/**
 * useHandlers.js - DetailTimeGrid 핸들러 함수 모음
 *
 * 📍 위치: DetailTimeGrid/hooks/useHandlers.js
 * 🔗 연결: ../index.js
 */

import { getNextTimeSlot } from '../utils/timeCalculations';

/**
 * createHandlers - 모든 핸들러 함수를 생성하여 반환
 * 컴포넌트의 state와 setter를 받아 핸들러 함수들을 생성
 */
export const createHandlers = ({
  selectedDate, schedule, setSchedule, exceptions, setExceptions,
  readOnly, copyOptions, personalTimes, timeRange, setTimeRange,
  onSave, showToast, setHasUnsavedChanges, showMerged, mergedSchedule,
  directInput, setDirectInput, setShowDirectInput,
  getSlotInfo, getExceptionForSlot, getPersonalTimeForSlot,
  hasExceptionInTimeRange, applyCopyOptions, applyCopyOptionsToSchedule,
  removeExceptionsInTimeRange
}) => {

  const getDateStr = () => {
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  /**
   * handleSlotClick - 시간 슬롯 클릭 핸들러
   * 우선순위 순환: 선호(3) → 보통(2) → 조정가능(1) → 삭제
   */
  const handleSlotClick = (startTime) => {
    if (readOnly) return;
    if (!setSchedule) return;

    const dayOfWeek = selectedDate.getDay();
    const dateStr = getDateStr();

    const existingSlot = schedule.find(slot =>
      slot.specificDate === dateStr &&
      slot.startTime === startTime &&
      slot.endTime === getNextTimeSlot(startTime)
    );

    if (existingSlot) {
      const currentPriority = existingSlot.priority || 3;

      if (currentPriority === 3) {
        setSchedule(schedule.map(slot =>
          (slot.specificDate === dateStr && slot.startTime === startTime && slot.endTime === getNextTimeSlot(startTime))
            ? { ...slot, priority: 2 }
            : slot
        ));
      } else if (currentPriority === 2) {
        setSchedule(schedule.map(slot =>
          (slot.specificDate === dateStr && slot.startTime === startTime && slot.endTime === getNextTimeSlot(startTime))
            ? { ...slot, priority: 1 }
            : slot
        ));
      } else if (currentPriority === 1) {
        const idToDelete = existingSlot._id;
        const sourceIdToDelete = existingSlot.sourceId;

        setSchedule(schedule.filter(slot => {
          if (slot.specificDate === dateStr && slot.startTime === startTime && slot.endTime === getNextTimeSlot(startTime)) {
            return false;
          }
          if (idToDelete && slot.sourceId === idToDelete) {
            return false;
          }
          if (sourceIdToDelete && (slot._id === sourceIdToDelete || slot.sourceId === sourceIdToDelete)) {
            return false;
          }
          return true;
        }));
      } else {
        setSchedule(schedule.map(slot =>
          (slot.specificDate === dateStr && slot.startTime === startTime && slot.endTime === getNextTimeSlot(startTime))
            ? { ...slot, priority: 3 }
            : slot
        ));
      }
    } else {
      const endTime = getNextTimeSlot(startTime);
      const newSlot = {
        _id: Date.now().toString() + Math.random(),
        dayOfWeek: selectedDate.getDay(),
        startTime: startTime,
        endTime: endTime,
        priority: 3,
        specificDate: dateStr
      };

      setSchedule([...schedule, newSlot]);

      if (copyOptions.copyType !== 'none') {
        applyCopyOptionsToSchedule([newSlot]);
      }
    }

    setHasUnsavedChanges(true);
  };

  /**
   * addQuickTimeSlot - 빠른 시간 추가/제거 (오전/오후)
   */
  const addQuickTimeSlot = (startHour, endHour, priority = 3) => {
    if (readOnly || !setSchedule) return;

    const dayOfWeek = selectedDate.getDay();
    const dateStr = getDateStr();

    const existingSlots = schedule.filter(slot => {
      if (!slot.specificDate || slot.specificDate !== dateStr) return false;
      const slotStart = slot.startTime.split(':').map(Number);
      const slotEnd = slot.endTime.split(':').map(Number);
      const slotStartMinutes = slotStart[0] * 60 + slotStart[1];
      const slotEndMinutes = slotEnd[0] * 60 + slotEnd[1];
      const targetStartMinutes = startHour * 60;
      const targetEndMinutes = endHour * 60;
      return (slotStartMinutes < targetEndMinutes && slotEndMinutes > targetStartMinutes);
    });

    if (existingSlots.length > 0) {
      const rootIds = new Set();
      existingSlots.forEach(slot => {
        rootIds.add(slot.sourceId || slot._id);
      });

      const filteredSchedule = schedule.filter(slot => {
        const rootId = slot.sourceId || slot._id;
        if (rootIds.has(rootId)) return false;
        if (rootIds.has(slot._id)) return false;
        return true;
      });
      setSchedule(filteredSchedule);
    } else {
      const newSlot = {
        _id: Date.now().toString() + Math.random(),
        dayOfWeek: dayOfWeek,
        startTime: `${String(startHour).padStart(2, '0')}:00`,
        endTime: `${String(endHour).padStart(2, '0')}:00`,
        priority: priority,
        specificDate: dateStr
      };

      setSchedule([...schedule, newSlot]);

      if (copyOptions.copyType !== 'none') {
        applyCopyOptionsToSchedule([newSlot]);
      }
    }

    setHasUnsavedChanges(true);

    if (onSave && !readOnly) {
      setTimeout(async () => {
        try {
          await onSave();
          setHasUnsavedChanges(false);
        } catch (error) {}
      }, 200);
    }

    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 10);
  };

  /**
   * addHolidayForDay - 휴무일 설정/해제 (토글)
   */
  const addHolidayForDay = () => {
    if (readOnly) return;

    setTimeRange({ start: 0, end: 24 });

    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const existingHolidayExceptions = exceptions.filter(ex => {
      const exStartTime = new Date(ex.startTime);
      const exYear = exStartTime.getFullYear();
      const exMonth = String(exStartTime.getMonth() + 1).padStart(2, '0');
      const exDay = String(exStartTime.getDate()).padStart(2, '0');
      const exDateStr = `${exYear}-${exMonth}-${exDay}`;
      return exDateStr === dateStr && (ex.title === '휴무일' || ex.isHoliday);
    });

    if (existingHolidayExceptions.length > 0) {
      const rootIds = new Set();
      existingHolidayExceptions.forEach(ex => {
        rootIds.add(ex.sourceId || ex._id);
      });

      const filteredExceptions = exceptions.filter(ex => {
        const rootId = ex.sourceId || ex._id;
        if (rootIds.has(rootId)) return false;
        if (rootIds.has(ex._id)) return false;
        return true;
      });
      setExceptions(filteredExceptions);
      setHasUnsavedChanges(true);
    } else {
      const filteredExceptions = exceptions.filter(ex => {
        const exStartTime = new Date(ex.startTime);
        const exYear = exStartTime.getFullYear();
        const exMonth = String(exStartTime.getMonth() + 1).padStart(2, '0');
        const exDay = String(exStartTime.getDate()).padStart(2, '0');
        const exDateStr = `${exYear}-${exMonth}-${exDay}`;
        return exDateStr !== dateStr;
      });

      const holidayExceptions = [];
      for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += 10) {
          const startDateTime = new Date(year, selectedDate.getMonth(), selectedDate.getDate(), hour, minute, 0);
          const endMinute = minute + 10;
          const endHour = endMinute >= 60 ? hour + 1 : hour;
          const adjustedEndMinute = endMinute >= 60 ? 0 : endMinute;
          const endDateTime = new Date(year, selectedDate.getMonth(), selectedDate.getDate(), endHour, adjustedEndMinute, 0);

          holidayExceptions.push({
            _id: Date.now().toString() + Math.random() + hour + minute,
            title: '휴무일',
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString(),
            isHoliday: true,
            isAllDay: true,
            specificDate: dateStr
          });
        }
      }

      setExceptions([...filteredExceptions, ...holidayExceptions]);
      setHasUnsavedChanges(true);

      if (copyOptions.copyType !== 'none') {
        holidayExceptions.forEach(exc => applyCopyOptions(exc));
      }
    }
  };

  /**
   * blockEntireDay - 하루 전체를 휴무일로 설정/해제 (토글)
   */
  const blockEntireDay = () => {
    if (readOnly || !setExceptions) return;

    setTimeRange({ start: 0, end: 24 });

    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const existingHolidayExceptions = exceptions.filter(ex => {
      const exStartTime = new Date(ex.startTime);
      const exYear = exStartTime.getFullYear();
      const exMonth = String(exStartTime.getMonth() + 1).padStart(2, '0');
      const exDay = String(exStartTime.getDate()).padStart(2, '0');
      const exDateStr = `${exYear}-${exMonth}-${exDay}`;
      return exDateStr === dateStr && (ex.title === '휴무일' || ex.isHoliday);
    });

    if (existingHolidayExceptions.length > 0) {
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
      const filteredExceptions = exceptions.filter(ex => {
        const exStartTime = new Date(ex.startTime);
        const exYear = exStartTime.getFullYear();
        const exMonth = String(exStartTime.getMonth() + 1).padStart(2, '0');
        const exDay = String(exStartTime.getDate()).padStart(2, '0');
        const exDateStr = `${exYear}-${exMonth}-${exDay}`;
        return exDateStr !== dateStr;
      });

      const holidayExceptions = [];
      for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += 10) {
          const startDateTime = new Date(year, selectedDate.getMonth(), selectedDate.getDate(), hour, minute, 0);
          const endMinute = minute + 10;
          const endHour = endMinute >= 60 ? hour + 1 : hour;
          const adjustedEndMinute = endMinute >= 60 ? 0 : endMinute;
          const endDateTime = new Date(year, selectedDate.getMonth(), selectedDate.getDate(), endHour, adjustedEndMinute, 0);

          holidayExceptions.push({
            _id: Date.now().toString() + Math.random() + hour + minute,
            title: '휴무일',
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString(),
            isHoliday: true,
            isAllDay: true,
            specificDate: dateStr
          });
        }
      }

      setExceptions([...filteredExceptions, ...holidayExceptions]);
      setHasUnsavedChanges(true);
    }
  };

  /**
   * deleteEntireDay - 선택된 날짜의 모든 일정/예외 삭제
   */
  const deleteEntireDay = async () => {
    if (readOnly) return;

    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const day = selectedDate.getDate();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayOfWeek = selectedDate.getDay();

    const idsToDelete = new Set();

    exceptions.forEach(ex => {
      let exDateStr;
      if (ex.specificDate) {
        exDateStr = ex.specificDate;
      } else if (ex.startTime) {
        const exStartTime = new Date(ex.startTime);
        const exYear = exStartTime.getFullYear();
        const exMonth = String(exStartTime.getMonth() + 1).padStart(2, '0');
        const exDay = String(exStartTime.getDate()).padStart(2, '0');
        exDateStr = `${exYear}-${exMonth}-${exDay}`;
      }

      if (exDateStr === dateStr) {
        if (ex._id) idsToDelete.add(String(ex._id));
        if (ex.sourceId) idsToDelete.add(String(ex.sourceId));
      }
    });

    schedule.forEach(s => {
      let sDateStr;
      if (s.specificDate) {
        sDateStr = s.specificDate;
      } else if (s.dayOfWeek !== undefined) {
        if (s.dayOfWeek === dayOfWeek) {
          return;
        }
      }

      if (sDateStr === dateStr) {
        if (s._id) idsToDelete.add(String(s._id));
        if (s.sourceId) idsToDelete.add(String(s.sourceId));
      }
    });

    let newExceptions = [...exceptions];
    let newSchedule = [...schedule];

    if (idsToDelete.size > 0) {
      newExceptions = exceptions.filter(ex => {
        const exId = ex._id ? String(ex._id) : undefined;
        const exSourceId = ex.sourceId ? String(ex.sourceId) : undefined;
        return !(idsToDelete.has(exId) || idsToDelete.has(exSourceId));
      });

      newSchedule = schedule.filter(s => {
        const sId = s._id ? String(s._id) : undefined;
        const sSourceId = s.sourceId ? String(s.sourceId) : undefined;
        return !(idsToDelete.has(sId) || idsToDelete.has(sSourceId));
      });
    } else {
      newExceptions = exceptions.filter(ex => {
        let exDateStr;
        if (ex.specificDate) {
          exDateStr = ex.specificDate;
        } else if (ex.startTime) {
          const exStartTime = new Date(ex.startTime);
          const exYear = exStartTime.getFullYear();
          const exMonth = String(exStartTime.getMonth() + 1).padStart(2, '0');
          const exDay = String(exStartTime.getDate()).padStart(2, '0');
          exDateStr = `${exYear}-${exMonth}-${exDay}`;
        }
        return exDateStr !== dateStr;
      });

      newSchedule = schedule.filter(s => {
        const sDateMatches = s.specificDate === dateStr;
        const sDayOfWeekMatches = s.dayOfWeek === dayOfWeek && !s.specificDate;
        return !(sDateMatches || sDayOfWeekMatches);
      });
    }

    if (setExceptions) {
      setExceptions(newExceptions);
    }
    if (setSchedule) {
      setSchedule(newSchedule);
    }
    setHasUnsavedChanges(true);

    if (onSave && readOnly) {
      setTimeout(async () => {
        try {
          await onSave();
          setHasUnsavedChanges(false);
        } catch (error) {}
      }, 200);
    }
  };

  /**
   * handleDirectInput - 직접 입력 시간 추가
   */
  const handleDirectInput = () => {
    if (readOnly) return;

    const startTime = directInput.startTime;
    const endTime = directInput.endTime;
    const priority = directInput.priority;

    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (endMinutes <= startMinutes) {
      showToast('종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }

    if (setExceptions) {
      const exceptions_to_add = [];

      for (let minutes = startMinutes; minutes < endMinutes; minutes += 10) {
        const slotHour = Math.floor(minutes / 60);
        const slotMin = minutes % 60;
        const slotStartTime = `${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`;

        const nextMinutes = minutes + 10;
        const nextHour = Math.floor(nextMinutes / 60);
        const nextMin = nextMinutes % 60;

        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const day = selectedDate.getDate();

        const startDateTime = new Date(year, month, day, slotHour, slotMin, 0);
        const endDateTime = new Date(year, month, day, nextHour, nextMin, 0);

        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        exceptions_to_add.push({
          _id: Date.now().toString() + Math.random(),
          title: '일정',
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          priority: priority,
          specificDate: dateStr
        });
      }

      setExceptions([...exceptions, ...exceptions_to_add]);
      setHasUnsavedChanges(true);

      if (copyOptions.copyType !== 'none') {
        exceptions_to_add.forEach(exc => applyCopyOptions(exc));
      }

      if (onSave && readOnly) {
        setTimeout(async () => {
          try {
            await onSave();
            setHasUnsavedChanges(false);
          } catch (error) {}
        }, 200);
      }

      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 10);

      setShowDirectInput(false);
      setDirectInput({
        startTime: '09:00',
        endTime: '10:00',
        priority: 2
      });
    }
  };

  return {
    handleSlotClick,
    addQuickTimeSlot,
    addHolidayForDay,
    blockEntireDay,
    deleteEntireDay,
    handleDirectInput
  };
};
