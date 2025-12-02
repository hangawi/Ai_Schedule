import React from 'react';
import { timeToMinutes } from '../utils/timeUtils';
import { DAYS, PRIORITY_CONFIG } from '../constants/scheduleConstants';

/**
 * 상세 주간 뷰 컴포넌트 (분할 모드)
 * - 시간 슬롯별로 각 일정을 개별 셀에 표시
 * - 10분 단위 그리드 형태
 * - 개인시간, 선호시간, 예외시간을 색상으로 구분
 *
 * @param {Object} props
 * @param {Array} props.allPersonalTimes - 개인 시간 배열
 * @param {Array} props.schedule - 기본 일정 (선호 시간)
 * @param {Array} props.exceptions - 특정 날짜 예외 일정
 * @param {Array} props.weekDates - 주간 날짜 배열
 * @param {Function} props.getCurrentTimeSlots - 현재 시간 슬롯 가져오기 함수
 * @param {Object} props.priorityConfig - 우선순위 설정 객체
 */
const DetailedWeekView = ({
  allPersonalTimes,
  schedule,
  exceptions,
  weekDates,
  getCurrentTimeSlots,
  priorityConfig
}) => {
  const timeSlots = getCurrentTimeSlots();
  const maxHeight = timeSlots.length > 54 ? '60vh' : '70vh'; // 9시간(54슬롯) 넘으면 높이 제한

  return (
    <div className="timetable-grid border border-gray-200 rounded-lg overflow-auto shadow-inner bg-white" style={{ maxHeight, minHeight: '300px' }}>
      {/* 헤더: 시간 + 요일 */}
      <div className="grid grid-cols-8 bg-gray-100 sticky top-0 z-10 border-b border-gray-300">
        <div className="col-span-1 p-2 text-center font-semibold text-gray-700 border-r border-gray-300 text-sm">시간</div>
        {weekDates.map((date, index) => (
          <div key={index} className="col-span-1 p-2 text-center font-semibold text-gray-700 border-r border-gray-200 last:border-r-0 text-sm">
            {date.display}
          </div>
        ))}
      </div>

      {/* 본문: 시간 슬롯별 그리드 */}
      <div>
        {timeSlots.map(time => (
          <div key={time} className="grid grid-cols-8 border-b border-gray-200 last:border-b-0 hover:bg-gray-50 transition-colors">
            {/* 시간 컬럼 */}
            <div className="col-span-1 p-2 text-center text-xs font-medium text-gray-600 flex items-center justify-center bg-gray-50 border-r border-gray-300 h-8">
              {time}
            </div>

            {/* 각 요일별 셀 */}
            {DAYS.map((day, index) => {
              const date = weekDates[index]?.fullDate;
              if (!date) {
                return (
                  <div key={day.dayOfWeek} className="col-span-1 border-r border-gray-200 last:border-r-0 h-8"></div>
                );
              }

              const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

              // 1. 반복 일정 (schedule) 확인
              const recurringSlot = schedule.find(s => s.dayOfWeek === day.dayOfWeek && s.startTime === time);

              // 2. 예외 일정 (exceptions) 확인
              const exceptionSlot = exceptions.find(e => {
                if (e.specificDate !== dateStr) return false;

                let startMins, endMins;
                const currentMinutes = timeToMinutes(time);

                if (e.startTime && e.startTime.includes('T')) {
                  // ISO 형식
                  const startDate = new Date(e.startTime);
                  const endDate = new Date(e.endTime);
                  startMins = startDate.getHours() * 60 + startDate.getMinutes();
                  endMins = endDate.getHours() * 60 + endDate.getMinutes();
                } else if (e.startTime && e.startTime.includes(':')) {
                  // HH:MM 형식
                  startMins = timeToMinutes(e.startTime);
                  endMins = timeToMinutes(e.endTime);
                } else {
                  return false;
                }

                return currentMinutes >= startMins && currentMinutes < endMins;
              });

              // 3. 개인 시간 (personalTimes) 확인
              const personalSlot = allPersonalTimes.find(p => {
                const personalDays = p.days || [];

                // ⭐ specificDate가 있으면 정확한 날짜로 비교
                if (p.specificDate && personalDays.length === 0) {
                  if (p.specificDate === dateStr) {
                    const startMinutes = timeToMinutes(p.startTime);
                    const endMinutes = timeToMinutes(p.endTime);
                    const currentMinutes = timeToMinutes(time);

                    if (endMinutes <= startMinutes) {
                      // 자정을 넘는 경우
                      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
                    } else {
                      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
                    }
                  }
                  return false;
                }

                // 반복 일정인 경우
                if (p.isRecurring !== false && personalDays.length > 0) {
                  const convertedDays = personalDays.map(day => {
                    return day === 7 ? 0 : day; // 7(일요일) -> 0, 나머지는 그대로
                  });
                  if (convertedDays.includes(day.dayOfWeek)) {
                    const startMinutes = timeToMinutes(p.startTime);
                    const endMinutes = timeToMinutes(p.endTime);
                    const currentMinutes = timeToMinutes(time);

                    if (endMinutes <= startMinutes) {
                      // 자정을 넘는 경우
                      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
                    } else {
                      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
                    }
                  }
                }
                return false;
              });

              // 우선순위: exceptionSlot > personalSlot > recurringSlot
              let slotClass = 'bg-white hover:bg-blue-50';
              let content = null;
              let customStyle = {};

              if (exceptionSlot) {
                // 예외 일정 (가장 높은 우선순위)
                slotClass = `${priorityConfig[exceptionSlot.priority]?.color || 'bg-blue-600'} hover:opacity-90`;
                // exception도 priority 레이블로 표시 (휴무/휴일은 제외)
                const displayTitle = exceptionSlot.title && (exceptionSlot.title.includes('휴무') || exceptionSlot.title.includes('휴일'))
                  ? exceptionSlot.title
                  : priorityConfig[exceptionSlot.priority]?.label || '일정';
                content = (
                  <span className="text-xs text-white truncate px-1 font-medium" title={displayTitle}>
                    {displayTitle}
                  </span>
                );
              } else if (personalSlot) {
                // 개인 시간 (두 번째 우선순위)
                // Tailwind 클래스를 hex 색상으로 변환
                const tailwindToHex = {
                  'bg-gray-100': '#f3f4f6', 'bg-gray-200': '#e5e7eb', 'bg-gray-300': '#d1d5db',
                  'bg-gray-400': '#9ca3af', 'bg-gray-500': '#6b7280', 'bg-gray-600': '#4b5563',
                  'bg-gray-700': '#374151', 'bg-gray-800': '#1f2937', 'bg-gray-900': '#111827',
                  'bg-red-100': '#fee2e2', 'bg-red-200': '#fecaca', 'bg-red-300': '#fca5a5',
                  'bg-red-400': '#f87171', 'bg-red-500': '#ef4444', 'bg-red-600': '#dc2626',
                  'bg-orange-100': '#ffedd5', 'bg-orange-200': '#fed7aa', 'bg-orange-300': '#fdba74',
                  'bg-orange-400': '#fb923c', 'bg-orange-500': '#f97316', 'bg-orange-600': '#ea580c',
                  'bg-yellow-100': '#fef3c7', 'bg-yellow-200': '#fde68a', 'bg-yellow-300': '#fcd34d',
                  'bg-yellow-400': '#fbbf24', 'bg-yellow-500': '#f59e0b', 'bg-yellow-600': '#d97706',
                  'bg-green-100': '#d1fae5', 'bg-green-200': '#a7f3d0', 'bg-green-300': '#6ee7b7',
                  'bg-green-400': '#34d399', 'bg-green-500': '#10b981', 'bg-green-600': '#059669',
                  'bg-blue-100': '#dbeafe', 'bg-blue-200': '#bfdbfe', 'bg-blue-300': '#93c5fd',
                  'bg-blue-400': '#60a5fa', 'bg-blue-500': '#3b82f6', 'bg-blue-600': '#2563eb',
                  'bg-purple-100': '#e9d5ff', 'bg-purple-200': '#ddd6fe', 'bg-purple-300': '#c4b5fd',
                  'bg-purple-400': '#a78bfa', 'bg-purple-500': '#8b5cf6', 'bg-purple-600': '#7c3aed',
                  'bg-pink-100': '#fce7f3', 'bg-pink-200': '#fbcfe8', 'bg-pink-300': '#f9a8d4',
                  'bg-pink-400': '#f472b6', 'bg-pink-500': '#ec4899', 'bg-pink-600': '#db2777'
                };

                let rawColor = personalSlot.color || '#8b5cf6';
                const personalColor = tailwindToHex[rawColor] || rawColor;

                slotClass = 'hover:opacity-90';
                customStyle = { backgroundColor: personalColor + 'CC' };
                const displayTitle = personalSlot.title || personalSlot.subjectName || personalSlot.academyName || '일정';
                content = (
                  <span className="text-xs truncate px-1 font-medium" style={{ color: '#000000' }} title={`개인시간: ${displayTitle}`}>
                    {displayTitle}
                  </span>
                );
              } else if (recurringSlot) {
                // 반복 일정 (가장 낮은 우선순위)
                slotClass = `${priorityConfig[recurringSlot.priority]?.color || 'bg-blue-400'} hover:opacity-90`;
                content = (
                  <span className="text-xs text-white truncate px-1 font-medium" title={priorityConfig[recurringSlot.priority]?.label}>
                    {priorityConfig[recurringSlot.priority]?.label}
                  </span>
                );
              }

              return (
                <div
                  key={day.dayOfWeek}
                  className={`col-span-1 border-r border-gray-200 last:border-r-0 h-8 flex items-center justify-center transition-all duration-200 cursor-pointer ${slotClass}`}
                  style={customStyle}
                >
                  {content}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DetailedWeekView;
