/**
 * ===================================================================================================
 * [파일명] RoomHeader.js - 협업 방 상세 뷰의 헤더 컴포넌트
 * ===================================================================================================
 */
import React from 'react';
import { FileText, Settings, Users, Calendar, List, Sparkles, LogOut } from 'lucide-react';
import { translateEnglishDays } from '../../../../utils';
import { isRoomOwner } from '../../../../utils/coordinationUtils';

/**
 * [RoomHeader]
 * @description 현재 선택된 협업 방의 상세 정보와 관련 액션 버튼들을 담고 있는 헤더 컴포넌트.
 *              '표준 모드'와 '대화형 모드'에 따라 다른 디자인을 보여줍니다.
 */
const RoomHeader = ({
  currentRoom,
  user,
  isOwner,
  onManageRoom,
  onOpenLogs,
  onBackToRoomList,
  onLeaveRoom,
  isMobile,
  onToggleMembers, // 추가: 참여자 목록 토글 함수
  onToggleSuggestions, // 추가: 일정 관리 모달 토글 함수
  typoCorrection, // 추가: AI 오타 교정 ON/OFF 상태
  onToggleTypoCorrection // 추가: AI 오타 교정 토글 함수
}) => {
  // 대화형 모드인지 확인
  const isConversational = currentRoom?.mode === 'conversational';

  // =================================================================================
  // [Case 1] 대화형 모드 (Compact & Slim Design)
  // 채팅창 공간 확보를 위해 높이를 줄인 디자인을 사용합니다.
  // =================================================================================
  if (isConversational) {
    if (isMobile) {
      // 모바일용 콤팩트 헤더
      return (
        <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-30">
          <div className="flex justify-between items-center mb-2">
            <div className="flex-1 min-w-0 pr-2">
              <h2 className="text-lg font-bold text-gray-800 truncate">{translateEnglishDays(currentRoom.name)}</h2>
              <p className="text-xs text-gray-500 truncate">{translateEnglishDays(currentRoom.description || ' ')}</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {isOwner ? (
                <button onClick={onManageRoom} className="p-2 text-blue-600 bg-blue-50 rounded-full hover:bg-blue-100">
                  <Settings size={18} />
                </button>
              ) : (
                <button onClick={onLeaveRoom} className="p-2 text-orange-600 bg-orange-50 rounded-full hover:bg-orange-100" title="방 나가기">
                  <LogOut size={18} />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center text-xs text-gray-500 space-x-2">
            <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700">CODE: {currentRoom.inviteCode}</span>
            <span>👥 {currentRoom.memberCount || currentRoom.members?.length}명</span>
            
            <div className="ml-auto flex items-center gap-1.5">
              {/* 방 목록 버튼 */}
              <button
                onClick={onBackToRoomList}
                className="p-1.5 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
                title="방 목록"
              >
                <List size={16} />
              </button>

              {/* 일정 관리 버튼 */}
              <button
                onClick={onToggleSuggestions}
                className="p-1.5 bg-green-50 text-green-600 rounded-md hover:bg-green-100 transition-colors"
                title="일정 관리"
              >
                <Calendar size={16} />
              </button>

              {/* 참여자 목록 버튼 */}
              <button
                onClick={onToggleMembers}
                className="p-1.5 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
                title="참여자 목록"
              >
                <Users size={16} />
              </button>

              {/* AI 오타 교정 토글 */}
              <button
                onClick={onToggleTypoCorrection}
                className={`p-1.5 rounded-md transition-colors flex items-center gap-1 ${
                  typoCorrection
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 text-gray-400'
                }`}
                title={typoCorrection ? 'AI 오타 교정 ON' : 'AI 오타 교정 OFF'}
              >
                <Sparkles size={14} />
                <span className="text-[10px] font-bold">{typoCorrection ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          </div>
        </div>
      );
    }    // PC용 슬림 헤더
    return (
      <div className="bg-white px-6 py-4 rounded-xl shadow-sm mb-4 border border-gray-200 flex justify-between items-center">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-xl font-bold text-gray-800">{translateEnglishDays(currentRoom.name)}</h2>
            <span className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
              {currentRoom.inviteCode}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <p className="max-w-md truncate">{translateEnglishDays(currentRoom.description || '설명 없음')}</p>
            <span className="w-px h-3 bg-gray-300"></span>
            <div className="flex items-center gap-1">
              <span className="font-medium">방장:</span> 
              {isOwner ? `${user.firstName} ${user.lastName}` : `${currentRoom.owner?.firstName || ''} ${currentRoom.owner?.lastName || ''}`}
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium">멤버:</span> 
              {currentRoom.memberCount || currentRoom.members?.length} / {currentRoom.maxMembers}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 방 목록 버튼 */}
          <button
            onClick={onBackToRoomList}
            className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
            title="방 목록"
          >
            <List size={18} />
          </button>

          {/* 일정 관리 버튼 */}
          <button
            onClick={onToggleSuggestions}
            className="px-3 py-2 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors font-medium flex items-center border border-green-200"
            title="일정 관리"
          >
            <Calendar size={16} className="mr-1" /> 일정
          </button>

          {/* AI 오타 교정 토글 */}
          <button
            onClick={onToggleTypoCorrection}
            className={`px-3 py-2 text-sm rounded-lg transition-colors font-medium flex items-center gap-1.5 ${
              typoCorrection
                ? 'bg-purple-500 text-white'
                : 'bg-gray-100 text-gray-500 border border-gray-200'
            }`}
            title={typoCorrection ? 'AI 오타 교정 ON' : 'AI 오타 교정 OFF'}
          >
            <Sparkles size={16} />
            <span>{typoCorrection ? 'ON' : 'OFF'}</span>
          </button>

          {isOwner ? (
            <>
              <button
                onClick={onOpenLogs}
                className="px-3 py-2 text-sm bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 transition-colors font-medium flex items-center border border-yellow-200"
                title="로그 보기"
              >
                <FileText size={16} className="mr-1" /> 로그
              </button>
              <button
                onClick={onManageRoom}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
              >
                방 관리
              </button>
            </>
          ) : (
            <button
              onClick={onLeaveRoom}
              className="p-2 bg-orange-50 text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
              title="방 나가기"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // =================================================================================
  // [Case 2] 표준 모드 (Original Large Design)
  // 기존의 풍성한 카드 형태 디자인을 유지합니다.
  // =================================================================================
  return (
    <div className="bg-white p-6 rounded-xl shadow-lg mb-6 border border-gray-200">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-800">{translateEnglishDays(currentRoom.name)}</h2>
          <p className="text-gray-500 mt-1">{translateEnglishDays(currentRoom.description || '방 설명이 없습니다.')}</p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
            <div className="flex items-center">
              <strong className="mr-2">초대코드:</strong>
              <span className="font-mono bg-blue-50 text-blue-700 px-2 py-1 rounded">{currentRoom.inviteCode}</span>
            </div>
            <div className="flex items-center">
              <strong className="mr-2">방장:</strong>
              {isOwner
                ? `${user.firstName} ${user.lastName}`
                : `${currentRoom.owner?.firstName || ''} ${currentRoom.owner?.lastName || ''}`.trim() || '알 수 없음'}
            </div>
            <div className="flex items-center">
              <strong className="mr-2">멤버:</strong>
              {currentRoom.memberCount || currentRoom.members?.length || 0} / {currentRoom.maxMembers}명
            </div>
          </div>
        </div>
        {isOwner && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1 flex gap-2">
            <button
              onClick={onManageRoom}
              className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors font-medium shadow-sm"
            >
              방 관리
            </button>
            <button
              onClick={onOpenLogs}
              className="px-3 py-2 text-sm bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors font-medium shadow-sm flex items-center"
              title="방 활동 로그를 확인합니다"
            >
              <FileText size={14} className="mr-1" />
              로그 보기
            </button>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={onBackToRoomList}
          className="px-5 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors shadow-sm"
        >
          방 목록으로 돌아가기
        </button>
        {!isOwner && (
          <button
            onClick={onLeaveRoom}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: '#f97316',
              color: 'white',
              borderRadius: '0.5rem',
              fontWeight: '500',
              boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
              border: 'none',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#ea580c'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#f97316'}
          >
            방 나가기
          </button>
        )}
      </div>
    </div>
  );
};

export default RoomHeader;