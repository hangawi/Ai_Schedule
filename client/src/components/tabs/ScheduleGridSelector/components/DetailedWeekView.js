/**
 * ===================================================================================================
 * DetailedWeekView.js - 주간 상세 뷰 컴포넌트 (분할 모드)
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/ScheduleGridSelector/components
 *
 * 🎯 주요 기능:
 *    - 10분 단위 세부 시간표 그리드 표시
 *    - 시간 슬롯별로 각 일정을 개별 셀에 표시
 *    - 개인시간, 선호시간, 예외시간을 색상으로 구분
 *    - 우선순위: 예외 일정 > 개인 시간 > 반복 일정
 *    - 반복 일정 vs 특정 날짜 일정 구분
 *
 * 🔗 연결된 파일:
 *    - ../index.js - 이 컴포넌트를 렌더링하여 분할 모드 제공
 *    - ../utils/timeUtils.js - timeToMinutes 함수 사용
 *    - ../constants/scheduleConstants.js - DAYS, PRIORITY_CONFIG 상수 사용
 *    - ../hooks/useTimeSlots.js - allPersonalTimes, getCurrentTimeSlots 제공
 *
 * 💡 UI 위치:
 *    - 탭: 프로필 탭
 *    - 섹션: 스케줄 그리드 > 주간 뷰 > 분할 모드
 *    - 경로: 앱 실행 > 프로필 탭 > 스케줄 그리드 > 분할 버튼 클릭
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 분할 모드 시간표의 UI와 색상 로직이 변경됨
 *    - 셀 높이 변경: h-8 값 수정
 *    - 색상 우선순위 변경: exceptionSlot > personalSlot > recurringSlot 순서 변경
 *    - Tailwind 색상 매핑 변경: tailwindToHex 테이블 수정
 *
 * 📝 참고사항:
 *    - 10분 단위 그리드 (TIME_SLOT_INTERVAL=10)
 *    - 예외 일정: priority 색상, 개인 시간: 커스텀 hex 색상 (투명도 CC)
 *    - 반복 일정: priority 색상
 *    - 자정 넘김 처리: endMinutes <= startMinutes 확인
 *    - 9시간(54슬롯) 넘으면 maxHeight 60vh, 아니면 70vh
 *
 * ===================================================================================================
 */

import React from 'react';
import { timeToMinutes } from '../utils/timeUtils';
import { DAYS, PRIORITY_CONFIG } from '../constants/scheduleConstants';

/**
 * DetailedWeekView - 주간 상세 뷰 컴포넌트 (분할 모드)
 *
 * @description 10분 단위로 세부 시간표를 그리드 형태로 표시하는 컴포넌트
 * @param {Object} props - 컴포넌트 props
 * @param {Array} props.allPersonalTimes - 개인 시간 배열 (personalTimes + fixedSchedules)
 * @param {Array} props.schedule - 기본 일정 (선호 시간, 반복 일정)
 * @param {Array} props.exceptions - 특정 날짜 예외 일정
 * @param {Array} props.weekDates - 주간 날짜 배열 (7개 요소, 일요일~토요일)
 * @param {Function} props.getCurrentTimeSlots - 현재 시간 슬롯 배열 반환 함수
 * @param {Object} props.priorityConfig - 우선순위 설정 객체 (색상 및 레이블)
 * @returns {JSX.Element} 분할 모드 시간표 UI
 *
 * @example
 * <DetailedWeekView
 *   allPersonalTimes={allPersonalTimes}
 *   schedule={schedule}
 *   exceptions={exceptions}
 *   weekDates={weekDates}
 *   getCurrentTimeSlots={getCurrentTimeSlots}
 *   priorityConfig={PRIORITY_CONFIG}
 * />
 *
 * @note
 * - 우선순위: exceptionSlot (예외 일정) > personalSlot (개인 시간) > recurringSlot (반복 일정)
 * - 개인 시간 색상: hex 코드 + CC (투명도 80%)
 * - 예외/반복 일정 색상: PRIORITY_CONFIG에서 가져옴
 * - 자정 넘김 처리: endMinutes <= startMinutes 확인
 * - 반복 일정: days 배열로 요일 판단, 특정 날짜: specificDate로 판단
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

              /**
               * 1. 반복 일정 (schedule) 확인
               *
               * @description 요일과 시작 시간이 일치하는 반복 일정 찾기
               * @note
               * - dayOfWeek로 요일 확인
               * - startTime이 현재 time과 정확히 일치해야 함
               */
              const recurringSlot = schedule.find(s => s.dayOfWeek === day.dayOfWeek && s.startTime === time);

              /**
               * 2. 예외 일정 (exceptions) 확인
               *
               * @description 특정 날짜에 지정된 예외 일정 찾기
               *
               * @process
               * 1. specificDate가 dateStr과 일치하는지 확인
               * 2. startTime이 ISO 형식 또는 HH:MM 형식인지 확인
               * 3. 현재 time이 시작~종료 시간 범위에 있는지 확인
               *
               * @note
               * - ISO 형식: new Date()로 파싱하여 시간 추출
               * - HH:MM 형식: timeToMinutes로 변환
               * - currentMinutes >= startMins && currentMinutes < endMins
               */
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

              /**
               * 3. 개인 시간 (personalTimes) 확인
               *
               * @description 개인시간 또는 고정일정 찾기 (반복 일정 또는 특정 날짜)
               *
               * @process
               * 1. specificDate가 있고 isRecurring이 false면 특정 날짜로 비교
               * 2. 없으면 반복 일정으로 판단 (days 배열로 요일 확인)
               * 3. 시작~종료 시간 범위에 현재 time이 있는지 확인
               * 4. 자정 넘김 처리 (endMinutes <= startMinutes)
               *
               * @note
               * - days 배열의 7은 0(일요일)으로 변환
               * - 자정 넘김: currentMinutes >= startMinutes || currentMinutes < endMinutes
               * - 일반: currentMinutes >= startMinutes && currentMinutes < endMinutes
               */
              const personalSlot = allPersonalTimes.find(p => {
                const personalDays = p.days || [];

                // ⭐ specificDate가 있고 반복되지 않는 일정이면 정확한 날짜로 비교
                if (p.specificDate && p.isRecurring === false) {
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

              /**
               * 셀 스타일 및 내용 결정
               *
               * @description 우선순위에 따라 셀의 색상과 내용 결정
               *
               * @priority
               * 1. exceptionSlot (예외 일정) - 가장 높은 우선순위
               * 2. personalSlot (개인 시간) - 두 번째 우선순위
               * 3. recurringSlot (반복 일정) - 가장 낮은 우선순위
               *
               * @note
               * - exceptionSlot: priorityConfig 색상 사용
               * - personalSlot: hex 색상 + CC (투명도 80%)
               * - recurringSlot: priorityConfig 색상 사용
               * - Tailwind 클래스를 hex 코드로 변환 (tailwindToHex 매핑)
               */
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
