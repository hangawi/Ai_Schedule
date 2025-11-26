import React, { useState, useEffect } from 'react';
import { X, FileText, User, Trash2 } from 'lucide-react';
import { auth } from '../../config/firebaseConfig';

const MemberLogsModal = ({ roomId, memberId, memberName, onClose, isAdmin = false }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeLogTab, setActiveLogTab] = useState('all');

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
      console.error('Fetch member logs error:', err);
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
    if (!window.confirm(`정말로 ${memberName}님의 모든 활동 로그를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

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

      alert(data.msg);
      await fetchMemberLogs(); // Refresh logs
    } catch (err) {
      console.error('Clear member logs error:', err);
      alert(err.message || '로그 삭제 중 오류가 발생했습니다.');
    }
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
    </div>
  );
};

export default MemberLogsModal;
