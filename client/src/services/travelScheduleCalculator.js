/**
 * travelScheduleCalculator.js - 이동시간 반영 스케줄 재계산 서비스
 *
 * 📍 이 파일은 하위 호환성을 위한 re-export 파일입니다.
 * 📁 실제 구현: ./travelSchedule/ 디렉토리
 *   - timeUtils.js: formatTime, parseTime, toLocalDateString, unmergeBlock
 *   - conflictUtils.js: checkOverlap, checkBlockedTimeConflict
 *   - memberUtils.js: buildMemberPreferences, mergeOverlappingSlots, isWithinPreferredTime
 *   - distanceSorting.js: calculateDistance, sortSlotsByDistance
 *   - slotPlacement.js: findAvailableSlot, findAvailableSlotsWithSplit
 *   - simulationUtils.js: simulateTimeSlotPlacement, getBlockedTimesForMember, getAvailableTimesForMember
 *   - validationUtils.js: validateWalkingMode
 *   - recalculateSchedule.js: recalculateScheduleWithTravel
 *   - index.js: TravelScheduleCalculator 클래스 래퍼
 */

export { default } from './travelSchedule/index';
