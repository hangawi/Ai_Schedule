/**
 * ===================================================================================================
 * MemberLogsModal.js - 특정 멤버의 활동 로그를 보여주는 모달
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/MemberLogsModal.js
 *
 * 🎯 주요 기능:
 *    - 조율방 내 특정 멤버의 모든 활동 기록을 서버에서 가져와 표시.
 *    - '전체', '멤버 활동', '자동배정', '변경 요청', '자리 관리' 등 탭을 통해 로그를 종류별로 필터링.
 *    - 각 로그 항목의 종류(action)에 따라 다른 색상의 라벨을 부여하여 가시성을 높임.
 *    - 로딩 및 데이터가 없을 경우에 대한 UI 상태를 처리.
 *    - (관리자/방장 권한) 특정 멤버의 모든 로그를 삭제하는 기능 제공.
 *
 * 🔗 연결된 파일:
 *    - ./CoordinationTab.js (추정) - 멤버 목록에서 특정 멤버의 로그를 보려고 할 때 이 모달을 호출.
 *    - ../../config/firebaseConfig.js - API 요청 시 사용자 인증 토큰을 얻기 위해 사용.
 *
 * 💡 UI 위치:
 *    - '일정 맞추기' 탭의 멤버 목록 등에서 특정 멤버의 활동 기록을 보고자 할 때 나타나는 팝업 모달.
 *
 * ✏️ 수정 가이드:
 *    - 새로운 로그 종류(action)를 추가하려면 `getActionLabel`, `getActionColor` 함수에 새로운 case를 추가해야 합니다.
 *    - 로그 필터링 탭을 추가/수정하려면 `filteredLogs`를 계산하는 로직과 JSX의 탭 버튼 부분을 수정합니다.
 *    - 로그 삭제 API 엔드포인트가 변경되면 `clearMemberLogs` 함수를 수정해야 합니다.
 *
 * 📝 참고사항:
 *    - `isAdmin` prop 값에 따라 로그를 가져오고 삭제하는 API 경로가 동적으로 변경됩니다.
 *    - 현재 구현은 방의 모든 로그를 가져온 후 클라이언트 측에서 특정 멤버의 로그를 필터링하는 방식입니다.
 *      (성능 개선을 위해 향후 서버에서 필터링된 데이터를 직접 받아오는 방식으로 변경될 수 있음)
 *
 * ===================================================================================================
 */
import React, { useState, useEffect } from 'react';
import { X, FileText, User, Trash2 } from 'lucide-react';
import { auth } from '../../config/firebaseConfig';
import { useToast } from '../../contexts/ToastContext';
import CustomAlertModal from './CustomAlertModal';

/**
 * MemberLogsModal
 * @description 특정 멤버의 활동 로그를 카테고리별로 필터링하여 보여주고, 로그를 삭제할 수 있는 관리 기능을 제공하는 모달.
 * @param {object} props - 컴포넌트 props
 * @param {string} props.roomId - 현재 조율방의 ID.
 * @param {string} props.memberId - 로그를 조회할 멤버의 ID.
 * @param {string} props.memberName - 로그를 조회할 멤버의 이름.
 * @param {function} props.onClose - 모달을 닫는 함수.
 * @param {boolean} [props.isAdmin=false] - 관리자 모드 여부. API 경로 분기에 사용됨.
 * @returns {JSX.Element}
 */
const MemberLogsModal = ({ roomId, memberId, memberName, onClose, isAdmin = false }) => {
  const { showToast } = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeLogTab, setActiveLogTab] = useState('all');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

  useEffect(() => {
    fetchMemberLogs();
  }, [roomId, memberId]);

  const fetchMemberLogs = async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      // 관리자면 admin API, 아니면 coordination API 사용
      const apiPath = isAdmin
        ? `${API_BASE_URL}/api/admin/rooms/${roomId}/logs`
        : `${API_BASE_URL}/api/coordination/rooms/${roomId}/logs`;

      const response = await fetch(apiPath, {
        headers: {
          'Authorization': `Bearer ${await currentUser.getIdToken()}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || '로그를 불러올 수 없습니다.');
      }

      // 해당 멤버와 관련된 로그만 필터링
      // userId가 memberId와 일치하는 로그만 가져옴
      const memberLogs = data.logs.filter(log => log.userId === memberId);
      setLogs(memberLogs);
    } catch (err) {
    } finally {
      setLoading(false);
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

  const clearMemberLogs = async () => {
    setConfirmModal({
      isOpen: true,
      title: '활동 로그 삭제',
      message: `정말로 ${memberName}님의 모든 활동 로그를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`,
      onConfirm: async () => {
        try {
          const currentUser = auth.currentUser;
          if (!currentUser) return;

          const apiPath = isAdmin
            ? `${API_BASE_URL}/api/admin/rooms/${roomId}/logs/user/${memberId}`
            : `${API_BASE_URL}/api/coordination/rooms/${roomId}/logs/user/${memberId}`;

          const response = await fetch(apiPath, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${await currentUser.getIdToken()}`
            }
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.msg || '로그 삭제 실패');
          }

          showToast(data.msg);
          await fetchMemberLogs(); // Refresh logs
        } catch (err) {
          showToast(err.message || '로그 삭제 중 오류가 발생했습니다.');
        }
      }
    });
  };

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white">
              <User size={20} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">{memberName}님의 활동 로그</h3>
              <p className="text-sm text-gray-500">총 {logs.length}개의 활동 기록</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearMemberLogs}
              className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 transition-colors"
              title="로그 초기화"
            >
              <Trash2 size={20} />
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* 탭 버튼 */}
        <div className="flex gap-2 px-5 pt-4 pb-2 overflow-x-auto border-b bg-white">
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
                ? 'bg-green-600 text-white shadow-md'
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
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            변경 요청 ({logs.filter(log => ['change_request', 'change_approve', 'change_reject'].includes(log.action)).length})
          </button>
          <button
            onClick={() => setActiveLogTab('slot')}
            className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
              activeLogTab === 'slot'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            자리 관리 ({logs.filter(log => ['slot_request', 'slot_yield', 'slot_swap'].includes(log.action)).length})
          </button>
        </div>

        {/* 로그 목록 */}
        <div className="flex-1 overflow-y-auto p-5" style={{ minHeight: '400px', maxHeight: '560px' }}>
          {loading ? (
            <div className="flex items-center justify-center" style={{ minHeight: '380px' }}>
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                <p className="mt-4 text-gray-500">로딩 중...</p>
              </div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-gray-500" style={{ minHeight: '380px' }}>
              <FileText size={48} className="text-gray-300 mb-4" />
              <p className="text-lg font-medium">
                {logs.length === 0 ? '활동 로그가 없습니다.' : '이 카테고리에 로그가 없습니다.'}
              </p>
              <p className="text-sm mt-2">
                {logs.length === 0 ? '이 멤버는 아직 활동한 기록이 없습니다.' : '다른 카테고리를 선택해보세요.'}
              </p>
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

        <div className="border-t p-4 flex justify-end bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
          >
            닫기
          </button>
        </div>
      </div>

      <CustomAlertModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type="warning"
        showCancel={true}
        confirmText="확인"
        cancelText="취소"
      />
    </div>
  );
};

export default MemberLogsModal;
