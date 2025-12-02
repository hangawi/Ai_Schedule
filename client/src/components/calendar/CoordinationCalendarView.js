import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  getBlockedTimeInfo,
  getRoomExceptionInfo,
  generateDayTimeSlots
} from '../../utils/timetableHelpers';

const toYYYYMMDD = (date) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const timeToMinutes = (timeStr) => {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [hour, minute] = timeStr.split(':').map(Number);
  return hour * 60 + minute;
};

const DaySummaryBar = ({ blocks }) => {
  if (!blocks || blocks.length === 0) {
    return <div className="w-full h-2 bg-gray-200 rounded-full"></div>;
  }

  const totalMinutes = 24 * 60;

  return (
    <div className="w-full h-3 flex rounded-full overflow-hidden border border-gray-300">
      {blocks.map((block, index) => {
        const width = (block.duration / totalMinutes) * 100;
        let bgColor = 'bg-gray-200';
        let tooltip = `${block.startTime} - ${getEndTimeForBlock(block)}: ${block.name}`;

        switch (block.type) {
          case 'assigned':
            // "배정된 시간"만 있는 경우 보라색, 그 외는 파란색
            const hasOnlyOthers = block.users && block.users.every(u => u === '배정된 시간');
            const hasSelfAndOthers = block.users && block.users.some(u => u === '배정된 시간') && block.users.some(u => u !== '배정된 시간');
            if (hasOnlyOthers) {
              bgColor = 'bg-purple-500';
            } else if (hasSelfAndOthers) {
              bgColor = 'bg-indigo-500'; // 혼합: 본인 + 다른 사람
            } else {
              bgColor = 'bg-blue-500';
            }
            tooltip = `${block.startTime} - ${getEndTimeForBlock(block)}: ${block.users.join(', ')}`;
            break;
          case 'blocked':
            bgColor = 'bg-red-500';
            break;
          case 'travel':
            bgColor = 'bg-green-500';
            tooltip = `${block.startTime} - ${getEndTimeForBlock(block)}: 이동시간`;
            break;

          case 'empty':
            bgColor = 'bg-white';
            tooltip = `${block.startTime} - ${getEndTimeForBlock(block)}: 빈 시간`;
            break;
          default:
            break;
        }

        return (
          <div key={index} className={`h-full ${bgColor}`} style={{ width: `${width}%` }} title={tooltip}></div>
        );
      })}
    </div>
  );
};

const getEndTimeForBlock = (block) => {
  const startMinutes = timeToMinutes(block.startTime);
  const endMinutes = startMinutes + block.duration;
  const hour = Math.floor(endMinutes / 60) % 24;
  const min = endMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

const CoordinationCalendarView = ({
  roomData,
  timeSlots = [],
  members = [],
  currentUser,
  isRoomOwner,
  onDateClick,
  selectedDate,
  ownerOriginalSchedule, // New prop
  currentWeekStartDate,
  onWeekChange
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    if (currentWeekStartDate) {
      setCurrentDate(new Date(currentWeekStartDate));
    }
  }, [currentWeekStartDate]);

  const getOwnerScheduleInfoForTime = (date, time) => {
    if (!ownerOriginalSchedule) return null;

    const timeMinutes = timeToMinutes(time);
    const dayOfWeek = date.getDay();
    const dateStr = toYYYYMMDD(date);

    const exception = ownerOriginalSchedule.scheduleExceptions?.find(e => {
      if (e.specificDate !== dateStr) return false;
      const startMins = timeToMinutes(e.startTime);
      const endMins = timeToMinutes(e.endTime);
      return timeMinutes >= startMins && timeMinutes < endMins;
    });
    if (exception) return { type: 'exception', ...exception };

    const personal = ownerOriginalSchedule.personalTimes?.find(p => {
      // specificDate가 있으면 날짜로 비교 (일회성 일정)
      if (p.specificDate) {
        if (p.specificDate !== dateStr) return false;
      } else if (p.isRecurring !== false && p.days?.includes(dayOfWeek)) {
        // specificDate가 없고 반복되는 경우만
      } else {
        return false;
      }

      const startMins = timeToMinutes(p.startTime);
      const endMins = timeToMinutes(p.endTime);
      if (endMins <= startMins) return timeMinutes >= startMins || timeMinutes < endMins;
      return timeMinutes >= startMins && timeMinutes < endMins;
    });
    if (personal) return { type: 'personal', ...personal };

    // 🔍 디버깅: defaultSchedule 전체 확인
    if (time === '09:00' && ownerOriginalSchedule?.defaultSchedule) {
      console.log('🔍 [일정맞추기-캘린더뷰] 09:00 시간의 defaultSchedule:', {
        dateStr,
        dayOfWeek,
        totalCount: ownerOriginalSchedule.defaultSchedule.length,
        items: ownerOriginalSchedule.defaultSchedule.filter(s => 
          s.specificDate === dateStr || s.dayOfWeek === dayOfWeek
        )
      });
    }

    const preferred = ownerOriginalSchedule.defaultSchedule?.some(s => {
      // 🔧 수정: specificDate가 있으면 그 날짜에만 적용
      if (s.specificDate) {
        if (s.specificDate !== dateStr) return false;
      } else {
        // specificDate가 없으면 dayOfWeek로 체크 (반복 일정)
        if (s.dayOfWeek !== dayOfWeek) return false;
      }

      return timeMinutes >= timeToMinutes(s.startTime) &&
             timeMinutes < timeToMinutes(s.endTime);
    });

    if (preferred) {
      // 🔍 디버깅: preferred 타입 반환
      if (time === '09:00') {
        console.log('✅ [일정맞추기-캘린더뷰] 09:00에 preferred 타입 반환 (빈시간)');
      }
      return { type: 'preferred' };
    }

    return { type: 'non_preferred' };
  };

  const getBlocksForDay = (date) => {
    const allPossibleSlots = generateDayTimeSlots(0, 24);
    const slotMap = new Map();

    allPossibleSlots.forEach(time => {
      const blockingInfo = getBlockedTimeInfo(time, roomData.settings) || getRoomExceptionInfo(date, time, roomData.settings);
      const assignedSlots = timeSlots.filter(slot =>
        toYYYYMMDD(slot.date) === toYYYYMMDD(date) &&
        time >= slot.startTime && time < slot.endTime
      );
      const travelSlot = assignedSlots.find(slot => slot.isTravel);
      const activitySlots = assignedSlots.filter(slot => !slot.isTravel);

      const ownerInfo = getOwnerScheduleInfoForTime(date, time);

      let event = null;
      if (blockingInfo) {
        event = { type: 'blocked', name: blockingInfo.name };
      } else if (travelSlot) {
        event = { type: 'travel', name: '이동시간' };
      } else if (activitySlots.length > 0) {
        const userNames = assignedSlots.map(slot => {
            // 현재 사용자의 슬롯인지 확인
            const slotUserId = slot.user?._id?.toString() || slot.user?.toString();
            const currentUserId = currentUser?.id?.toString() || currentUser?._id?.toString();
            const isOwnSlot = slotUserId && currentUserId && slotUserId === currentUserId;

            // 방장이 아닌 경우: 본인 슬롯은 이름 표시, 다른 사람은 "다른 사람"
            if (!isRoomOwner) {
              if (isOwnSlot) {
                // 본인 슬롯: 이름 표시
                if (slot.user && typeof slot.user === 'object' && slot.user._id) {
                  const user = slot.user;
                  return `${user.firstName || ''} ${user.lastName || ''}`.trim() || '나';
                }
                return '나';
              } else {
                // 다른 사람 슬롯
                return '배정된 시간';
              }
            }

            // 방장인 경우: 모든 이름 표시
            // slot.user가 populate되어 있으면 직접 사용 (우선순위 1)
            if (slot.user && typeof slot.user === 'object' && slot.user._id) {
              const user = slot.user;
              return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.firstName || '알 수 없음';
            }

            // slot.user가 ObjectId만 있으면 members에서 찾기 (우선순위 2)
            const member = members.find(m => {
              const memberUserId = m.user?._id?.toString() || m.user?.toString();
              const slotUserIdInner = slot.user?._id?.toString() || slot.user?.toString();
              return memberUserId && slotUserIdInner && memberUserId === slotUserIdInner;
            });

            if (member && member.user && typeof member.user === 'object') {
              const user = member.user;
              return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.firstName || '알 수 없음';
            }

            return '알 수 없음';
        }).filter(Boolean).sort();
        const uniqueUserNames = [...new Set(userNames)];
        event = { type: 'assigned', name: uniqueUserNames.join(', '), users: uniqueUserNames };
      } else if (ownerInfo?.type === 'personal') {
        // personalTimes는 방장의 개인 일정이므로 배정 불가능
        event = { type: 'blocked', name: ownerInfo.title || '방장 개인일정' };
      } else if (ownerInfo?.type === 'non_preferred') {
        event = { type: 'blocked', name: '방장 불가능' };
      }
      // preferred 타입은 무시 (선호시간이므로 빈 시간으로 유지 = 배정 가능)
      slotMap.set(time, event);
    });

    const blocks = [];
    let currentBlock = null;

    allPossibleSlots.forEach(time => {
      const event = slotMap.get(time);
      const currentEventType = event ? event.type : 'empty';
      const currentEventName = event ? event.name : 'empty';

      if (currentBlock && currentBlock.type === currentEventType && currentBlock.name === currentEventName) {
        currentBlock.duration += 10;
      } else {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = { type: currentEventType, name: currentEventName, startTime: time, duration: 10, users: event?.users };
      }
    });

    if (currentBlock) blocks.push(currentBlock);
    return blocks;
  };

  const calendarDates = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - firstDay.getDay());

    const dates = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      dates.push({
        date: new Date(date),
        day: date.getDate(),
        isCurrentMonth: date.getMonth() === month,
        isToday: toYYYYMMDD(date) === toYYYYMMDD(new Date()),
        isSelected: selectedDate && toYYYYMMDD(date) === toYYYYMMDD(selectedDate),
        blocks: getBlocksForDay(date),
      });
    }
    return dates;
  }, [currentDate, selectedDate, timeSlots, members, roomData, ownerOriginalSchedule]);


  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
    if (onWeekChange) onWeekChange(toYYYYMMDD(newDate));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    if (onWeekChange) onWeekChange(toYYYYMMDD(today));
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
       <div className="flex items-center justify-between p-4">
        <h2 className="text-xl font-semibold">
          {`${currentDate.getFullYear()}년 ${monthNames[currentDate.getMonth()]}`}
        </h2>
        <div className="flex items-center space-x-2">
          <button onClick={() => navigateMonth(-1)} className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors"><ChevronLeft size={16} /></button>
          <button onClick={goToToday} className="px-3 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors text-sm">오늘</button>
          <button onClick={() => navigateMonth(1)} className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 bg-gray-50 border-y border-gray-200">
        {dayNames.map((dayName, index) => (
          <div key={index} className={`p-3 text-center text-sm font-medium ${index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-gray-700'}`}>
            {dayName}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {calendarDates.map((dateInfo, index) => (
          <div
            key={index}
            className={`h-32 border-r border-b border-gray-100 p-2 cursor-pointer transition-colors ${dateInfo.isCurrentMonth ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 text-gray-400'} ${dateInfo.isToday ? 'bg-blue-100' : ''} ${dateInfo.isSelected ? 'bg-blue-200 ring-2 ring-blue-500' : ''}`}
            onClick={() => onDateClick(dateInfo.date)}
          >
            <div className={`text-sm font-medium mb-2 ${dateInfo.isToday ? 'text-blue-600' : ''}`}>
              {dateInfo.day}
            </div>
            <div className="space-y-1">
              <DaySummaryBar blocks={dateInfo.blocks} />
              <div className="flex flex-wrap gap-1 mt-1 overflow-y-auto" style={{maxHeight: '4.5rem'}}>
                {Array.from(new Set(dateInfo.blocks.filter(b => b.type === 'assigned').flatMap(b => b.users || []))).map((name, i) => (
                  <span
                    key={`user-${i}`}
                    className={`text-sm px-1.5 py-0.5 rounded-full ${
                      name === '배정된 시간'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {name}
                  </span>
                ))}
                {Array.from(new Set(dateInfo.blocks.filter(b => b.type === 'blocked').map(b => b.name))).map((name, i) => (
                  <span key={`block-${i}`} className="text-sm bg-red-100 text-red-800 px-1.5 py-0.5 rounded-full">{name}</span>
                ))}
                {dateInfo.blocks.some(b => b.type === 'travel') && (
                  <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full">이동시간</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CoordinationCalendarView;