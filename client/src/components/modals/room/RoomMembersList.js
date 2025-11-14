import React from "react";
import { UserMinus } from "lucide-react";

const RoomMembersList = ({ room, removeMember }) => {
  return (
    <div className="space-y-2">
      {room.members?.map((member, index) => {
        const userData = member.user;
        if (!userData) return null;

        const memberId = userData.id;
        const ownerId = room.owner?.id;
        const isOwner = memberId?.toString() === ownerId?.toString();

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

            {/* 오른쪽: 제거버튼 + 역할 태그 */}
            <div className="flex items-center gap-2">
              {!isOwner && (
                <button
                  onClick={() => removeMember(memberId)}
                  className="text-gray-400 hover:text-red-600 p-1 rounded-full"
                  title="멤버 제거"
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