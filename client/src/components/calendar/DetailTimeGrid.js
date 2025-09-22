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
    priority: 3
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
    console.log(`시간대 ${startTime} 정보:`, {
      exception: exception ? exception.title : '없음',
      personalTime: personalTime ? personalTime.title : '없음',
      schedule: slotInfo ? priorityConfig[slotInfo.priority]?.label : '없음'
    });

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
      // 새로운 슬롯 추가 (10분 단위)
      const [hour, minute] = startTime.split(':').map(Number);
      const endMinute = minute + 10;
      const endHour = endMinute >= 60 ? hour + 1 : hour;
      const adjustedEndMinute = endMinute >= 60 ? endMinute - 60 : endMinute;
      const endTime = `${String(endHour).padStart(2, '0')}:${String(adjustedEndMinute).padStart(2, '0')}`;

      // 항상 특정 날짜의 예외로 추가 (복사 옵션이 선택된 경우에만 다른 날짜에도 적용)
      if (setExceptions) {
        const startDateTime = new Date(selectedDate);
        const [startHour, startMin] = startTime.split(':').map(Number);
        startDateTime.setHours(startHour, startMin, 0, 0);

        const endDateTime = new Date(selectedDate);
        const [endHour, endMin] = endTime.split(':').map(Number);
        endDateTime.setHours(endHour, endMin, 0, 0);

        const newException = {
          _id: Date.now().toString(),
          title: '일정',
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          priority: 3,
          specificDate: selectedDate.toISOString().split('T')[0]
        };

        setExceptions([...exceptions, newException]);
        setHasUnsavedChanges(true);

        // 복사 옵션이 선택된 경우에만 추가 날짜에 적용
        if (copyOptions.copyType !== 'none') {
          applyCopyOptions(newException);
        }
      }
    }
  };

  const getSlotInfo = (startTime) => {
    const dayOfWeek = selectedDate.getDay();
    return schedule.find(
      s => s.dayOfWeek === dayOfWeek && s.startTime === startTime
    );
  };

  const getExceptionForSlot = (startTime) => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    const [hour, minute] = startTime.split(':').map(Number);

    for (const ex of exceptions) {
      // Date 방식으로 날짜 비교 (서버 데이터 호환)
      const exStart = new Date(ex.startTime);
      const exDate = exStart.toISOString().split('T')[0];

      if (exDate === dateStr) {
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
      if (!pt.days.includes(dayOfWeek)) continue;

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

          // 로컬 날짜 문자열로 시간 생성 (시간대 문제 방지)
          const dateStr = selectedDate.toISOString().split('T')[0];
          const startTimeStr = `${dateStr}T${slotStartTime}:00`;
          const endTimeStr = `${dateStr}T${slotEndTime}:00`;

          const newException = {
            _id: Date.now().toString() + Math.random(),
            title: '일정',
            startTime: startTimeStr,
            endTime: endTimeStr,
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

      // 강제 리렌더링
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 10);
    }
  };


  const applyCopyOptions = (baseException) => {
    // 복사 옵션에 따라 다른 날짜에도 동일한 예외 추가
    if (!setExceptions) return;

    const additionalExceptions = [];
    const baseDate = new Date(selectedDate);

    if (copyOptions.copyType === 'nextWeek') {
      // 다음주 같은 요일에 복사
      const nextWeekDate = new Date(baseDate);
      nextWeekDate.setDate(baseDate.getDate() + 7);

      const newException = {
        ...baseException,
        _id: Date.now().toString() + Math.random(),
        startTime: new Date(nextWeekDate.getFullYear(), nextWeekDate.getMonth(), nextWeekDate.getDate(),
                         new Date(baseException.startTime).getHours(), new Date(baseException.startTime).getMinutes()).toISOString(),
        endTime: new Date(nextWeekDate.getFullYear(), nextWeekDate.getMonth(), nextWeekDate.getDate(),
                       new Date(baseException.endTime).getHours(), new Date(baseException.endTime).getMinutes()).toISOString(),
        specificDate: nextWeekDate.toISOString().split('T')[0]
      };
      additionalExceptions.push(newException);
    } else if (copyOptions.copyType === 'prevWeek') {
      // 이전주 같은 요일에 복사
      const prevWeekDate = new Date(baseDate);
      prevWeekDate.setDate(baseDate.getDate() - 7);

      const newException = {
        ...baseException,
        _id: Date.now().toString() + Math.random(),
        startTime: new Date(prevWeekDate.getFullYear(), prevWeekDate.getMonth(), prevWeekDate.getDate(),
                         new Date(baseException.startTime).getHours(), new Date(baseException.startTime).getMinutes()).toISOString(),
        endTime: new Date(prevWeekDate.getFullYear(), prevWeekDate.getMonth(), prevWeekDate.getDate(),
                       new Date(baseException.endTime).getHours(), new Date(baseException.endTime).getMinutes()).toISOString(),
        specificDate: prevWeekDate.toISOString().split('T')[0]
      };
      additionalExceptions.push(newException);
    } else if (copyOptions.copyType === 'wholeMonth') {
      // 이번달 모든 같은 요일에 복사
      const currentMonth = baseDate.getMonth();
      const currentYear = baseDate.getFullYear();
      const dayOfWeek = baseDate.getDay();

      for (let week = 0; week < 6; week++) {
        const targetDate = new Date(currentYear, currentMonth, 1 + week * 7 + dayOfWeek - new Date(currentYear, currentMonth, 1).getDay());
        if (targetDate.getMonth() === currentMonth && targetDate.toDateString() !== baseDate.toDateString()) {
          const newException = {
            ...baseException,
            _id: Date.now().toString() + Math.random(),
            startTime: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(),
                             new Date(baseException.startTime).getHours(), new Date(baseException.startTime).getMinutes()).toISOString(),
            endTime: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(),
                           new Date(baseException.endTime).getHours(), new Date(baseException.endTime).getMinutes()).toISOString(),
            specificDate: targetDate.toISOString().split('T')[0]
          };
          additionalExceptions.push(newException);
        }
      }
    }

    if (additionalExceptions.length > 0) {
      setExceptions(prev => [...prev, ...additionalExceptions]);
    }
  };

  const blockEntireDay = () => {
    if (readOnly || !setExceptions) return;

    // 휴무일 설정 시 전체 시간 범위로 변경
    setTimeRange({ start: 0, end: 24 });

    // 선택된 날짜를 휴무일로 설정 (예외 일정으로 추가)
    const dateStr = selectedDate.toISOString().split('T')[0];

    // 해당 날짜의 모든 휴무일 관련 예외 찾기
    const existingHolidayExceptions = exceptions.filter(ex => {
      const exDate = new Date(ex.startTime).toISOString().split('T')[0];
      return exDate === dateStr && (ex.title === '휴무일' || ex.isHoliday);
    });

    if (existingHolidayExceptions.length > 0) {
      // 이미 휴무일로 설정된 경우 해당 날짜의 모든 예외 제거
      const filteredExceptions = exceptions.filter(ex => {
        const exDate = new Date(ex.startTime).toISOString().split('T')[0];
        return exDate !== dateStr;
      });
      setExceptions(filteredExceptions);
      setHasUnsavedChanges(true);
    } else {
      // 해당 날짜의 모든 기존 예외를 완전히 제거하고 새로운 휴무일 설정
      const filteredExceptions = exceptions.filter(ex => {
        const exDate = new Date(ex.startTime).toISOString().split('T')[0];
        return exDate !== dateStr;
      });

      // 전체 하루를 00:00:00 ~ 23:59:59로 설정하여 휴무일 예외 생성
      const startTimeStr = `${dateStr}T00:00:00`;
      const endTimeStr = `${dateStr}T23:59:59`;

      const newException = {
        _id: Date.now().toString() + Math.random(),
        title: '휴무일',
        startTime: startTimeStr,
        endTime: endTimeStr,
        isHoliday: true,
        isAllDay: true,
        specificDate: dateStr
      };

      const holidayExceptions = [newException];

      setExceptions([...filteredExceptions, ...holidayExceptions]);
      setHasUnsavedChanges(true);
    }
  };

  const deleteEntireDay = () => {
    if (readOnly) return;

    const dayOfWeek = selectedDate.getDay();
    const dateStr = selectedDate.toISOString().split('T')[0];

    // 해당 요일의 모든 스케줄 삭제
    const filteredSchedule = schedule.filter(s => s.dayOfWeek !== dayOfWeek);
    setSchedule(filteredSchedule);

    // 해당 날짜의 모든 예외 일정 삭제
    const filteredExceptions = exceptions.filter(ex => {
      const exDate = new Date(ex.startTime).toISOString().split('T')[0];
      return exDate !== dateStr;
    });
    if (setExceptions) {
      setExceptions(filteredExceptions);
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

        // 로컬 날짜 문자열로 시간 생성 (시간대 문제 방지)
        const dateStr = selectedDate.toISOString().split('T')[0];
        const startTimeStr = `${dateStr}T${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}:00`;
        const endTimeStr = `${dateStr}T${String(nextHour).padStart(2, '0')}:${String(nextMin).padStart(2, '0')}:00`;

        const newException = {
          _id: Date.now().toString() + Math.random(),
          title: '일정',
          startTime: startTimeStr,
          endTime: endTimeStr,
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

      // 강제 리렌더링
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 10);

      setShowDirectInput(false);
      // 시간은 초기화하지만 우선순위는 유지
      setDirectInput(prev => ({
        startTime: '09:00',
        endTime: '10:00',
        priority: prev.priority
      }));
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
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => addQuickTimeSlot(9, 12, 3)}
                className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
              >
                오전 (9-12시) 추가
              </button>
              <button
                onClick={() => addQuickTimeSlot(13, 17, 3)}
                className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition-colors"
              >
                오후 (13-17시) 추가
              </button>
              <button
                onClick={() => addQuickTimeSlot(9, 17, 3)}
                className="px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600 transition-colors"
              >
                전체 근무시간 추가
              </button>
              <button
                onClick={() => addQuickTimeSlot(18, 22, 2)}
                className="px-3 py-1 bg-orange-500 text-white rounded text-sm hover:bg-orange-600 transition-colors"
              >
                저녁 (18-22시) 추가
              </button>
              <button
                onClick={() => setShowDirectInput(!showDirectInput)}
                className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 transition-colors"
              >
                직접 입력
              </button>
              <button
                onClick={() => setShowCopyOptions(!showCopyOptions)}
                className="px-3 py-1 bg-indigo-500 text-white rounded text-sm hover:bg-indigo-600 transition-colors"
              >
                복사 옵션
              </button>
              <button
                onClick={() => setTimeRange({ start: 0, end: 24 })}
                className="px-3 py-1 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600 transition-colors"
              >
                24시간 보기
              </button>
              <button
                onClick={blockEntireDay}
                className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 transition-colors"
              >
                휴무일 설정
              </button>
              <button
                onClick={deleteEntireDay}
                className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors"
              >
                하루 전체 삭제
              </button>
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


                let slotClass = 'bg-white hover:bg-gray-50';
                if (isExceptionSlot) {
                  if (exception.title === '휴무일' || exception.isHoliday) {
                    slotClass = 'bg-gray-300 text-gray-600';
                  } else {
                    // 일반 예외 일정 (직접입력으로 추가된 일정)
                    const exceptionPriority = exception.priority !== undefined ? exception.priority : 3;
                    slotClass = priorityConfig[exceptionPriority]?.color || 'bg-blue-600';
                    console.log(`시간 ${time}: 우선순위 ${exceptionPriority} → 색상 ${slotClass}`);
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
                      <span className="text-gray-600 font-medium text-xs">휴무일</span>
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
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-between items-center">
          <p className="text-sm text-gray-600">
            {readOnly
              ? "현재 설정된 시간표를 확인하고 있습니다."
              : "시간 슬롯을 클릭하여 우선순위를 설정하세요. (선호 → 보통 → 조정 가능 → 해제)"
            }
          </p>
          <div className="flex space-x-2">
            {!readOnly && onSave && (
              <button
                onClick={async () => {
                  try {
                    await onSave();
                    setHasUnsavedChanges(false); // 저장 완료 후 변경사항 플래그 초기화
                    // 저장 완료 알림을 위한 시각적 피드백
                    const btn = document.activeElement;
                    const originalText = btn.textContent;
                    btn.textContent = '저장됨!';
                    btn.style.backgroundColor = '#10B981';
                    setTimeout(() => {
                      btn.textContent = originalText;
                      btn.style.backgroundColor = '';
                    }, 1000);

                    // 저장 후 CalendarView 강제 리렌더링
                    window.dispatchEvent(new Event('calendarUpdate'));
                  } catch (error) {
                    console.error('저장 실패:', error);
                  }
                }}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                저장
              </button>
            )}
            <button
              onClick={() => {
                if (hasUnsavedChanges) {
                  // 저장하지 않고 닫을 때 원래 상태로 복원
                  setExceptions(initialExceptions);
                }
                onClose();
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailTimeGrid;
