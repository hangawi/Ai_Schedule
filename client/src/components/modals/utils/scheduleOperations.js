/**
 * ===================================================================================================
 * scheduleOperations.js - 스케줄 데이터 조작 유틸리티
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/utils
 *
 * 🎯 주요 기능:
 *    - 파싱된 명령어에 따라 스케줄 목록을 조작(삭제, 선택, 수정, 추가)
 *    - '삭제': 특정 조건(요일, 시간, 학년부)에 맞는 스케줄을 제거
 *    - '선택': 겹치는 시간대의 여러 스케줄 중 특정 제목의 스케줄만 남기고 나머지는 제거
 *    - '수정': 특정 스케줄의 시작 시간을 변경하고, 그에 맞춰 종료 시간도 조정
 *    - '추가': 새로운 스케줄 객체를 생성하여 목록에 추가
 *
 * 🔗 연결된 파일:
 *    - ./timeUtils - 시간 계산 관련 유틸리티
 *    - ScheduleOptimizerModal.js - 이 함수들을 사용하여 파싱된 명령을 실제 데이터에 적용
 *
 * 💡 UI 위치:
 *    - 이 파일은 UI가 없으며, '일정 최적화 모달' 내의 채팅 명령 실행 로직에 사용됩니다.
 *
 * ✏️ 수정 가이드:
 *    - 삭제 로직 변경: `deleteSchedules` 함수의 필터링 조건 수정
 *    - 수정 시 종료 시간 계산 방식 변경: `modifySchedules` 함수 내의 `adjustTimeByMinutes` 로직 수정
 *
 * 📝 참고사항:
 *    - 모든 함수는 불변성을 유지하기 위해 원본 배열을 직접 수정하지 않고 새로운 배열을 반환합니다.
 *    - 각 함수는 작업의 성공 여부, 변경된 스케줄 목록, 사용자에게 보여줄 메시지 등을 포함하는 객체를 반환합니다.
 *
 * ===================================================================================================
 */

import { calculateTimeDifference, calculateEndTime, adjustTimeByMinutes } from './timeUtils';

/**
 * deleteSchedules
 * @description 주어진 조건에 맞는 스케줄을 목록에서 삭제합니다.
 * @param {Array<Object>} currentSchedules - 현재 스케줄 목록.
 * @param {{day: string|null, time: string|null, gradeLevel: string|null}} criteria - 삭제 조건.
 * @returns {{filteredSchedules: Array<Object>, deletedCount: number, hasChanges: boolean}} 변경된 스케줄 목록, 삭제된 개수, 변경 여부.
 */
export const deleteSchedules = (currentSchedules, { day, time, gradeLevel }) => {
  const filteredSchedules = currentSchedules.map((schedule) => {
    let shouldBeRemoved = true;
    if (day && !schedule.days?.includes(day)) shouldBeRemoved = false;
    if (time && schedule.startTime !== time) shouldBeRemoved = false;
    if (gradeLevel && schedule.gradeLevel !== gradeLevel) shouldBeRemoved = false;
    
    // 아무 조건도 없으면 아무것도 삭제하지 않음
    if (!day && !time && !gradeLevel) shouldBeRemoved = false;

    if (shouldBeRemoved && day && schedule.days.length > 1) {
      // 여러 요일 중 하나만 삭제하는 경우
      const updatedDays = schedule.days.filter(d => d !== day);
      return { ...schedule, days: updatedDays };
    }
    
    return shouldBeRemoved ? null : schedule;
  }).filter(Boolean);

  const deletedCount = currentSchedules.length - filteredSchedules.length;
  const hasChanges = deletedCount > 0 || JSON.stringify(currentSchedules) !== JSON.stringify(filteredSchedules);

  return { filteredSchedules, deletedCount, hasChanges };
};

/**
 * selectSchedule
 * @description 겹치는 시간대에서 특정 제목의 스케줄만 남기고 나머지를 제거합니다.
 * @param {Array<Object>} currentSchedules - 현재 스케줄 목록.
 * @param {{day: string, time: string, title: string}} criteria - 선택 조건.
 * @returns {{success: boolean, message: string, filteredSchedules?: Array<Object>, deletedCount?: number}} 작업 결과 객체.
 */
export const selectSchedule = (currentSchedules, { day, time, title }) => {
  if (!day || !time || !title) {
    return { success: false, message: '요일, 시간, 과목명을 모두 입력해주세요.' };
  }

  const matchingSchedules = currentSchedules.filter(schedule => schedule.days?.includes(day) && schedule.startTime === time);
  if (matchingSchedules.length <= 1) return { success: false, message: '해당 시간대에 겹치는 스케줄이 없거나 이미 하나만 있습니다.' };

  const filteredSchedules = currentSchedules.filter(schedule => {
    const isTargetSlot = schedule.days?.includes(day) && schedule.startTime === time;
    return isTargetSlot ? schedule.title?.includes(title) : true;
  });

  const deletedCount = currentSchedules.length - filteredSchedules.length;
  return { success: true, filteredSchedules, deletedCount, message: `${day} ${time} 시간대에서 "${title}"만 남기고 ${deletedCount}개를 제거했습니다.` };
};

/**
 * modifySchedules
 * @description 특정 조건에 맞는 스케줄의 시간을 수정합니다.
 * @param {Array<Object>} currentSchedules - 현재 스케줄 목록.
 * @param {{day: string|null, oldTime: string|null, newTime: string|null, gradeLevel: string|null}} criteria - 수정 조건.
 * @returns {{success: boolean, message: string, newSchedules?: Array<Object>}} 작업 결과 객체.
 */
export const modifySchedules = (currentSchedules, { day, oldTime, newTime, gradeLevel }) => {
  if (!oldTime || !newTime) return { success: false, message: '시간 정보를 찾을 수 없습니다.' };

  let modified = false;
  const newSchedules = currentSchedules.map(schedule => {
    let shouldModify = true;
    if (day && !schedule.days?.includes(day)) shouldModify = false;
    if (oldTime && schedule.startTime !== oldTime) shouldModify = false;
    if (gradeLevel && schedule.gradeLevel !== gradeLevel) shouldModify = false;

    if (shouldModify) {
      modified = true;
      const diff = calculateTimeDifference(oldTime, newTime);
      return { ...schedule, startTime: newTime, endTime: schedule.endTime ? adjustTimeByMinutes(schedule.endTime, diff) : newTime };
    }
    return schedule;
  });

  return { success: modified, newSchedules, message: modified ? `시간표를 ${oldTime}에서 ${newTime}로 수정했습니다.` : '해당 조건에 맞는 시간표를 찾을 수 없습니다.' };
};

/**
 * addSchedule
 * @description 새로운 스케줄을 목록에 추가합니다.
 * @param {Array<Object>} currentSchedules - 현재 스케줄 목록.
 * @param {{day: string, time: string, gradeLevel: string|null, title: string}} criteria - 추가할 스케줄 정보.
 * @returns {{success: boolean, message: string, updatedSchedules?: Array<Object>}} 작업 결과 객체.
 */
export const addSchedule = (currentSchedules, { day, time, gradeLevel, title }) => {
  if (!day || !time) return { success: false, message: '요일과 시간을 지정해주세요.' };

  const newSchedule = { title, days: [day], startTime: time, endTime: calculateEndTime(time, 60), duration: 60, gradeLevel };
  const updatedSchedules = [...currentSchedules, newSchedule];
  return { success: true, updatedSchedules, message: `${day} ${time}에 ${title} 시간표를 추가했습니다.` };
};