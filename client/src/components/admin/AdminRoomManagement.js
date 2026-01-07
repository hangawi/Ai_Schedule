/**
 * ===================================================================================================
 * AdminRoomManagement.js - 관리자 방 관리 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/admin/AdminRoomManagement.js
 *
 * 🎯 주요 기능:
 *    - 전체 방 목록 조회 및 검색
 *    - 방 삭제 (관리자 권한)
 *    - 방별 활동 로그 조회 (전체, 멤버 활동, 자동배정, 변경 요청, 자리 관리)
 *    - 방 멤버 목록 조회
 *    - 개별 멤버 활동 로그 조회
 *    - 활동 로그 초기화
 *    - 페이지네이션 (20개씩)
 *
 * 🔗 연결된 파일:
 *    - ../../config/firebaseConfig.js - Firebase 인증
 *    - ../modals/MemberLogsModal.js - 멤버 로그 모달
 *    - /api/admin/rooms - 방 목록 조회 API
 *    - /api/admin/rooms/:id/logs - 방 로그 조회 API
 *    - /api/admin/users/:id - 사용자 정보 조회 API
 *
 * 💡 UI 위치:
 *    - 화면: 관리자 > 방 관리
 *    - 접근: 헤더 > 관리자 메뉴 > 방 관리
 *    - 섹션: 검색 바, 방 목록, 로그 모달, 멤버 목록
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 관리자 방 관리 화면 전체가 변경됨
 *    - 로그 카테고리 추가: activeLogTab 조건 및 필터 로직 추가
 *    - 페이지당 항목 수 변경: fetchRooms의 limit 파라미터 수정
 *    - 방 카드 UI 변경: 방 목록 렌더링 JSX 수정
 *
 * 📝 참고사항:
 *    - 관리자 권한 필요
 *    - 방 삭제는 되돌릴 수 없음 (확인 메시지 표시)
 *    - 로그는 탭별로 필터링 가능 (전체, 멤버, 자동배정, 변경, 자리)
 *    - 멤버별 상세 로그는 MemberLogsModal에서 표시
 *
 * ===================================================================================================
 */

import React, { useState, useEffect } from 'react';
import { Building2, Search, Trash2, RefreshCw, Users, Clock, ChevronDown, ChevronUp, X, FileText } from 'lucide-react';
import { auth } from '../../config/firebaseConfig';
import MemberLogsModal from '../modals/MemberLogsModal';

/**
 * AdminRoomManagement - 관리자 방 관리 메인 컴포넌트
 *
 * @returns {JSX.Element} 관리자 방 관리 UI
 */
const AdminRoomManagement = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [error, setError] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [activeLogTab, setActiveLogTab] = useState('all');
  const [selectedMemberForLogs, setSelectedMemberForLogs] = useState(null);
  const [roomMembers, setRoomMembers] = useState([]);
  const [roomMembersWithUserInfo, setRoomMembersWithUserInfo] = useState([]);
  const [modalTab, setModalTab] = useState('logs'); // 'logs' 또는 'members'

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

  /**
   * fetchRooms - 방 목록 조회
   *
   * @description 페이지네이션과 검색어를 적용하여 방 목록을 가져옴
   * @param {number} page - 조회할 페이지 번호 (기본값: 1)
   */
  const fetchRooms = async (page = 1) => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const response = await fetch(
        `${API_BASE_URL}/api/admin/rooms?page=${page}&limit=20&search=${search}`,
        {
          headers: {
            'Authorization': `Bearer ${await currentUser.getIdToken()}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || '방 목록을 불러올 수 없습니다.');
      }

      setRooms(data.rooms);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  /**
   * handleSearch - 검색 폼 제출 처리
   *
   * @description 검색어 입력 후 첫 페이지부터 방 목록 재조회
   * @param {Event} e - 폼 제출 이벤트
   */
  const handleSearch = (e) => {
    e.preventDefault();
    fetchRooms(1);
  };

  /**
   * handleDelete - 방 삭제 처리
   *
   * @description 관리자 권한으로 방을 영구 삭제 (확인 메시지 표시)
   * @param {string} roomId - 삭제할 방의 ID
   * @param {string} roomName - 삭제할 방의 이름 (확인 메시지용)
   */
  const handleDelete = async (roomId, roomName) => {
    if (!window.confirm(`정말로 "${roomName}" 방을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      const currentUser = auth.currentUser;
      const response = await fetch(`${API_BASE_URL}/api/admin/rooms/${roomId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${await currentUser.getIdToken()}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.msg || '방 삭제 실패');
      }

      fetchRooms(pagination.current);
    } catch (err) {
      alert(err.message);
    }
  };

  /**
   * fetchLogs - 방 활동 로그 조회
   *
   * @description 특정 방의 활동 로그를 가져오고, 멤버 정보도 함께 로드
   * @param {string} roomId - 로그를 조회할 방의 ID
   * @param {Object|null} roomObj - 방 객체 (멤버 정보 포함, 선택적)
   */
  const fetchLogs = async (roomId, roomObj = null) => {
    try {
      setLogsLoading(true);
      const currentUser = auth.currentUser;

      const response = await fetch(`${API_BASE_URL}/api/admin/rooms/${roomId}/logs`, {
        headers: {
          'Authorization': `Bearer ${await currentUser.getIdToken()}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || '로그를 불러올 수 없습니다.');
      }

      setLogs(data.logs);
      setSelectedRoom({ id: roomId, name: data.roomName });

      // 방 객체가 전달되었으면 멤버 정보 사용
      if (roomObj && roomObj.members) {
        setRoomMembers(roomObj.members);
        // 사용자 정보 가져오기
        await fetchMembersUserInfo(roomObj.members);
      } else {
        // 방 객체가 없으면 rooms 배열에서 찾기
        const foundRoom = rooms.find(r => r._id === roomId);
        if (foundRoom && foundRoom.members) {
          setRoomMembers(foundRoom.members);
          // 사용자 정보 가져오기
          await fetchMembersUserInfo(foundRoom.members);
        }
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLogsLoading(false);
    }
  };

  /**
   * fetchMembersUserInfo - 멤버 상세 정보 조회
   *
   * @description 각 멤버의 userId로 사용자 정보를 조회하여 state에 저장
   * @param {Array} members - 멤버 배열 (user 필드 포함)
   */
  const fetchMembersUserInfo = async (members) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      // 각 멤버의 userId로 사용자 정보 가져오기
      const userInfoPromises = members.map(async (member) => {
        const userId = typeof member.user === 'string' ? member.user : member.user?._id;
        if (!userId) return { ...member, userInfo: null };

        try {
          const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
            headers: {
              'Authorization': `Bearer ${await currentUser.getIdToken()}`
            }
          });

          if (response.ok) {
            const data = await response.json();
            return { ...member, userInfo: data.user };
          } else {
            return { ...member, userInfo: null };
          }
        } catch (err) {
          return { ...member, userInfo: null };
        }
      });

      const membersWithUserInfo = await Promise.all(userInfoPromises);
      setRoomMembersWithUserInfo(membersWithUserInfo);
    } catch (err) {
    }
  };

  /**
   * clearLogs - 방 로그 초기화
   *
   * @description 특정 방의 모든 활동 로그를 영구 삭제 (확인 메시지 표시)
   * @param {string} roomId - 로그를 삭제할 방의 ID
   */
  const clearLogs = async (roomId) => {
    if (!window.confirm('정말로 이 방의 모든 로그를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      const currentUser = auth.currentUser;

      const response = await fetch(`${API_BASE_URL}/api/admin/rooms/${roomId}/logs`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${await currentUser.getIdToken()}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || '로그 삭제 실패');
      }

      setLogs([]);
      alert('로그가 성공적으로 삭제되었습니다.');
    } catch (err) {
      alert(err.message);
    }
  };

  /**
   * formatDate - 날짜 포맷팅 (년월일)
   *
   * @description 날짜 문자열을 한국어 형식으로 변환 (예: 2025년 1월 1일)
   * @param {string} dateString - ISO 형식의 날짜 문자열
   * @returns {string} 포맷팅된 날짜 문자열
   */
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  /**
   * formatDateTime - 날짜시간 포맷팅 (월일시분)
   *
   * @description 날짜 문자열을 한국어 형식으로 변환 (예: 1월 1일 오후 3:45)
   * @param {string} dateString - ISO 형식의 날짜 문자열
   * @returns {string} 포맷팅된 날짜시간 문자열
   */
  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /**
   * getActionLabel - 활동 타입 레이블 변환
   *
   * @description 영문 활동 타입을 한국어 레이블로 변환
   * @param {string} action - 활동 타입 코드
   * @returns {string} 한국어 활동 레이블
   */
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

  /**
   * getActionColor - 활동 타입별 색상 클래스 반환
   *
   * @description 활동 타입에 따라 Tailwind CSS 색상 클래스 반환
   * @param {string} action - 활동 타입 코드
   * @returns {string} Tailwind CSS 색상 클래스
   */
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

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Building2 className="text-purple-600" size={28} />
          <h2 className="text-2xl font-bold text-gray-800">방 관리</h2>
          <span className="text-sm text-gray-500">({pagination.total}개)</span>
        </div>
        <button
          onClick={() => fetchRooms(pagination.current)}
          className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg"
        >
          <RefreshCw size={20} />
        </button>
      </div>

      {/* 검색 */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="방 이름으로 검색..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </form>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">로딩 중...</p>
        </div>
      ) : (
        <>
          {/* 방 목록 */}
          <div className="space-y-4">
            {rooms.map((room) => (
              <div key={room._id} className="bg-white rounded-xl shadow p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg text-gray-800">{room.name}</h3>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                        {room.inviteCode}
                      </span>
                    </div>
                    {room.description && (
                      <p className="text-sm text-gray-500 mb-2">{room.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Users size={14} />
                        {room.memberCount}명
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {formatDate(room.createdAt)}
                      </span>
                      {room.ownerId && (
                        <span>
                          방장: {room.ownerId.firstName} {room.ownerId.lastName}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fetchLogs(room._id, room)}
                      className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      로그 보기
                    </button>
                    <button
                      onClick={() => handleDelete(room._id, room.name)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      title="삭제"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 페이지네이션 */}
          {pagination.pages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => fetchRooms(page)}
                  className={`px-3 py-1 rounded ${
                    page === pagination.current
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* 로그 모달 */}
      {selectedRoom && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center p-5 border-b">
              <h3 className="text-xl font-bold text-gray-800">
                {selectedRoom.name} - 활동 로그
              </h3>
              <button
                onClick={() => {
                  setSelectedRoom(null);
                  setLogs([]);
                  setActiveLogTab('all');
                  setModalTab('logs');
                  setRoomMembers([]);
                  setRoomMembersWithUserInfo([]);
                  setSelectedMemberForLogs(null);
                }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200"
              >
                <X size={22} />
              </button>
            </div>

            {/* 모달 탭 (로그/멤버) */}
            <div className="flex gap-2 px-5 pt-4 border-b bg-gray-50">
              <button
                onClick={() => setModalTab('logs')}
                className={`px-6 py-3 font-semibold text-sm transition-all ${
                  modalTab === 'logs'
                    ? 'border-b-2 border-blue-500 text-blue-600 bg-white'
                    : 'text-gray-500 hover:text-blue-600'
                }`}
              >
                활동 로그
              </button>
              <button
                onClick={() => setModalTab('members')}
                className={`px-6 py-3 font-semibold text-sm transition-all ${
                  modalTab === 'members'
                    ? 'border-b-2 border-blue-500 text-blue-600 bg-white'
                    : 'text-gray-500 hover:text-blue-600'
                }`}
              >
                멤버 목록 ({roomMembers.length})
              </button>
            </div>

            {/* 로그 탭의 하위 탭 버튼 */}
            {modalTab === 'logs' && (
              <div className="flex gap-2 px-5 pt-4 pb-2 overflow-x-auto border-b">

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
              <button
                onClick={() => clearLogs(selectedRoom.id)}
                className="ml-auto px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all bg-red-500 text-white hover:bg-red-600 shadow-md"
                title="로그 초기화"
              >
                <Trash2 size={16} className="inline mr-1" />
                초기화
              </button>
              </div>
            )}

            {/* 컨텐츠 영역 */}
            <div className="flex-1 overflow-y-auto p-5" style={{ minHeight: '560px', maxHeight: '560px' }}>
              {modalTab === 'logs' ? (
                logsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                </div>
              ) : logs.length === 0 ? (
                <div className="flex items-center justify-center text-gray-500" style={{ minHeight: '520px' }}>
                  활동 로그가 없습니다.
                </div>
              ) : (() => {
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

                return filteredLogs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    이 카테고리에 로그가 없습니다.
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
                );
              })()
              ) : (
                <div className="space-y-3">
                  {roomMembersWithUserInfo.length === 0 ? (
                    <div className="flex items-center justify-center text-gray-500" style={{ minHeight: '520px' }}>
                      멤버 정보를 불러오는 중...
                    </div>
                  ) : (
                    roomMembersWithUserInfo.map((member, index) => {
                      const userData = member.userInfo;
                      if (!userData) return null;

                      const memberId = userData._id?.toString() || userData.id?.toString();
                      const displayName =
                        userData.fullName ||
                        `${userData.firstName || ''} ${userData.lastName || ''}`.trim() ||
                        userData.name ||
                        "이름 정보 없음";
                      const displayEmail = userData.email || "이메일 정보 없음";
                      const displayInitial = (userData.firstName || userData.name || "U")
                        .charAt(0)
                        .toUpperCase();

                      return (
                        <div
                          key={memberId || index}
                          className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-12 h-12 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold text-lg">
                              {displayInitial}
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-gray-800">{displayName}</p>
                              <p className="text-sm text-gray-500">{displayEmail}</p>
                            </div>
                            <button
                              onClick={() => setSelectedMemberForLogs({
                                id: memberId,
                                name: displayName
                              })}
                              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
                              title="활동 로그 보기"
                            >
                              <FileText size={16} />
                              로그 보기
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 멤버 로그 모달 */}
      {selectedMemberForLogs && (
        <MemberLogsModal
          roomId={selectedRoom?.id}
          memberId={selectedMemberForLogs.id}
          memberName={selectedMemberForLogs.name}
          onClose={() => setSelectedMemberForLogs(null)}
          isAdmin={true}
        />
      )}
    </div>
  );
};

export default AdminRoomManagement;