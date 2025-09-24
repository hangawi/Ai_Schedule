import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Grid, Clock, Merge, Split } from 'lucide-react';

// --- Constants and Helpers ---
const days = [
  { name: '월', dayOfWeek: 1 },
  { name: '화', dayOfWeek: 2 },
  { name: '수', dayOfWeek: 3 },
  { name: '목', dayOfWeek: 4 },
  { name: '금', dayOfWeek: 5 },
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

const getMondayOfCurrentWeek = (date) => {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCMilliseconds(0);
  return d;
};

const timeToMinutes = (timeString) => {
  if (!timeString || !timeString.includes(':')) return 0;
  const [hour, minute] = timeString.split(':').map(Number);
  return hour * 60 + minute;
};

// --- Main Component ---
const ScheduleGridSelector = ({ schedule, exceptions, personalTimes, readOnly = true }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [weekDates, setWeekDates] = useState([]);
  const [timeRange, setTimeRange] = useState({ start: 0, end: 24 });
  const [showFullDay, setShowFullDay] = useState(true);
  const [showMerged, setShowMerged] = useState(false);

  useEffect(() => {
    const monday = getMondayOfCurrentWeek(currentDate);
    const dates = [];
    const dayNamesKorean = ['월', '화', '수', '목', '금'];
    for (let i = 0; i < 5; i++) {
      const date = new Date(monday);
      date.setUTCDate(monday.getUTCDate() + i);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const dayOfMonth = String(date.getUTCDate()).padStart(2, '0');
      dates.push({
        fullDate: date,
        display: `${dayNamesKorean[i]} (${month}.${dayOfMonth})`,
        dayOfWeek: i + 1
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
    const eventSlots = new Set();
    let blocks = [];

    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    const dailySchedule = schedule.filter(s => s.dayOfWeek === dayOfWeek).map(s => ({...s, type: 'schedule'}));
    const dailyExceptions = exceptions.filter(e => e.specificDate === dateStr).map(e => ({...e, type: 'exception'}));
    const dailyPersonal = personalTimes.filter(p => p.days.includes(dayOfWeek)).map(p => ({...p, type: 'personal'}));

    const allEvents = [...dailySchedule, ...dailyExceptions, ...dailyPersonal];

    allEvents.forEach(event => {
        let startMins, endMins;
        let eventStartTime = event.startTime;

        if (event.type === 'exception') {
            const startDate = new Date(event.startTime);
            const endDate = new Date(event.endTime);
            startMins = startDate.getHours() * 60 + startDate.getMinutes();
            endMins = endDate.getHours() * 60 + endDate.getMinutes();
            if (endMins === 0 && endDate.getHours() === 0 && startDate < endDate) endMins = 24 * 60;
            eventStartTime = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
        } else { // Recurring schedule or personal time
            startMins = timeToMinutes(event.startTime);
            endMins = timeToMinutes(event.endTime);
        }

        for (let t = startMins; t < endMins; t += 10) {
            const timeStr = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
            if(allPossibleSlots.includes(timeStr)) eventSlots.add(timeStr);
        }
        blocks.push({ ...event, startTime: eventStartTime, startMins, endMins });
    });

    let currentEmptyBlock = null;
    for (const time of allPossibleSlots) {
        if (!eventSlots.has(time)) {
            if (currentEmptyBlock === null) {
                currentEmptyBlock = { type: 'empty', startTime: time, duration: 10 };
            } else {
                currentEmptyBlock.duration += 10;
            }
        } else {
            if (currentEmptyBlock) {
                blocks.push(currentEmptyBlock);
                currentEmptyBlock = null;
            }
        }
    }
    if (currentEmptyBlock) blocks.push(currentEmptyBlock);

    const sortedBlocks = blocks.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    
    const finalBlocks = [];
    const processed = new Set();

    allPossibleSlots.forEach(time => {
        if (processed.has(time)) return;

        const block = sortedBlocks.find(b => b.startTime === time);
        if (block) {
            let duration;
            if (block.type === 'empty') {
                duration = block.duration;
            } else {
                duration = block.endMins - block.startMins;
            }

            finalBlocks.push({ ...block, duration });

            for (let i = 0; i < duration; i += 10) {
                const min = timeToMinutes(time) + i;
                const t = `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
                processed.add(t);
            }
        }
    });
    return finalBlocks;
  };

  const renderViewControls = () => (
    <div className="flex items-center justify-between mb-4 flex-wrap gap-y-2">
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            <button disabled className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-not-allowed bg-gray-100 text-gray-400`}><Grid size={16} className="mr-2 inline" />주간</button>
            <button disabled className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-not-allowed bg-gray-100 text-gray-400`}><Calendar size={16} className="mr-2 inline" />월간 (개발 중)</button>
            <div className="border-l border-gray-300 pl-3 ml-1 flex space-x-2 flex-wrap gap-y-2">
                <button onClick={toggleTimeRange} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${showFullDay ? 'bg-purple-500 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}><Clock size={16} className="mr-2 inline" />{showFullDay ? '24시간' : '기본'}</button>
                <button onClick={() => setShowMerged(!showMerged)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${showMerged ? 'bg-green-500 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>{showMerged ? <><Split size={16} className="mr-2 inline" />분할</> : <><Merge size={16} className="mr-2 inline" />병합</>}</button>
            </div>
        </div>
        <div className="flex items-center space-x-2">
            <button onClick={() => navigateWeek(-1)} className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors"><ChevronLeft size={20} /></button>
            <div className="text-lg font-semibold min-w-40 text-center whitespace-nowrap">{`${currentDate.getFullYear()}년 ${monthNames[currentDate.getMonth()]}`}</div>
            <button onClick={() => navigateWeek(1)} className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors"><ChevronRight size={20} /></button>
            <button onClick={goToToday} className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors text-sm whitespace-nowrap shadow-md">오늘</button>
        </div>
    </div>
  );

  const renderMergedWeekView = () => {
    const dayBlocks = weekDates.map(d => getBlocksForDay(d.fullDate, d.dayOfWeek));
    const timeSlots = getCurrentTimeSlots();
    const slotHeight = 1.2; // 1.2rem per 10min slot

    return (
        <div className="grid grid-cols-6 border border-gray-200 rounded-lg bg-white text-sm shadow-inner">
            <div className="col-span-1 border-r border-gray-200 bg-gray-50">
                <div className="p-2 text-center font-semibold text-gray-700 border-b border-gray-200 sticky top-0 bg-gray-100 z-10 h-12 flex items-center justify-center">시간</div>
                <div className="relative" style={{ height: `${timeSlots.length * slotHeight}rem`}}>
                    {timeSlots.map((time, i) => time.endsWith(':00') && (
                        <div key={time} style={{top: `${i * slotHeight}rem`, height: `${6 * slotHeight}rem`}} className="absolute w-full text-center text-xs font-medium text-gray-400 border-t border-gray-200 flex items-center justify-center">{time}</div>
                    ))}
                </div>
            </div>
            {weekDates.map((date, index) => (
                <div key={date.dayOfWeek} className="col-span-1 border-r border-gray-200 last:border-r-0 relative">
                    <div className="p-2 text-center font-semibold text-gray-700 border-b border-gray-200 sticky top-0 bg-gray-100 z-10 h-12 flex items-center justify-center">{date.display}</div>
                    {dayBlocks[index].map((block, i) => {
                        const height = (block.duration / 10) * slotHeight;
                        const top = (timeToMinutes(block.startTime) - timeToMinutes(timeSlots[0])) / 10 * slotHeight;
                        let content = '';
                        let slotClass = '';
                        let title = '';

                        if (block.type === 'schedule') {
                            slotClass = priorityConfig[block.priority]?.color || 'bg-blue-400';
                            content = `${priorityConfig[block.priority]?.label} (${block.duration}분)`;
                            title = `${content}`;
                        } else if (block.type === 'exception') {
                            slotClass = priorityConfig[block.priority]?.color || 'bg-blue-600';
                            content = `${block.title} (${block.duration}분)`;
                            title = block.title;
                        } else if (block.type === 'personal') {
                            slotClass = 'bg-red-400';
                            content = `${block.title} (${block.duration}분)`;
                            title = `개인시간: ${block.title}`;
                        } else { // empty
                            slotClass = 'bg-gray-50 hover:bg-gray-100';
                            content = block.duration >= 30 ? `(${block.duration}분)` : '';
                            title = `빈 시간: ${block.startTime}`;
                        }

                        return (
                            <div key={i} title={title} style={{ height: `${height}rem`, top: `${top}rem` }} className={`absolute w-full flex items-center justify-center text-center transition-colors cursor-pointer border-y border-white/50 ${slotClass}`}>
                                <span className={`font-medium text-xs px-1 ${block.type === 'empty' ? 'text-gray-500' : 'text-white'}`}>{content}</span>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
  };

  const renderDetailedWeekView = () => {
    const timeSlots = getCurrentTimeSlots();
    return (
        <div className="timetable-grid border border-gray-200 rounded-lg overflow-auto" style={{ maxHeight: '60vh' }}>
            <div className="grid grid-cols-6 bg-gray-100 sticky top-0 z-10">
                <div className="col-span-1 p-2 text-center font-semibold text-gray-700">시간</div>
                {weekDates.map((date, index) => (
                    <div key={index} className="col-span-1 p-2 text-center font-semibold text-gray-700 border-l border-gray-200">{date.display}</div>
                ))}
            </div>
            {timeSlots.map(time => (
                <div key={time} className="grid grid-cols-6 border-b border-gray-200 last:border-b-0">
                    <div className="col-span-1 p-2 text-center text-sm font-medium text-gray-600 flex items-center justify-center">{time}</div>
                    {days.map((day, index) => {
                        const date = weekDates[index]?.fullDate;
                        if (!date) return <div key={day.dayOfWeek} className="col-span-1 border-l border-gray-200"></div>;

                        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                        
                        const recurringSlot = schedule.find(s => s.dayOfWeek === day.dayOfWeek && s.startTime === time);
                        const exceptionSlot = exceptions.find(e => e.specificDate === dateStr && timeToMinutes(new Date(e.startTime).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'})) === timeToMinutes(time));
                        const personalSlot = personalTimes.find(p => p.days.includes(day.dayOfWeek) && timeToMinutes(p.startTime) <= timeToMinutes(time) && timeToMinutes(time) < timeToMinutes(p.endTime));

                        let slotClass = 'bg-white';
                        let content = null;

                        if (exceptionSlot) {
                            slotClass = priorityConfig[exceptionSlot.priority]?.color || 'bg-blue-600';
                            content = <span className="text-xs text-white truncate px-1">{exceptionSlot.title}</span>;
                        } else if (personalSlot) {
                            slotClass = 'bg-red-400';
                            content = <span className="text-xs text-white truncate px-1">{personalSlot.title}</span>;
                        } else if (recurringSlot) {
                            slotClass = priorityConfig[recurringSlot.priority]?.color || 'bg-blue-400';
                            content = <span className="text-xs text-white truncate px-1">{priorityConfig[recurringSlot.priority]?.label}</span>;
                        }

                        return (
                            <div key={day.dayOfWeek} className={`col-span-1 border-l border-gray-200 h-8 flex items-center justify-center transition-colors ${slotClass}`}>
                                {content}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md mb-6">
      {renderViewControls()}
      {showMerged ? renderMergedWeekView() : renderDetailedWeekView() }
    </div>
  );
}; 

export default ScheduleGridSelector;
