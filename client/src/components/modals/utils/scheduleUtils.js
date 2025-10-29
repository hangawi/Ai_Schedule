/**
 * 스케줄 관련 유틸리티 함수
 */

// 요일 맵
export const dayMap = {
  '월요일': 'MON', '화요일': 'TUE', '수요일': 'WED', '목요일': 'THU',
  '금요일': 'FRI', '토요일': 'SAT', '일요일': 'SUN',
  '월': 'MON', '화': 'TUE', '수': 'WED', '목': 'THU',
  '금': 'FRI', '토': 'SAT', '일': 'SUN'
};

// 학년부 맵
export const gradeLevelMap = {
  '초등부': 'elementary', '중등부': 'middle', '고등부': 'high',
  '초등': 'elementary', '중등': 'middle', '고등': 'high'
};

// 시간 파싱 함수
export const parseTime = (timeStr) => {
  // "오후 3시" 형식
  const koreanTimeMatch = timeStr.match(/(오전|오후)\s*(\d+)시?\s*(\d+)?분?/);
  if (koreanTimeMatch) {
    let hour = parseInt(koreanTimeMatch[2]);
    const minute = koreanTimeMatch[3] ? parseInt(koreanTimeMatch[3]) : 0;
    if (koreanTimeMatch[1] === '오후' && hour !== 12) hour += 12;
    if (koreanTimeMatch[1] === '오전' && hour === 12) hour = 0;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  // "3pm", "3PM" 형식
  const pmMatch = timeStr.match(/(\d+)\s*(pm|PM)/);
  if (pmMatch) {
    let hour = parseInt(pmMatch[1]);
    if (hour !== 12) hour += 12;
    return `${hour.toString().padStart(2, '0')}:00`;
  }

  // "3am", "3AM" 형식
  const amMatch = timeStr.match(/(\d+)\s*(am|AM)/);
  if (amMatch) {
    let hour = parseInt(amMatch[1]);
    if (hour === 12) hour = 0;
    return `${hour.toString().padStart(2, '0')}:00`;
  }

  // "14:40", "14시 40분" 형식
  const timeMatch = timeStr.match(/(\d+)[시:]?\s*(\d+)?분?/);
  if (timeMatch) {
    const hour = parseInt(timeMatch[1]);
    const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  return null;
};

// 총 수업 시간 계산
export const getTotalClassHours = (schedules) => {
  let total = 0;
  schedules.forEach(schedule => {
    if (schedule.duration) {
      total += schedule.duration;
    }
  });
  return total;
};

// 학년부 라벨
export const gradeLevelLabels = {
  elementary: '초등부',
  middle: '중등부',
  high: '고등부'
};
