/**
 * timeUtils.js - 시간 관련 순수 유틸리티 함수
 *
 * 📍 위치: services/travelSchedule/timeUtils.js
 * 🔗 연결: ../travelScheduleCalculator.js (index.js)
 */

export const formatTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

export const parseTime = (timeString) => {
  if (!timeString || !timeString.includes(':')) {
    return 0;
  }
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
};

export const toLocalDateString = (date) => {
  // 이미 YYYY-MM-DD 형식이면 그대로 반환
  if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return date;
  }

  // Date 객체로 변환 후 로컬 날짜 사용 (UTC 변환 시 시간대 문제 방지)
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const unmergeBlock = (block) => {
  const slots = [];
  const startMinutes = parseTime(block.startTime);
  const endMinutes = parseTime(block.endTime);

  // 🔧 버그 수정: block에서 startTime/endTime 제외하고 나머지 속성만 추출
  const { startTime: _st, endTime: _et, originalSlots, isMerged, ...baseProps } = block;

  for (let m = startMinutes; m < endMinutes; m += 10) {
    // 완전히 새로운 객체 생성 (참조 공유 방지)
    const calculatedStart = formatTime(m);
    const calculatedEnd = formatTime(m + 10);

    const newSlot = {
      ...baseProps,
      startTime: calculatedStart,
      endTime: calculatedEnd
    };

    slots.push(newSlot);
  }
  return slots;
};
