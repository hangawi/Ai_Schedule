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
            bgColor = 'bg-blue-500';
            tooltip = `${block.startTime} - ${getEndTimeForBlock(block)}: ${block.users.join(', ')}`;
            break;
          case 'blocked':
            bgColor = 'bg-red-500';
            break;
          case 'negotiation':
            bgColor = 'bg-yellow-500';
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
      if (p.isRecurring !== false && p.days?.includes(dayOfWeek)) {
        const startMins = timeToMinutes(p.startTime);
        const endMins = timeToMinutes(p.endTime);
        if (endMins <= startMins) return timeMinutes >= startMins || timeMinutes < endMins;
        return timeMinutes >= startMins && timeMinutes < endMins;
      }
      return false;
    });
    if (personal) return { type: 'personal', ...personal };

    const preferred = ownerOriginalSchedule.defaultSchedule?.some(s => 
      s.dayOfWeek === dayOfWeek &&
      timeMinutes >= timeToMinutes(s.startTime) &&
      timeMinutes < timeToMinutes(s.endTime)
    );

    if (preferred) return { type: 'preferred' };

    return { type: 'non_preferred' };
  };

  const getBlocksForDay = (date) => {
    const allPossibleSlots = generateDayTimeSlots(0, 24);
    const slotMap = new Map();

    allPossibleSlots.forEach(time => {
      const negotiation = roomData.negotiations?.find(neg =>
        neg.status === 'active' && // ✅ active 상태인 협의만
        toYYYYMMDD(neg.slotInfo.date) === toYYYYMMDD(date) &&
        time >= neg.slotInfo.startTime && time < neg.slotInfo.endTime
      );
      const blockingInfo = getBlockedTimeInfo(time, roomData.settings) || getRoomExceptionInfo(date, time, roomData.settings);
      const assignedSlots = timeSlots.filter(slot => 
        toYYYYMMDD(slot.date) === toYYYYMMDD(date) && 
        time >= slot.startTime && time < slot.endTime
      );
      const ownerInfo = getOwnerScheduleInfoForTime(date, time);

      let event = null;
      if (blockingInfo) {
        event = { type: 'blocked', name: blockingInfo.name };
      } else if (negotiation) {
        event = { type: 'negotiation', name: `협의: ${negotiation._id}` };
      } else if (assignedSlots.length > 0) {
        const userNames = assignedSlots.map(slot => {
            // slot.user가 populate되어 있으면 직접 사용 (우선순위 1)
            if (slot.user && typeof slot.user === 'object' && slot.user._id) {
              const user = slot.user;
              return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.firstName || '알 수 없음';
            }

            // slot.user가 ObjectId만 있으면 members에서 찾기 (우선순위 2)
            const member = members.find(m => {
              const memberUserId = m.user?._id?.toString() || m.user?.toString();
              const slotUserId = slot.user?._id?.toString() || slot.user?.toString();
              return memberUserId && slotUserId && memberUserId === slotUserId;
            });

            if (member && member.user && typeof member.user === 'object') {
              const user = member.user;
              return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.firstName || '알 수 없음';
            }

            return '알 수 없음';
        }).filter(Boolean).sort();
        const uniqueUserNames = [...new Set(userNames)];
        event = { type: 'assigned', name: uniqueUserNames.join(', '), users: uniqueUserNames };
      } else if (ownerInfo?.type === 'non_preferred') {
        event = { type: 'blocked', name: '방장 불가능' };
      }
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
                  <span key={`user-${i}`} className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full">{name}</span>
                ))}
                {Array.from(new Set(dateInfo.blocks.filter(b => b.type === 'blocked').map(b => b.name))).map((name, i) => (
                  <span key={`block-${i}`} className="text-xs bg-red-100 text-red-800 px-1.5 py-0.5 rounded-full">{name}</span>
                ))}
                {dateInfo.blocks.some(b => b.type === 'negotiation') && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full">협의 중</span>
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