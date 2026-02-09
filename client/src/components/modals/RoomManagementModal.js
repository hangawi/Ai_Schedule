/**
 * ===================================================================================================
 * RoomManagementModal.js - 조율방의 모든 것을 관리하는 복합 모달
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/RoomManagementModal.js
 *
 * 🎯 주요 기능:
 *    - 탭(Tab) 기반 인터페이스를 통해 조율방의 다양한 정보를 관리.
 *    - **방 정보 탭**: 방 이름, 설명, 운영 시간 등 기본 설정을 조회하고 수정. (방장만 수정 가능)
 *    - **AI 학습 탭**: 외부 AI 학습 시스템 페이지(교사, 대시보드)로 연결.
 *    - **로그 보기 탭**: 방에서 발생한 모든 활동 로그를 조회하고 카테고리별로 필터링. (방장만 초기화 가능)
 *    - **멤버 관리 탭**: 방에 속한 멤버 목록을 보여주고, 멤버 강퇴(방장) 또는 방 나가기(멤버) 기능 제공.
 *    - 현재 사용자가 방장인지(`isOwner`) 여부를 판별하여 특정 기능(방 삭제, 멤버 강퇴 등)에 대한 접근을 제어.
 *
 * 🔗 연결된 파일:
 *    - ./room/RoomInfoTab.js - '방 정보' 탭의 UI와 로직을 담당하는 하위 컴포넌트.
 *    - ./room/RoomMembersList.js - '멤버 관리' 탭의 UI와 로직을 담당하는 하위 컴포넌트.
 *    - ../../services/coordinationService.js, ../../services/userService.js 등 (간접적) - API 호출 로직.
 *
 * 💡 UI 위치:
 *    - '일정 맞추기' 탭에서 특정 조율방의 '관리' 버튼을 클릭했을 때 나타나는 팝업 모달.
 *
 * ✏️ 수정 가이드:
 *    - 새로운 관리 탭을 추가하려면 `render...Tab` 함수를 새로 만들고, 탭 버튼과 렌더링 영역에 조건부로 추가해야 합니다.
 *    - 방 정보 수정 로직을 변경하려면 `RoomInfoTab.js` 컴포넌트와 `handleUpdate` 함수를 확인해야 합니다.
 *    - 멤버 관련 액션(강퇴, 나가기) 로직을 변경하려면 `RoomMembersList.js`와 `removeMember`, `leaveRoom` 함수를 수정합니다.
 *
 * 📝 참고사항:
 *    - 이 모달은 하나의 컴포넌트가 여러 하위 컴포넌트와 API 호출 함수를 조합하여 복잡한 '관리' 기능을 수행하는 좋은 예시입니다.
 *    - 방장 권한 확인(`isOwner`) 로직이 여러 곳에 사용되므로, 권한 정책 변경 시 주의가 필요합니다.
 *
 * ===================================================================================================
 */
import React, { useState, useEffect } from "react";
import { X, Users, Settings, Trash2, GraduationCap, FileText } from "lucide-react";
import CustomAlertModal from './CustomAlertModal';
import RoomInfoTab from './room/RoomInfoTab';
import RoomMembersList from './room/RoomMembersList';
import { auth } from '../../config/firebaseConfig';
import { useToast } from '../../contexts/ToastContext';

/**
 * RoomManagementModal
 * @description 조율방의 정보, 멤버, 로그, AI 학습 등 모든 것을 관리하는 탭 기반의 종합 관리 모달.
 * @param {object} props - 컴포넌트 props
 * @param {object} props.room - 관리할 방의 데이터 객체.
 * @param {function} props.onClose - 모달을 닫는 함수.
 * @param {function} props.onRoomUpdated - 방 정보가 업데이트되었을 때 호출되는 콜백.
 * @param {function} props.updateRoom - 방 정보를 업데이트하는 API 호출 함수.
 * @param {function} props.deleteRoom - 방을 삭제하는 API 호출 함수.
 * @param {string} [props.defaultTab="info"] - 모달이 처음 열릴 때 기본으로 보여줄 탭.
 * @returns {JSX.Element}
 */
const RoomManagementModal = ({
  room,
  onClose,
  onRoomUpdated,
  updateRoom,
  deleteRoom,
  defaultTab = "info",
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: room?.name || "",
    description: room?.description || "",
    maxMembers: room?.maxMembers || 100,
    settings: {
      startHour: room?.settings?.startHour || 9,
      endHour: room?.settings?.endHour || 18,
      blockedTimes: room?.settings?.blockedTimes || [],
      roomExceptions: room?.settings?.roomExceptions || [],
    },
  });

  const [newBlockedTime, setNewBlockedTime] = useState({
    name: '',
    startTime: '12:00',
    endTime: '13:00'
  });

  // Get current user ID from Firebase auth
  const getCurrentUserId = () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return null;
      return currentUser.uid;
    } catch (error) {
      return null;
    }
  };

  // CustomAlert 상태
  const [customAlert, setCustomAlert] = useState({ show: false, message: '' });
  const showAlert = (message) => setCustomAlert({ show: true, message });
  const closeAlert = () => setCustomAlert({ show: false, message: '' });

  // 로그 관련 상태
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [activeLogTab, setActiveLogTab] = useState('all');

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

  // 방장인지 확인
  const currentUserId = getCurrentUserId();
  const roomOwnerId = typeof room?.ownerId === 'object' ? room?.ownerId?._id : room?.ownerId;
  const roomOwnerUid = room?.owner?.firebaseUid || room?.owner?.uid || room?.ownerId?.firebaseUid || room?.ownerId?.uid;
  const isOwner = roomOwnerId === currentUserId || roomOwnerUid === currentUserId;

  // 로그 조회
  const fetchLogs = async () => {
    try {
      setLogsLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${room._id}/logs`, {
        headers: {
          'Authorization': `Bearer ${await currentUser.getIdToken()}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || '로그를 불러올 수 없습니다.');
      }

      setLogs(data.logs);
    } catch (err) {
    } finally {
      setLogsLoading(false);
    }
  };

  // 로그 탭 선택 시 데이터 로드
  useEffect(() => {
    if (activeTab === 'logs' && logs.length === 0) {
      fetchLogs();
    }
  }, [activeTab]);

  // 로그 초기화
  const clearLogs = async () => {
    if (!window.confirm('로그를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }
    
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${room._id}/clear-logs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await currentUser.getIdToken()}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || '로그를 초기화할 수 없습니다.');
      }

      // 초기화 후 로그 목록 비우기
      setLogs([]);
      showToast('로그가 초기화되었습니다.');
    } catch (err) {
      showToast(err.message || '로그 초기화 중 오류가 발생했습니다.');
    }
  };

  const getActionLabel = (action) => {
    const labels = {
      auto_assign: '자동배정 실행',
      slot_request: '자리 요청',
      slot_yield: '자리 양보',
      slot_swap: '자리 변경',
      member_join: '멤버 입장',
      member_leave: '멤버 퇴장',
      member_kick: '멤버 강퇴',
      room_create: '방 생성',
      room_update: '방 설정 변경',
      schedule_update: '일정 수정',
      change_request: '변경 요청',
      change_approve: '변경 승인',
      change_reject: '변경 거절'
    };
    return labels[action] || action;
  };

  const getActionColor = (action) => {
    const colors = {
      auto_assign: 'bg-blue-100 text-blue-700',
      slot_request: 'bg-yellow-100 text-yellow-700',
      slot_yield: 'bg-green-100 text-green-700',
      slot_swap: 'bg-purple-100 text-purple-700',
      member_join: 'bg-green-100 text-green-700',
      member_leave: 'bg-red-100 text-red-700',
      member_kick: 'bg-red-100 text-red-700',
      room_create: 'bg-indigo-100 text-indigo-700',
      room_update: 'bg-cyan-100 text-cyan-700',
      schedule_update: 'bg-pink-100 text-pink-700',
      change_request: 'bg-blue-100 text-blue-700',
      change_approve: 'bg-green-100 text-green-700',
      change_reject: 'bg-red-100 text-red-700'
    };
    return colors[action] || 'bg-gray-100 text-gray-700';
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleUpdate = async () => {
    try {
      const updatedRoom = await updateRoom(room._id, formData);
      setIsEditing(false);
      onRoomUpdated(updatedRoom);
      showAlert('방 정보가 성공적으로 업데이트되었습니다.');
    } catch (error) {
      showAlert(`방 정보 업데이트 실패: ${error.message}`);
    }
  };

  const handleDelete = async () => {
    if (
      window.confirm(
        "정말로 이 방을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
      )
    ) {
      try {
        await deleteRoom(room._id);
        onClose();
      } catch (error) {
        // Failed to delete room - silently handle error
      }
    }
  };

  const copyInviteCode = () => {
    navigator.clipboard.writeText(room.inviteCode);
    showAlert("초대 코드가 클립보드에 복사되었습니다!");
  };

  const removeMember = async (memberId) => {
    if (window.confirm("이 멤버를 방에서 제거하시겠습니까?")) {
      try {
        const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
        const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${room._id}/members/${memberId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.msg || 'Failed to remove member');
        }

        const result = await response.json();
        onRoomUpdated(result.room);

        if (result.removedMember) {
          showAlert(`${result.removedMember.name}님이 방에서 강퇴되었습니다. 해당 멤버에게 알림이 전송되었습니다.`);
        } else {
          showAlert("조원이 성공적으로 제거되었습니다.");
        }
      } catch (error) {
        // Failed to remove member - silently handle error
        showAlert(`조원 제거 실패: ${error.message}`);
      }
    }
  };

  const leaveRoom = async () => {
    if (window.confirm("정말로 이 방을 나가시겠습니까? 배정된 모든 시간이 삭제됩니다.")) {
      try {
        const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
        const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${room._id}/leave`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.msg || 'Failed to leave room');
        }

        const result = await response.json();
        showAlert("방에서 나갔습니다.");

        // Close modal and trigger room list refresh
        setTimeout(() => {
          onClose();
          // Dispatch custom event to refresh room list
          window.dispatchEvent(new CustomEvent('roomListChanged'));
        }, 1500);

      } catch (error) {
        showAlert(`방 나가기 실패: ${error.message}`);
      }
    }
  };

  const renderInfoTab = () => (
    <RoomInfoTab
      room={room}
      isEditing={isEditing}
      setIsEditing={setIsEditing}
      formData={formData}
      setFormData={setFormData}
      newBlockedTime={newBlockedTime}
      setNewBlockedTime={setNewBlockedTime}
      handleUpdate={handleUpdate}
      handleDelete={handleDelete}
      copyInviteCode={copyInviteCode}
      showAlert={showAlert}
    />
  );

  const renderMembersTab = () => (
    <RoomMembersList
      room={room}
      removeMember={removeMember}
      leaveRoom={leaveRoom}
      currentUserId={getCurrentUserId()}
      isOwner={isOwner}
    />
  );

  const renderAILearningTab = () => (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-xl border border-purple-200">
        <div className="flex items-center gap-3 mb-4">
          <GraduationCap size={28} className="text-purple-600" />
          <h3 className="text-xl font-bold text-gray-800">AI 학습 시스템</h3>
        </div>
        <p className="text-gray-600 mb-6">
          AI 기반 맞춤형 학습 문제를 생성하고 학습 통계를 확인할 수 있습니다.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => window.open('/nview/content/bingo/teacher/ai_demo_nview.html', '_blank', 'width=1400,height=900')}
            className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 font-semibold shadow-lg transition-all transform hover:scale-105 flex flex-col items-center gap-2"
          >
            <GraduationCap size={24} />
            <span>교사 페이지 열기</span>
            <span className="text-xs opacity-90">문제 생성 및 관리</span>
          </button>

          <button
            onClick={() => window.open('/nview/content/bingo/teacher/dashboard.html', '_blank', 'width=1400,height=900')}
            className="px-6 py-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 font-semibold shadow-lg transition-all transform hover:scale-105 flex flex-col items-center gap-2"
          >
            <Settings size={24} />
            <span>대시보드 열기</span>
            <span className="text-xs opacity-90">학습 통계 확인</span>
          </button>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
          💡 사용 방법
        </h4>
        <ol className="text-sm text-yellow-700 space-y-1 ml-4 list-decimal">
          <li>교사 페이지에서 학생별 AI 문제를 생성하고 전송합니다</li>
          <li>학생들이 문제를 풀면 자동으로 채점됩니다</li>
          <li>대시보드에서 학생별 학습 통계를 확인할 수 있습니다</li>
        </ol>
      </div>
    </div>
  );

  const renderLogsTab = () => {
    // 선택된 탭에 따라 로그 필터링
    let filteredLogs = logs;
    if (activeLogTab === 'auto_assign') {
      filteredLogs = logs.filter(log => log.action === 'auto_assign');
    } else if (activeLogTab === 'member') {
      filteredLogs = logs.filter(log => ['member_join', 'member_leave', 'member_kick'].includes(log.action));
    } else if (activeLogTab === 'slot') {
      filteredLogs = logs.filter(log => ['slot_request', 'slot_yield', 'slot_swap'].includes(log.action));
    } else if (activeLogTab === 'change') {
      filteredLogs = logs.filter(log => ['change_request', 'change_approve', 'change_reject'].includes(log.action));
    }

    return (
      <div className="space-y-4">
        {/* 탭 버튼 */}
        <div className="flex gap-2 overflow-x-auto pb-2 border-b">
          <button
            onClick={() => setActiveLogTab('all')}
            className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
              activeLogTab === 'all'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            전체 ({logs.length})
          </button>
          <button
            onClick={() => setActiveLogTab('member')}
            className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
              activeLogTab === 'member'
                ? 'bg-green-600 text-white shadow-md border-2 border-green-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            멤버 활동 ({logs.filter(log => ['member_join', 'member_leave', 'member_kick'].includes(log.action)).length})
          </button>
          <button
            onClick={() => setActiveLogTab('auto_assign')}
            className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
              activeLogTab === 'auto_assign'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            자동배정 ({logs.filter(log => log.action === 'auto_assign').length})
          </button>
          <button
            onClick={() => setActiveLogTab('change')}
            className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
              activeLogTab === 'change'
                ? 'bg-purple-600 text-white shadow-md border-2 border-purple-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            변경 요청 ({logs.filter(log => ['change_request', 'change_approve', 'change_reject'].includes(log.action)).length})
          </button>
          <button
            onClick={() => setActiveLogTab('slot')}
            className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
              activeLogTab === 'slot'
                ? 'bg-indigo-600 text-white shadow-md border-2 border-indigo-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            자리 관리 ({logs.filter(log => ['slot_request', 'slot_yield', 'slot_swap'].includes(log.action)).length})
          </button>
        </div>

        {/* 로그 목록 */}
        <div className="overflow-y-auto" style={{ minHeight: '400px', maxHeight: '400px' }}>
          {logsLoading ? (
            <div className="flex items-center justify-center" style={{ minHeight: '380px' }}>
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                <p className="mt-4 text-gray-500">로딩 중...</p>
              </div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center text-gray-500" style={{ minHeight: '380px' }}>
              {logs.length === 0 ? '활동 로그가 없습니다.' : '이 카테고리에 로그가 없습니다.'}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => (
                <div key={log._id} className="flex gap-3 p-4 bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex-shrink-0">
                    <span className={`inline-block px-3 py-1.5 text-xs font-semibold rounded-lg ${getActionColor(log.action)}`}>
                      {getActionLabel(log.action)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-800">
                      {log.userName}
                    </div>
                    {log.details && (
                      <div className="text-sm text-gray-600 mt-1">
                        {log.details}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-1.5">
                      {formatDateTime(log.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-200">
        <div className="flex justify-between items-center p-5 border-b bg-slate-50">
          <h2 className="text-xl font-bold text-gray-800">
            방 관리: <span className="text-blue-600">{room?.name || ""}</span>
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200"
          >
            <X size={22} />
          </button>
        </div>

        {/* 탭 버튼들 → 버튼답게 스타일 */}
        <div className="flex border-b bg-white">
          <button
            onClick={() => setActiveTab("info")}
            className={`flex-1 px-4 py-3 font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
              activeTab === "info"
                ? "border-b-2 border-blue-500 text-blue-600 bg-blue-50 shadow-inner"
                : "text-gray-500 hover:text-blue-600 hover:bg-slate-50"
            }`}
          >
            <Settings size={16} /> 방 정보
          </button>
          <button
            onClick={() => setActiveTab("ai-learning")}
            className={`flex-1 px-4 py-3 font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
              activeTab === "ai-learning"
                ? "border-b-2 border-purple-500 text-purple-600 bg-purple-50 shadow-inner"
                : "text-gray-500 hover:text-purple-600 hover:bg-slate-50"
            }`}
          >
            <GraduationCap size={16} /> AI 학습
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`flex-1 px-4 py-3 font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
              activeTab === "logs"
                ? "border-b-2 border-yellow-500 text-yellow-600 bg-yellow-50 shadow-inner"
                : "text-gray-500 hover:text-yellow-600 hover:bg-slate-50"
            }`}
          >
            <FileText size={16} /> 로그 보기
          </button>
          <button
            onClick={() => setActiveTab("members")}
            className={`flex-1 px-4 py-3 font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
              activeTab === "members"
                ? "border-b-2 border-blue-500 text-blue-600 bg-blue-50 shadow-inner"
                : "text-gray-500 hover:text-blue-600 hover:bg-slate-50"
            }`}
          >
            <Users size={16} /> 멤버 관리 ({room.members?.length || 0})
          </button>
        </div>

        <div className="p-6 overflow-y-auto bg-white">
          {activeTab === "info" && renderInfoTab()}
          {activeTab === "ai-learning" && renderAILearningTab()}
          {activeTab === "logs" && renderLogsTab()}
          {activeTab === "members" && renderMembersTab()}
        </div>

        <div className="border-t p-4 flex justify-between items-center bg-slate-50">
          <div>
            {activeTab === "info" && (
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center gap-2 text-sm shadow-sm"
              >
                <Trash2 size={16} /> 방 삭제
              </button>
            )}
            {activeTab === "logs" && (
              <button
                onClick={clearLogs}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium text-sm"
              >
                초기화
              </button>
            )}
          </div>
          <div className="flex space-x-3">
            {activeTab === "info" && isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
                >
                  취소
                </button>
                <button
                  onClick={handleUpdate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm"
                >
                  변경사항 저장
                </button>
              </>
            ) : activeTab === "info" && !isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm flex items-center gap-2"
              >
                <Settings size={16} /> 정보 수정
              </button>
            ) : null}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
            >
              닫기
            </button>
          </div>
        </div>

        {/* CustomAlert Modal */}
        <CustomAlertModal
          show={customAlert.show}
          onClose={closeAlert}
          message={customAlert.message}
        />
      </div>
    </div>
  );
};

export default RoomManagementModal;
