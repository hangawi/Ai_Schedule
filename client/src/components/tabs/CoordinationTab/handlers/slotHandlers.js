// Slot-related handler factories

import { days, calculateEndTime } from '../../../../utils/coordinationUtils';

/**
 * Create handler for submitting slots
 */
export const createHandleSubmitSlots = (currentRoom, selectedSlots, submitTimeSlots, clearSelectedSlots, fetchRoomDetails) => {
  return async () => {
    if (!currentRoom || selectedSlots.length === 0) return;
    try {
      await submitTimeSlots(currentRoom._id, selectedSlots);
      clearSelectedSlots();
      await fetchRoomDetails(currentRoom._id);
    } catch (error) {
      // Silent error handling
    }
  };
};

/**
 * Create handler for assigning slot
 */
export const createHandleAssignSlot = (currentRoom, assignTimeSlot) => {
  return async (assignmentData) => {
    if (!currentRoom) return;
    await assignTimeSlot(
      assignmentData.roomId,
      assignmentData.day,
      assignmentData.startTime,
      assignmentData.endTime,
      assignmentData.userId
    );
  };
};

/**
 * Create handler for AssignSlotModal onAssign
 */
export const createHandleAssignSlotFromModal = (currentRoom, slotToAssign, handleAssignSlot, closeAssignModal) => {
  return (memberId) => {
    handleAssignSlot({
      roomId: currentRoom._id,
      day: days[slotToAssign.dayIndex - 1],
      startTime: slotToAssign.time,
      endTime: calculateEndTime(slotToAssign.time),
      userId: memberId
    });
    closeAssignModal();
  };
};

/**
 * Create handler for removing slot from detail grid
 */
export const createHandleRemoveSlot = (currentRoom, removeTimeSlot, fetchRoomDetails) => {
  return async (slotData) => {
    await removeTimeSlot(currentRoom._id, slotData.day, slotData.startTime, slotData.endTime);
    await fetchRoomDetails(currentRoom._id);
  };
};
