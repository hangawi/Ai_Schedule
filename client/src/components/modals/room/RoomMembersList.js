import React from "react";
import { UserMinus, LogOut } from "lucide-react";

const RoomMembersList = ({ room, removeMember, leaveRoom, currentUserId }) => {
  // Determine the owner ID (handle both object and string formats)
  const ownerIdValue = room.owner?._id?.toString() || room.owner?.id?.toString() || room.owner?.toString() || room.owner;

  // Check if current user is owner (using Firebase UID)
  const isCurrentUserOwner = currentUserId && room.owner?.firebaseUid === currentUserId;

  // Debug logging
  console.log('====== DEBUG - RoomMembersList ======');
  console.log('currentUserId:', currentUserId);
  console.log('room.owner:', room.owner);
  console.log('room.owner.firebaseUid:', room.owner?.firebaseUid);
  console.log('isCurrentUserOwner:', isCurrentUserOwner);
  console.log('ownerIdValue:', ownerIdValue);
  console.log('removeMember function exists:', !!removeMember);
  console.log('====================================');

  return (
    <div className="space-y-2">
      {room.members?.map((member, index) => {
        const userData = member.user;
        if (!userData) return null;

        const memberId = userData._id?.toString() || userData.id?.toString();
        const isOwner = memberId === ownerIdValue;
        const isCurrentUser = userData.firebaseUid === currentUserId || memberId === currentUserId;

        // Debug each member
        console.log(`--- Member ${index + 1}: ${userData.firstName} ${userData.lastName} ---`);
        console.log('  memberId:', memberId);
        console.log('  userData.firebaseUid:', userData.firebaseUid);
        console.log('  isOwner:', isOwner);
        console.log('  isCurrentUser:', isCurrentUser);
        console.log('  isCurrentUserOwner:', isCurrentUserOwner);
        console.log('  Kick button should show:', isCurrentUserOwner && !isCurrentUser && !isOwner && removeMember);
        console.log('  - isCurrentUserOwner:', isCurrentUserOwner);
        console.log('  - !isCurrentUser:', !isCurrentUser);
        console.log('  - !isOwner:', !isOwner);
        console.log('  - removeMember exists:', !!removeMember);

        const displayName =
          userData.fullName ||
          `${userData.firstName} ${userData.lastName}`.trim() ||
          "이름 정보 없음";
        const displayEmail = userData.email || "이메일 정보 없음";
        const displayInitial = (userData.firstName || "U")
          .charAt(0)
          .toUpperCase();

        return (
          <div
            key={memberId || index}
            className="flex items-center justify-between p-3 transition-colors duration-200 rounded-lg hover:bg-slate-100"
          >
            {/* 왼쪽: 프로필 + 이름/이메일 */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold">
                {displayInitial}
              </div>
              <div>
                <p className="font-semibold text-gray-800">{displayName}</p>
                <p className="text-sm text-gray-500">{displayEmail}</p>
              </div>
            </div>

            {/* 오른쪽: 제거버튼/방나가기버튼 + 역할 태그 */}
            <div className="flex items-center gap-2">
              {/* 방 나가기 버튼: 본인이면서 방장이 아닌 경우 */}
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

              {/* 강퇴 버튼: 현재 사용자가 방장이고, 대상이 본인이 아니며 방장이 아닌 멤버에 대해 표시 */}
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
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RoomMembersList;