import React from 'react';
import { timeToMinutes, minutesToTime, getEndTimeForBlock } from '../utils/timeUtils';
import { PRIORITY_CONFIG } from '../constants/scheduleConstants';

/**
 * 병합 주간 뷰 컴포넌트
 * - 같은 제목의 연속된 시간 블록을 병합하여 표시
 * - 겹치는 일정은 옆으로 나란히 배치
 * - 각 날짜별 독립적인 컬럼으로 렌더링
 *
 * @param {Object} props
 * @param {Array} props.allPersonalTimes - 개인 시간 배열 (personalTimes + fixedSchedules)
 * @param {Array} props.schedule - 기본 일정 (선호 시간)
 * @param {Array} props.exceptions - 특정 날짜 예외 일정
 * @param {Array} props.weekDates - 주간 날짜 배열
 * @param {Function} props.getCurrentTimeSlots - 현재 시간 슬롯 가져오기 함수
 * @param {boolean} props.showFullDay - 24시간 모드 여부
 * @param {Object} props.priorityConfig - 우선순위 설정 객체
 */
const MergedWeekView = ({
  allPersonalTimes,
  schedule,
  exceptions,
  weekDates,
  getCurrentTimeSlots,
  showFullDay,
  priorityConfig
}) => {
  /**
   * 각 요일별 일정 가져오기
   * personalTimes, schedule, exceptions를 병합하고 같은 제목끼리 연속된 시간 블록 병합
   *
   * @param {number} dayOfWeek - JavaScript 요일 (0=일, 1=월, ...)
   * @param {Date} targetDate - 대상 날짜
   * @returns {Array} 병합된 일정 배열
   */
  const getDaySchedules = (dayOfWeek, targetDate) => {
    // 1. personalTimes에서 해당 요일 필터링 + 색상 추가
    const personalFiltered = allPersonalTimes.filter(p => {
      const personalDays = p.days || [];

      // ⭐ specificDate가 있으면 정확한 날짜로 비교 (병합모드는 날짜별로 독립적으로 호출됨)
      if (p.specificDate && personalDays.length === 0) {
        if (targetDate) {
          // targetDate와 정확히 비교
          const scheduleDate = new Date(p.specificDate);
          const targetDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
          const scheduleDateStr = `${scheduleDate.getFullYear()}-${String(scheduleDate.getMonth() + 1).padStart(2, '0')}-${String(scheduleDate.getDate()).padStart(2, '0')}`;
          return targetDateStr === scheduleDateStr;
        } else {
          // targetDate가 없으면 요일만 비교 (fallback)
          const dateObj = new Date(p.specificDate);
          const dateDay = dateObj.getDay();
          return dateDay === dayOfWeek;
        }
      }

      // days 배열이 비어있으면서 specificDate도 없으면 모든 요일에 표시 (기본값)
      if (personalDays.length === 0 && p.isRecurring !== false) {
        return true; // 모든 요일에 표시
      }

      // days 배열이 JavaScript 형식인지 DB 형식인지 모르므로 둘 다 확인
      const matchesJS = p.isRecurring !== false && personalDays.includes(dayOfWeek); // JS 형식 (0=일, 1=월, ...)
      const matchesDB = p.isRecurring !== false && personalDays.map(day => day === 7 ? 0 : day).includes(dayOfWeek); // DB 형식 변환

      const matches = matchesJS || matchesDB;

      return matches;
    }).map(p => ({
      ...p,
      // 개인시간에 색상이 없으면 보라색 할당
      color: p.color || '#8b5cf6'
    })).filter(p => {
      // ⭐ 병합 모드에서도 기본 모드일 때는 수면시간 제외
      if (showFullDay) return true; // 24시간 모드이면 모두 표시

      // 기본 모드에서는 수면시간 제외 (제목에 '수면' 포함 또는 22:00 이후 시작)
      const isSleepTime = p.title?.includes('수면') ||
                         p.name?.includes('수면') ||
                         (p.startTime && timeToMinutes(p.startTime) >= 22 * 60);

      return !isSleepTime;
    });

    // 2. schedule (defaultSchedule)에서 해당 요일 필터링 - 선호도를 색상으로 표시
    const priorityColorMap = {
      'bg-blue-600': '#2563eb',  // 선호 (priority 3)
      'bg-blue-400': '#60a5fa',  // 보통 (priority 2)
      'bg-blue-200': '#bfdbfe'   // 조정 가능 (priority 1)
    };
    const scheduleFiltered = schedule.filter(s => s.dayOfWeek === dayOfWeek).map(s => ({
      ...s,
      title: s.title || `${priorityConfig[s.priority]?.label || '일정'}`,
      color: priorityColorMap[priorityConfig[s.priority]?.color] || '#60a5fa',
      days: [dayOfWeek === 0 ? 7 : dayOfWeek], // JavaScript 요일 → DB 요일
      isRecurring: true
    }));

    // 3. exceptions (선호시간 with specificDate)에서 해당 날짜 필터링
    const exceptionsFiltered = exceptions.filter(e => {
      if (e.specificDate && targetDate) {
        const exceptionDate = new Date(e.specificDate);
        const targetDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
        const exceptionDateStr = `${exceptionDate.getFullYear()}-${String(exceptionDate.getMonth() + 1).padStart(2, '0')}-${String(exceptionDate.getDate()).padStart(2, '0')}`;
        return targetDateStr === exceptionDateStr;
      }
      return false;
    }).map(e => ({
      ...e,
      color: priorityColorMap[priorityConfig[e.priority]?.color] || '#2563eb'
    }));

    // 4. 세 배열 합치기 (자정 넘는 일정 분할)
    const allSchedules = [...personalFiltered, ...scheduleFiltered, ...exceptionsFiltered];

    // 자정을 넘나드는 일정을 분할
    const filteredSchedules = [];
    allSchedules.forEach(schedule => {
      const startMin = timeToMinutes(schedule.startTime);
      const endMin = timeToMinutes(schedule.endTime);

      // 자정을 넘는 경우 (예: 22:00~08:00)
      if (endMin <= startMin) {
        // 오늘 밤 부분: startTime ~ 23:50
        filteredSchedules.push({
          ...schedule,
          endTime: '23:50'
        });
        // 내일 새벽 부분: 00:00 ~ endTime
        filteredSchedules.push({
          ...schedule,
          startTime: '00:00',
          endTime: schedule.endTime
        });
      } else {
        // 정상적인 하루 내 시간
        filteredSchedules.push(schedule);
      }
    });

    // 디버깅: 이고은 원장 일정 확인
    const debugSchedules = filteredSchedules.filter(s => s.title?.includes('이고은') || s.instructor?.includes('이고은'));

    // 같은 제목끼리 그룹화 (sourceImageIndex도 포함하여 서로 다른 이미지의 같은 제목은 병합 안함)
    const groupedByTitle = {};
    filteredSchedules.forEach(schedule => {
      const key = `${schedule.title}_${schedule.instructor || ''}_${schedule.type || ''}_${schedule.sourceImageIndex || ''}`;
      if (!groupedByTitle[key]) {
        groupedByTitle[key] = [];
      }
      groupedByTitle[key].push(schedule);
    });

    // 각 그룹에서 시간대를 병합 (실제로 연속되고 중간에 다른 일정이 없을 때만)
    const mergedSchedules = [];
    Object.values(groupedByTitle).forEach(group => {
      if (group.length === 0) return;

      // 시작 시간 기준으로 정렬
      group.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

      // 연속된 시간대만 병합 (중간에 다른 일정이 없는지 확인)
      let current = { ...group[0] };
      for (let i = 1; i < group.length; i++) {
        const next = group[i];
        const currentEndMinutes = timeToMinutes(current.endTime);
        const nextStartMinutes = timeToMinutes(next.startTime);

        // 현재 블록의 끝 시간과 다음 블록의 시작 시간이 정확히 같은지 확인
        if (currentEndMinutes === nextStartMinutes) {
          // 중간에 다른 일정이 있는지 확인
          const hasConflict = filteredSchedules.some(other => {
            const otherKey = `${other.title}_${other.instructor || ''}_${other.type || ''}_${other.sourceImageIndex || ''}`;
            const currentKey = `${current.title}_${current.instructor || ''}_${current.type || ''}_${current.sourceImageIndex || ''}`;

            // 다른 일정이고, 현재-다음 사이에 겹치는지 확인
            if (otherKey !== currentKey) {
              const otherStart = timeToMinutes(other.startTime);
              const otherEnd = timeToMinutes(other.endTime);

              // 중간 시간대에 겹치는 일정이 있으면 병합 불가
              const conflict = (otherStart < nextStartMinutes && otherEnd > currentEndMinutes) ||
                     (otherStart >= currentEndMinutes && otherStart < nextStartMinutes);

              return conflict;
            }
            return false;
          });

          if (!hasConflict) {
            // 중간에 다른 일정이 없으면 병합
            current.endTime = next.endTime;
          } else {
            // 중간에 다른 일정이 있으면 병합 안함
            mergedSchedules.push(current);
            current = { ...next };
          }
        } else {
          // 연속되지 않으면 현재 블록 저장하고 새로운 블록 시작
          mergedSchedules.push(current);
          current = { ...next };
        }
      }
      mergedSchedules.push(current);
    });

    // 디버깅: 병합 후 이고은 원장 일정 확인
    const debugMerged = mergedSchedules.filter(s => s.title?.includes('이고은') || s.instructor?.includes('이고은'));

    return mergedSchedules;
  };

  const timeSlots = getCurrentTimeSlots();

  /**
   * 시간 슬롯별 위치 계산을 위한 헬퍼 함수
   * @param {string} time - 시간 (HH:MM 형식)
   * @returns {number} 시간 슬롯 인덱스
   */
  const getTimeSlotIndex = (time) => {
    // 정확히 일치하는 슬롯 찾기
    const exactIndex = timeSlots.findIndex(slot => slot === time);
    if (exactIndex !== -1) return exactIndex;

    // 정확히 일치하지 않으면 분 단위로 계산
    const timeMinutes = timeToMinutes(time);
    const startMinutes = timeToMinutes(timeSlots[0]);

    // 10분 단위 슬롯 인덱스 계산
    const index = Math.floor((timeMinutes - startMinutes) / 10);
    return Math.max(0, index);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm w-full">
      {/* 헤더 추가 - 요일과 날짜 표시 */}
      <div className="flex bg-gray-100 sticky top-0 z-10 border-b border-gray-300">
        <div className="w-16 flex-shrink-0 p-2 text-center font-semibold text-gray-700 border-r border-gray-300 text-sm">시간</div>
        {weekDates.slice(0, 7).map((date, index) => (
          <div key={index} className="flex-1 p-2 text-center font-semibold text-gray-700 border-r border-gray-200 last:border-r-0 text-sm">
            {date.display}
          </div>
        ))}
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: '1000px' }}>
        <div className="flex w-full">
          {/* 시간 컬럼은 전체 시간대 표시 */}
          <div className="w-16 flex-shrink-0">
            {timeSlots.map(time => (
              <div
                key={time}
                className="h-4 px-1 text-center text-xs font-medium text-gray-600 border-b border-gray-200 flex items-center justify-center"
              >
                {time}
              </div>
            ))}
          </div>

          {/* 각 날짜별 독립적 컬럼 */}
          {weekDates.slice(0, 7).map((dateInfo, dayIndex) => {
            const daySchedules = getDaySchedules(dateInfo.dayOfWeek, dateInfo.fullDate);
            const totalHeight = timeSlots.length * 16; // 전체 컬럼 높이 (h-4 = 16px)

            // 각 일정을 세그먼트로 분할 (겹치는 구간별로)
            const segments = [];

            daySchedules.forEach((schedule, scheduleIndex) => {
              const startMin = timeToMinutes(schedule.startTime);
              const endMin = timeToMinutes(schedule.endTime);

              // 모든 경계점 찾기 (이 일정의 시작/끝 + 겹치는 일정들의 시작/끝)
              const boundaries = [startMin];
              daySchedules.forEach(other => {
                const otherStart = timeToMinutes(other.startTime);
                const otherEnd = timeToMinutes(other.endTime);
                if (otherStart > startMin && otherStart < endMin) boundaries.push(otherStart);
                if (otherEnd > startMin && otherEnd < endMin) boundaries.push(otherEnd);
              });
              boundaries.push(endMin);
              boundaries.sort((a, b) => a - b);

              // 각 세그먼트마다 겹치는 일정 개수 계산
              for (let i = 0; i < boundaries.length - 1; i++) {
                const segStart = boundaries[i];
                const segEnd = boundaries[i + 1];

                // 이 세그먼트와 겹치는 일정들
                const overlapping = daySchedules.filter(other => {
                  const otherStart = timeToMinutes(other.startTime);
                  const otherEnd = timeToMinutes(other.endTime);
                  return otherStart <= segStart && otherEnd >= segEnd;
                });

                const overlapIndex = overlapping.findIndex(s => s === schedule);
                if (overlapIndex === -1) continue; // 이 세그먼트에 현재 일정이 없음

                segments.push({
                  schedule,
                  startMin: segStart,
                  endMin: segEnd,
                  overlapIndex,
                  overlapCount: overlapping.length
                });
              }
            });

            return (
              <div key={dayIndex} className="flex-1 border-l border-gray-200 relative" style={{ height: `${totalHeight}px` }}>
                {segments.map((seg, segIndex) => {
                  const duration = seg.endMin - seg.startMin;
                  const blockHeight = duration * 1.6; // 1분 = 1.6px
                  const startTime = minutesToTime(seg.startMin);
                  const startIndex = getTimeSlotIndex(startTime);
                  const topPosition = startIndex * 16;

                  // ⭐ 스케줄의 색상 사용 (우선순위: backgroundColor → sourceImageIndex → 기본 보라색)
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

                  // ⭐ 색상 결정 로직 개선
                  let rawColor = seg.schedule.color; // 먼저 스케줄의 color 필드 확인
                  
                  // 🎨 디버깅: MergedWeekView 색상 적용
                  console.log(`🎨 [MergedWeekView] ${seg.schedule.title} 렌더링:`, {
                    color: seg.schedule.color,
                    backgroundColor: seg.schedule.backgroundColor,
                    sourceImageIndex: seg.schedule.sourceImageIndex
                  });
                  
                  // color가 없으면 sourceImageIndex 기반으로 색상 할당
                  if (!rawColor && seg.schedule.sourceImageIndex !== undefined) {
                    const { getColorForImageIndex } = require('../../../../utils/scheduleAnalysis/assignScheduleColors');
                    const colorInfo = getColorForImageIndex(seg.schedule.sourceImageIndex);
                    rawColor = colorInfo.border; // 이미지 인덱스 색상 사용
                    console.log(`  📊 fallback to sourceImageIndex: ${seg.schedule.sourceImageIndex} → ${rawColor}`);
                  }
                  
                  // 그래도 없으면 기본 보라색
                  if (!rawColor) {
                    rawColor = '#8b5cf6';
                    console.log(`  ⚪ fallback to default: ${rawColor}`);
                  } else {
                    console.log(`  ✅ 최종 색상: ${rawColor}`);
                  }
                  
                  const bgColor = tailwindToHex[rawColor] || rawColor;

                  const columnWidth = seg.overlapCount > 1 ? `${100 / seg.overlapCount}%` : '100%';
                  const leftPosition = seg.overlapCount > 1 ? `${(100 / seg.overlapCount) * seg.overlapIndex}%` : '0%';

                  // 같은 일정의 연속 세그먼트인지 확인 (같은 스케줄이면 overlapIndex 달라도 OK)
                  const prevSeg = segIndex > 0 ? segments[segIndex - 1] : null;
                  const nextSeg = segIndex < segments.length - 1 ? segments[segIndex + 1] : null;

                  const isSameSchedule = (s1, s2) => {
                    return s1.schedule === s2.schedule ||
                           (s1.schedule.title === s2.schedule.title &&
                            s1.schedule.startTime === s2.schedule.startTime &&
                            s1.schedule.endTime === s2.schedule.endTime);
                  };

                  const hasSameAbove = prevSeg &&
                                      isSameSchedule(prevSeg, seg) &&
                                      prevSeg.endMin === seg.startMin;

                  const hasSameBelow = nextSeg &&
                                      isSameSchedule(nextSeg, seg) &&
                                      nextSeg.startMin === seg.endMin;

                  // 같은 일정(schedule 객체 기준)의 모든 세그먼트 찾고 가장 큰 세그먼트 찾기
                  const allSameSegments = segments.filter(s =>
                    s.schedule === seg.schedule ||
                    (s.schedule.title === seg.schedule.title &&
                     s.schedule.startTime === seg.schedule.startTime &&
                     s.schedule.endTime === seg.schedule.endTime)
                  );

                  // 가장 큰 세그먼트 찾기
                  const largestSeg = allSameSegments.reduce((max, curr) => {
                    const currDuration = curr.endMin - curr.startMin;
                    const maxDuration = max.endMin - max.startMin;
                    return currDuration > maxDuration ? curr : max;
                  }, allSameSegments[0]);

                  const isLargestSegment = largestSeg.startMin === seg.startMin &&
                                          largestSeg.endMin === seg.endMin &&
                                          largestSeg.overlapIndex === seg.overlapIndex;

                  // border 클래스 동적 생성
                  let borderClasses = 'absolute text-center px-1 text-white';
                  if (!hasSameAbove) borderClasses += ' border-t';
                  if (!hasSameBelow) borderClasses += ' border-b';
                  borderClasses += ' border-l border-r border-gray-300';

                  return (
                    <div
                      key={`${dateInfo.dayOfWeek}-${segIndex}`}
                      className={borderClasses}
                      style={{
                        height: `${blockHeight}px`,
                        top: `${topPosition}px`,
                        left: leftPosition,
                        width: columnWidth,
                        backgroundColor: bgColor,
                        zIndex: seg.overlapIndex
                      }}
                      title={`${seg.schedule.academyName ? seg.schedule.academyName + ' - ' : ''}${seg.schedule.subjectName ? seg.schedule.subjectName + ' - ' : ''}${seg.schedule.title}${seg.schedule.instructor ? ` (${seg.schedule.instructor})` : ''}${seg.schedule.floor ? ` (${seg.schedule.floor}층)` : ''} (${seg.schedule.startTime}~${seg.schedule.endTime})`}
                    >
                      {isLargestSegment && (
                        <div className="text-xs leading-tight flex flex-col items-center justify-center h-full overflow-hidden">
                          <div className="w-full px-1 text-center">
                            {/* 블록 높이에 따라 표시 방식 변경 */}
                            {duration >= 60 ? (
                              // ===== 60분 이상: 4줄 전체 표시 =====
                              <>
                                {/* 1. 학원 풀네임 */}
                                {seg.schedule.academyName && (
                                  <div className="text-[8px] font-bold opacity-90 whitespace-nowrap overflow-hidden text-ellipsis">{seg.schedule.academyName}</div>
                                )}
                                {/* 2. 과목명 */}
                                {seg.schedule.subjectName && (
                                  <div className="text-[9px] font-semibold opacity-80 whitespace-nowrap overflow-hidden text-ellipsis">{seg.schedule.subjectName}</div>
                                )}
                                {/* 3. 반이름(강사명) */}
                                <div className="font-semibold text-[10px] whitespace-nowrap overflow-hidden text-ellipsis">
                                  {seg.schedule.title || seg.schedule.subjectName || seg.schedule.academyName || '일정'}
                                  {seg.schedule.instructor && <span className="text-[9px]">({seg.schedule.instructor})</span>}
                                  {seg.schedule.floor && <span className="text-[8px] ml-1">({seg.schedule.floor}층)</span>}
                                </div>
                                {/* 4. 시간 */}
                                <div className="text-[9px] mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{seg.schedule.startTime}~{seg.schedule.endTime}</div>
                              </>
                            ) : (
                              // ===== 30분: 2줄만 표시 (과목명 + 시간) =====
                              <>
                                {/* 1. 과목명 (없으면 강사명) */}
                                <div className="font-semibold text-[11px] whitespace-nowrap overflow-hidden text-ellipsis">
                                  {seg.schedule.subjectName || seg.schedule.title || seg.schedule.academyName || '일정'}
                                </div>
                                {/* 2. 시간 */}
                                <div className="text-[10px] mt-1 whitespace-nowrap overflow-hidden text-ellipsis">{seg.schedule.startTime}~{seg.schedule.endTime}</div>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MergedWeekView;
