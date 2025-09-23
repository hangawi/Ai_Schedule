import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

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
  1: { label: '조정 가능', color: 'bg-blue-200', next: 0 },
  0: { label: '휴무일', color: 'bg-gray-400', next: 3 },
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
  showFullDay = false,
  viewMode = 'month' // 'month' or 'week'
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
    copyType: viewMode === 'month' ? 'none' : 'none', // 월간 뷰에서는 기본적으로 복사 안함
    includePrevWeek: false,
    includeNextWeek: false,
    includeWholeMonth: false
  });

  // 초기 상태 저장 (저장하지 않고 닫을 때 복원용)
  const [initialExceptions] = useState([...exceptions]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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

    // 시간대 정보를 콘솔에 출력 (디버깅 및 정보 확인용)

    // readOnly 모드에서는 정보만 표시하고 수정하지 않음
    if (readOnly) {
      return;
    }

    const dayOfWeek = selectedDate.getDay();
    const existingSlot = schedule.find(
      s => s.dayOfWeek === dayOfWeek && s.startTime === startTime
    );

    if (existingSlot) {
      const currentPriority = existingSlot.priority || 2;
      const nextPriority = priorityConfig[currentPriority].next;

      if (nextPriority === 0) {
        setSchedule(schedule.filter(s =>
          !(s.dayOfWeek === dayOfWeek && s.startTime === startTime)
        ));
      } else {
        setSchedule(schedule.map(s =>
          (s.dayOfWeek === dayOfWeek && s.startTime === startTime)
          ? { ...s, priority: nextPriority }
          : s
        ));
      }
    } else {
      // 빈 슬롯 클릭 시 우선순위 3(선호)으로 시작
      const [hour, minute] = startTime.split(':').map(Number);
      const endMinute = minute + 10;
      const endHour = endMinute >= 60 ? hour + 1 : hour;
      const adjustedEndMinute = endMinute >= 60 ? endMinute - 60 : endMinute;
      const endTime = `${String(endHour).padStart(2, '0')}:${String(adjustedEndMinute).padStart(2, '0')}`;

      // 새로운 슬롯을 기본 스케줄에 추가 (우선순위 3: 선호)
      setSchedule([...schedule, {
        dayOfWeek: dayOfWeek,
        startTime: startTime,
        endTime: endTime,
        priority: 3  // 선호로 시작
      }]);
      setHasUnsavedChanges(true);
      return;

    }
  };

  const getSlotInfo = (startTime) => {
    const dayOfWeek = selectedDate.getDay();
    return schedule.find(
      s => s.dayOfWeek === dayOfWeek && s.startTime === startTime
    );
  };

  const getExceptionForSlot = (startTime) => {
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const [hour, minute] = startTime.split(':').map(Number);

    for (const ex of exceptions) {
      // Date 방식으로 날짜 비교 (로컬 날짜 기준)
      const exStart = new Date(ex.startTime);
      const exYear = exStart.getFullYear();
      const exMonth = String(exStart.getMonth() + 1).padStart(2, '0');
      const exDay = String(exStart.getDate()).padStart(2, '0');
      const exDateStr = `${exYear}-${exMonth}-${exDay}`;

      if (exDateStr === dateStr) {
        const exStartHour = exStart.getHours();
        const exStartMinute = exStart.getMinutes();

        if (hour === exStartHour && minute === exStartMinute) {
          // 매칭 성공 시에만 로그 출력
          console.log(`슬롯 ${startTime} 매칭:`, {
            title: ex.title,
            priority: ex.priority,
            isHoliday: ex.isHoliday
          });
          return ex;
        }
      }
    }
    return null;
  };

  const getPersonalTimeForSlot = (startTime) => {
    const dayOfWeek = selectedDate.getDay() === 0 ? 7 : selectedDate.getDay();
    const [hour, minute] = startTime.split(':').map(Number);
    const slotMinutes = hour * 60 + minute;


    for (const pt of personalTimes) {

      if (!pt.days.includes(dayOfWeek)) {
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

  const addQuickTimeSlot = (startHour, endHour, priority = 3) => {
    if (readOnly) return;

    // 항상 특정 날짜의 예외로 추가 (복사 옵션이 선택된 경우에만 다른 날짜에도 적용)
    if (setExceptions) {
      const exceptions_to_add = [];

      for (let hour = startHour; hour < endHour; hour++) {
        for (let minute = 0; minute < 60; minute += 10) {
          const slotStartTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
          const endMinute = minute + 10;
          const actualEndHour = endMinute >= 60 ? hour + 1 : hour;
          const actualEndMinute = endMinute >= 60 ? 0 : endMinute;
          const slotEndTime = `${String(actualEndHour).padStart(2, '0')}:${String(actualEndMinute).padStart(2, '0')}`;

          // 로컬 날짜로 정확하게 생성
          const year = selectedDate.getFullYear();
          const month = selectedDate.getMonth();
          const day = selectedDate.getDate();

          const startDateTime = new Date(year, month, day, hour, minute, 0);
          const endDateTime = new Date(year, month, day, actualEndHour, actualEndMinute, 0);

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
      }

      setExceptions([...exceptions, ...exceptions_to_add]);
      setHasUnsavedChanges(true);

      // 복사 옵션이 선택된 경우에만 추가 날짜에 적용
      if (copyOptions.copyType !== 'none') {
        exceptions_to_add.forEach(exc => applyCopyOptions(exc));
      }

      // 즉시 자동 저장 실행
      if (onSave) {
        setTimeout(async () => {
          try {
            await onSave();
            setHasUnsavedChanges(false);
            console.log('Quick time slot auto-saved successfully');
          } catch (error) {
            console.error('Quick time slot auto-save failed:', error);
          }
        }, 200);
      }

      // 강제 리렌더링
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 10);
    }
  };


  const applyCopyOptions = (baseException) => {
    // 복사 옵션에 따라 다른 날짜에도 동일한 예외 추가
    if (!setExceptions || copyOptions.copyType === 'none') return;

    console.log('복사 옵션 적용:', copyOptions.copyType, baseException);

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
      console.log('다음주 복사 생성:', newException);

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
      console.log('이전주 복사 생성:', newException);

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
      console.log('전체 월 복사 생성:', additionalExceptions.length, '개');
    }

    if (additionalExceptions.length > 0) {
      setTimeout(() => {
        setExceptions(prev => [...prev, ...additionalExceptions]);
        console.log('복사된 예외 일정 추가 완료:', additionalExceptions.length, '개');
      }, 100);
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

    console.log('하루 전체 삭제 시작:', dateStr);

    // 해당 날짜의 모든 예외 일정 삭제
    const filteredExceptions = exceptions.filter(ex => {
      const exStartTime = new Date(ex.startTime);
      const exYear = exStartTime.getFullYear();
      const exMonth = String(exStartTime.getMonth() + 1).padStart(2, '0');
      const exDay = String(exStartTime.getDate()).padStart(2, '0');
      const exDateStr = `${exYear}-${exMonth}-${exDay}`;
      return exDateStr !== dateStr;
    });

    const deletedCount = exceptions.length - filteredExceptions.length;
    console.log(`${deletedCount}개의 예외 일정 삭제됨`);

    if (setExceptions) {
      setExceptions(filteredExceptions);
      setHasUnsavedChanges(true);

      // 즉시 자동 저장 실행
      if (onSave) {
        setTimeout(async () => {
          try {
            await onSave();
            setHasUnsavedChanges(false);
            console.log('하루 전체 삭제 후 자동 저장 완료');
          } catch (error) {
            console.error('하루 전체 삭제 후 자동 저장 실패:', error);
          }
        }, 200);
      }
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

        console.log('직접입력으로 생성된 예외:', newException);

        exceptions_to_add.push(newException);
      }

      setExceptions([...exceptions, ...exceptions_to_add]);
      setHasUnsavedChanges(true);

      // 복사 옵션이 선택된 경우에만 추가 날짜에 적용
      if (copyOptions.copyType !== 'none') {
        exceptions_to_add.forEach(exc => applyCopyOptions(exc));
      }

      // 즉시 자동 저장 실행
      if (onSave) {
        setTimeout(async () => {
          try {
            await onSave();
            setHasUnsavedChanges(false);
            console.log('Direct input auto-saved successfully');
          } catch (error) {
            console.error('Direct input auto-save failed:', error);
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-11/12 max-w-4xl max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {formatDate(selectedDate)} 세부 시간표
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {!readOnly && (
            <div className="space-y-4">
              {/* 시간대 추가 버튼들 */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-800 mb-3">⏰ 빠른 시간 추가</h4>
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

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <button
                        onClick={() => addQuickTimeSlot(9, 12, directInput.priority)}
                        className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors shadow-sm"
                      >
오전 (9-12시)
                      </button>
                      <button
                        onClick={() => addQuickTimeSlot(13, 17, directInput.priority)}
                        className="w-full px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors shadow-sm"
                      >
오후 (13-17시)
                      </button>
                    </div>
                    <div className="space-y-2">
                      <button
                        onClick={() => addQuickTimeSlot(18, 22, directInput.priority)}
                        className="w-full px-4 py-2 bg-pink-600 text-white rounded-lg text-sm hover:bg-pink-700 transition-colors shadow-sm"
                      >
저녁 (18-22시)
                      </button>
                      <button
                        onClick={() => addQuickTimeSlot(9, 17, directInput.priority)}
                        className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600 transition-colors shadow-sm"
                      >
                        💼 전체 근무시간
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 기타 옵션들 */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <button
                  onClick={() => setShowDirectInput(!showDirectInput)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors shadow-md font-medium"
                >
직접 입력
                </button>
                <button
                  onClick={() => setShowCopyOptions(!showCopyOptions)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors shadow-md font-medium"
                >
복사 옵션
                </button>
                <button
                  onClick={() => setTimeRange({ start: 0, end: 24 })}
                  className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm hover:bg-green-800 transition-colors shadow-md font-medium border border-green-600"
                  style={{backgroundColor: '#15803d', color: '#ffffff'}}
                >
24시간 보기
                </button>
                <button
                  onClick={blockEntireDay}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700 transition-colors shadow-md font-medium"
                >
휴무일 설정
                </button>
                <button
                  onClick={deleteEntireDay}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors shadow-md font-medium"
                >
하루 전체 삭제
                </button>
              </div>
            </div>
          )}

          {showCopyOptions && (
            <div className="mt-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
              <h4 className="text-sm font-semibold mb-3 text-indigo-800">복사 옵션 설정</h4>
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
              <p className="text-xs text-indigo-600 mt-2">
                선택한 옵션은 시간 추가 시 자동으로 적용됩니다.
              </p>
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
            <div className="flex items-center justify-center space-x-4">
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
          </div>
        )}

        {/* 시간표 그리드 */}
        <div className="overflow-auto" style={{ maxHeight: '60vh' }}>
          <div className="grid grid-cols-7 gap-0">
            {/* 시간 컬럼 */}
            <div className="bg-gray-50 border-r border-gray-200">
              <div className="p-3 text-center font-semibold text-gray-700 border-b border-gray-200">
                시간
              </div>
              {timeSlots.map(time => (
                <div
                  key={time}
                  className="p-2 text-center text-sm font-medium text-gray-600 border-b border-gray-100 h-8 flex items-center justify-center"
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
                    // 일반 예외 일정 (직접입력으로 추가된 일정)
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
                  cursorClass = 'cursor-not-allowed'; // 휴무일은 항상 클릭 불가
                }

                return (
                  <div
                    key={time}
                    className={`border-b border-gray-100 h-8 flex items-center justify-center transition-colors ${slotClass} ${cursorClass}`}
                    onClick={() => {
                      // 휴무일은 클릭 불가
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
              {!readOnly && onSave && (
                <button
                  onClick={async () => {
                    try {
                      await onSave();
                      setHasUnsavedChanges(false);
                      const btn = document.activeElement;
                      const originalText = btn.textContent;
                      btn.textContent = '저장됨!';
                      btn.style.backgroundColor = '#10B981';
                      setTimeout(() => {
                        btn.textContent = originalText;
                        btn.style.backgroundColor = '';
                      }, 1000);

                      window.dispatchEvent(new Event('calendarUpdate'));
                    } catch (error) {
                      console.error('저장 실패:', error);
                    }
                  }}
                  className="px-5 py-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition-all duration-200 shadow-md hover:shadow-lg font-medium"
                >
저장
                </button>
              )}
              <button
                onClick={() => {
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
