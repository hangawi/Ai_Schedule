/**
 * ===================================================================================================
 * SuggestionModal.js - AI 일정 제안 관리 모달
 * ===================================================================================================
 *
 * 설명: 채팅방의 AI 일정 제안들을 지난/오늘/미래로 분류하여 보여주고 개인별 참석/불참 응답 관리
 *
 * 기능:
 * - 지난 약속, 오늘 약속, 미래 약속 탭 전환
 * - 멤버별 응답 상태 표시 (pending/accepted/rejected)
 * - 개인별 [참석]/[불참] 버튼
 * - 실시간 업데이트 (Socket.io suggestion-updated 이벤트)
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../../contexts/ToastContext';
import { X, Calendar, Clock, MapPin, Users, Check, XCircle, Trash2 } from 'lucide-react';
import { auth } from '../../config/firebaseConfig';
import { io } from 'socket.io-client';
import ScheduleDetailModal from './ScheduleDetailModal';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const SuggestionModal = ({ isOpen, onClose, roomId, socket: externalSocket, isMobile }) => {
  const { showToast } = useToast();
  const [ownSocket, setOwnSocket] = useState(null);
  const socketRef = useRef(null);

  // 외부 소켓이 제공되지 않으면 자체 생성
  useEffect(() => {
    if (isOpen && !externalSocket) {
      const newSocket = io(API_BASE_URL, { transports: ['websocket', 'polling'] });
      socketRef.current = newSocket;

      newSocket.on('connect', () => {
        newSocket.emit('join-room', roomId);
      });

      setOwnSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }
  }, [isOpen, roomId, externalSocket]);

  // 사용할 소켓 결정
  const socket = externalSocket || ownSocket;
  const [activeTab, setActiveTab] = useState('future'); // 'past' | 'today' | 'future'
  const [suggestions, setSuggestions] = useState({
    past: [],
    today: [],
    future: []
  });
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null); // 🆕 사용자 전체 프로필 (주소 포함)
  const [selectedSuggestion, setSelectedSuggestion] = useState(null); // 🆕 상세 모달용
  const [conflictModal, setConflictModal] = useState(null); // 🆕 충돌 확인 모달

  // 현재 사용자 정보 가져오기 (email로 비교)
  useEffect(() => {
    if (isOpen && auth.currentUser) {
      setCurrentUser({
        _id: auth.currentUser.uid,
        email: auth.currentUser.email
      });

      // 🆕 사용자 전체 프로필 가져오기 (주소 포함)
      fetchUserProfile();
    }
  }, [isOpen]);

  // 🆕 사용자 프로필 가져오기
  const fetchUserProfile = async () => {
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUserProfile(data);
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    }
  };

  // 제안 목록 불러오기
  useEffect(() => {
    if (isOpen) {
      fetchSuggestions();
    }
  }, [isOpen, roomId]);

  // Socket 실시간 업데이트 구독
  useEffect(() => {
    if (!socket || !isOpen) return;

    const handleSuggestionUpdated = (data) => {
      console.log('🔄 Suggestion updated:', data);
      // 실시간 업데이트 - 해당 제안 찾아서 교체
      setSuggestions((prev) => {
        const updatedSuggestions = { ...prev };

        // 모든 카테고리에서 해당 제안 찾기
        for (const category of ['past', 'today', 'future']) {
          const index = updatedSuggestions[category].findIndex(
            (s) => s._id === data.suggestionId
          );

          if (index !== -1) {
            // 기존 제안 업데이트 (memberResponses + suggestedBy 소유권 이전 반영)
            updatedSuggestions[category][index] = {
              ...updatedSuggestions[category][index],
              memberResponses: data.memberResponses,
              ...(data.suggestedBy !== undefined && { suggestedBy: data.suggestedBy })
            };
            break;
          }
        }

        return updatedSuggestions;
      });
    };

    const handleSuggestionDeleted = (data) => {
      console.log('🗑️ Suggestion deleted:', data);
      // 삭제된 제안을 목록에서 제거
      setSuggestions((prev) => {
        const updated = { ...prev };
        for (const category of ['past', 'today', 'future']) {
          updated[category] = updated[category].filter(
            (s) => s._id !== data.suggestionId
          );
        }
        return updated;
      });
    };

    socket.on('suggestion-updated', handleSuggestionUpdated);
    socket.on('suggestion-deleted', handleSuggestionDeleted);

    // 🆕 충돌 확인 필요 이벤트
    const handleConflictConfirmation = (data) => {
      console.log('⚠️ Conflict confirmation needed:', data);
      // 현재 사용자에게만 모달 표시
      if (userProfile && data.targetUserId === userProfile._id) {
        setConflictModal(data);
      }
    };
    socket.on('conflict-confirmation-needed', handleConflictConfirmation);

    return () => {
      socket.off('suggestion-updated', handleSuggestionUpdated);
      socket.off('suggestion-deleted', handleSuggestionDeleted);
      socket.off('conflict-confirmation-needed', handleConflictConfirmation);
    };
  }, [socket, isOpen]);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();

      // 세 가지 상태 모두 가져오기
      const [pastRes, todayRes, futureRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/chat/${roomId}/suggestions?status=past`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE_URL}/api/chat/${roomId}/suggestions?status=today`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE_URL}/api/chat/${roomId}/suggestions?status=future`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const past = await pastRes.json();
      const today = await todayRes.json();
      const future = await futureRes.json();

      setSuggestions({ past, today, future });
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (suggestionId) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/chat/${roomId}/suggestions/${suggestionId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        fetchSuggestions();
        window.dispatchEvent(new CustomEvent('suggestionUpdate', { detail: { roomId } }));
      } else {
        const error = await res.json();
        showToast(error.message || '일정 추가에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to accept suggestion:', error);
      showToast('일정 추가 중 오류가 발생했습니다.');
    }
  };

  const handleReject = async (suggestionId) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/chat/${roomId}/suggestions/${suggestionId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        if (data.action === 'deleted') {
          showToast('일정이 삭제되었습니다.');
        } else {
          showToast('불참 처리되었습니다.');
        }
        fetchSuggestions();
        window.dispatchEvent(new CustomEvent('calendarUpdate', { detail: { type: 'suggestion_rejected' } }));
        window.dispatchEvent(new CustomEvent('suggestionUpdate', { detail: { roomId } }));
      } else {
        const error = await res.json();
        showToast(error.message || '일정 거절에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to reject suggestion:', error);
      showToast('일정 거절 중 오류가 발생했습니다.');
    }
  };

  // 🆕 강제 참석 (충돌 무시)
  const handleForceAccept = async (suggestionId) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/chat/${roomId}/suggestions/${suggestionId}/force-accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        console.log('✅ Force accepted suggestion:', data);
        setConflictModal(null);
        fetchSuggestions();
        window.dispatchEvent(new CustomEvent('suggestionUpdate', { detail: { roomId } }));
      } else {
        const error = await res.json();
        showToast(error.message || '참석 처리에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to force accept suggestion:', error);
      showToast('참석 처리 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (suggestionId) => {
    if (!window.confirm('정말로 이 일정 제안을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/chat/${roomId}/suggestions/${suggestionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        console.log('🗑️ Deleted suggestion:', suggestionId);
        fetchSuggestions();
        window.dispatchEvent(new CustomEvent('suggestionUpdate', { detail: { roomId } }));
      } else {
        const error = await res.json();
        showToast(error.message || '일정 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to delete suggestion:', error);
      showToast('일정 삭제 중 오류가 발생했습니다.');
    }
  };

  // 현재 사용자가 제안자인지 확인 (email로 비교)
  const isOwner = (suggestion) => {
    if (!currentUser?.email) return false;
    // 제안자가 있으면 제안자만 삭제 가능
    if (suggestion.suggestedBy) {
      const suggestedByEmail = suggestion.suggestedBy.email;
      return suggestedByEmail === currentUser.email;
    }
    // 제안자가 나간 경우 (suggestedBy === null): rejected가 아닌 멤버면 삭제 가능
    const isActiveMember = suggestion.memberResponses?.some(
      r => r.user?.email === currentUser.email && r.status === 'accepted'
    );
    return !!isActiveMember;
  };

  // 현재 사용자의 응답 상태 확인 (email로 비교)
  const getUserResponse = (suggestion) => {
    if (!currentUser?.email) return null;
    return suggestion.memberResponses?.find(
      (r) => r.user?.email === currentUser.email
    );
  };

  // 응답 통계 계산
  const getResponseStats = (suggestion) => {
    const total = suggestion.memberResponses?.length || 0;
    const accepted = suggestion.memberResponses?.filter((r) => r.status === 'accepted').length || 0;
    const rejected = suggestion.memberResponses?.filter((r) => r.status === 'rejected').length || 0;
    const pending = suggestion.memberResponses?.filter((r) => r.status === 'pending').length || 0;
    // 자동 불참 (일정 충돌)
    const autoRejected = suggestion.memberResponses?.filter((r) => r.isAutoRejected === true).length || 0;

    return { total, accepted, rejected, pending, autoRejected };
  };

  // 제안 시간 포맷 함수
  const formatSuggestionTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  };

  // 제안 카드 렌더링
  const renderSuggestion = (suggestion) => {
    const userResponse = getUserResponse(suggestion);
    const stats = getResponseStats(suggestion);
    const canDelete = isOwner(suggestion);

    return (
      <div key={suggestion._id} className="bg-white border border-gray-200 rounded-lg p-4 mb-3 shadow-sm relative">
        {/* 제안 시간 (오른쪽 상단) */}
        {suggestion.createdAt && (
          <div className="absolute top-2 right-3 text-xs text-gray-400">
            {formatSuggestionTime(suggestion.createdAt)}
          </div>
        )}

        {/* 제안 정보 */}
        <div className="mb-3">
          <div className="flex items-start justify-between mb-2 pr-16">
            <div
              className="flex-1 cursor-pointer hover:bg-gray-50 -m-2 p-2 rounded transition-colors"
              onClick={() => setSelectedSuggestion(suggestion)}
              title="클릭하여 상세보기"
            >
              <h3 className="text-lg font-bold text-gray-800">{suggestion.summary}</h3>
              {suggestion.suggestedBy && (
                <p className="text-xs text-gray-500 mt-0.5">
                  제안자: {suggestion.suggestedBy.firstName} {suggestion.suggestedBy.lastName}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {userResponse && (
                <span
                  className={`px-2 py-1 text-xs rounded-full font-medium ${
                    userResponse.status === 'accepted'
                      ? 'bg-green-100 text-green-700'
                      : userResponse.status === 'rejected'
                      ? 'bg-red-100 text-red-700'
                      : activeTab === 'past'
                      ? 'bg-gray-100 text-gray-600'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {userResponse.status === 'accepted'
                    ? '참석'
                    : userResponse.status === 'rejected'
                    ? '불참'
                    : activeTab === 'past'
                    ? '종료됨'
                    : '대기중'}
                </span>
              )}
              {canDelete && (
                <button
                  onClick={() => handleDelete(suggestion._id)}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  title="삭제 (제안자만 가능)"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>

          <div
            className="space-y-1 text-sm text-gray-600 cursor-pointer hover:bg-gray-50 -m-2 p-2 rounded transition-colors"
            onClick={() => setSelectedSuggestion(suggestion)}
            title="클릭하여 지도 및 경로 보기"
          >
            <div className="flex items-center gap-2">
              <Calendar size={14} />
              <span>{suggestion.date}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={14} />
              <span>{suggestion.startTime} ~ {suggestion.endTime}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin size={14} className={suggestion.location ? 'text-blue-500' : ''} />
              <span className={suggestion.location ? 'text-blue-600 font-medium' : 'text-gray-400'}>
                {suggestion.location || '미정'}
              </span>
            </div>
            {suggestion.location && (
              <p className="text-xs text-blue-500 ml-5">📍 지도 및 대중교통 경로 보기</p>
            )}
            {/* 외부 참여자 표시 */}
            {suggestion.externalParticipants?.length > 0 && (
              <div className="flex items-center gap-2 mt-1">
                <Users size={14} className="text-purple-500" />
                <span className="text-purple-600 font-medium">
                  {suggestion.externalParticipants.map(p => p.name).join(', ')} ({suggestion.externalParticipants.length}명)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 응답 통계 */}
        <div className="mb-3 pb-3 border-b border-gray-200">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Users size={14} />
            <span>총 {stats.total}명</span>
            <span className="text-green-600">✓ {stats.accepted}</span>
            <span className="text-red-600">✗ {stats.rejected}</span>
            <span className="text-yellow-600">⏳ {stats.pending}</span>
          </div>
        </div>

        {/* 멤버별 응답 상태 */}
        <div className="mb-3">
          <div className="flex flex-wrap gap-2">
            {suggestion.memberResponses?.map((response, idx) => (
              <div
                key={`member-${idx}`}
                className={`px-2 py-1 text-xs rounded border ${
                  response.status === 'accepted'
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : response.isAutoRejected
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : response.status === 'rejected'
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-gray-50 border-gray-200 text-gray-600'
                }`}
                title={response.isAutoRejected ? '일정 충돌로 자동 불참' : ''}
              >
                {response.user.firstName} {response.user.lastName}
                {response.status === 'accepted' && ' ✓'}
                {response.isAutoRejected && <XCircle size={12} className="inline ml-1" />}
                {response.status === 'rejected' && !response.isAutoRejected && ' ✗'}
              </div>
            ))}
          </div>
        </div>

        {/* 참석/불참 버튼 (pending 상태이고 미래/오늘 약속일 때만) */}
        {userResponse?.status === 'pending' && (activeTab === 'future' || activeTab === 'today') && (
          <div className="flex gap-2">
            <button
              onClick={() => handleAccept(suggestion._id)}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-1"
            >
              <Check size={16} /> 참석
            </button>
            <button
              onClick={() => handleReject(suggestion._id)}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-1"
            >
              <XCircle size={16} /> 불참
            </button>
          </div>
        )}

        {/* 자동 불참된 경우 - 참석 변경 버튼 표시 */}
        {userResponse?.isAutoRejected && (activeTab === 'future' || activeTab === 'today') && (
          <div className="space-y-2">
            <div className="text-center text-sm text-red-600 font-medium flex items-center justify-center gap-1">
              <XCircle size={14} /> 해당 시간에 일정이 있어 자동 불참 처리되었습니다
            </div>
            <button
              onClick={() => handleAccept(suggestion._id)}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-1"
            >
              <Check size={16} /> 참석으로 변경
            </button>
          </div>
        )}

        {/* 이미 응답한 경우 (수동 응답) - 변경 버튼 추가 */}
        {userResponse && userResponse.status !== 'pending' && !userResponse.isAutoRejected && (activeTab === 'future' || activeTab === 'today') && (
          <div className="space-y-2">
            <div className="text-center text-sm text-gray-500">
              {userResponse.status === 'accepted' ? '참석으로 응답하셨습니다' : '불참으로 응답하셨습니다'}
            </div>
            <button
              onClick={() => userResponse.status === 'accepted' ? handleReject(suggestion._id) : handleAccept(suggestion._id)}
              className={`w-full px-4 py-2 rounded-lg transition-colors font-medium flex items-center justify-center gap-1 ${
                userResponse.status === 'accepted' 
                  ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {userResponse.status === 'accepted' ? (
                <><XCircle size={16} /> 불참으로 변경</>
              ) : (
                <><Check size={16} /> 참석으로 변경</>
              )}
            </button>
          </div>
        )}
        {/* 지난 약속은 변경 버튼 없이 상태만 표시 */}
        {userResponse && userResponse.status !== 'pending' && !userResponse.isAutoRejected && activeTab === 'past' && (
          <div className="text-center text-sm text-gray-500">
            {userResponse.status === 'accepted' ? '참석으로 응답하셨습니다' : '불참으로 응답하셨습니다'}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className={`bg-white rounded-xl shadow-2xl flex flex-col ${
          isMobile ? 'w-full h-full' : 'w-full max-w-2xl max-h-[80vh]'
        }`}
      >
        {/* 헤더 */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">일정 관리</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('future')}
            className={`flex-1 px-4 py-3 font-medium transition-colors ${
              activeTab === 'future'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            미래 약속 ({suggestions.future.length})
          </button>
          <button
            onClick={() => setActiveTab('today')}
            className={`flex-1 px-4 py-3 font-medium transition-colors ${
              activeTab === 'today'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            오늘 약속 ({suggestions.today.length})
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`flex-1 px-4 py-3 font-medium transition-colors ${
              activeTab === 'past'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            지난 약속 ({suggestions.past.length})
          </button>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">로딩 중...</div>
          ) : suggestions[activeTab].length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {activeTab === 'future' && '미래 약속이 없습니다.'}
              {activeTab === 'today' && '오늘 약속이 없습니다.'}
              {activeTab === 'past' && '지난 약속이 없습니다.'}
            </div>
          ) : (
            <div>{suggestions[activeTab].map(renderSuggestion)}</div>
          )}
        </div>
      </div>

      {/* 🆕 상세 모달 */}
      <ScheduleDetailModal
        isOpen={!!selectedSuggestion}
        onClose={() => setSelectedSuggestion(null)}
        suggestion={selectedSuggestion}
        userAddress={userProfile?.address}
      />

      {/* 🆕 충돌 확인 모달 - Portal로 body에 렌더링 */}
      {conflictModal && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: '16px',
            isolation: 'isolate'
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" style={{ position: 'relative', zIndex: 1000000 }}>
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">⚠️</span>
              </div>
              <h3 className="text-lg font-bold text-gray-800">기존 일정이 있습니다</h3>
            </div>

            {/* 충돌하는 일정 목록 */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-700 font-medium mb-2">충돌하는 일정:</p>
              {conflictModal.conflicts?.map((conflict, idx) => (
                <div key={idx} className="text-sm text-red-600 flex items-center gap-2 py-1">
                  <Clock size={14} />
                  <span>{conflict.title} ({conflict.time})</span>
                </div>
              ))}
            </div>

            {/* 새 일정 정보 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-700 font-medium mb-2">참석하려는 일정:</p>
              <div className="text-sm text-blue-600">
                <div className="flex items-center gap-2 py-1">
                  <Calendar size={14} />
                  <span>{conflictModal.suggestion?.date}</span>
                </div>
                <div className="flex items-center gap-2 py-1">
                  <Clock size={14} />
                  <span>{conflictModal.suggestion?.startTime} ~ {conflictModal.suggestion?.endTime}</span>
                </div>
                <div className="font-medium mt-1">{conflictModal.suggestion?.summary}</div>
              </div>
            </div>

            <p className="text-sm text-gray-600 text-center mb-4">
              기존 일정과 시간이 겹칩니다.<br />
              그래도 참석하시겠습니까?
            </p>

            {/* 버튼 */}
            <div className="flex gap-3">
              <button
                onClick={() => setConflictModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                취소
              </button>
              <button
                onClick={() => handleForceAccept(conflictModal.suggestionId)}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                참석하기
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default SuggestionModal;
