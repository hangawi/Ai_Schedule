import React from 'react';
import { X } from 'lucide-react';
import { timeToMinutes } from '../utils/timeUtils';
import { PRIORITY_CONFIG } from '../constants/scheduleConstants';

/**
 * 날짜 상세 모달 컴포넌트
 * - 특정 날짜의 세부 시간표를 병합/분할 모드로 표시
 * - 병합 모드: 연속된 시간 블록으로 표시
 * - 분할 모드: 10분 단위 세부 시간표
 *
 * @param {Object} props
 * @param {boolean} props.show - 모달 표시 여부
 * @param {Function} props.onClose - 모달 닫기 핸들러
 * @param {Object} props.selectedDate - 선택된 날짜 데이터
 * @param {Array} props.allPersonalTimes - 개인 시간 배열
 * @param {Array} props.schedule - 기본 일정
 * @param {Array} props.exceptions - 예외 일정
 * @param {Function} props.getCurrentTimeSlots - 시간 슬롯 가져오기 함수
 * @param {boolean} props.showFullDay - 24시간 모드 여부
 * @param {Function} props.setShowFullDay - 24시간 모드 설정
 * @param {boolean} props.showMerged - 병합 모드 여부
 * @param {Function} props.setShowMerged - 병합 모드 설정
 * @param {Object} props.priorityConfig - 우선순위 설정
 */
const DateDetailModal = ({
  show,
  onClose,
  selectedDate,
  allPersonalTimes,
  schedule,
  exceptions,
  getCurrentTimeSlots,
  showFullDay,
  setShowFullDay,
  showMerged,
  setShowMerged,
  priorityConfig
}) => {
  if (!show || !selectedDate) return null;

  const dayData = selectedDate;
  const timeSlots = getCurrentTimeSlots();
  const dateStr = `${dayData.date.getFullYear()}-${String(dayData.date.getMonth() + 1).padStart(2, '0')}-${String(dayData.date.getDate()).padStart(2, '0')}`;

  /**
   * 특정 날짜의 시간 블록 생성 (병합 모드용)
   * @param {Date} date - 날짜
   * @param {number} dayOfWeek - 요일
   * @returns {Array} 시간 블록 배열
   */
  const getBlocksForDay = (date, dayOfWeek) => {
    const allPossibleSlots = timeSlots;
    const slotMap = new Map();

    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    // 각 시간 슬롯에 해당하는 이벤트 할당
    allPossibleSlots.forEach(time => {
      const timeMinutes = timeToMinutes(time);
      let assignedEvents = [];

      // 예외 일정 우선 확인
      const exceptionSlot = exceptions.find(e => {
        if (e.specificDate !== dateStr) return false;

        let startMins, endMins;

        if (e.startTime && e.startTime.includes('T')) {
          const startDate = new Date(e.startTime);
          const endDate = new Date(e.endTime);
          startMins = startDate.getHours() * 60 + startDate.getMinutes();
          endMins = endDate.getHours() * 60 + endDate.getMinutes();
        } else if (e.startTime && e.startTime.includes(':')) {
          startMins = timeToMinutes(e.startTime);
          endMins = timeToMinutes(e.endTime);
        } else {
          return false;
        }

        return timeMinutes >= startMins && timeMinutes < endMins;
      });

      if (exceptionSlot) {
        assignedEvents.push({ ...exceptionSlot, type: 'exception' });
      } else {
        // 개인 시간 확인
        const personalSlots = allPersonalTimes.filter(p => {
          const personalDays = p.days || [];

          if (p.specificDate && personalDays.length === 0) {
            const dateObj = new Date(p.specificDate);
            const dateDay = dateObj.getDay();

            if (dateDay !== dayOfWeek) return false;

            const startMinutes = timeToMinutes(p.startTime);
            const endMinutes = timeToMinutes(p.endTime);

            if (endMinutes <= startMinutes) {
              return timeMinutes >= startMinutes || timeMinutes < endMinutes;
            } else {
              return timeMinutes >= startMinutes && timeMinutes < endMinutes;
            }
          }

          if (p.isRecurring !== false && personalDays.length > 0) {
            const convertedDays = personalDays.map(day => day === 7 ? 0 : day);

            if (convertedDays.includes(dayOfWeek)) {
              const startMinutes = timeToMinutes(p.startTime);
              const endMinutes = timeToMinutes(p.endTime);

              if (endMinutes <= startMinutes) {
                if (timeMinutes >= startMinutes || timeMinutes < endMinutes) {
                  return true;
                }
              } else {
                if (timeMinutes >= startMinutes && timeMinutes < endMinutes) {
                  return true;
                }
              }
            }
          }

          return false;
        });

        // 수면시간 필터링
        const filteredPersonalSlots = personalSlots.filter(p => {
          if (showFullDay) return true;

          const isSleepTime = p.title?.includes('수면') ||
                             p.name?.includes('수면') ||
                             (p.startTime && timeToMinutes(p.startTime) >= 22 * 60);

          return !isSleepTime;
        });

        if (filteredPersonalSlots.length > 0) {
          assignedEvents.push(...filteredPersonalSlots.map(p => ({ ...p, type: 'personal' })));
        } else {
          // 기본 일정 확인
          const scheduleSlot = schedule.find(s => {
            if (s.dayOfWeek !== dayOfWeek) return false;
            const startMinutes = timeToMinutes(s.startTime);
            const endMinutes = timeToMinutes(s.endTime);
            return timeMinutes >= startMinutes && timeMinutes < endMinutes;
          });
          if (scheduleSlot) {
            assignedEvents.push({ ...scheduleSlot, type: 'schedule' });
          }
        }
      }

      slotMap.set(time, assignedEvents);
    });

    // 연속된 블록들 병합
    const blocks = [];
    let currentBlock = null;

    allPossibleSlots.forEach(time => {
      let events = slotMap.get(time) || [];

      // 중복 이벤트 제거
      const uniqueEvents = [];
      const seenKeys = new Set();
      events.forEach(e => {
        const key = `${e.type}_${e.title || e.subjectName || e.academyName || ''}_${e.priority || ''}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          uniqueEvents.push(e);
        }
      });
      events = uniqueEvents;

      if (!events || events.length === 0) {
        // 빈 시간
        if (currentBlock && currentBlock.type === 'empty') {
          currentBlock.duration += 10;
        } else {
          if (currentBlock) blocks.push(currentBlock);
          currentBlock = {
            type: 'empty',
            startTime: time,
            duration: 10
          };
        }
      } else {
        // 이벤트가 있는 시간
        const isSameEventSet = currentBlock && currentBlock.events &&
                              currentBlock.events.length === events.length &&
                              (() => {
                                const getEventKey = (e) => {
                                  const title = e.title || e.subjectName || e.academyName || '';
                                  const type = e.type || 'unknown';
                                  const priority = e.priority || '';
                                  return `${type}_${title}_${priority}`;
                                };
                                const currentKeys = currentBlock.events.map(getEventKey).sort().join('|');
                                const newKeys = events.map(getEventKey).sort().join('|');
                                return currentKeys === newKeys;
                              })();

        // 시간 연속성 확인
        const isTimeConsecutive = (() => {
          if (!currentBlock) return false;

          const prevSlotEndMins = timeToMinutes(currentBlock.startTime) + currentBlock.duration;
          const currentSlotStartMins = timeToMinutes(time);

          if (prevSlotEndMins === currentSlotStartMins) {
            return true;
          }

          // 자정을 넘는 경우
          if (prevSlotEndMins === 1440 && currentSlotStartMins === 0) {
            return true;
          }

          return false;
        })();

        if (isSameEventSet && isTimeConsecutive) {
          currentBlock.duration += 10;
        } else {
          if (currentBlock) {
            blocks.push(currentBlock);
          }

          const baseBlock = {
            type: events.length > 1 ? 'multiple' : events[0].type,
            events: events,
            startTime: time,
            duration: 10
          };

          if (events.length === 1) {
            const evt = events[0];
            if (evt.title) baseBlock.title = evt.title;
            if (evt.subjectName) baseBlock.subjectName = evt.subjectName;
            if (evt.academyName) baseBlock.academyName = evt.academyName;
            if (evt.priority !== undefined) baseBlock.priority = evt.priority;
            if (evt.color) baseBlock.color = evt.color;
            if (evt.dayOfWeek !== undefined) baseBlock.dayOfWeek = evt.dayOfWeek;
          }

          currentBlock = baseBlock;
        }
      }
    });

    if (currentBlock) {
      blocks.push(currentBlock);
    }

    // 각 블록의 endTime 계산
    blocks.forEach(block => {
      const startMinutes = timeToMinutes(block.startTime);
      const endMinutes = startMinutes + block.duration;
      const endHour = Math.floor(endMinutes / 60) % 24;
      const endMin = endMinutes % 60;
      block.endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
    });

    return blocks;
  };

  /**
   * 선호시간 체크 헬퍼 함수
   * @param {number} dayOfWeek - 요일
   * @param {string} time - 시간
   * @param {string} dateStr - 날짜 문자열
   * @returns {boolean} 선호시간 여부
   */
  const hasPreferredTime = (dayOfWeek, time, dateStr) => {
    const timeMinutes = timeToMinutes(time);

    // 예외 일정 확인
    const exceptionSlot = exceptions.find(e => {
      if (e.specificDate !== dateStr) return false;
      if (!e.priority || e.priority < 2) return false;

      let startMins, endMins;
      if (e.startTime && e.startTime.includes('T')) {
        const startDate = new Date(e.startTime);
        const endDate = new Date(e.endTime);
        startMins = startDate.getHours() * 60 + startDate.getMinutes();
        endMins = endDate.getHours() * 60 + endDate.getMinutes();
      } else if (e.startTime && e.startTime.includes(':')) {
        startMins = timeToMinutes(e.startTime);
        endMins = timeToMinutes(e.endTime);
      } else {
        return false;
      }

      return timeMinutes >= startMins && timeMinutes < endMins;
    });

    if (exceptionSlot) return true;

    // 반복 일정에서 선호시간 확인
    const preferredSlot = schedule.find(s => {
      if (s.dayOfWeek !== dayOfWeek) return false;
      if (!s.priority || s.priority < 2) return false;
      const startMinutes = timeToMinutes(s.startTime);
      const endMinutes = timeToMinutes(s.endTime);
      return timeMinutes >= startMinutes && timeMinutes < endMinutes;
    });

    return !!preferredSlot;
  };

  // 병합 모드일 때 실시간으로 blocks 생성
  const dayBlocks = showMerged ? getBlocksForDay(dayData.date, dayData.dayOfWeek) : null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden">
        {/* 헤더 */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-bold text-gray-800">
            {dayData.date.getMonth() + 1}월 {dayData.date.getDate()}일 ({['일', '월', '화', '수', '목', '금', '토'][dayData.date.getDay()]}) 시간표
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFullDay(!showFullDay)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                showFullDay
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {showFullDay ? '24시간' : '기본'}
            </button>
            <button
              onClick={() => setShowMerged(!showMerged)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                showMerged
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {showMerged ? '병합' : '분할'}
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 80px)' }}>
          {showMerged ? (
            // 병합 모드: 블록 형태로 표시
            <div className="space-y-2">
              {!dayBlocks || dayBlocks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  표시할 일정이 없습니다.
                </div>
              ) : dayBlocks.map((block, index) => {
                let bgColor = 'bg-gray-50';
                let textColor = 'text-gray-500';
                let content = '';

                if (block.type === 'schedule') {
                  bgColor = priorityConfig[block.priority]?.color || 'bg-blue-400';
                  textColor = 'text-white';
                  content = `${priorityConfig[block.priority]?.label} (${block.duration}분)`;
                } else if (block.type === 'exception') {
                  bgColor = priorityConfig[block.priority]?.color || 'bg-blue-600';
                  textColor = 'text-white';
                  content = `${block.title} (${block.duration}분)`;
                } else if (block.type === 'personal') {
                  const title = block.title || block.subjectName || block.academyName || '개인일정';
                  const isSleepTime = title.includes('수면') || title.includes('睡眠') || title.toLowerCase().includes('sleep');

                  const tailwindToHex = {
                    'bg-purple-100': '#e9d5ff', 'bg-purple-200': '#ddd6fe', 'bg-purple-300': '#c4b5fd',
                    'bg-purple-400': '#a78bfa', 'bg-purple-500': '#8b5cf6', 'bg-purple-600': '#7c3aed'
                  };
                  let rawColor = block.color || '#8b5cf6';
                  const personalColor = tailwindToHex[rawColor] || rawColor;
                  bgColor = personalColor + 'CC';
                  textColor = 'text-black';
                  content = `${isSleepTime ? '수면시간' : title} (${block.duration}분)`;
                } else {
                  // 빈 시간
                  const isPreferred = hasPreferredTime(dayData.dayOfWeek, block.startTime, dateStr);
                  if (!isPreferred) {
                    bgColor = 'bg-red-200';
                    textColor = 'text-red-900';
                    content = `불가능 시간 (${block.duration}분)`;
                  } else {
                    bgColor = 'bg-gray-50';
                    textColor = 'text-gray-500';
                    content = `빈 시간 (${block.duration}분)`;
                  }
                }

                const isHexColor = typeof bgColor === 'string' && bgColor.startsWith('#');

                return (
                  <div
                    key={index}
                    className={`p-3 rounded-lg ${isHexColor ? '' : bgColor}`}
                    style={isHexColor ? { backgroundColor: bgColor } : {}}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className={`text-sm font-medium ${textColor}`}>
                        {block.startTime}~{block.endTime}
                      </span>
                      <span className={`text-xs ${textColor}`}>
                        {Math.floor(block.duration / 60) > 0 && `${Math.floor(block.duration / 60)}시간 `}
                        {block.duration % 60 > 0 && `${block.duration % 60}분`}
                      </span>
                    </div>
                    <div className={`text-sm mt-1 ${textColor}`}>
                      {content}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // 일반 모드: 10분 단위 세부 시간표
            <div className="space-y-1">
              {timeSlots.map(time => {
                const timeMinutes = timeToMinutes(time);

                const recurringSlot = schedule.find(s => s.dayOfWeek === dayData.dayOfWeek && s.startTime === time);

                const exceptionSlot = exceptions.find(e => {
                  if (e.specificDate !== dateStr) return false;

                  let startMins, endMins;

                  if (e.startTime && e.startTime.includes('T')) {
                    const startDate = new Date(e.startTime);
                    const endDate = new Date(e.endTime);
                    startMins = startDate.getHours() * 60 + startDate.getMinutes();
                    endMins = endDate.getHours() * 60 + endDate.getMinutes();
                  } else if (e.startTime && e.startTime.includes(':')) {
                    startMins = timeToMinutes(e.startTime);
                    endMins = timeToMinutes(e.endTime);
                  } else {
                    return false;
                  }

                  return timeMinutes >= startMins && timeMinutes < endMins;
                });

                const personalSlots = allPersonalTimes.filter(p => {
                  const personalDays = p.days || [];

                  if (p.specificDate && personalDays.length === 0) {
                    const dateObj = new Date(p.specificDate);
                    const dateDay = dateObj.getDay();

                    if (dateDay !== dayData.dayOfWeek) {
                      return false;
                    }

                    const startMinutes = timeToMinutes(p.startTime);
                    const endMinutes = timeToMinutes(p.endTime);

                    if (endMinutes <= startMinutes) {
                      return timeMinutes >= startMinutes || timeMinutes < endMinutes;
                    } else {
                      return timeMinutes >= startMinutes && timeMinutes < endMinutes;
                    }
                  }

                  if (p.isRecurring !== false && personalDays.length > 0) {
                    const convertedDays = personalDays.map(day => {
                      return day === 7 ? 0 : day;
                    });
                    if (convertedDays.includes(dayData.dayOfWeek)) {
                      const startMinutes = timeToMinutes(p.startTime);
                      const endMinutes = timeToMinutes(p.endTime);

                      if (endMinutes <= startMinutes) {
                        return timeMinutes >= startMinutes || timeMinutes < endMinutes;
                      } else {
                        return timeMinutes >= startMinutes && timeMinutes < endMinutes;
                      }
                    }
                  }
                  return false;
                });

                let bgColor = 'bg-white';
                let textColor = 'text-gray-900';
                let content = '빈 시간';
                let hasMultiple = false;

                if (exceptionSlot) {
                  bgColor = priorityConfig[exceptionSlot.priority]?.color || 'bg-blue-600';
                  textColor = 'text-white';
                  content = exceptionSlot.title;
                } else if (personalSlots.length > 0) {
                  const firstSlot = personalSlots[0];
                  const title = firstSlot.title || firstSlot.subjectName || firstSlot.academyName || '개인일정';
                  const isSleepTime = title.includes('수면') || title.includes('睡眠') || title.toLowerCase().includes('sleep');

                  const tailwindToHex = {
                    'bg-purple-100': '#e9d5ff', 'bg-purple-200': '#ddd6fe', 'bg-purple-300': '#c4b5fd',
                    'bg-purple-400': '#a78bfa', 'bg-purple-500': '#8b5cf6', 'bg-purple-600': '#7c3aed'
                  };
                  let rawColor = firstSlot.color || '#8b5cf6';
                  bgColor = (tailwindToHex[rawColor] || rawColor) + 'CC';
                  textColor = 'text-black';
                  content = isSleepTime ? '수면시간' : title;
                } else if (recurringSlot) {
                  bgColor = priorityConfig[recurringSlot.priority]?.color || 'bg-blue-400';
                  textColor = 'text-white';
                  content = priorityConfig[recurringSlot.priority]?.label;
                } else {
                  const isPreferred = hasPreferredTime(dayData.dayOfWeek, time, dateStr);
                  if (!isPreferred) {
                    bgColor = 'bg-red-200';
                    textColor = 'text-red-900';
                    content = '불가능';
                  }
                }

                const isHexColor = typeof bgColor === 'string' && bgColor.startsWith('#');

                return (
                  <div
                    key={time}
                    className={`flex items-center justify-between p-2 rounded ${!hasMultiple && !isHexColor ? bgColor : ''} ${bgColor === 'bg-white' ? 'border border-gray-200' : ''}`}
                    style={!hasMultiple && isHexColor ? { backgroundColor: bgColor } : {}}
                  >
                    <span className={`text-sm font-medium ${!hasMultiple ? textColor : 'text-gray-700'}`}>{time}</span>
                    {hasMultiple ? (
                      <div className="flex gap-1 flex-1 ml-2">
                        {personalSlots.map((p, idx) => {
                          const tailwindToHex = {
                            'bg-gray-100': '#f3f4f6', 'bg-gray-200': '#e5e7eb', 'bg-gray-300': '#d1d5db',
                            'bg-gray-400': '#9ca3af', 'bg-gray-500': '#6b7280', 'bg-gray-600': '#4b5563',
                            'bg-red-100': '#fee2e2', 'bg-red-200': '#fecaca', 'bg-red-300': '#fca5a5',
                            'bg-red-400': '#f87171', 'bg-red-500': '#ef4444', 'bg-red-600': '#dc2626',
                            'bg-orange-100': '#ffedd5', 'bg-orange-500': '#f97316', 'bg-orange-600': '#ea580c',
                            'bg-blue-100': '#dbeafe', 'bg-blue-400': '#60a5fa', 'bg-blue-600': '#2563eb'
                          };
                          let rawColor = p.color || '#8b5cf6';
                          const finalColor = (tailwindToHex[rawColor] || rawColor) + 'CC';

                          return (
                            <div
                              key={idx}
                              className="flex-1 text-xs px-2 py-1 rounded text-center"
                              style={{ backgroundColor: finalColor, color: '#000000' }}
                            >
                              {p.title || p.subjectName || p.academyName || '일정'}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className={`text-sm ${textColor}`}>{content}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DateDetailModal;
