import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Grid, Clock, Merge, Split, X } from 'lucide-react';

// --- Constants and Helpers ---
const days = [
  { name: '일', dayOfWeek: 0 },
  { name: '월', dayOfWeek: 1 },
  { name: '화', dayOfWeek: 2 },
  { name: '수', dayOfWeek: 3 },
  { name: '목', dayOfWeek: 4 },
  { name: '금', dayOfWeek: 5 },
  { name: '토', dayOfWeek: 6 },
];

const monthNames = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월'
];

const priorityConfig = {
  3: { label: '선호', color: 'bg-blue-600' },
  2: { label: '보통', color: 'bg-blue-400' },
  1: { label: '조정 가능', color: 'bg-blue-200' },
};

const generateTimeSlots = (startHour = 0, endHour = 24) => {
  const slots = [];
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += 10) {
      const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      slots.push(time);
    }
  }
  return slots;
};

const getSundayOfCurrentWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  // 현재 날짜에서 요일만큼 빼서 해당 주의 일요일을 구함
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
};

const timeToMinutes = (timeString) => {
  if (!timeString || !timeString.includes(':')) return 0;
  const [hour, minute] = timeString.split(':').map(Number);
  return hour * 60 + minute;
};

// --- Main Component ---
const ScheduleGridSelector = ({
  schedule,
  exceptions,
  personalTimes,
  readOnly = true,
  enableMonthView = false,
  showViewControls = true,
  initialTimeRange = null
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [weekDates, setWeekDates] = useState([]);
  const [viewMode, setViewMode] = useState('week'); // 'week', 'month'
  const [timeRange, setTimeRange] = useState(initialTimeRange || { start: 9, end: 18 });
  const [showFullDay, setShowFullDay] = useState(false);
  const [showMerged, setShowMerged] = useState(true); // 기본값을 병합 모드로 설정

  // 월간 모드에서 선택된 날짜에 대한 세부 시간표 모달
  const [selectedDateForDetail, setSelectedDateForDetail] = useState(null);
  const [showDateDetailModal, setShowDateDetailModal] = useState(false);

  useEffect(() => {
    const sunday = getSundayOfCurrentWeek(currentDate);
    const dates = [];
    const dayNamesKorean = ['일', '월', '화', '수', '목', '금', '토'];
    for (let i = 0; i < 7; i++) {
      const date = new Date(sunday);
      date.setDate(sunday.getDate() + i);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const dayOfMonth = String(date.getDate()).padStart(2, '0');
      // 실제 요일을 확인 (JavaScript의 getDay()는 0=일요일, 1=월요일, ...)
      const actualDayOfWeek = date.getDay();
      dates.push({
        fullDate: date,
        display: `${dayNamesKorean[actualDayOfWeek]} (${month}.${dayOfMonth})`,
        dayOfWeek: actualDayOfWeek
      });
    }
    setWeekDates(dates);
  }, [currentDate]);

  const navigateWeek = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction * 7));
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const toggleTimeRange = () => {
    const newShowFullDay = !showFullDay;
    setShowFullDay(newShowFullDay);
    setTimeRange(newShowFullDay ? { start: 0, end: 24 } : { start: 9, end: 18 });
  };


  const getCurrentTimeSlots = () => generateTimeSlots(timeRange.start, timeRange.end);

  const getBlocksForDay = (date, dayOfWeek) => {
    const allPossibleSlots = getCurrentTimeSlots();
    const slotMap = new Map(); // 시간별로 이벤트 저장

    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    // 각 시간 슬롯에 해당하는 이벤트 할당
    allPossibleSlots.forEach(time => {
        const timeMinutes = timeToMinutes(time);
        let assignedEvent = null;

        // 예외 일정 우선 확인
        const exceptionSlot = exceptions.find(e => {
            if (e.specificDate !== dateStr) return false;

            // startTime과 endTime이 HH:MM 형식인지 ISO 날짜 형식인지 확인
            let startMins, endMins;

            if (e.startTime && e.startTime.includes('T')) {
                // ISO 형식 (예: 2025-01-15T09:00:00.000Z)
                const startDate = new Date(e.startTime);
                const endDate = new Date(e.endTime);
                startMins = startDate.getHours() * 60 + startDate.getMinutes();
                endMins = endDate.getHours() * 60 + endDate.getMinutes();
            } else if (e.startTime && e.startTime.includes(':')) {
                // HH:MM 형식 (예: 09:00)
                startMins = timeToMinutes(e.startTime);
                endMins = timeToMinutes(e.endTime);
            } else {
                return false;
            }

            return timeMinutes >= startMins && timeMinutes < endMins;
        });

        if (exceptionSlot) {
            assignedEvent = { ...exceptionSlot, type: 'exception' };
        } else {
            // 개인 시간 확인 (자정 넘나드는 시간 처리 포함)
            const personalSlot = personalTimes.find(p => {
                // 개인시간의 days 배열이 있는지 확인
                const personalDays = p.days || [];

                // 디버그 로그 추가 (일요일 첫 번째 슬롯에서만)
                if (timeMinutes === timeToMinutes(allPossibleSlots[0]) && dayOfWeek === 0) {
                    console.log('Personal time debug for dayOfWeek', dayOfWeek, ':', {
                        personalTimes: personalTimes.length,
                        allPersonalTimes: personalTimes,
                        time,
                        timeMinutes,
                        sampleCheck: personalTimes.map(p => ({
                            title: p.title,
                            days: p.days,
                            includes: p.days?.includes(dayOfWeek),
                            startTime: p.startTime,
                            endTime: p.endTime,
                            startMinutes: timeToMinutes(p.startTime),
                            endMinutes: timeToMinutes(p.endTime),
                            isRecurring: p.isRecurring
                        }))
                    });
                }

                // 반복 개인시간인 경우에만 처리
                if (p.isRecurring !== false && personalDays.length > 0) {
                    // 데이터베이스 요일 시스템 (1=월요일, 2=화요일, ..., 7=일요일)을
                    // JavaScript 요일 시스템 (0=일요일, 1=월요일, 2=화요일, ...)으로 변환
                    const convertedDays = personalDays.map(day => {
                        return day === 7 ? 0 : day; // 7(일요일) -> 0, 나머지는 그대로
                    });

                    if (convertedDays.includes(dayOfWeek)) {
                        const startMinutes = timeToMinutes(p.startTime);
                        const endMinutes = timeToMinutes(p.endTime);

                        // 자정을 넘나드는 시간인지 확인 (수면시간 등)
                        if (endMinutes <= startMinutes) {
                            // 예: 22:00~08:00의 경우
                            // 밤 부분: 22:00~23:50 또는 새벽 부분: 00:00~08:00
                            if (timeMinutes >= startMinutes || timeMinutes < endMinutes) {
                                return true;
                            }
                        } else {
                            // 일반적인 하루 내 시간
                            if (timeMinutes >= startMinutes && timeMinutes < endMinutes) {
                                return true;
                            }
                        }
                    }
                }

                return false;
            });


            if (personalSlot) {
                assignedEvent = { ...personalSlot, type: 'personal' };
            } else {
                // 기본 일정 확인 - 시간 범위 내에 있는지 확인
                const scheduleSlot = schedule.find(s => {
                    if (s.dayOfWeek !== dayOfWeek) return false;
                    const startMinutes = timeToMinutes(s.startTime);
                    const endMinutes = timeToMinutes(s.endTime);
                    return timeMinutes >= startMinutes && timeMinutes < endMinutes;
                });
                if (scheduleSlot) {
                    assignedEvent = { ...scheduleSlot, type: 'schedule' };
                }
            }
        }

        slotMap.set(time, assignedEvent);
    });

    // 연속된 블록들 병합
    const blocks = [];
    let currentBlock = null;

    allPossibleSlots.forEach(time => {
        const event = slotMap.get(time);

        if (!event) {
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
            const isSameEvent = currentBlock &&
                               currentBlock.type === event.type &&
                               ((event.type === 'schedule' && currentBlock.priority === event.priority) ||
                                (event.type === 'exception' && currentBlock.title === event.title && currentBlock.priority === event.priority) ||
                                (event.type === 'personal' && currentBlock.title === event.title));

            if (isSameEvent) {
                currentBlock.duration += 10;
            } else {
                if (currentBlock) blocks.push(currentBlock);
                currentBlock = {
                    ...event,
                    startTime: time,
                    duration: 10
                };
            }
        }
    });

    if (currentBlock) blocks.push(currentBlock);

    return blocks;
  };

  const renderViewControls = () => (
    <div className="flex items-center justify-between mb-4 flex-wrap gap-y-2">
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            <button
                onClick={() => setViewMode('week')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    viewMode === 'week'
                        ? 'bg-blue-500 text-white shadow-md'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
            >
                <Grid size={16} className="mr-2 inline" />주간
            </button>
            <button
                onClick={() => setViewMode('month')}
                disabled={!enableMonthView}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    !enableMonthView
                        ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                        : viewMode === 'month'
                            ? 'bg-blue-500 text-white shadow-md'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
            >
                <Calendar size={16} className="mr-2 inline" />
                월간{!enableMonthView && ' (개발 중)'}
            </button>
            <div className="border-l border-gray-300 pl-3 ml-1 flex space-x-2 flex-wrap gap-y-2">
                <button onClick={toggleTimeRange} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${showFullDay ? 'bg-purple-500 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}><Clock size={16} className="mr-2 inline" />{showFullDay ? '24시간' : '기본'}</button>
                <button onClick={() => setShowMerged(!showMerged)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${showMerged ? 'bg-green-500 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>{showMerged ? <><Split size={16} className="mr-2 inline" />분할</> : <><Merge size={16} className="mr-2 inline" />병합</>}</button>
            </div>
        </div>
        <div className="flex items-center space-x-2">
            <button onClick={() => viewMode === 'month' ? navigateMonth(-1) : navigateWeek(-1)} className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors"><ChevronLeft size={20} /></button>
            <div className="text-lg font-semibold min-w-40 text-center whitespace-nowrap">{`${currentDate.getFullYear()}년 ${monthNames[currentDate.getMonth()]}`}</div>
            <button onClick={() => viewMode === 'month' ? navigateMonth(1) : navigateWeek(1)} className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors"><ChevronRight size={20} /></button>
            <button onClick={goToToday} className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors text-sm whitespace-nowrap shadow-md">오늘</button>
        </div>
    </div>
  );

  // 시간 블록 생성 함수 (병합용) - 연속된 시간대를 하나로 합침
  const getTimeBlocks = () => {
    const timeSlots = getCurrentTimeSlots();
    const blocks = [];
    let currentBlock = null;

    for (let i = 0; i < timeSlots.length; i++) {
      const time = timeSlots[i];
      const hour = parseInt(time.split(':')[0]);
      const minute = parseInt(time.split(':')[1]);

      if (minute === 0) { // 정시면 새 블록 시작
        if (currentBlock) {
          blocks.push(currentBlock);
        }
        currentBlock = {
          startTime: time,
          startHour: hour,
          duration: 60,
          label: `${hour}시`
        };
      } else if (currentBlock) {
        currentBlock.duration += 10;
      }
    }

    if (currentBlock) {
      blocks.push(currentBlock);
    }

    // 연속된 시간 블록들을 병합
    const mergedBlocks = [];
    let mergeBlock = null;

    for (const block of blocks) {
      if (!mergeBlock) {
        mergeBlock = { ...block };
      } else if (mergeBlock.startHour + (mergeBlock.duration / 60) === block.startHour) {
        // 연속된 시간이면 병합
        mergeBlock.duration += block.duration;
        mergeBlock.label = `${mergeBlock.startHour}-${block.startHour + 1}시`;
      } else {
        // 연속되지 않으면 기존 블록 추가하고 새로 시작
        if (mergeBlock.duration === 60) {
          mergeBlock.label = `${mergeBlock.startHour}시`;
        }
        mergedBlocks.push(mergeBlock);
        mergeBlock = { ...block };
      }
    }

    if (mergeBlock) {
      if (mergeBlock.duration === 60) {
        mergeBlock.label = `${mergeBlock.startHour}시`;
      }
      mergedBlocks.push(mergeBlock);
    }

    return mergedBlocks;
  };

  // 헬퍼 함수들
  const mergeConsecutiveBlocks = (blocks) => {
    if (!blocks || blocks.length === 0) return [];

    blocks.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    const mergedBlocks = [];
    let currentMergeGroup = [];

    for (const block of blocks) {
      if (currentMergeGroup.length === 0) {
        currentMergeGroup.push(block);
      } else {
        const lastBlock = currentMergeGroup[currentMergeGroup.length - 1];
        const lastEndTime = getEndTimeForBlock(lastBlock);

        // 연속된 시간이면 같은 그룹에 추가
        if (lastEndTime === block.startTime && lastBlock.type === block.type) {
          currentMergeGroup.push(block);
        } else {
          // 연속되지 않거나 타입이 다르면 기존 그룹을 병합하여 추가
          mergedBlocks.push(createMergedBlock(currentMergeGroup));
          currentMergeGroup = [block];
        }
      }
    }

    if (currentMergeGroup.length > 0) {
      mergedBlocks.push(createMergedBlock(currentMergeGroup));
    }

    return mergedBlocks;
  };

  const createMergedBlock = (blockGroup) => {
    if (blockGroup.length === 1) {
      return blockGroup[0];
    }

    const firstBlock = blockGroup[0];
    const lastBlock = blockGroup[blockGroup.length - 1];
    const totalDuration = blockGroup.reduce((sum, block) => sum + block.duration, 0);

    return {
      ...firstBlock,
      endTime: getEndTimeForBlock(lastBlock),
      duration: totalDuration,
      isMerged: true
    };
  };

  const getEndTimeForBlock = (block) => {
    const startMinutes = timeToMinutes(block.startTime);
    const endMinutes = startMinutes + block.duration;
    return minutesToTime(endMinutes);
  };

  const minutesToTime = (minutes) => {
    const hour = Math.floor(minutes / 60);
    const min = minutes % 60;
    return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  };

  const renderMergedWeekView = () => {
    // 각 날짜별로 병합된 블록 계산 - WeekView와 동일한 방식
    const dayBlocks = weekDates.map(date => {
      const blocks = getBlocksForDay(date.fullDate, date.dayOfWeek);
      return mergeConsecutiveBlocks(blocks);
    });

    const timeSlots = getCurrentTimeSlots();

    // 시간 슬롯별 위치 계산을 위한 헬퍼 함수
    const getTimeSlotIndex = (time) => {
      return timeSlots.findIndex(slot => slot === time);
    };

    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
        {/* 헤더 추가 - 요일과 날짜 표시 */}
        <div className="flex bg-gray-100 sticky top-0 z-10 border-b border-gray-300">
          <div className="w-12 flex-shrink-0 p-2 text-center font-semibold text-gray-700 border-r border-gray-300 text-sm">시간</div>
          {weekDates.slice(0, 7).map((date, index) => (
            <div key={index} className="flex-1 p-2 text-center font-semibold text-gray-700 border-r border-gray-200 last:border-r-0 text-sm">
              {date.display}
            </div>
          ))}
        </div>

        <div className="overflow-auto" style={{ maxHeight: '70vh' }}>
          <div className="flex">
            {/* 시간 컬럼은 전체 시간대 표시 */}
            <div className="w-12 flex-shrink-0">
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
              const blocks = dayBlocks[dayIndex];
              const totalHeight = timeSlots.length * 16; // 전체 컬럼 높이 (h-4 = 16px)

              return (
                <div key={dayIndex} className="flex-1 border-l border-gray-200 relative" style={{ height: `${totalHeight}px` }}>
                  {blocks.map((block, blockIndex) => {
                    const date = dateInfo.fullDate;
                    const blockHeight = block.duration * 1.6; // 10분 = 1.6px (16px/10)
                    const startIndex = getTimeSlotIndex(block.startTime);
                    const topPosition = startIndex * 16; // 각 시간 슬롯은 16px (h-4)

                    let bgColor = 'bg-gray-100';
                    let textColor = 'text-gray-500';
                    let content = '빈 시간';

                    if (block.type === 'schedule') {
                      const priorityInfo = priorityConfig[block.priority] || priorityConfig[3];
                      bgColor = priorityInfo.color;
                      textColor = 'text-white';
                      content = priorityInfo.label;
                    } else if (block.type === 'exception') {
                      const priorityInfo = priorityConfig[block.priority] || priorityConfig[3];
                      bgColor = priorityInfo.color;
                      textColor = 'text-white';
                      content = block.title || '예외 일정';
                    } else if (block.type === 'personal') {
                      bgColor = 'bg-red-400';
                      textColor = 'text-white';
                      content = block.title || '개인 시간';
                    }

                    const actualEndTime = getEndTimeForBlock(block);

                    return (
                      <div
                        key={`${date.toISOString().split('T')[0]}-${block.startTime}-${blockIndex}`}
                        className={`absolute left-0 right-0 border-b border-gray-200 flex items-center justify-center text-center px-0.5 ${bgColor} ${textColor}`}
                        style={{
                          height: `${blockHeight}px`,
                          top: `${topPosition}px`
                        }}
                        title={`${content} (${block.startTime}~${actualEndTime})`}
                      >
                        <div className="text-xs leading-tight">
                          <div>{content.length > 4 ? content.substring(0, 3) + '...' : content}</div>
                          {blockHeight > 20 && <div className="text-xs leading-tight">{block.startTime}~{actualEndTime}</div>}
                        </div>
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

  const renderDetailedWeekView = () => {
    const timeSlots = getCurrentTimeSlots();
    const maxHeight = timeSlots.length > 54 ? '60vh' : '70vh'; // 9시간(54슬롯) 넘으면 높이 제한

    return (
        <div className="timetable-grid border border-gray-200 rounded-lg overflow-auto shadow-inner bg-white" style={{ maxHeight, minHeight: '300px' }}>
            <div className="grid grid-cols-8 bg-gray-100 sticky top-0 z-10 border-b border-gray-300">
                <div className="col-span-1 p-2 text-center font-semibold text-gray-700 border-r border-gray-300 text-sm">시간</div>
                {weekDates.map((date, index) => (
                    <div key={index} className="col-span-1 p-2 text-center font-semibold text-gray-700 border-r border-gray-200 last:border-r-0 text-sm">{date.display}</div>
                ))}
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(' + maxHeight + ' - 60px)' }}>
                {timeSlots.map(time => (
                    <div key={time} className="grid grid-cols-8 border-b border-gray-200 last:border-b-0 hover:bg-gray-50 transition-colors">
                        <div className="col-span-1 p-2 text-center text-xs font-medium text-gray-600 flex items-center justify-center bg-gray-50 border-r border-gray-300 h-8">{time}</div>
                        {days.map((day, index) => {
                            const date = weekDates[index]?.fullDate;
                            if (!date) return <div key={day.dayOfWeek} className="col-span-1 border-r border-gray-200 last:border-r-0 h-8"></div>;

                            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

                            const recurringSlot = schedule.find(s => s.dayOfWeek === day.dayOfWeek && s.startTime === time);

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

                            const personalSlot = personalTimes.find(p => {
                                const personalDays = p.days || [];
                                if (p.isRecurring !== false && personalDays.length > 0) {
                                    const convertedDays = personalDays.map(day => {
                                        return day === 7 ? 0 : day; // 7(일요일) -> 0, 나머지는 그대로
                                    });
                                    if (convertedDays.includes(day.dayOfWeek)) {
                                        const startMinutes = timeToMinutes(p.startTime);
                                        const endMinutes = timeToMinutes(p.endTime);
                                        const currentMinutes = timeToMinutes(time);

                                        if (endMinutes <= startMinutes) {
                                            return currentMinutes >= startMinutes || currentMinutes < endMinutes;
                                        } else {
                                            return currentMinutes >= startMinutes && currentMinutes < endMinutes;
                                        }
                                    }
                                }
                                return false;
                            });

                            let slotClass = 'bg-white hover:bg-blue-50';
                            let content = null;

                            if (exceptionSlot) {
                                slotClass = `${priorityConfig[exceptionSlot.priority]?.color || 'bg-blue-600'} hover:opacity-90`;
                                content = <span className="text-xs text-white truncate px-1 font-medium" title={exceptionSlot.title}>{exceptionSlot.title}</span>;
                            } else if (personalSlot) {
                                slotClass = 'bg-red-400 hover:bg-red-500';
                                content = <span className="text-xs text-white truncate px-1 font-medium" title={`개인시간: ${personalSlot.title}`}>{personalSlot.title}</span>;
                            } else if (recurringSlot) {
                                slotClass = `${priorityConfig[recurringSlot.priority]?.color || 'bg-blue-400'} hover:opacity-90`;
                                content = <span className="text-xs text-white truncate px-1 font-medium" title={priorityConfig[recurringSlot.priority]?.label}>{priorityConfig[recurringSlot.priority]?.label}</span>;
                            }

                            return (
                                <div key={day.dayOfWeek} className={`col-span-1 border-r border-gray-200 last:border-r-0 h-8 flex items-center justify-center transition-all duration-200 cursor-pointer ${slotClass}`}>
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

  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // 월의 첫날과 마지막날
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // 월의 첫 주 일요일부터 시작 (헤더와 맞춤)
    const startDate = new Date(firstDay);
    const startDayOfWeek = firstDay.getDay();
    startDate.setDate(startDate.getDate() - startDayOfWeek); // 일요일부터 시작

    // 월의 마지막 주 토요일까지
    const endDate = new Date(lastDay);
    const endDayOfWeek = lastDay.getDay();
    endDate.setDate(endDate.getDate() + (6 - endDayOfWeek)); // 토요일까지

    const weeks = [];
    let currentWeek = [];

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const date = new Date(d);
      const dayOfWeek = date.getDay();

      // 일~토 모두 표시
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      // 해당 날짜의 일정 확인
      const hasSchedule = schedule.some(s => s.dayOfWeek === dayOfWeek);
      const hasException = exceptions.some(e => e.specificDate === dateStr);
      const hasPersonal = personalTimes.some(p => {
        const personalDays = p.days || [];
        const isRecurring = p.isRecurring !== false;
        return isRecurring && personalDays.includes(dayOfWeek);
      });

      currentWeek.push({
        date,
        dayOfWeek,
        isCurrentMonth: date.getMonth() === month,
        hasSchedule,
        hasException,
        hasPersonal,
        dateStr
      });

      if (dayOfWeek === 6 && currentWeek.length === 7) { // 토요일이면 현재 주 완료
        weeks.push([...currentWeek]);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    const handleDateClick = (dayData) => {
      if (showMerged) {
        // 병합 모드에서는 블록 형태로 일정 보기
        const dayBlocks = getBlocksForDay(dayData.date, dayData.dayOfWeek);
        setSelectedDateForDetail({ ...dayData, blocks: dayBlocks });
      } else {
        // 일반 모드에서는 세부 시간표 보기
        setSelectedDateForDetail(dayData);
      }
      setShowDateDetailModal(true);
    };

    return (
      <div className="border border-gray-200 rounded-lg bg-white shadow-inner" style={{ minHeight: '500px' }}>
        <div className="grid grid-cols-7 bg-gray-100 border-b border-gray-200">
          {['일', '월', '화', '수', '목', '금', '토'].map(day => (
            <div key={day} className="p-4 text-center font-semibold text-gray-700 border-r border-gray-200 last:border-r-0">
              {day}
            </div>
          ))}
        </div>

        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 border-b border-gray-200 last:border-b-0">
            {week.map((day, dayIndex) => (
              <div
                key={dayIndex}
                onClick={() => handleDateClick(day)}
                className={`p-3 min-h-[120px] border-r border-gray-200 last:border-r-0 ${
                  day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                } hover:bg-blue-50 transition-colors cursor-pointer`}
                title={`${day.date.getMonth() + 1}/${day.date.getDate()} - 클릭하여 세부 시간표 보기`}
              >
                <div className={`text-base font-medium mb-2 ${
                  day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                }`}>
                  {day.date.getDate()}
                </div>

                <div className="space-y-1">
                  {day.hasSchedule && (
                    <div className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded truncate">
                      기본 일정
                    </div>
                  )}
                  {day.hasException && (
                    <div className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded truncate">
                      예외 일정
                    </div>
                  )}
                  {day.hasPersonal && (
                    <div className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded truncate">
                      개인 시간
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  // 세부 시간표 모달 렌더링
  const renderDateDetailModal = () => {
    if (!showDateDetailModal || !selectedDateForDetail) return null;

    const dayData = selectedDateForDetail;
    const timeSlots = getCurrentTimeSlots();
    const dateStr = `${dayData.date.getFullYear()}-${String(dayData.date.getMonth() + 1).padStart(2, '0')}-${String(dayData.date.getDate()).padStart(2, '0')}`;

    return (
      <div
        className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowDateDetailModal(false);
          }
        }}
      >
        <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden">
          <div className="flex justify-center items-center p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-bold text-gray-800">
              {dayData.date.getMonth() + 1}월 {dayData.date.getDate()}일 ({['일', '월', '화', '수', '목', '금', '토'][dayData.date.getDay()]}) 시간표
            </h3>
          </div>

          <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 80px)' }}>
            {showMerged && dayData.blocks ? (
              // 병합 모드: 블록 형태로 표시
              <div className="space-y-2">
                {dayData.blocks.map((block, index) => {
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
                    bgColor = 'bg-red-400';
                    textColor = 'text-white';
                    content = `${block.title} (${block.duration}분)`;
                  } else {
                    content = `빈 시간 (${block.duration}분)`;
                  }

                  return (
                    <div
                      key={index}
                      className={`p-3 rounded-lg ${bgColor}`}
                    >
                      <div className="flex justify-between items-center">
                        <span className={`text-sm font-medium ${textColor}`}>
                          {block.startTime}
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

                    return timeMinutes >= startMins && timeMinutes < endMins;
                  });
                  const personalSlot = personalTimes.find(p => {
                    const personalDays = p.days || [];
                    if (p.isRecurring !== false && personalDays.length > 0) {
                      const convertedDays = personalDays.map(day => {
                        return day === 7 ? 0 : day; // 7(일요일) -> 0, 나머지는 그대로
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

                  if (exceptionSlot) {
                    bgColor = priorityConfig[exceptionSlot.priority]?.color || 'bg-blue-600';
                    textColor = 'text-white';
                    content = exceptionSlot.title;
                  } else if (personalSlot) {
                    bgColor = 'bg-red-400';
                    textColor = 'text-white';
                    content = personalSlot.title;
                  } else if (recurringSlot) {
                    bgColor = priorityConfig[recurringSlot.priority]?.color || 'bg-blue-400';
                    textColor = 'text-white';
                    content = priorityConfig[recurringSlot.priority]?.label;
                  }

                  return (
                    <div
                      key={time}
                      className={`flex items-center justify-between p-2 rounded ${bgColor} ${bgColor === 'bg-white' ? 'border border-gray-200' : ''}`}
                    >
                      <span className={`text-sm font-medium ${textColor}`}>{time}</span>
                      <span className={`text-sm ${textColor}`}>{content}</span>
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

  return (
    <div className="bg-white p-4 rounded-lg shadow-md mb-6">
      {showViewControls && renderViewControls()}
      {viewMode === 'month' ? renderMonthView() : (showMerged ? renderMergedWeekView() : renderDetailedWeekView())}
      {renderDateDetailModal()}
    </div>
  );
}; 

export default ScheduleGridSelector;
