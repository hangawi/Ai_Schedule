/**
 * ===================================================================================================
 * scheduleTransform.js - 스케줄 데이터 변환 유틸리티
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/utils
 *
 * 🎯 주요 기능:
 *    - 초기 시간표 조합(combinations) 배열을 생성하고 유효성을 검사
 *    - ScheduleGridSelector가 요구하는 'personalTimes' 형식으로 스케줄 데이터를 변환
 *    - 주어진 시간표 조합의 총 수업 시간(duration)을 계산
 *    - 현재 시간표 조합에 사용자가 고정한 스케줄을 병합하여 전체 스케줄을 생성
 *
 * 🔗 연결된 파일:
 *    - ../../../utils/scheduleAnalysis/assignScheduleColors - 스케줄 색상 할당 유틸리티
 *    - ../constants/modalConstants - 요일 매핑 객체
 *    - ScheduleOptimizerModal.js - 이 유틸리티 함수들을 사용하여 스케줄 데이터를 가공하고 표시
 *
 * 💡 UI 위치:
 *    - 이 파일은 UI가 없으며, '일정 최적화 모달' 내부의 데이터 처리 로직에서 사용됩니다.
 *
 * ✏️ 수정 가이드:
 *    - 'personalTimes' 형식 변경 시: `convertToPersonalTimes` 함수의 반환 객체 구조 수정
 *    - 총 수업 시간 계산 방식 변경: `getTotalClassHours` 함수의 로직 수정
 *
 * 📝 참고사항:
 *    - 이 유틸리티들은 ScheduleOptimizerModal에서 사용되는 복잡한 스케줄 데이터를
 *      다른 컴포넌트(예: ScheduleGridSelector)가 이해할 수 있는 형식으로 변환하는 중요한 역할을 합니다.
 *
 * ===================================================================================================
 */

import { getColorForImageIndex } from '../../../utils/scheduleAnalysis/assignScheduleColors';

/**
 * createInitialCombinations
 * @description 시간표 조합 배열이 유효하면 그대로 반환하고, 그렇지 않으면 초기 스케줄로 새로운 조합 배열을 생성합니다.
 * @param {Array<Array<Object>>} combinations - 기존 시간표 조합 배열.
 * @param {Array<Object>} initialSchedules - 조합이 없을 경우 사용할 초기 스케줄 목록.
 * @returns {Array<Array<Object>>} 유효한 시간표 조합 배열.
 */
export const createInitialCombinations = (combinations, initialSchedules) => {
  if (combinations && Array.isArray(combinations) && combinations.length > 0) {
    const isValid = combinations.every(c => Array.isArray(c));
    if (isValid) return combinations;
  }
  return initialSchedules && Array.isArray(initialSchedules) && initialSchedules.length > 0 ? [initialSchedules] : [[]];
};

/**
 * convertToPersonalTimes
 * @description ScheduleOptimizerModal의 스케줄 데이터를 ScheduleGridSelector에서 사용할 수 있는 personalTimes 형식으로 변환합니다.
 * @param {Array<Object>} currentCombination - 현재 선택된 시간표 조합.
 * @param {number|null} hoveredImageIndex - 사용자가 마우스를 올린 이미지의 인덱스 (해당 이미지의 스케줄만 필터링하기 위함).
 * @returns {Array<Object>} personalTimes 형식으로 변환된 스케줄 목록.
 */
export const convertToPersonalTimes = (currentCombination, hoveredImageIndex) => {
  try {
    const schedulesToShow = hoveredImageIndex !== null
      ? currentCombination.filter(schedule => schedule.sourceImageIndex === hoveredImageIndex)
      : currentCombination;


    const dayMap = { 'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4, 'FRI': 5, 'SAT': 6, 'SUN': 7, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 7 };

    const result = schedulesToShow.map((schedule, index) => {
      if (!schedule) {
        console.warn(`   ⚠️ 스케줄 ${index}: null 또는 undefined`);
        return null;
      }

      if (!schedule.days || schedule.days.length === 0) {
        console.warn(`   ⚠️ 스케줄 ${index} "${schedule.title}": days가 없음`, schedule.days);
        return null;
      }

      const mappedDays = (Array.isArray(schedule.days) ? schedule.days : [schedule.days])
        .map(day => dayMap[day] || day)
        .filter(d => typeof d === 'number');

      // ⭐ 변환 후 빈 배열이면 경고 및 제외
      if (mappedDays.length === 0) {
        console.warn(`   ⚠️ 스케줄 ${index} "${schedule.title}": days 변환 실패!`, {
          original: schedule.days,
          mapped: mappedDays
        });
        return null;
      }

      let scheduleColor = '#9333ea'; // default purple
      if (schedule.sourceImageIndex !== undefined) {
        scheduleColor = getColorForImageIndex(schedule.sourceImageIndex).border;
      }

      const converted = {
        ...schedule, // ⭐ 먼저 원본 속성 복사
        id: Date.now() + index,
        type: 'study',
        days: mappedDays, // ⭐ 그 다음 변환된 days로 덮어쓰기
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        title: schedule.title || '수업',
        color: scheduleColor,
        isRecurring: true
      };

      if (index < 3) {
        console.log(`   ✅ 스케줄 ${index}: ${schedule.title}`, {
          originalDays: schedule.days,
          mappedDays: mappedDays,
          time: `${schedule.startTime}-${schedule.endTime}`
        });
      }

      return converted;
    }).filter(Boolean);

    console.log(`📊 [convertToPersonalTimes] 변환 완료: ${schedulesToShow.length}개 → ${result.length}개`);
    return result;
  } catch (error) {
    console.error('❌ [convertToPersonalTimes] 에러:', error);
    return [];
  }
};

/**
 * getTotalClassHours
 * @description 주어진 시간표 조합의 총 수업 시간(분)을 계산합니다.
 * @param {Array<Object>} currentCombination - 계산할 시간표 조합.
 * @returns {number} 총 수업 시간 (분).
 */
export const getTotalClassHours = (currentCombination) => {
  return currentCombination.reduce((total, schedule) => total + (schedule.duration || 0), 0);
};

/**
 * createFullScheduleWithFixed
 * @description 현재 시간표 조합에 사용자가 고정한 스케줄을 중복 없이 병합하여 완전한 스케줄 목록을 생성합니다.
 * @param {Array<Object>} currentCombination - 현재 선택된 시간표 조합.
 * @param {Array<Object>} currentFixedSchedules - 사용자가 고정한 스케줄 목록.
 * @returns {Array<Object>} 현재 조합과 고정 스케줄이 병합된 전체 스케줄 목록.
 */
export const createFullScheduleWithFixed = (currentCombination, currentFixedSchedules) => {
  const fixedSchedulesFlat = (currentFixedSchedules || []).map(fixed => {
    const base = fixed.originalSchedule || fixed;
    return { ...base, title: fixed.title, days: fixed.days, startTime: fixed.startTime, endTime: fixed.endTime };
  });

  const combinationKeys = new Set(currentCombination.map(s => `${s.title}_${s.startTime}_${s.days.join(',')}`));
  const fixedToAdd = fixedSchedulesFlat.filter(f => !combinationKeys.has(`${f.title}_${f.startTime}_${f.days.join(',')}`));

  return [...currentCombination, ...fixedToAdd];
};