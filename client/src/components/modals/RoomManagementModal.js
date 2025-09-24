import React, { useState } from "react";
import { X, Users, Settings, Trash2 } from "lucide-react";
import CustomAlertModal from './CustomAlertModal';
import RoomInfoTab from './room/RoomInfoTab';
import RoomMembersList from './room/RoomMembersList';

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
    settings: {
      startHour: room?.settings?.startHour || 9,
      endHour: room?.settings?.endHour || 18,
      blockedTimes: room?.settings?.blockedTimes || [],
    },
  });

  const [newBlockedTime, setNewBlockedTime] = useState({
    name: '',
    startTime: '12:00',
    endTime: '13:00'
  });

  // CustomAlert 상태
  const [customAlert, setCustomAlert] = useState({ show: false, message: '' });
  const showAlert = (message) => setCustomAlert({ show: true, message });
  const closeAlert = () => setCustomAlert({ show: false, message: '' });

  const handleUpdate = async () => {
    try {
      console.log('Updating room with data:', formData);
      const updatedRoom = await updateRoom(room._id, formData);
      setIsEditing(false);
      onRoomUpdated(updatedRoom);
      showAlert('방 정보가 성공적으로 업데이트되었습니다.');
    } catch (error) {
      console.error('Failed to update room:', error);
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
            'x-auth-token': localStorage.getItem('token') 
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
    <RoomMembersList room={room} removeMember={removeMember} />
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
