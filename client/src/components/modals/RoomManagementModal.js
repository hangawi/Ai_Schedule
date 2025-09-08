import React, { useState } from "react";
import { X, Users, Settings, Trash2, Copy, UserMinus } from "lucide-react";

const RoomManagementModal = ({
  room,
  onClose,
  onRoomUpdated,
  updateRoom,
  deleteRoom,
}) => {
  const [activeTab, setActiveTab] = useState("info");
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: room?.name || "",
    description: room?.description || "",
    maxMembers: room?.maxMembers || 10,
    settings: room?.settings || {},
  });

  const handleUpdate = async () => {
    try {
      const updatedRoom = await updateRoom(room._id, formData);
      setIsEditing(false);
      onRoomUpdated(updatedRoom);
    } catch (error) {
      console.error("Failed to update room:", error);
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
        console.error("Failed to delete room:", error);
      }
    }
  };

  const copyInviteCode = () => {
    navigator.clipboard.writeText(room.inviteCode);
    alert("초대 코드가 클립보드에 복사되었습니다!");
  };

  const removeMember = async (memberId) => {
    if (window.confirm("이 멤버를 방에서 제거하시겠습니까?")) {
      console.log("Removing member:", memberId);
      // TODO: API 연결
    }
  };

  const renderInfoTab = () => (
    <div className="space-y-6">
      {isEditing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              방 이름
            </label>
            <input
              type="text"
              className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              방 설명
            </label>
            <textarea
              className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              최대 멤버 수
            </label>
            <input
              type="number"
              className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
              value={formData.maxMembers}
              onChange={(e) =>
                setFormData({ ...formData, maxMembers: Number(e.target.value) })
              }
              min="2"
              max="20"
            />
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">방 이름</p>
              <p className="font-semibold text-gray-800">{room.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">멤버 수</p>
              <p className="font-semibold text-gray-800">
                {room.members?.length || 0} / {room.maxMembers}명
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">생성일</p>
              <p className="font-semibold text-gray-800">
                {new Date(room.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          {room.description && (
            <div>
              <p className="text-sm text-gray-500">방 설명</p>
              <p className="mt-1 text-gray-800">{room.description}</p>
            </div>
          )}
        </div>
      )}
      <div className="border-t pt-4 mt-6">
        <h4 className="font-medium text-gray-800 mb-2">초대 코드</h4>
        <div className="flex items-center p-2 bg-blue-50 rounded-lg">
          <p className="text-sm text-gray-600 flex-1 font-mono font-bold text-blue-700 tracking-wider">
            {room.inviteCode}
          </p>
          <button
            onClick={copyInviteCode}
            className="px-3 py-1 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 shadow-sm"
          >
            <Copy size={14} className="inline mr-1" /> 복사
          </button>
        </div>
      </div>
    </div>
  );

  const renderMembersTab = () => (
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
      const displayInitial = (userData.firstName || userData.name || "U")
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



  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200">
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
          {activeTab === "info" ? renderInfoTab() : renderMembersTab()}
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
      </div>
    </div>
  );
};

export default RoomManagementModal;
