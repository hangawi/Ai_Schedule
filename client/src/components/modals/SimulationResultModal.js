import React from 'react';
import Modal from './Modal';
import TimetableGrid from '../timetable/TimetableGrid';

const SimulationResultModal = ({ isOpen, onClose, simulationResult, currentUser }) => {
  if (!simulationResult) return null;

  const { room, unassignedMembersInfo, conflictSuggestions } = simulationResult;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="시뮬레이션 결과">
      <div className="p-4">
        <h3 className="text-lg font-bold mb-2">시뮬레이션된 방 정보</h3>
        <div className="mt-4 max-w-md mx-auto max-h-64 overflow-y-auto">
          <TimetableGrid
            roomId={room._id}
            roomSettings={room.settings}
            timeSlots={room.timeSlots || []}
            members={room.members || []}
            roomData={room}
            currentUser={currentUser}
            isRoomOwner={false} // For simulation, we treat it as read-only, not necessarily owner view
            readOnly={true}
            initialStartDate={new Date()} // Or a more relevant start date from simulationResult if available
            onWeekChange={() => {}} // No week change in simulation view
            onSlotSelect={() => {}} // No slot selection in simulation view
            onOpenChangeRequestModal={() => {}} // No change requests in simulation view
            showMerged={true} // Default to merged view for simulation
          />
        </div>

        {unassignedMembersInfo && unassignedMembersInfo.length > 0 && (
          <div className="mt-4">
            <h3 className="text-lg font-bold mb-2">미배정 멤버 정보</h3>
            <ul className="list-disc list-inside">
              {unassignedMembersInfo.map((member, index) => (
                <li key={index}>{member.memberId}: {member.neededHours}시간 부족</li>
              ))}
            </ul>
          </div>
        )}

        {conflictSuggestions && conflictSuggestions.length > 0 && (
          <div className="mt-4">
            <h3 className="text-lg font-bold mb-2">충돌 해결 제안</h3>
            <ul className="list-disc list-inside">
              {conflictSuggestions.map((suggestion, index) => (
                <li key={index}>{suggestion.title}: {suggestion.content}</li>
              ))}
            </ul>
          </div>
        )}

        {(unassignedMembersInfo === null || unassignedMembersInfo.length === 0) &&
         (conflictSuggestions === null || conflictSuggestions.length === 0) && (
          <p className="mt-4 text-green-600">모든 멤버가 성공적으로 배정되었으며, 충돌이 없습니다.</p>
        )}
      </div>
    </Modal>
  );
};

export default SimulationResultModal;
