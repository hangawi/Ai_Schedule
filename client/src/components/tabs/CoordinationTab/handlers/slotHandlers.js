/**
 * ===================================================================================================
 * [파일명] slotHandlers.js - 시간 슬롯(Slot) 관련 이벤트 핸들러 생성 팩토리
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > [client/src/components/tabs/CoordinationTab/handlers/slotHandlers.js]
 *
 * 🎯 주요 기능:
 *    - 'CoordinationTab'에서 사용되는 시간 슬롯(slot) 관련 액션(제출, 배정, 삭제 등)에 대한 이벤트 핸들러를 생성.
 *    - 핸들러 팩토리 패턴을 사용하여, 각 핸들러가 필요로 하는 의존성을 주입받아 완전한 기능의 함수를 생성.
 *
 * 🔗 연결된 파일:
 *    - ../index.js (CoordinationTab): 이 파일의 팩토리 함수들을 호출하여 실제 이벤트 핸들러를 생성하고 사용.
 *    - ../../../../utils/coordinationUtils.js: `days`, `calculateEndTime` 등 시간 계산 관련 유틸리티.
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 시간 슬롯 제출, 배정, 삭제와 관련된 사용자 액션의 세부 동작이 변경됩니다.
 *    - 슬롯 제출 후 동작 변경: `createHandleSubmitSlots` 함수 내부의 `try...catch` 블록을 수정합니다.
 *
 * 📝 참고사항:
 *    - `requestHandlers.js`, `roomHandlers.js`와 동일한 핸들러 팩토리 패턴을 사용하여 코드의 관심사를 분리하고 재사용성을 높입니다.
 *    - `createHandleAssignSlotFromModal` 함수는 모달로부터 받은 최소한의 정보(memberId)를 완전한 요청 데이터로 가공한 후,
 *      더 일반적인 `handleAssignSlot` 핸들러를 호출하는 좋은 함수 합성(composition) 예시입니다.
 *
 * ===================================================================================================
 */
import { days, calculateEndTime } from '../../../../utils/coordinationUtils';

/**
 * [createHandleSubmitSlots]
 * @description 사용자가 선택한 여러 개의 '가능 시간' 슬롯들을 한 번에 제출하는 핸들러를 생성하는 팩토리 함수.
 * @returns {function} API 호출, 선택된 슬롯 초기화, 방 정보 새로고침을 순차적으로 수행하는 핸들러.
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
 * [createHandleAssignSlot]
 * @description 특정 시간 슬롯을 특정 멤버에게 '배정'하는 범용 핸들러를 생성하는 팩토리 함수.
 * @returns {function} 배정에 필요한 모든 데이터를 담은 `assignmentData` 객체를 인자로 받아 처리하는 핸들러.
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
 * [createHandleAssignSlotFromModal]
 * @description 'AssignSlotModal'에서 특정 멤버를 선택하여 슬롯을 배정할 때 사용되는 핸들러를 생성하는 팩토리 함수.
 * @returns {function} 모달에서 선택된 `memberId`를 인자로 받아, 완전한 배정 데이터로 가공 후 `handleAssignSlot`을 호출하는 핸들러.
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
 * [createHandleRemoveSlot]
 * @description 특정 시간 슬롯 배정을 '삭제'(제거)하는 핸들러를 생성하는 팩토리 함수.
 * @returns {function} 삭제할 슬롯 정보를 담은 `slotData`를 인자로 받아 API 호출 및 방 정보 새로고침을 수행하는 핸들러.
 */
export const createHandleRemoveSlot = (currentRoom, removeTimeSlot, fetchRoomDetails) => {
  return async (slotData) => {
    await removeTimeSlot(currentRoom._id, slotData.day, slotData.startTime, slotData.endTime);
    await fetchRoomDetails(currentRoom._id);
  };
};