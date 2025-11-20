import { useMemo, useEffect } from 'react';
import { generateTimeSlots } from '../utils/timeUtils';
import { DAY_MAP } from '../constants/scheduleConstants';
import { getColorForImageIndex } from '../../../../utils/scheduleAnalysis/assignScheduleColors';

/**
 * 시간 슬롯 관련 로직을 관리하는 커스텀 훅
 * @param {Array} personalTimes - 개인 시간 배열
 * @param {Array} fixedSchedules - 고정 일정 배열
 * @param {boolean} showFullDay - 24시간 모드 여부
 * @param {Object} timeRange - 시간 범위
 * @param {Function} setTimeRange - 시간 범위 설정 함수
 * @returns {Object} 시간 슬롯 관련 데이터
 */
const useTimeSlots = (personalTimes, fixedSchedules, showFullDay, timeRange, setTimeRange) => {

  // ⭐ personalTimes와 fixedSchedules 합치기
  const allPersonalTimes = useMemo(() => {
    // personalTimes에 색상 추가 (없으면 보라색)
    const combined = (personalTimes || []).map(p => ({
      ...p,
      color: p.color || '#8b5cf6'
    }));

    // 고정 일정을 personalTime 형식으로 변환해서 추가
    if (fixedSchedules && fixedSchedules.length > 0) {
      fixedSchedules.forEach(fixed => {
        // days를 숫자 배열로 먼저 변환
        const daysArray = Array.isArray(fixed.days) ? fixed.days : [fixed.days];
        const mappedDays = daysArray.map(day => DAY_MAP[day] || day).filter(d => d && typeof d === 'number');

        // ⭐ 중복 체크: personalTimes에 이미 있는지 확인 (숫자 배열로 비교)
        const isDuplicate = combined.some(existing =>
          existing.title === fixed.title &&
          existing.startTime === fixed.startTime &&
          existing.endTime === fixed.endTime &&
          JSON.stringify(existing.days?.sort()) === JSON.stringify(mappedDays.sort())
        );

        if (isDuplicate) {
          return;
        }

        // 이미지 인덱스로 색상 가져오기
        let scheduleColor = '#9333ea'; // 기본 보라색
        if (fixed.sourceImageIndex !== undefined) {
          const colorInfo = getColorForImageIndex(fixed.sourceImageIndex);
          scheduleColor = colorInfo.border; // 색상 팔레트에서 border 색상 사용
        }

        combined.push({
          ...fixed,
          days: mappedDays, // ⭐ 숫자 배열로 변환
          color: scheduleColor, // ⭐ 원본 이미지 색상으로 할당
          isFixed: true, // 고정 일정 표시용 플래그
          sourceImageIndex: fixed.sourceImageIndex // 범례 필터링용
        });
      });
    }

    return combined;
  }, [personalTimes, fixedSchedules]);

  // 일정에 맞춰 timeRange 자동 조정 (올림 처리)
  useEffect(() => {
    if (!allPersonalTimes || allPersonalTimes.length === 0) return;

    let maxEndHour = 18;
    allPersonalTimes.forEach(p => {
      if (p.endTime) {
        const [hour, minute] = p.endTime.split(':').map(Number);
        // 분이 있으면 다음 시간으로 올림
        const endHour = minute > 0 ? hour + 1 : hour;
        if (endHour > maxEndHour) {
          maxEndHour = endHour;
        }
      }
    });

    // 최소 18시까지는 표시
    maxEndHour = Math.max(18, maxEndHour);
    if (!showFullDay && maxEndHour > timeRange.end) {
      setTimeRange(prev => ({ ...prev, end: maxEndHour }));
    }
  }, [allPersonalTimes, showFullDay, timeRange.end, setTimeRange]);

  /**
   * 현재 시간 슬롯 가져오기
   * @returns {Array} 시간 슬롯 배열
   */
  const getCurrentTimeSlots = () => {
    if (showFullDay) {
      // 24시간 모드: 00:00 ~ 24:00
      return generateTimeSlots(0, 24);
    } else {
      // 기본 모드: timeRange 사용 (9~18시 또는 일정에 맞춰 조정)
      return generateTimeSlots(timeRange.start, timeRange.end);
    }
  };

  return {
    allPersonalTimes,
    getCurrentTimeSlots
  };
};

export default useTimeSlots;
