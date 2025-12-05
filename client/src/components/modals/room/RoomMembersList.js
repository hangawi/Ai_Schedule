/**
 * ===================================================================================================
 * RoomMembersList.js - 방 관리 모달 내의 멤버 목록 탭 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/room
 *
 * 🎯 주요 기능:
 *    - 현재 방에 참여한 모든 멤버의 목록을 표시
 *    - 각 멤버의 이름, 이메일, 역할(방장/멤버)을 표시
 *    - 방장에게는 다른 멤버를 '강퇴'할 수 있는 버튼을 제공
 *    - 멤버 본인에게는 '방 나가기' 버튼을 제공
 *    - 각 멤버의 '활동 로그'를 볼 수 있는 모달을 여는 기능 제공
 *
 * 🔗 연결된 파일:
 *    - ../MemberLogsModal.js - 멤버의 활동 로그를 표시하는 모달
 *    - RoomManagementModal.js - 이 컴포넌트를 사용하는 상위 모달 컴포넌트
 *
 * 💡 UI 위치:
 *    - 조율 탭 > 방 카드 클릭 > '방 관리' 모달 > '멤버 목록' 탭
 *
 * ✏️ 수정 가이드:
 *    - 멤버 아이템의 UI 변경: `room.members?.map(...)` 내부의 JSX 구조 수정
 *    - 강퇴/방나가기 버튼의 동작 변경: 각 버튼의 `onClick` 핸들러에 연결된 `removeMember`, `leaveRoom` 함수 로직 수정 (부모 컴포넌트에서)
 *
 * 📝 참고사항:
 *    - 현재 사용자가 방장인지, 그리고 목록에 있는 멤버가 누구인지(본인, 방장, 일반 멤버)에 따라
 *      조건부로 다른 버튼(강퇴, 방나가기)과 태그(방장, 멤버)를 렌더링합니다.
 *    - `selectedMember` 상태를 통해 '활동 로그' 모달의 표시 여부와 대상 멤버를 제어합니다.
 *
 * ===================================================================================================
 */

import React, { useState } from "react";
import { UserMinus, LogOut, FileText } from "lucide-react";
import MemberLogsModal from '../MemberLogsModal';

/**
 * RoomMembersList
 *
 * @description 방에 속한 멤버들의 목록을 표시하고 관리하는 UI를 제공하는 탭 컴포넌트입니다.
 * @param {Object} props - 컴포넌트 프롭스
 * @param {Object} props.room - 현재 방 정보 객체 (멤버 목록 포함)
 * @param {Function} props.removeMember - (방장용) 특정 멤버를 방에서 강퇴시키는 함수
 * @param {Function} props.leaveRoom - (멤버용) 현재 방에서 나가는 함수
 * @param {string} props.currentUserId - 현재 로그인한 사용자의 ID (Firebase UID 또는 DB ID)
 * @param {boolean} props.isOwner - 현재 사용자가 방장인지 여부
 * @returns {JSX.Element} 멤버 목록 탭 UI
 */
const RoomMembersList = ({ room, removeMember, leaveRoom, currentUserId, isOwner: isCurrentUserOwnerProp }) => {
  const [selectedMember, setSelectedMember] = useState(null);

  const ownerIdValue = room.owner?._id?.toString() || room.owner?.id?.toString() || room.owner?.toString();
  const isCurrentUserOwner = isCurrentUserOwnerProp !== undefined 
    ? isCurrentUserOwnerProp 
    : (currentUserId && room.owner?.firebaseUid === currentUserId);

  return (
    <>
      <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
        {room.members?.map((member, index) => {
          const userData = member.user;
          if (!userData) return null;

          const memberId = userData._id?.toString() || userData.id?.toString();
          const isOwner = memberId === ownerIdValue;
          const isCurrentUser = userData.firebaseUid === currentUserId || memberId === currentUserId;

          const displayName = userData.fullName || `${userData.firstName} ${userData.lastName}`.trim() || "이름 정보 없음";
          const displayEmail = userData.email || "이메일 정보 없음";
          const displayInitial = (userData.firstName || "U").charAt(0).toUpperCase();

          return (
            <div
              key={memberId || index}
              className="flex items-center justify-between p-4 transition-colors duration-200 rounded-lg hover:bg-slate-100 border border-transparent hover:border-blue-200"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold">
                  {displayInitial}
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{displayName}</p>
                  <p className="text-sm text-gray-500">{displayEmail}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isCurrentUser && !isOwner && leaveRoom && (
                  <button
                    onClick={leaveRoom}
                    className="px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium text-sm flex items-center gap-1.5 transition-colors"
                    title="방 나가기"
                  >
                    <LogOut size={16} />
                    방 나가기
                  </button>
                )}
                {isCurrentUserOwner && !isCurrentUser && !isOwner && removeMember && (
                  <button
                    onClick={() => removeMember(memberId)}
                    className="p-2 text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                    title="멤버 강퇴"
                  >
                    <UserMinus size={18} />
                  </button>
                )}

                {isOwner ? (
                  <span className="px-3 py-1 text-xs font-bold leading-none text-blue-800 bg-blue-100 rounded-full">
                    방장
                  </span>
                ) : (
                  <span className="px-3 py-1 text-xs font-bold leading-none text-green-800 bg-green-100 rounded-full">
                    멤버
                  </span>
                )}
                <button
                  onClick={() => setSelectedMember({ id: memberId, name: displayName })}
                  className="px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 font-medium text-sm flex items-center gap-1.5 transition-all shadow-sm hover:shadow-md"
                  title="활동 로그 보기"
                >
                  <FileText size={16} />
                  로그
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {selectedMember && (
        <MemberLogsModal
          roomId={room._id}
          memberId={selectedMember.id}
          memberName={selectedMember.name}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </>
  );
};

export default RoomMembersList;
