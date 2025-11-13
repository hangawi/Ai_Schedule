import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Grid, Clock, Merge, Split, X } from 'lucide-react';
import { getColorForImageIndex } from '../../utils/scheduleAnalysis/assignScheduleColors';

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
  // endHour까지 포함하도록 <= 사용
  for (let h = startHour; h <= endHour; h++) {
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
  fixedSchedules = [],
  readOnly = true,
  enableMonthView = false,
  showViewControls = true,
  initialTimeRange = null,
  defaultShowMerged = true
}) => {
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [weekDates, setWeekDates] = useState([]);
  const [viewMode, setViewMode] = useState('week'); // 'week', 'month'
  const [timeRange, setTimeRange] = useState(initialTimeRange || { start: 9, end: 18 });
  const [showFullDay, setShowFullDay] = useState(false);
  const [showMerged, setShowMerged] = useState(defaultShowMerged); // props로 받은 기본값 사용

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

  // ⭐ personalTimes와 fixedSchedules 합치기
  const allPersonalTimes = React.useMemo(() => {
    const combined = [...(personalTimes || [])];

    // 고정 일정을 personalTime 형식으로 변환해서 추가
    if (fixedSchedules && fixedSchedules.length > 0) {
      const dayMap = {
        'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4,
        'FRI': 5, 'SAT': 6, 'SUN': 7,
        '월': 1, '화': 2, '수': 3, '목': 4,
        '금': 5, '토': 6, '일': 7
      };

      fixedSchedules.forEach(fixed => {
        // days를 숫자 배열로 먼저 변환
        const daysArray = Array.isArray(fixed.days) ? fixed.days : [fixed.days];
        const mappedDays = daysArray.map(day => dayMap[day] || day).filter(d => d && typeof d === 'number');

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
    // 🔍 김다희 강사 확인
    const daheeSchedules = combined.filter(s => s.title?.includes('김다희'));
    // 🔍 공연반 확인
    const gongSchedules = combined.filter(s => s.title?.includes('공연반'));

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
  }, [allPersonalTimes, showFullDay]);

  const getCurrentTimeSlots = () => {
    if (showFullDay) {
      // 24시간 모드: 00:00 ~ 24:00
      return generateTimeSlots(0, 24);
    } else {
      // 기본 모드: timeRange 사용 (9~18시 또는 일정에 맞춰 조정)
      return generateTimeSlots(timeRange.start, timeRange.end);
    }
  };

  const getBlocksForDay = (date, dayOfWeek) => {
    const allPossibleSlots = getCurrentTimeSlots();
    const slotMap = new Map(); // 시간별로 이벤트 배열 저장

    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    // 각 시간 슬롯에 해당하는 이벤트 할당
    allPossibleSlots.forEach(time => {
        const timeMinutes = timeToMinutes(time);
        let assignedEvents = []; // 배열로 변경

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
            assignedEvents.push({ ...exceptionSlot, type: 'exception' });
        } else {
            // 개인 시간 확인 (자정 넘나드는 시간 처리 포함)
            // filter()로 모든 겹치는 일정 찾기
            const personalSlots = allPersonalTimes.filter(p => {
                // 개인시간의 days 배열이 있는지 확인
                const personalDays = p.days || [];

                // ⭐ specificDate가 있으면 해당 날짜의 요일에 표시
                if (p.specificDate && personalDays.length === 0) {
                  const dateObj = new Date(p.specificDate);
                  const dateDay = dateObj.getDay();

                  if (dateDay !== dayOfWeek) {
                    return false; // 요일이 다르면 필터링
                  }

                  // 요일이 맞으면 시간대 체크
                  const startMinutes = timeToMinutes(p.startTime);
                  const endMinutes = timeToMinutes(p.endTime);

                  if (endMinutes <= startMinutes) {
                    return timeMinutes >= startMinutes || timeMinutes < endMinutes;
                  } else {
                    return timeMinutes >= startMinutes && timeMinutes < endMinutes;
                  }
                }

                // 디버깅: 월요일 15:00 확인
                if (dayOfWeek === 1 && time === '15:00') {
                    const startMinutes = timeToMinutes(p.startTime);
                    const endMinutes = timeToMinutes(p.endTime);
                    const matches = personalDays.map(day => day === 7 ? 0 : day).includes(dayOfWeek) &&
                                  timeMinutes >= startMinutes && timeMinutes < endMinutes;
                    if (matches) {
                    }
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

            // 모든 개인 시간을 배열에 추가
            if (personalSlots.length > 0) {
                assignedEvents.push(...personalSlots.map(p => ({ ...p, type: 'personal' })));
            } else {
                // 기본 일정 확인 - 시간 범위 내에 있는지 확인
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

    // 연속된 블록들 병합 (겹치는 이벤트 배열 지원)
    const blocks = [];
    let currentBlock = null;

    allPossibleSlots.forEach(time => {
        const events = slotMap.get(time);

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
            // 같은 이벤트 세트인지 체크 (제목 기준으로 비교)
            const isSameEventSet = currentBlock && currentBlock.events &&
                                  currentBlock.events.length === events.length &&
                                  (() => {
                                      // 제목 기준으로 정렬해서 비교
                                      const currentTitles = currentBlock.events.map(e => e.title || e.type).sort().join('|');
                                      const newTitles = events.map(e => e.title || e.type).sort().join('|');
                                      return currentTitles === newTitles;
                                  })();

            if (isSameEventSet) {
                currentBlock.duration += 10;
            } else {
                if (currentBlock) blocks.push(currentBlock);
                currentBlock = {
                    type: events.length > 1 ? 'multiple' : events[0].type,
                    events: events,
                    startTime: time,
                    duration: 10,
                    // 단일 이벤트일 경우 속성 복사 (title, priority 등)
                    ...(events.length === 1 ? events[0] : {})
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

        // 연속된 시간이고, 타입과 제목이 같으면 같은 그룹에 추가
        const isSameBlock = lastEndTime === block.startTime &&
                           lastBlock.type === block.type &&
                           lastBlock.title === block.title;

        if (isSameBlock) {
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

    // 새로운 접근: personalTimes와 schedule를 합쳐서 각 요일별 일정 추출 + 같은 제목끼리 병합
    const getDaySchedules = (dayOfWeek, targetDate) => {
      console.log(`🔍 [병합모드] getDaySchedules 호출 - 요일=${dayOfWeek}, targetDate=`, targetDate);

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
            const isMatch = targetDateStr === scheduleDateStr;
            console.log(`  📅 [병합모드 specificDate] targetDate=${targetDateStr}, scheduleDate=${scheduleDateStr}, 매칭=${isMatch}, 제목=${p.title || p.subjectName}`);
            return isMatch;
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
        // 개인시간에 색상이 없으면 회색 계열 색상 할당
        color: p.color || '#6b7280'
      }));

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
          const isMatch = targetDateStr === exceptionDateStr;
          console.log(`  📅 [병합모드 exceptions] targetDate=${targetDateStr}, exceptionDate=${exceptionDateStr}, 매칭=${isMatch}, 제목=${e.title}`);
          return isMatch;
        }
        return false;
      }).map(e => ({
        ...e,
        color: priorityColorMap[priorityConfig[e.priority]?.color] || '#2563eb'
      }));

      // 4. 세 배열 합치기
      const filteredSchedules = [...personalFiltered, ...scheduleFiltered, ...exceptionsFiltered];

      console.log(`  ✅ [병합모드] 필터링 결과 - personalFiltered=${personalFiltered.length}개, scheduleFiltered=${scheduleFiltered.length}개, exceptionsFiltered=${exceptionsFiltered.length}개, 합계=${filteredSchedules.length}개`);

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
    console.log(`⏰ [병합모드] 시간 범위: ${timeRange.start}시 ~ ${timeRange.end}시, timeSlots 개수: ${timeSlots.length}개, showFullDay=${showFullDay}`);

    // 시간 슬롯별 위치 계산을 위한 헬퍼 함수
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

        <div>
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

                    // 스케줄의 색상 사용 (없으면 기본 빨간색)
                    const bgColor = seg.schedule.color || '#f87171';
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
            <div>
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

                            const personalSlot = allPersonalTimes.find(p => {
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

                            let customStyle = {};
                            if (exceptionSlot) {
                                slotClass = `${priorityConfig[exceptionSlot.priority]?.color || 'bg-blue-600'} hover:opacity-90`;
                                content = <span className="text-xs text-white truncate px-1 font-medium" title={exceptionSlot.title}>{exceptionSlot.title}</span>;
                            } else if (personalSlot) {
                                // personalSlot의 색상 사용
                                const personalColor = personalSlot.color || '#f87171';
                                slotClass = 'hover:opacity-90';
                                customStyle = { backgroundColor: personalColor };
                                const displayTitle = personalSlot.title || personalSlot.subjectName || personalSlot.academyName || '일정';
                                content = <span className="text-xs text-white truncate px-1 font-medium" title={`개인시간: ${displayTitle}`}>{displayTitle}</span>;
                            } else if (recurringSlot) {
                                slotClass = `${priorityConfig[recurringSlot.priority]?.color || 'bg-blue-400'} hover:opacity-90`;
                                content = <span className="text-xs text-white truncate px-1 font-medium" title={priorityConfig[recurringSlot.priority]?.label}>{priorityConfig[recurringSlot.priority]?.label}</span>;
                            }

                            return (
                                <div key={day.dayOfWeek} className={`col-span-1 border-r border-gray-200 last:border-r-0 h-8 flex items-center justify-center transition-all duration-200 cursor-pointer ${slotClass}`} style={customStyle}>
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
      const hasPersonal = allPersonalTimes.some(p => {
        const personalDays = p.days || [];
        const convertedDays = personalDays.map(day => day === 7 ? 0 : day);
        const isRecurring = p.isRecurring !== false;
        return isRecurring && convertedDays.includes(dayOfWeek);
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
                      선호 일정
                    </div>
                  )}
                  {day.hasException && (
                    <div className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded truncate">
                      선호 일정
                    </div>
                  )}
                  {day.hasPersonal && (
                    <div className="text-xs px-2 py-1 bg-gray-100 text-gray-800 rounded truncate">
                      개인 일정
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

          <div className="p-4">
            {showMerged && dayData.blocks ? (
              // 병합 모드: 블록 형태로 표시
              <div className="space-y-2">
                {dayData.blocks.map((block, index) => {
                  let bgColor = 'bg-gray-50';
                  let textColor = 'text-gray-500';
                  let content = '';
                  let multipleSchedules = [];

                  // 같은 시간대의 모든 personalTimes 찾기
                  if (block.type === 'personal') {
                    const startMin = timeToMinutes(block.startTime);
                    const endMin = timeToMinutes(block.endTime);

                    multipleSchedules = allPersonalTimes.filter(p => {
                      const personalDays = p.days || [];

                      // ⭐ specificDate가 있으면 해당 날짜의 요일에 표시
                      if (p.specificDate && personalDays.length === 0) {
                        const dateObj = new Date(p.specificDate);
                        const dateDay = dateObj.getDay();

                        if (dateDay !== dayData.dayOfWeek) {
                          return false; // 요일이 다르면 필터링
                        }

                        // 요일이 맞으면 시간대가 겹치는지 확인
                        const pStart = timeToMinutes(p.startTime);
                        const pEnd = timeToMinutes(p.endTime);

                        return (pStart >= startMin && pStart < endMin) ||
                               (pEnd > startMin && pEnd <= endMin) ||
                               (pStart <= startMin && pEnd >= endMin);
                      }

                      const convertedDays = personalDays.map(day => day === 7 ? 0 : day);

                      if (p.isRecurring !== false && convertedDays.includes(dayData.dayOfWeek)) {
                        const pStart = timeToMinutes(p.startTime);
                        const pEnd = timeToMinutes(p.endTime);

                        // 시간대가 겹치는지 확인
                        return (pStart >= startMin && pStart < endMin) ||
                               (pEnd > startMin && pEnd <= endMin) ||
                               (pStart <= startMin && pEnd >= endMin);
                      }
                      return false;
                    });
                  }

                  if (block.type === 'schedule') {
                    bgColor = priorityConfig[block.priority]?.color || 'bg-blue-400';
                    textColor = 'text-white';
                    content = `${priorityConfig[block.priority]?.label} (${block.duration}분)`;
                  } else if (block.type === 'exception') {
                    bgColor = priorityConfig[block.priority]?.color || 'bg-blue-600';
                    textColor = 'text-white';
                    content = `${block.title} (${block.duration}분)`;
                  } else if (block.type === 'personal') {
                    // personalTime에 color가 있으면 사용, 없으면 회색
                    const personalColor = multipleSchedules[0]?.color || '#6b7280';
                    bgColor = personalColor; // inline style로 사용
                    textColor = 'text-white';
                    if (multipleSchedules.length > 1) {
                      content = multipleSchedules.map(p => p.title || p.subjectName || p.academyName || '일정').join(' / ');
                    } else {
                      const displayTitle = block.title || block.subjectName || block.academyName || '일정';
                      content = `${displayTitle} (${block.duration}분)`;
                    }
                  } else {
                    content = `빈 시간 (${block.duration}분)`;
                  }

                  // bgColor가 hex 색상인지 Tailwind 클래스인지 확인
                  const isHexColor = typeof bgColor === 'string' && bgColor.startsWith('#');

                  return (
                    <div
                      key={index}
                      className={`p-3 rounded-lg ${multipleSchedules.length > 1 ? 'bg-gray-100' : (isHexColor ? '' : bgColor)}`}
                      style={isHexColor && !multipleSchedules.length ? { backgroundColor: bgColor } : {}}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className={`text-sm font-medium ${multipleSchedules.length > 1 ? 'text-gray-700' : textColor}`}>
                          {block.startTime}
                        </span>
                        <span className={`text-xs ${multipleSchedules.length > 1 ? 'text-gray-600' : textColor}`}>
                          {Math.floor(block.duration / 60) > 0 && `${Math.floor(block.duration / 60)}시간 `}
                          {block.duration % 60 > 0 && `${block.duration % 60}분`}
                        </span>
                      </div>
                      {multipleSchedules.length > 1 ? (
                        <div className="flex gap-2">
                          {multipleSchedules.map((p, idx) => (
                            <div
                              key={idx}
                              className="flex-1 text-white text-sm px-3 py-2 rounded-lg text-center"
                              style={{ backgroundColor: p.color || '#6b7280' }}
                            >
                              {p.title || p.subjectName || p.academyName || '일정'}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className={`text-sm mt-1 ${textColor}`}>
                          {content}
                        </div>
                      )}
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
                  // 같은 시간대의 모든 personalTimes 찾기
                  const personalSlots = allPersonalTimes.filter(p => {
                    const personalDays = p.days || [];

                    // ⭐ specificDate가 있으면 해당 날짜의 요일에 표시
                    if (p.specificDate && personalDays.length === 0) {
                      const dateObj = new Date(p.specificDate);
                      const dateDay = dateObj.getDay();

                      if (dateDay !== dayData.dayOfWeek) {
                        return false; // 요일이 다르면 필터링
                      }

                      // 요일이 맞으면 시간대 체크
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
                    // personalTime에 color가 있으면 사용, 없으면 회색
                    bgColor = personalSlots[0].color || '#6b7280';
                    textColor = 'text-white';
                    if (personalSlots.length > 1) {
                      hasMultiple = true;
                      content = personalSlots.map(p => p.title || p.subjectName || p.academyName || '일정').join('\n');
                    } else {
                      content = personalSlots[0].title || personalSlots[0].subjectName || personalSlots[0].academyName || '일정';
                    }
                  } else if (recurringSlot) {
                    bgColor = priorityConfig[recurringSlot.priority]?.color || 'bg-blue-400';
                    textColor = 'text-white';
                    content = priorityConfig[recurringSlot.priority]?.label;
                  }

                  // bgColor가 hex 색상인지 확인
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
                          {personalSlots.map((p, idx) => (
                            <div
                              key={idx}
                              className="flex-1 text-white text-xs px-2 py-1 rounded text-center"
                              style={{ backgroundColor: p.color || '#6b7280' }}
                            >
                              {p.title || p.subjectName || p.academyName || '일정'}
                            </div>
                          ))}
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
  return (
    <div className="bg-white p-4 rounded-lg shadow-md mb-6">
      {showViewControls && renderViewControls()}
      {viewMode === 'month' ? renderMonthView() : (showMerged ? renderMergedWeekView() : renderDetailedWeekView())}
      {renderDateDetailModal()}
    </div>
  );
}; 

export default ScheduleGridSelector;
