import React, { useState, useEffect, useRef } from 'react';
import { X, Merge, Split } from 'lucide-react';

// 10분 단위 시간 슬롯 생성
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

const priorityConfig = {
  3: { label: '선호', color: 'bg-blue-600', next: 2 },
  2: { label: '보통', color: 'bg-blue-400', next: 1 },
  1: { label: '조정 가능', color: 'bg-blue-200', next: null },
  0: { label: '없어짐', color: 'bg-gray-200', next: null },
};

// 연속된 시간대 병합 함수
const mergeConsecutiveTimeSlots = (schedule) => {
  if (!schedule || schedule.length === 0) return [];

  const sortedSchedule = [...schedule].sort((a, b) => {
    // specificDate가 있으면 날짜로 정렬, 없으면 dayOfWeek로 정렬
    if (a.specificDate && b.specificDate) {
      if (a.specificDate !== b.specificDate) return a.specificDate.localeCompare(b.specificDate);
    } else if (a.dayOfWeek !== b.dayOfWeek) {
      return a.dayOfWeek - b.dayOfWeek;
    }
    return a.startTime.localeCompare(b.startTime);
  });

  const merged = [];
  let currentGroup = null;

  for (const slot of sortedSchedule) {
    const sameDate = (currentGroup && slot.specificDate && currentGroup.specificDate) 
      ? (currentGroup.specificDate === slot.specificDate)
      : (currentGroup && currentGroup.dayOfWeek === slot.dayOfWeek && !slot.specificDate && !currentGroup.specificDate);
    
    if (currentGroup &&
        sameDate &&
        currentGroup.priority === slot.priority &&
        currentGroup.endTime === slot.startTime) {
      // 연속된 슬롯이므로 병합
      currentGroup.endTime = slot.endTime;
      currentGroup.isMerged = true;
      if (!currentGroup.originalSlots) {
        currentGroup.originalSlots = [{ ...currentGroup }];
      }
      currentGroup.originalSlots.push(slot);
    } else {
      // 새로운 그룹 시작
      if (currentGroup) {
        merged.push(currentGroup);
      }
      currentGroup = { ...slot };
      // 기존 속성 정리
      delete currentGroup.isMerged;
      delete currentGroup.originalSlots;
    }
  }

  if (currentGroup) {
    merged.push(currentGroup);
  }

  return merged;
};;

// 다음 시간 슬롯 계산
const getNextTimeSlot = (timeString) => {
  const [hour, minute] = timeString.split(':').map(Number);
  const nextMinute = minute + 10;
  const nextHour = nextMinute >= 60 ? hour + 1 : hour;
  const finalMinute = nextMinute >= 60 ? 0 : nextMinute;
  return `${String(nextHour).padStart(2, '0')}:${String(finalMinute).padStart(2, '0')}`;
};

// 시간 차이 계산 (분 단위)
const getTimeDifferenceInMinutes = (startTime, endTime) => {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  return (endHour * 60 + endMin) - (startHour * 60 + startMin);
};

const DetailTimeGrid = ({
  selectedDate,
  schedule,
  setSchedule,
  readOnly,
  exceptions = [],
  setExceptions,
  personalTimes = [],
  onClose,
  onSave,
  showFullDay = false
}) => {
  const [timeRange, setTimeRange] = useState({ start: 9, end: 18 });
  const [selectionStart, setSelectionStart] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [previewSelection, setPreviewSelection] = useState([]);
  const [showDirectInput, setShowDirectInput] = useState(false);
  const [directInput, setDirectInput] = useState({
    startTime: '09:00',
    endTime: '10:00',
    priority: 2
  });
  const [showCopyOptions, setShowCopyOptions] = useState(false);
  const [copyOptions, setCopyOptions] = useState({
    copyType: 'none', // 기본적으로 복사 안함
    includePrevWeek: false,
    includeNextWeek: false,
    includeWholeMonth: false
  });
  const [showMerged, setShowMerged] = useState(false); // 병합 모드 토글
  const [mergedSchedule, setMergedSchedule] = useState([]);

  // 초기 상태 저장 (저장하지 않고 닫을 때 복원용)
  const [initialExceptions] = useState([...exceptions]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // 복사옵션 외부 클릭 감지를 위한 ref
  const copyOptionsRef = useRef(null);

  // 스케줄이 변경될 때마다 병합된 스케줄 업데이트
  useEffect(() => {
    setMergedSchedule(mergeConsecutiveTimeSlots(schedule));
  }, [schedule]);

  // 외부 클릭 감지하여 복사옵션 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (copyOptionsRef.current && !copyOptionsRef.current.contains(event.target)) {
        setShowCopyOptions(false);
      }
    };

    if (showCopyOptions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCopyOptions]);

  useEffect(() => {
    if (showFullDay) {
      setTimeRange({ start: 0, end: 24 });
    } else {
      setTimeRange({ start: 9, end: 18 });
    }
  }, [showFullDay]);

  const getCurrentTimeSlots = () => {
    return generateTimeSlots(timeRange.start, timeRange.end);
  };

  const calculateEndTime = (startTime) => {
    const [h, m] = startTime.split(':').map(Number);
    const totalMinutes = h * 60 + m + 10;
    const endHour = Math.floor(totalMinutes / 60);
    const endMinute = totalMinutes % 60;
    return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
  };

  const handleSlotClick = (startTime) => {
    // 모든 모드에서 시간대 정보 확인 가능
    const exception = getExceptionForSlot(startTime);
    const personalTime = getPersonalTimeForSlot(startTime);
    const slotInfo = getSlotInfo(startTime);

    // readOnly 모드에서는 정보만 표시하고 수정하지 않음
    if (readOnly) {
      return;
    }

    // 수동 클릭은 특정 날짜의 defaultSchedule에 추가
    if (!setSchedule) {
      return;
    }

    const dayOfWeek = selectedDate.getDay(); // 0: Sunday, ..., 6: Saturday
    const [hour, minute] = startTime.split(':').map(Number);
    
    // 특정 날짜 문자열 생성
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    // 해당 날짜의 해당 시간대에 이미 스케줄이 있는지 확인
    const existingSlot = schedule.find(slot => 
      slot.specificDate === dateStr &&
      slot.startTime === startTime &&
      slot.endTime === getNextTimeSlot(startTime)
    );

    if (existingSlot) {
      // 기존 슬롯이 있으면 우선순위를 순환시킴: 선호(3) → 보통(2) → 조정 가능(1) → 없어짐(삭제)
      const currentPriority = existingSlot.priority || 3;

      if (currentPriority === 3) {
        // 선호 → 보통
        setSchedule(schedule.map(slot =>
          (slot.specificDate === dateStr && slot.startTime === startTime && slot.endTime === getNextTimeSlot(startTime))
            ? { ...slot, priority: 2 }
            : slot
        ));
      } else if (currentPriority === 2) {
        // 보통 → 조정 가능
        setSchedule(schedule.map(slot =>
          (slot.specificDate === dateStr && slot.startTime === startTime && slot.endTime === getNextTimeSlot(startTime))
            ? { ...slot, priority: 1 }
            : slot
        ));
      } else if (currentPriority === 1) {
        // 조정 가능 → 없어짐 (삭제)
        setSchedule(schedule.filter(slot =>
          !(slot.specificDate === dateStr && slot.startTime === startTime && slot.endTime === getNextTimeSlot(startTime))
        ));
      } else {
        // 다른 우선순위는 선호로 초기화
        setSchedule(schedule.map(slot =>
          (slot.specificDate === dateStr && slot.startTime === startTime && slot.endTime === getNextTimeSlot(startTime))
            ? { ...slot, priority: 3 }
            : slot
        ));
      }
    } else {
      // 새로운 슬롯 생성 (선호로 시작, 특정 날짜)
      const endTime = getNextTimeSlot(startTime);

      const newSlot = {
        dayOfWeek: dayOfWeek,
        startTime: startTime,
        endTime: endTime,
        priority: 3, // 선호로 시작
        specificDate: dateStr // 특정 날짜 지정
      };

      setSchedule([...schedule, newSlot]);
    }

    setHasUnsavedChanges(true);
  };

  const getSlotInfo = (startTime) => {
    const dayOfWeek = selectedDate.getDay();
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const currentSchedule = showMerged ? mergedSchedule : schedule;

    if (showMerged) {
      // 병합 모드에서는 해당 시간이 병합된 슬롯에 포함되는지 확인
      for (const slot of currentSchedule) {
        // specificDate가 있으면 날짜도 비교, 없으면 dayOfWeek만 비교
        const dateMatches = slot.specificDate ? slot.specificDate === dateStr : slot.dayOfWeek === dayOfWeek;
        
        if (dateMatches) {
          const slotStartMinutes = timeToMinutes(slot.startTime);
          const slotEndMinutes = timeToMinutes(slot.endTime);
          const currentTimeMinutes = timeToMinutes(startTime);

          if (currentTimeMinutes >= slotStartMinutes && currentTimeMinutes < slotEndMinutes) {
            return slot;
          }
        }
      }
      return null;
    } else {
      return currentSchedule.find(
        s => {
          const dateMatches = s.specificDate ? s.specificDate === dateStr : s.dayOfWeek === dayOfWeek;
          return dateMatches && s.startTime === startTime;
        }
      );
    }
  };

  const timeToMinutes = (timeString) => {
    const [hour, minute] = timeString.split(':').map(Number);
    return hour * 60 + minute;
  };

  const getExceptionForSlot = (startTime) => {
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const [hour, minute] = startTime.split(':').map(Number);

    for (const ex of exceptions) {
      // 유효하지 않은 데이터 필터링
      if (!ex || !ex.specificDate || !ex.startTime) continue;

      // specificDate 필드를 사용해야 함 (startTime은 "10:00" 형식이므로 날짜가 아님)
      const exDateStr = ex.specificDate;

      if (exDateStr === dateStr) {
        // startTime이 ISO 형식인 경우와 "HH:MM" 형식인 경우를 모두 처리
        let exStartHour, exStartMinute;

        if (ex.startTime.includes('T')) {
          // ISO 형식 (예: "2025-09-26T10:00:00.000Z")
          const exStartTime = new Date(ex.startTime);
          exStartHour = exStartTime.getHours();
          exStartMinute = exStartTime.getMinutes();
        } else {
          // "HH:MM" 형식
          [exStartHour, exStartMinute] = ex.startTime.split(':').map(Number);
        }

        if (hour === exStartHour && minute === exStartMinute) {
          return ex;
        }
      }
    }
    return null;
  };

  const getPersonalTimeForSlot = (startTime) => {
    const dayOfWeek = selectedDate.getDay() === 0 ? 7 : selectedDate.getDay();
    const selectedDateStr = selectedDate.toISOString().split('T')[0];
    const [hour, minute] = startTime.split(':').map(Number);
    const slotMinutes = hour * 60 + minute;

    for (const pt of personalTimes) {
      let shouldInclude = false;

      // 반복되는 개인시간 체크
      if (pt.isRecurring !== false && pt.days && pt.days.includes(dayOfWeek)) {
        shouldInclude = true;
      }

      // 특정 날짜의 개인시간 체크
      if (pt.isRecurring === false && pt.specificDate) {
        const specificDateStr = new Date(pt.specificDate).toISOString().split('T')[0];
        if (specificDateStr === selectedDateStr) {
          shouldInclude = true;
        }
      }

      if (!shouldInclude) {
        continue;
      }

      const [startHour, startMin] = pt.startTime.split(':').map(Number);
      const [endHour, endMin] = pt.endTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      let endMinutes = endHour * 60 + endMin;


      // 수면시간과 같은 overnight 시간 처리
      if (endMinutes <= startMinutes) {
        endMinutes += 24 * 60;
        if (slotMinutes >= startMinutes || slotMinutes < (endMinutes - 24 * 60)) {
          return pt;
        }
      } else {
        if (slotMinutes >= startMinutes && slotMinutes < endMinutes) {
          return pt;
        }
      }
    }
    return null;
  };

  const formatDate = (date) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
  };

  // 특정 시간대에 예외가 있는지 확인하는 함수
  const hasExceptionInTimeRange = (startHour, endHour) => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const day = selectedDate.getDate();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 10) {
        const hasException = exceptions.some(ex => {
          // specificDate로 날짜 비교, startTime으로 시간 비교
          if (!ex || ex.specificDate !== dateStr || !ex.startTime) return false;

          const [exHour, exMinute] = ex.startTime.split(':').map(Number);
          return exHour === hour && exMinute === minute && ex.title === '일정';
        });
        if (hasException) return true;
      }
    }
    return false;
  };

  // 특정 시간대의 예외들을 제거하는 함수
  const removeExceptionsInTimeRange = (startHour, endHour) => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const day = selectedDate.getDate();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const filteredExceptions = exceptions.filter(ex => {
      const exStartTime = new Date(ex.startTime);
      const exHour = exStartTime.getHours();
      const exMinute = exStartTime.getMinutes();

      // 해당 시간대이고 해당 날짜이며 '일정' 제목인 것들을 제거
      if (ex.specificDate === dateStr &&
          ex.title === '일정' &&
          exHour >= startHour &&
          exHour < endHour) {
        return false; // 제거
      }
      return true; // 유지
    });

    setExceptions(filteredExceptions);
    setHasUnsavedChanges(true);
  };

  const addQuickTimeSlot = (startHour, endHour, priority = 3) => {
    if (readOnly || !setSchedule) return;

    const dayOfWeek = selectedDate.getDay(); // 0: Sunday, ..., 6: Saturday
    
    // 특정 날짜 문자열 생성
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    console.log('🔍 [DetailTimeGrid] 빠른시간 추가 (선호시간, 특정 날짜):', { startHour, endHour, priority, dayOfWeek, dateStr });

    // 해당 날짜 및 시간대에 이미 스케줄이 있는지 확인
    const existingSlots = schedule.filter(slot => {
      // 특정 날짜 스케줄만 확인 (specificDate가 있는 것)
      if (!slot.specificDate || slot.specificDate !== dateStr) return false;
      
      const slotStart = slot.startTime.split(':').map(Number);
      const slotEnd = slot.endTime.split(':').map(Number);
      const slotStartMinutes = slotStart[0] * 60 + slotStart[1];
      const slotEndMinutes = slotEnd[0] * 60 + slotEnd[1];
      
      const targetStartMinutes = startHour * 60;
      const targetEndMinutes = endHour * 60;
      
      // 겹치는지 확인
      return (slotStartMinutes < targetEndMinutes && slotEndMinutes > targetStartMinutes);
    });

    if (existingSlots.length > 0) {
      // 이미 있으면 해당 날짜 및 시간대의 모든 10분 슬롯 제거 (토글)
      console.log('🔍 [DetailTimeGrid] 기존 선호시간 제거:', existingSlots.length);
      const filteredSchedule = schedule.filter(slot => {
        if (!slot.specificDate || slot.specificDate !== dateStr) return true;
        
        const slotStart = slot.startTime.split(':').map(Number);
        const slotEnd = slot.endTime.split(':').map(Number);
        const slotStartMinutes = slotStart[0] * 60 + slotStart[1];
        const slotEndMinutes = slotEnd[0] * 60 + slotEnd[1];
        
        const targetStartMinutes = startHour * 60;
        const targetEndMinutes = endHour * 60;
        
        // 겹치지 않는 것만 유지
        return !(slotStartMinutes < targetEndMinutes && slotEndMinutes > targetStartMinutes);
      });
      setSchedule(filteredSchedule);
    } else {
      // 없으면 특정 날짜에 10분 단위로 슬롯들을 추가
      const newSlots = [];
      
      for (let hour = startHour; hour < endHour; hour++) {
        for (let minute = 0; minute < 60; minute += 10) {
          const startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
          const nextMinute = minute + 10;
          const nextHour = nextMinute >= 60 ? hour + 1 : hour;
          const adjustedMinute = nextMinute >= 60 ? 0 : nextMinute;
          const endTime = `${String(nextHour).padStart(2, '0')}:${String(adjustedMinute).padStart(2, '0')}`;
          
          newSlots.push({
            dayOfWeek: dayOfWeek,
            startTime: startTime,
            endTime: endTime,
            priority: priority,
            specificDate: dateStr // 특정 날짜 지정
          });
        }
      }

      console.log('🔍 [DetailTimeGrid] 새 선호시간 추가 (특정 날짜, 10분 단위):', newSlots.length, '개 슬롯');
      setSchedule([...schedule, ...newSlots]);
    }

    setHasUnsavedChanges(true);

    // 편집 모드가 아닐 때만 자동 저장 실행
    if (onSave && !readOnly) {
      setTimeout(async () => {
        try {
          await onSave();
          setHasUnsavedChanges(false);
        } catch (error) {
          console.error('🔍 [DetailTimeGrid] 빠른시간 자동저장 실패:', error);
        }
      }, 200);
    }

    // 강제 리렌더링
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 10);
  };


  const applyCopyOptions = (baseException) => {
    // 복사 옵션에 따라 다른 날짜에도 동일한 예외 추가
    if (!setExceptions || copyOptions.copyType === 'none') return;


    const additionalExceptions = [];
    const baseDate = new Date(selectedDate);

    if (copyOptions.copyType === 'nextWeek') {
      // 다음주 같은 요일에 복사
      const nextWeekDate = new Date(baseDate);
      nextWeekDate.setDate(baseDate.getDate() + 7);

      const nextYear = nextWeekDate.getFullYear();
      const nextMonth = nextWeekDate.getMonth();
      const nextDay = nextWeekDate.getDate();
      const nextDateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;

      const baseStartTime = new Date(baseException.startTime);
      const baseEndTime = new Date(baseException.endTime);

      const newStartTime = new Date(nextYear, nextMonth, nextDay, baseStartTime.getHours(), baseStartTime.getMinutes(), 0);
      const newEndTime = new Date(nextYear, nextMonth, nextDay, baseEndTime.getHours(), baseEndTime.getMinutes(), 0);

      const newException = {
        ...baseException,
        _id: Date.now().toString() + Math.random(),
        startTime: newStartTime.toISOString(),
        endTime: newEndTime.toISOString(),
        specificDate: nextDateStr
      };
      additionalExceptions.push(newException);

    } else if (copyOptions.copyType === 'prevWeek') {
      // 이전주 같은 요일에 복사
      const prevWeekDate = new Date(baseDate);
      prevWeekDate.setDate(baseDate.getDate() - 7);

      const prevYear = prevWeekDate.getFullYear();
      const prevMonth = prevWeekDate.getMonth();
      const prevDay = prevWeekDate.getDate();
      const prevDateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(prevDay).padStart(2, '0')}`;

      const baseStartTime = new Date(baseException.startTime);
      const baseEndTime = new Date(baseException.endTime);

      const newStartTime = new Date(prevYear, prevMonth, prevDay, baseStartTime.getHours(), baseStartTime.getMinutes(), 0);
      const newEndTime = new Date(prevYear, prevMonth, prevDay, baseEndTime.getHours(), baseEndTime.getMinutes(), 0);

      const newException = {
        ...baseException,
        _id: Date.now().toString() + Math.random(),
        startTime: newStartTime.toISOString(),
        endTime: newEndTime.toISOString(),
        specificDate: prevDateStr
      };
      additionalExceptions.push(newException);

    } else if (copyOptions.copyType === 'wholeMonth') {
      // 이번달 모든 같은 요일에 복사
      const currentMonth = baseDate.getMonth();
      const currentYear = baseDate.getFullYear();
      const dayOfWeek = baseDate.getDay();

      const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
      const firstDayOfWeek = firstDayOfMonth.getDay();

      // 해당 요일의 첫 번째 날짜 계산
      let firstTargetDate = 1 + (dayOfWeek - firstDayOfWeek + 7) % 7;

      while (firstTargetDate <= 31) {
        const targetDate = new Date(currentYear, currentMonth, firstTargetDate);

        // 유효한 날짜이고 이번달이고 현재 날짜가 아닌 경우
        if (targetDate.getMonth() === currentMonth && targetDate.toDateString() !== baseDate.toDateString()) {
          const targetYear = targetDate.getFullYear();
          const targetMonth = targetDate.getMonth();
          const targetDay = targetDate.getDate();
          const targetDateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;

          const baseStartTime = new Date(baseException.startTime);
          const baseEndTime = new Date(baseException.endTime);

          const newStartTime = new Date(targetYear, targetMonth, targetDay, baseStartTime.getHours(), baseStartTime.getMinutes(), 0);
          const newEndTime = new Date(targetYear, targetMonth, targetDay, baseEndTime.getHours(), baseEndTime.getMinutes(), 0);

          const newException = {
            ...baseException,
            _id: Date.now().toString() + Math.random(),
            startTime: newStartTime.toISOString(),
            endTime: newEndTime.toISOString(),
            specificDate: targetDateStr
          };
          additionalExceptions.push(newException);
        }

        firstTargetDate += 7; // 다음 주 같은 요일
      }
    }

    if (additionalExceptions.length > 0) {
      setTimeout(() => {
        setExceptions(prev => [...prev, ...additionalExceptions]);
      }, 100);
    }
  };

  // 휴무일 설정/해제 함수
  const addHolidayForDay = () => {
    if (readOnly) return;

    // 휴무일 설정 시 전체 시간 범위로 변경
    setTimeRange({ start: 0, end: 24 });

    // 선택된 날짜를 로컬 날짜로 정확히 처리
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // 해당 날짜의 모든 휴무일 관련 예외 찾기
    const existingHolidayExceptions = exceptions.filter(ex => {
      const exStartTime = new Date(ex.startTime);
      const exYear = exStartTime.getFullYear();
      const exMonth = String(exStartTime.getMonth() + 1).padStart(2, '0');
      const exDay = String(exStartTime.getDate()).padStart(2, '0');
      const exDateStr = `${exYear}-${exMonth}-${exDay}`;
      return exDateStr === dateStr && (ex.title === '휴무일' || ex.isHoliday);
    });

    if (existingHolidayExceptions.length > 0) {
      // 이미 휴무일로 설정된 경우 해당 날짜의 모든 예외 제거
      const filteredExceptions = exceptions.filter(ex => {
        const exStartTime = new Date(ex.startTime);
        const exYear = exStartTime.getFullYear();
        const exMonth = String(exStartTime.getMonth() + 1).padStart(2, '0');
        const exDay = String(exStartTime.getDate()).padStart(2, '0');
        const exDateStr = `${exYear}-${exMonth}-${exDay}`;
        return exDateStr !== dateStr;
      });
      setExceptions(filteredExceptions);
      setHasUnsavedChanges(true);
    } else {
      // 해당 날짜의 모든 기존 예외를 완전히 제거하고 새로운 휴무일 설정
      const filteredExceptions = exceptions.filter(ex => {
        const exStartTime = new Date(ex.startTime);
        const exYear = exStartTime.getFullYear();
        const exMonth = String(exStartTime.getMonth() + 1).padStart(2, '0');
        const exDay = String(exStartTime.getDate()).padStart(2, '0');
        const exDateStr = `${exYear}-${exMonth}-${exDay}`;
        return exDateStr !== dateStr;
      });

      // 휴무일을 위한 10분 단위 예외들을 생성 (전체 하루를 덮도록)
      const holidayExceptions = [];

      // 00:00부터 23:59까지 10분 단위로 휴무일 예외 생성
      for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += 10) {
          const startDateTime = new Date(year, selectedDate.getMonth(), selectedDate.getDate(), hour, minute, 0);
          const endMinute = minute + 10;
          const endHour = endMinute >= 60 ? hour + 1 : hour;
          const adjustedEndMinute = endMinute >= 60 ? 0 : endMinute;
          const endDateTime = new Date(year, selectedDate.getMonth(), selectedDate.getDate(), endHour, adjustedEndMinute, 0);

          const newException = {
            _id: Date.now().toString() + Math.random() + hour + minute,
            title: '휴무일',
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString(),
            isHoliday: true,
            isAllDay: true,
            specificDate: dateStr
          };

          holidayExceptions.push(newException);
        }
      }

      setExceptions([...filteredExceptions, ...holidayExceptions]);
      setHasUnsavedChanges(true);
    }
  };

  const blockEntireDay = () => {
    if (readOnly || !setExceptions) return;

    // 휴무일 설정 시 전체 시간 범위로 변경
    setTimeRange({ start: 0, end: 24 });

    // 선택된 날짜를 로컬 날짜로 정확히 처리
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // 해당 날짜의 모든 휴무일 관련 예외 찾기
    const existingHolidayExceptions = exceptions.filter(ex => {
      const exStartTime = new Date(ex.startTime);
      const exYear = exStartTime.getFullYear();
      const exMonth = String(exStartTime.getMonth() + 1).padStart(2, '0');
      const exDay = String(exStartTime.getDate()).padStart(2, '0');
      const exDateStr = `${exYear}-${exMonth}-${exDay}`;
      return exDateStr === dateStr && (ex.title === '휴무일' || ex.isHoliday);
    });

    if (existingHolidayExceptions.length > 0) {
      // 이미 휴무일로 설정된 경우 해당 날짜의 모든 예외 제거
      const filteredExceptions = exceptions.filter(ex => {
        const exStartTime = new Date(ex.startTime);
        const exYear = exStartTime.getFullYear();
        const exMonth = String(exStartTime.getMonth() + 1).padStart(2, '0');
        const exDay = String(exStartTime.getDate()).padStart(2, '0');
        const exDateStr = `${exYear}-${exMonth}-${exDay}`;
        return exDateStr !== dateStr;
      });
      setExceptions(filteredExceptions);
      setHasUnsavedChanges(true);
    } else {
      // 해당 날짜의 모든 기존 예외를 완전히 제거하고 새로운 휴무일 설정
      const filteredExceptions = exceptions.filter(ex => {
        const exStartTime = new Date(ex.startTime);
        const exYear = exStartTime.getFullYear();
        const exMonth = String(exStartTime.getMonth() + 1).padStart(2, '0');
        const exDay = String(exStartTime.getDate()).padStart(2, '0');
        const exDateStr = `${exYear}-${exMonth}-${exDay}`;
        return exDateStr !== dateStr;
      });

      // 휴무일을 위한 10분 단위 예외들을 생성 (전체 하루를 덮도록)
      const holidayExceptions = [];

      // 00:00부터 23:59까지 10분 단위로 휴무일 예외 생성
      for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += 10) {
          const startDateTime = new Date(year, selectedDate.getMonth(), selectedDate.getDate(), hour, minute, 0);
          const endMinute = minute + 10;
          const endHour = endMinute >= 60 ? hour + 1 : hour;
          const adjustedEndMinute = endMinute >= 60 ? 0 : endMinute;
          const endDateTime = new Date(year, selectedDate.getMonth(), selectedDate.getDate(), endHour, adjustedEndMinute, 0);

          const newException = {
            _id: Date.now().toString() + Math.random() + hour + minute,
            title: '휴무일',
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString(),
            isHoliday: true,
            isAllDay: true,
            specificDate: dateStr
          };

          holidayExceptions.push(newException);
        }
      }

      setExceptions([...filteredExceptions, ...holidayExceptions]);
      setHasUnsavedChanges(true);
    }
  };

  const deleteEntireDay = async () => {
    if (readOnly) return;

    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const day = selectedDate.getDate();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayOfWeek = selectedDate.getDay();


    let totalDeleted = 0;

    // 해당 날짜의 모든 예외 일정 삭제
    const filteredExceptions = exceptions.filter(ex => {
      const exStartTime = new Date(ex.startTime);
      const exYear = exStartTime.getFullYear();
      const exMonth = String(exStartTime.getMonth() + 1).padStart(2, '0');
      const exDay = String(exStartTime.getDate()).padStart(2, '0');
      const exDateStr = `${exYear}-${exMonth}-${exDay}`;
      return exDateStr !== dateStr;
    });

    const deletedExceptions = exceptions.length - filteredExceptions.length;
    totalDeleted += deletedExceptions;

    // 해당 요일의 기본 스케줄 삭제
    const filteredSchedule = schedule.filter(s => s.dayOfWeek !== dayOfWeek);
    const deletedSchedule = schedule.length - filteredSchedule.length;
    totalDeleted += deletedSchedule;


    // 상태 업데이트
    if (setExceptions) {
      setExceptions(filteredExceptions);
    }
    if (setSchedule) {
      setSchedule(filteredSchedule);
    }
    setHasUnsavedChanges(true);

    // 편집 모드가 아닐 때만 자동 저장 실행
    if (onSave && readOnly) {
      setTimeout(async () => {
        try {
          await onSave();
          setHasUnsavedChanges(false);
        } catch (error) {
        }
      }, 200);
    }
  };

  const handleDirectInput = () => {
    if (readOnly) return;

    const startTime = directInput.startTime;
    const endTime = directInput.endTime;
    const priority = directInput.priority;

    // 시간 유효성 검사
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (endMinutes <= startMinutes) {
      alert('종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }

    // 특정 날짜의 예외 일정으로 추가 (기본 스케줄이 아님)
    if (setExceptions) {
      const exceptions_to_add = [];

      // 10분 단위로 슬롯 생성
      for (let minutes = startMinutes; minutes < endMinutes; minutes += 10) {
        const slotHour = Math.floor(minutes / 60);
        const slotMin = minutes % 60;
        const slotStartTime = `${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`;

        const nextMinutes = minutes + 10;
        const nextHour = Math.floor(nextMinutes / 60);
        const nextMin = nextMinutes % 60;
        const slotEndTime = `${String(nextHour).padStart(2, '0')}:${String(nextMin).padStart(2, '0')}`;

        // 로컬 날짜로 정확하게 생성
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const day = selectedDate.getDate();

        const startDateTime = new Date(year, month, day, slotHour, slotMin, 0);
        const endDateTime = new Date(year, month, day, nextHour, nextMin, 0);

        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        const newException = {
          _id: Date.now().toString() + Math.random(),
          title: '일정',
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          priority: priority,
          specificDate: dateStr
        };


        exceptions_to_add.push(newException);
      }

      setExceptions([...exceptions, ...exceptions_to_add]);
      setHasUnsavedChanges(true);

      // 복사 옵션이 선택된 경우에만 추가 날짜에 적용
      if (copyOptions.copyType !== 'none') {
        exceptions_to_add.forEach(exc => applyCopyOptions(exc));
      }

      // 편집 모드가 아닐 때만 자동 저장 실행
      if (onSave && readOnly) {
        setTimeout(async () => {
          try {
            await onSave();
            setHasUnsavedChanges(false);
          } catch (error) {
          }
        }, 200);
      }

      // 강제 리렌더링
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 10);

      setShowDirectInput(false);
      // 시간은 초기화하고 우선순위는 보통(2)으로 재설정
      setDirectInput({
        startTime: '09:00',
        endTime: '10:00',
        priority: 2
      });
    }
  };

  const timeSlots = getCurrentTimeSlots();

  // 병합된 뷰 렌더링 (연속 시간대를 실제로 단일 슬롯으로 병합)
  const renderMergedView = () => {
    const dayOfWeek = selectedDate.getDay();

    // 병합된 슬롯들과 개별 슬롯들을 모두 수집
    const displaySlots = [];

    // 병합된 기본 스케줄 추가
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    mergedSchedule.filter(slot => {
      // specificDate가 있으면 날짜 비교, 없으면 dayOfWeek 비교
      return slot.specificDate ? slot.specificDate === dateStr : slot.dayOfWeek === dayOfWeek;
    }).forEach(slot => {
      displaySlots.push({
        type: 'schedule',
        startTime: slot.startTime,
        endTime: slot.endTime,
        priority: slot.priority,
        isMerged: slot.isMerged,
        data: slot
      });
    });

    // 예외 일정들도 추가 (병합 처리를 위해 10분 단위로 분할)
    const exceptionSlots = [];

    exceptions.forEach(ex => {
      // 유효하지 않은 데이터 필터링
      if (!ex || !ex.specificDate || !ex.startTime || !ex.endTime) {
        return;
      }

      // 날짜 비교 (specificDate 사용)
      if (ex.specificDate === dateStr) {
        // startTime과 endTime을 올바른 형식으로 변환
        let startTime, endTimeStr;

        if (ex.startTime.includes('T')) {
          // ISO 형식인 경우
          const startDate = new Date(ex.startTime);
          const endDate = new Date(ex.endTime);
          startTime = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
          endTimeStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
        } else {
          // 이미 "HH:MM" 형식인 경우
          startTime = ex.startTime;
          endTimeStr = ex.endTime;
        }

        // 예외 일정을 10분 단위로 분할하여 병합 대상으로 만들기
        const startMinutes = timeToMinutes(startTime);
        const endMinutes = timeToMinutes(endTimeStr);

        for (let minutes = startMinutes; minutes < endMinutes; minutes += 10) {
          const hour = Math.floor(minutes / 60);
          const minute = minutes % 60;
          const slotStartTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
          const slotEndTime = getNextTimeSlot(slotStartTime);

          const slotData = {
            startTime: slotStartTime,
            endTime: slotEndTime,
            priority: ex.priority || 3,
            dayOfWeek: selectedDate.getDay(),
            title: ex.title,
            isException: true
          };

          exceptionSlots.push(slotData);
        }
      }
    });

    // 예외 일정도 병합 처리
    const mergedExceptions = mergeConsecutiveTimeSlots(exceptionSlots);

    mergedExceptions.forEach(slot => {
      const displaySlot = {
        type: 'exception',
        startTime: slot.startTime,
        endTime: slot.endTime,
        data: slot,
        isMerged: slot.isMerged
      };
      displaySlots.push(displaySlot);
    });

    // 개인 시간도 추가 (자정 넘어가는 시간 처리)
    const dayOfWeekPersonal = selectedDate.getDay() === 0 ? 7 : selectedDate.getDay();
    const selectedDateStr = selectedDate.toISOString().split('T')[0];

    personalTimes.forEach(pt => {
      let shouldInclude = false;

      // 반복되는 개인시간 체크
      if (pt.isRecurring !== false && pt.days && pt.days.includes(dayOfWeekPersonal)) {
        shouldInclude = true;
      }

      // 특정 날짜의 개인시간 체크
      if (pt.isRecurring === false && pt.specificDate) {
        const specificDateStr = new Date(pt.specificDate).toISOString().split('T')[0];
        if (specificDateStr === selectedDateStr) {
          shouldInclude = true;
        }
      }

      if (shouldInclude) {
        const [startHour, startMin] = pt.startTime.split(':').map(Number);
        const [endHour, endMin] = pt.endTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        // 자정을 넘나드는 시간인지 확인 (예: 22:00 - 08:00)
        if (endMinutes <= startMinutes) {
          // 수면시간처럼 자정을 넘나드는 경우
          // 22:00-08:00를 22:00-23:50과 00:00-08:00으로 분할

          // 밤 부분 (예: 22:00-23:50)
          const nightSlot = {
            type: 'personal',
            startTime: pt.startTime,
            endTime: '23:50',
            data: { ...pt, title: pt.title }
          };
          displaySlots.push(nightSlot);

          // 아침 부분 (예: 00:00-08:00)
          const morningSlot = {
            type: 'personal',
            startTime: '00:00',
            endTime: pt.endTime,
            data: { ...pt, title: pt.title }
          };
          displaySlots.push(morningSlot);
        } else {
          // 일반적인 하루 내 시간 (학습시간 등)
          const normalSlot = {
            type: 'personal',
            startTime: pt.startTime,
            endTime: pt.endTime,
            data: pt
          };
          displaySlots.push(normalSlot);
        }
      }
    });

    // 시간순 정렬
    displaySlots.sort((a, b) => a.startTime.localeCompare(b.startTime));

    // 모든 시간 슬롯을 순회하면서 병합된 슬롯이나 빈 슬롯으로 분류
    const allSlots = [];
    const currentTimeSlots = getCurrentTimeSlots();
    const processedTimes = new Set();

    for (const timeSlot of currentTimeSlots) {
      if (processedTimes.has(timeSlot)) continue;

      let foundSlot = null;

      // 현재 시간 슬롯이 어떤 표시 슬롯에 포함되는지 확인
      for (const displaySlot of displaySlots) {
        const startMinutes = timeToMinutes(displaySlot.startTime);
        const endMinutes = timeToMinutes(displaySlot.endTime);
        const currentMinutes = timeToMinutes(timeSlot);

        if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
          foundSlot = displaySlot;
          break;
        }
      }

      if (foundSlot) {

        // 병합된 슬롯 추가
        allSlots.push({
          ...foundSlot,
          displayTime: timeSlot,
          duration: getTimeDifferenceInMinutes(foundSlot.startTime, foundSlot.endTime)
        });

        // 이 슬롯이 차지하는 모든 시간을 processed로 표시
        const startMinutes = timeToMinutes(foundSlot.startTime);
        const endMinutes = timeToMinutes(foundSlot.endTime);
        for (let minutes = startMinutes; minutes < endMinutes; minutes += 10) {
          const hour = Math.floor(minutes / 60);
          const minute = minutes % 60;
          const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
          processedTimes.add(time);
        }
      } else {
        // 빈 슬롯들을 연속으로 병합
        const emptyStartTime = timeSlot;
        let emptyEndTime = getNextTimeSlot(timeSlot);
        let duration = 10;

        // 다음 슬롯들도 빈 슬롯인지 확인하며 병합
        let nextTimeIndex = currentTimeSlots.indexOf(timeSlot) + 1;
        while (nextTimeIndex < currentTimeSlots.length) {
          const nextTime = currentTimeSlots[nextTimeIndex];
          if (processedTimes.has(nextTime)) break;

          // 다음 시간이 어떤 슬롯에 포함되는지 확인
          let nextIsEmpty = true;
          for (const displaySlot of displaySlots) {
            const startMinutes = timeToMinutes(displaySlot.startTime);
            const endMinutes = timeToMinutes(displaySlot.endTime);
            const nextMinutes = timeToMinutes(nextTime);

            if (nextMinutes >= startMinutes && nextMinutes < endMinutes) {
              nextIsEmpty = false;
              break;
            }
          }

          if (nextIsEmpty && emptyEndTime === nextTime) {
            emptyEndTime = getNextTimeSlot(nextTime);
            duration += 10;
            processedTimes.add(nextTime);
            nextTimeIndex++;
          } else {
            break;
          }
        }

        allSlots.push({
          type: 'empty',
          displayTime: emptyStartTime,
          startTime: emptyStartTime,
          endTime: emptyEndTime,
          duration: duration
        });
        processedTimes.add(timeSlot);
      }
    }

    return (
      <div className="grid grid-cols-7 gap-0">
        {/* 시간 컬럼 */}
        <div className="bg-gray-50 border-r border-gray-200">
          <div className="p-3 text-center font-semibold text-gray-700 border-b border-gray-200">
            시간
          </div>
          {allSlots.map((slot, index) => {
            const height = Math.max(20, (slot.duration / 10) * 12); // 10분당 12px (더욱 작게)

            return (
              <div
                key={index}
                className="text-center text-sm font-medium text-gray-600 border-b border-gray-100 flex items-center justify-center"
                style={{ height: `${height}px` }}
              >
                {slot.duration > 10 ? (
                  <div className="text-xs">
                    <div>{slot.startTime || slot.displayTime}</div>
                    <div className="text-gray-400">~</div>
                    <div>{slot.endTime || getNextTimeSlot(slot.displayTime)}</div>
                    {slot.type === 'empty' && (
                      <div className="text-gray-500 text-xs">({slot.duration}분)</div>
                    )}
                  </div>
                ) : (
                  slot.displayTime
                )}
              </div>
            );
          })}
        </div>

        {/* 시간 슬롯 컬럼 */}
        <div className="col-span-6">
          <div className="p-3 text-center font-semibold text-gray-700 border-b border-gray-200">
            {formatDate(selectedDate)}
          </div>
          {allSlots.map((slot, index) => {
            const height = Math.max(20, (slot.duration / 10) * 12); // 10분당 12px (더욱 작게)

            let slotClass = 'bg-gray-50 hover:bg-gray-100';
            let content = '';
            let title = '';

            if (slot.type === 'schedule') {
              const baseColor = priorityConfig[slot.priority]?.color || 'bg-blue-400';
              slotClass = slot.isMerged ? `${baseColor} border-2 border-green-400` : baseColor;
              content = slot.isMerged ?
                `${priorityConfig[slot.priority]?.label} (${slot.duration}분)` :
                priorityConfig[slot.priority]?.label;
              title = `${priorityConfig[slot.priority]?.label} - ${slot.startTime}~${slot.endTime}`;
            } else if (slot.type === 'exception') {
              if (slot.data.title === '휴무일' || slot.data.isHoliday) {
                slotClass = 'bg-gray-300 text-gray-600';
                content = '휴무일';
              } else {
                const exceptionPriority = slot.data.priority !== undefined ? slot.data.priority : 3;
                slotClass = priorityConfig[exceptionPriority]?.color || 'bg-blue-600';
                content = `${slot.data.title} (${slot.duration}분)`;
              }
              title = slot.data.title;
            } else if (slot.type === 'personal') {
              slotClass = 'bg-red-300';
              content = `${slot.data.title} (${slot.duration}분)`;
              title = `개인시간: ${slot.data.title}`;
            } else if (slot.type === 'empty') {
              slotClass = 'bg-gray-50 hover:bg-gray-100';
              content = slot.duration > 10 ? `빈 시간 (${slot.duration}분)` : '';
              title = `빈 시간 - ${slot.startTime || slot.displayTime}~${slot.endTime || getNextTimeSlot(slot.displayTime)}`;
            }

            return (
              <div
                key={index}
                className={`border-b border-gray-100 flex items-center justify-center transition-colors cursor-pointer ${slotClass}`}
                style={{ height: `${height}px` }}
                onClick={() => {
                  if (slot.type === 'schedule' || slot.type === 'empty') {
                    handleSlotClick(slot.displayTime || slot.startTime);
                  }
                }}
                title={title || '클릭하여 선택'}
              >
                <span className={`font-medium text-sm text-center px-2 ${slot.type === 'empty' ? 'text-gray-700' : 'text-white'}`}>
                  {content}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 기존 상세 뷰 렌더링
  const renderDetailedView = () => {
    return (
      <div className="grid grid-cols-7 gap-0">
        {/* 시간 컬럼 */}
        <div className="bg-gray-50 border-r border-gray-200">
          <div className="p-3 text-center font-semibold text-gray-700 border-b border-gray-200">
            시간
          </div>
          {timeSlots.map(time => (
            <div
              key={time}
              className="p-2 text-center text-sm font-medium text-gray-600 border-b border-gray-100 h-6 flex items-center justify-center"
            >
              {time}
            </div>
          ))}
        </div>

        {/* 시간 슬롯 컬럼 */}
        <div className="col-span-6">
          <div className="p-3 text-center font-semibold text-gray-700 border-b border-gray-200">
            {formatDate(selectedDate)}
          </div>
          {timeSlots.map(time => {
            const slotInfo = getSlotInfo(time);
            const exception = getExceptionForSlot(time);
            const personalTime = getPersonalTimeForSlot(time);
            const isExceptionSlot = !!exception;
            const isPersonalTimeSlot = !!personalTime;

            let slotClass = 'bg-gray-50 hover:bg-gray-100';
            if (isExceptionSlot) {
              if (exception.title === '휴무일' || exception.isHoliday) {
                slotClass = 'bg-gray-300 text-gray-600';
              } else {
                const exceptionPriority = exception.priority !== undefined ? exception.priority : 3;
                slotClass = priorityConfig[exceptionPriority]?.color || 'bg-blue-600';
              }
            } else if (isPersonalTimeSlot) {
              slotClass = 'bg-red-300';
            } else if (slotInfo) {
              slotClass = priorityConfig[slotInfo.priority]?.color || 'bg-blue-400';
              if (slotInfo.isBlocked) {
                slotClass = 'bg-gray-400 text-gray-600';
              }
            }

            let cursorClass = 'cursor-pointer';
            if (isExceptionSlot && (exception.title === '휴무일' || exception.isHoliday)) {
              cursorClass = 'cursor-not-allowed';
            }

            return (
              <div
                key={time}
                className={`border-b border-gray-100 h-6 flex items-center justify-center transition-colors ${slotClass} ${cursorClass}`}
                onClick={() => {
                  if (isExceptionSlot && (exception.title === '휴무일' || exception.isHoliday)) {
                    return;
                  }
                  handleSlotClick(time);
                }}
                title={
                  isExceptionSlot
                    ? exception.title
                    : isPersonalTimeSlot
                    ? `개인시간: ${personalTime.title}`
                    : (slotInfo ? priorityConfig[slotInfo.priority]?.label : '클릭하여 선택')
                }
              >
                {isExceptionSlot && (exception.title === '휴무일' || exception.isHoliday) && (
                  <div className="flex items-center justify-center w-full h-full">
                    <span className="bg-gray-500 text-white px-2 py-1 rounded-full text-xs font-semibold shadow-sm">
                      휴무일
                    </span>
                  </div>
                )}
                {isExceptionSlot && exception.title !== '휴무일' && !exception.isHoliday && (
                  <span className="text-white font-medium text-xs">
                    {priorityConfig[exception.priority !== undefined ? exception.priority : 3]?.label || '일정'}
                  </span>
                )}
                {!isExceptionSlot && slotInfo && (
                  <span className="text-white font-medium text-xs">
                    {priorityConfig[slotInfo.priority]?.label}
                  </span>
                )}
                {isPersonalTimeSlot && !isExceptionSlot && (
                  <span className="text-white font-medium text-xs">개인</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-11/12 max-w-4xl max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="bg-white px-6 py-4 border-b border-gray-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {formatDate(selectedDate)} 세부 시간표
              </h3>
              {/* 뷰 옵션들을 헤더 아래로 이동 */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    if (timeRange.start === 0 && timeRange.end === 24) {
                      setTimeRange({ start: 9, end: 18 });
                    } else {
                      setTimeRange({ start: 0, end: 24 });
                    }
                  }}
                  className="px-3 py-1 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition-colors font-medium"
                >
                  {timeRange.start === 0 && timeRange.end === 24 ? '기본' : '24시간'}
                </button>
                <button
                  onClick={() => setShowMerged(!showMerged)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    showMerged
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-gray-500 text-white hover:bg-gray-600'
                  }`}
                >
                  {showMerged ? '분할' : '병합'}
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                // 편집 모드가 아닐 때만 저장하지 않은 변경사항을 초기 상태로 복원
                if (hasUnsavedChanges && setExceptions && readOnly) {
                  setExceptions([...initialExceptions]);
                }
                onClose();
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {!readOnly && (
            <div className="space-y-4">
              {/* 시간대 추가 버튼들 */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-semibold text-blue-800">빠른 시간 추가</h4>
                  <div className="flex gap-2 relative">
                    <div className="relative" ref={copyOptionsRef}>
                      <button
                        onClick={() => setShowCopyOptions(!showCopyOptions)}
                        className={`px-3 py-1 rounded-lg text-xs transition-all font-medium ${
                          showCopyOptions
                            ? 'bg-purple-600 text-white hover:bg-purple-700'
                            : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        }`}
                      >
                        복사옵션
                      </button>

                      {showCopyOptions && (
                        <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                          {/* 말풍선 화살표 */}
                          <div className="absolute -top-2 right-4 w-4 h-4 bg-white border-l border-t border-gray-200 rotate-45"></div>

                          <div className="p-4">
                            <h4 className="text-sm font-semibold mb-3 text-gray-800">복사 옵션 설정</h4>
                            <div className="space-y-2">
                              <label className="flex items-center">
                                <input
                                  type="radio"
                                  name="copyType"
                                  value="none"
                                  checked={copyOptions.copyType === 'none'}
                                  onChange={(e) => setCopyOptions({...copyOptions, copyType: e.target.value})}
                                  className="mr-2"
                                />
                                <span className="text-sm">복사하지 않음 (현재 날짜만)</span>
                              </label>
                              <label className="flex items-center">
                                <input
                                  type="radio"
                                  name="copyType"
                                  value="nextWeek"
                                  checked={copyOptions.copyType === 'nextWeek'}
                                  onChange={(e) => setCopyOptions({...copyOptions, copyType: e.target.value})}
                                  className="mr-2"
                                />
                                <span className="text-sm">다음주 같은 요일에 복사</span>
                              </label>
                              <label className="flex items-center">
                                <input
                                  type="radio"
                                  name="copyType"
                                  value="prevWeek"
                                  checked={copyOptions.copyType === 'prevWeek'}
                                  onChange={(e) => setCopyOptions({...copyOptions, copyType: e.target.value})}
                                  className="mr-2"
                                />
                                <span className="text-sm">이전주 같은 요일에 복사</span>
                              </label>
                              <label className="flex items-center">
                                <input
                                  type="radio"
                                  name="copyType"
                                  value="wholeMonth"
                                  checked={copyOptions.copyType === 'wholeMonth'}
                                  onChange={(e) => setCopyOptions({...copyOptions, copyType: e.target.value})}
                                  className="mr-2"
                                />
                                <span className="text-sm">이번달 모든 같은 요일에 복사</span>
                              </label>
                            </div>
                            <p className="text-xs text-gray-600 mt-2">
                              선택한 옵션은 시간 추가 시 자동으로 적용됩니다.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={deleteEntireDay}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-xs hover:bg-red-200 transition-all font-medium"
                    >
                      전체삭제
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {/* 선호도 선택 */}
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-blue-700">선호도:</span>
                    <select
                      value={directInput.priority}
                      onChange={(e) => setDirectInput({ ...directInput, priority: Number(e.target.value) })}
                      className="px-2 py-1 border border-blue-300 rounded text-sm bg-white"
                    >
                      <option value={3}>선호</option>
                      <option value={2}>보통</option>
                      <option value={1}>조정 가능</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={() => addQuickTimeSlot(9, 12, directInput.priority)}
                      className={`px-4 py-2 rounded-lg text-sm transition-colors shadow-sm ${
                        hasExceptionInTimeRange(9, 12)
                          ? 'bg-red-500 text-white hover:bg-red-600'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      {hasExceptionInTimeRange(9, 12) ? '오전 제거' : '오전 (9-12시)'}
                    </button>
                    <button
                      onClick={() => addQuickTimeSlot(13, 17, directInput.priority)}
                      className={`px-4 py-2 rounded-lg text-sm transition-colors shadow-sm ${
                        hasExceptionInTimeRange(13, 17)
                          ? 'bg-red-500 text-white hover:bg-red-600'
                          : 'bg-green-500 text-white hover:bg-green-600'
                      }`}
                    >
                      {hasExceptionInTimeRange(13, 17) ? '오후 제거' : '오후 (13-17시)'}
                    </button>
                    <button
                      onClick={() => setShowDirectInput(!showDirectInput)}
                      className={`px-4 py-2 rounded-lg text-sm transition-all transform hover:scale-105 font-medium shadow-md ${
                        showDirectInput
                          ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                          : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                      }`}
                    >
                      직접입력
                    </button>
                    <button
                      onClick={() => addHolidayForDay()}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700 transition-all transform hover:scale-105 font-medium shadow-md"
                    >
                      휴무일
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}


          {showDirectInput && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="text-sm font-semibold mb-3 text-blue-800">직접 시간 입력</h4>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">시작 시간</label>
                  <input
                    type="time"
                    value={directInput.startTime}
                    onChange={(e) => setDirectInput({ ...directInput, startTime: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">종료 시간</label>
                  <input
                    type="time"
                    value={directInput.endTime}
                    onChange={(e) => setDirectInput({ ...directInput, endTime: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">선호도</label>
                  <select
                    value={directInput.priority}
                    onChange={(e) => setDirectInput({ ...directInput, priority: Number(e.target.value) })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value={3}>선호</option>
                    <option value={2}>보통</option>
                    <option value={1}>조정 가능</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleDirectInput}
                    className="w-full px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                  >
                    추가
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 범례 */}
        {!readOnly && (
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-center space-x-4 mb-2">
              <span className="text-sm font-semibold text-gray-700">범례:</span>
              {Object.entries(priorityConfig).filter(([priority]) => priority !== '0').sort(([p1], [p2]) => p2 - p1).map(([priority, {label, color}]) => (
                <div key={priority} className="flex items-center">
                  <div className={`w-4 h-4 rounded-full ${color} mr-2`}></div>
                  <span className="text-sm text-gray-600">{label}</span>
                </div>
              ))}
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-gray-300 mr-2"></div>
                <span className="text-sm text-gray-600">휴무일</span>
              </div>
            </div>
            {showMerged && (
              <div className="flex items-center justify-center space-x-4 border-t pt-2">
                <div className="flex items-center">
                  <div className="w-4 h-4 rounded-full bg-blue-400 border-2 border-green-400 mr-2"></div>
                  <span className="text-sm text-gray-600">병합된 시간대</span>
                </div>
                <div className="flex items-center">
                  <span className="text-xs text-white font-bold bg-green-600 px-2 py-1 rounded mr-2">30분</span>
                  <span className="text-sm text-gray-600">병합 지속시간</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 시간표 그리드 */}
        <div className="overflow-auto" style={{ maxHeight: '60vh' }}>
          {showMerged ? renderMergedView() : renderDetailedView()}
        </div>

        {/* 푸터 */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-t border-gray-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <p className="text-sm text-gray-600 font-medium">
              {readOnly
? "현재 설정된 시간표를 확인하고 있습니다."
: "시간 슬롯을 클릭하여 우선순위를 설정하세요. (선호 → 보통 → 조정 가능 → 해제)"
              }
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  // 편집 모드가 아닐 때만 저장하지 않은 변경사항을 초기 상태로 복원
                  if (hasUnsavedChanges && setExceptions && readOnly) {
                    setExceptions([...initialExceptions]);
                  }
                  onClose();
                }}
                className="px-5 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-all duration-200 shadow-md hover:shadow-lg font-medium"
              >
닫기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailTimeGrid;
