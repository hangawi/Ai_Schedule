/**
 * MergedView.js - 병합된 시간표 뷰 컴포넌트
 *
 * 📍 위치: DetailTimeGrid/components/MergedView.js
 * 🔗 연결: ../index.js
 */

import React from 'react';
import { timeToMinutes, generateTimeSlots, getNextTimeSlot, getTimeDifferenceInMinutes } from '../utils/timeCalculations';
import { mergeConsecutiveTimeSlots } from '../utils/timeSlotMerger';
import { formatDate } from '../utils/dateFormatters';
import { priorityConfig } from '../constants/priorityConfig';

const MergedView = ({ selectedDate, mergedSchedule, exceptions, personalTimes, timeRange, onSlotClick }) => {
  const dayOfWeek = selectedDate.getDay();
  const displaySlots = [];

  const year = selectedDate.getFullYear();
  const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
  const day = String(selectedDate.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  // 병합된 기본 스케줄 필터링
  const filteredSchedule = mergedSchedule.filter(slot => {
    if (slot.specificDate) {
      return slot.specificDate === dateStr;
    }
    return slot.dayOfWeek === dayOfWeek;
  });

  filteredSchedule.forEach(slot => {
    displaySlots.push({
      type: 'schedule',
      startTime: slot.startTime,
      endTime: slot.endTime,
      priority: slot.priority,
      isMerged: slot.isMerged,
      data: slot
    });
  });

  // 예외 일정들을 10분 단위로 분할 후 병합
  const exceptionSlots = [];
  exceptions.forEach(ex => {
    if (!ex || !ex.specificDate || !ex.startTime || !ex.endTime) return;

    if (ex.specificDate === dateStr) {
      let startTime, endTimeStr;

      if (ex.startTime.includes('T')) {
        const startDate = new Date(ex.startTime);
        const endDate = new Date(ex.endTime);
        startTime = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
        endTimeStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
      } else {
        startTime = ex.startTime;
        endTimeStr = ex.endTime;
      }

      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTimeStr);

      for (let minutes = startMinutes; minutes < endMinutes; minutes += 10) {
        const hour = Math.floor(minutes / 60);
        const minute = minutes % 60;
        const slotStartTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        const slotEndTime = getNextTimeSlot(slotStartTime);

        exceptionSlots.push({
          startTime: slotStartTime,
          endTime: slotEndTime,
          priority: ex.priority || 3,
          dayOfWeek: selectedDate.getDay(),
          title: ex.title,
          isException: true
        });
      }
    }
  });

  const mergedExceptions = mergeConsecutiveTimeSlots(exceptionSlots);
  mergedExceptions.forEach(slot => {
    displaySlots.push({
      type: 'exception',
      startTime: slot.startTime,
      endTime: slot.endTime,
      data: slot,
      isMerged: slot.isMerged
    });
  });

  // 개인 시간 수집 (자정 넘김 처리)
  const dayOfWeekPersonal = selectedDate.getDay() === 0 ? 7 : selectedDate.getDay();

  // 선호시간 + 개인시간 범위 수집
  const preferredTimeRanges = [];
  filteredSchedule.forEach(slot => {
    if (slot.priority >= 2) {
      const startMinutes = timeToMinutes(slot.startTime);
      const endMinutes = timeToMinutes(slot.endTime);
      preferredTimeRanges.push({ start: startMinutes, end: endMinutes });
    }
  });
  mergedExceptions.forEach(slot => {
    if (slot.priority >= 2) {
      const startMinutes = timeToMinutes(slot.startTime);
      const endMinutes = timeToMinutes(slot.endTime);
      preferredTimeRanges.push({ start: startMinutes, end: endMinutes });
    }
  });

  // personalTimes도 선호시간으로 간주
  personalTimes.forEach(pt => {
    let shouldInclude = false;

    if (pt.specificDate) {
      if (pt.specificDate === dateStr) shouldInclude = true;
    } else if (pt.isRecurring !== false && pt.days && pt.days.includes(dayOfWeekPersonal)) {
      shouldInclude = true;
    }

    if (shouldInclude) {
      const [startHour, startMin] = pt.startTime.split(':').map(Number);
      const [endHour, endMin] = pt.endTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      let endMinutes = endHour * 60 + endMin;

      if (endMinutes <= startMinutes) {
        endMinutes += 24 * 60;
        preferredTimeRanges.push({ start: startMinutes, end: 24 * 60 });
        preferredTimeRanges.push({ start: 0, end: endMinutes - 24 * 60 });
      } else {
        preferredTimeRanges.push({ start: startMinutes, end: endMinutes });
      }
    }
  });

  // 선호시간이 없으면 전체를 불가능한 시간으로 표시
  if (preferredTimeRanges.length === 0) {
    displaySlots.push({
      type: 'personal',
      startTime: `${String(timeRange.start).padStart(2, '0')}:00`,
      endTime: `${String(timeRange.end).padStart(2, '0')}:00`,
      data: { title: '불가능한 시간' }
    });
  }

  // 선호시간이 아닌 시간대 찾기
  const allDayMinutes = [];
  for (let minutes = timeRange.start * 60; minutes < timeRange.end * 60; minutes += 10) {
    allDayMinutes.push(minutes);
  }

  const nonPreferredRanges = [];
  let currentRangeStart = null;

  for (const minutes of allDayMinutes) {
    const isPreferred = preferredTimeRanges.some(range =>
      minutes >= range.start && minutes < range.end
    );

    if (!isPreferred) {
      if (currentRangeStart === null) currentRangeStart = minutes;
    } else {
      if (currentRangeStart !== null) {
        nonPreferredRanges.push({ start: currentRangeStart, end: minutes });
        currentRangeStart = null;
      }
    }
  }

  if (currentRangeStart !== null) {
    nonPreferredRanges.push({ start: currentRangeStart, end: 24 * 60 });
  }

  nonPreferredRanges.forEach(range => {
    const startHour = Math.floor(range.start / 60);
    const startMin = range.start % 60;
    const endHour = Math.floor(range.end / 60);
    const endMin = range.end % 60;

    displaySlots.push({
      type: 'personal',
      startTime: `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`,
      endTime: `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`,
      data: { title: '불가능한 시간' }
    });
  });

  // 개인 시간 추가 (자정 넘김 처리)
  personalTimes.forEach(pt => {
    let shouldInclude = false;

    if (pt.specificDate) {
      const localDateStr = `${year}-${month}-${day}`;
      if (pt.specificDate === localDateStr) shouldInclude = true;
    } else if (pt.isRecurring !== false && pt.days && pt.days.includes(dayOfWeekPersonal)) {
      shouldInclude = true;
    }

    if (shouldInclude) {
      const [startHour, startMin] = pt.startTime.split(':').map(Number);
      const [endHour, endMin] = pt.endTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      if (endMinutes <= startMinutes) {
        displaySlots.push({
          type: 'personal',
          startTime: pt.startTime,
          endTime: '23:50',
          data: { ...pt, title: pt.title }
        });
        displaySlots.push({
          type: 'personal',
          startTime: '00:00',
          endTime: pt.endTime,
          data: { ...pt, title: pt.title }
        });
      } else {
        displaySlots.push({
          type: 'personal',
          startTime: pt.startTime,
          endTime: pt.endTime,
          data: pt
        });
      }
    }
  });

  // 시간순 정렬
  displaySlots.sort((a, b) => a.startTime.localeCompare(b.startTime));

  // 모든 시간 슬롯 순회하며 병합된 슬롯이나 빈 슬롯으로 분류
  const allSlots = [];
  const currentTimeSlots = generateTimeSlots(timeRange.start, timeRange.end);
  const processedTimes = new Set();

  for (const timeSlot of currentTimeSlots) {
    if (processedTimes.has(timeSlot)) continue;

    let foundSlot = null;

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
      allSlots.push({
        ...foundSlot,
        displayTime: timeSlot,
        duration: getTimeDifferenceInMinutes(foundSlot.startTime, foundSlot.endTime)
      });

      const startMinutes = timeToMinutes(foundSlot.startTime);
      const endMinutes = timeToMinutes(foundSlot.endTime);
      for (let minutes = startMinutes; minutes < endMinutes; minutes += 10) {
        const hour = Math.floor(minutes / 60);
        const minute = minutes % 60;
        processedTimes.add(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
      }
    } else {
      const emptyStartTime = timeSlot;
      let emptyEndTime = getNextTimeSlot(timeSlot);
      let duration = 10;

      let nextTimeIndex = currentTimeSlots.indexOf(timeSlot) + 1;
      while (nextTimeIndex < currentTimeSlots.length) {
        const nextTime = currentTimeSlots[nextTimeIndex];
        if (processedTimes.has(nextTime)) break;

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
          const height = Math.max(20, (slot.duration / 10) * 12);

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
          const height = Math.max(20, (slot.duration / 10) * 12);

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
              content = `${priorityConfig[exceptionPriority]?.label} (${slot.duration}분)`;
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
                  onSlotClick(slot.displayTime || slot.startTime);
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

export default MergedView;
