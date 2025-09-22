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
};

const DetailTimeGrid = ({
  selectedDate,
  schedule,
  setSchedule,
  readOnly,
  exceptions = [],
  personalTimes = [],
  onClose,
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
    priority: 3
  });

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

  const handleSlotClick = (startTime) => {
    if (readOnly) return;

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

      setSchedule([...schedule, {
        dayOfWeek,
        startTime,
        endTime,
        priority: 3
      }]);
    }
  };

  const getSlotInfo = (startTime) => {
    const dayOfWeek = selectedDate.getDay();
    return schedule.find(
      s => s.dayOfWeek === dayOfWeek && s.startTime === startTime
    );
  };

  const getExceptionForSlot = (startTime) => {
    const slotStart = new Date(`${selectedDate.toISOString().split('T')[0]}T${startTime}:00.000Z`);
    for (const ex of exceptions) {
      const exStart = new Date(ex.startTime);
      const exEnd = new Date(ex.endTime);
      if (slotStart >= exStart && slotStart < exEnd) {
        return ex;
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

    const dayOfWeek = selectedDate.getDay();
    const newSlots = [];

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 10) {
        const startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        const endMinute = minute + 10;
        const actualEndHour = endMinute >= 60 ? hour + 1 : hour;
        const actualEndMinute = endMinute >= 60 ? 0 : endMinute;
        const endTime = `${String(actualEndHour).padStart(2, '0')}:${String(actualEndMinute).padStart(2, '0')}`;

        const existingSlot = schedule.find(
          s => s.dayOfWeek === dayOfWeek && s.startTime === startTime
        );

        if (!existingSlot) {
          newSlots.push({
            dayOfWeek,
            startTime,
            endTime,
            priority
          });
        }
      }
    }

    if (newSlots.length > 0) {
      setSchedule([...schedule, ...newSlots]);
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

    const dayOfWeek = selectedDate.getDay();
    const newSlots = [];

    // 10분 단위로 슬롯 생성
    for (let minutes = startMinutes; minutes < endMinutes; minutes += 10) {
      const slotHour = Math.floor(minutes / 60);
      const slotMin = minutes % 60;
      const slotStartTime = `${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`;

      const nextMinutes = minutes + 10;
      const nextHour = Math.floor(nextMinutes / 60);
      const nextMin = nextMinutes % 60;
      const slotEndTime = `${String(nextHour).padStart(2, '0')}:${String(nextMin).padStart(2, '0')}`;

      const existingSlot = schedule.find(
        s => s.dayOfWeek === dayOfWeek && s.startTime === slotStartTime
      );

      if (!existingSlot) {
        newSlots.push({
          dayOfWeek,
          startTime: slotStartTime,
          endTime: slotEndTime,
          priority
        });
      }
    }

    if (newSlots.length > 0) {
      setSchedule([...schedule, ...newSlots]);
      setShowDirectInput(false);
      setDirectInput({
        startTime: '09:00',
        endTime: '10:00',
        priority: 3
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
            </div>

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
              {Object.entries(priorityConfig).sort(([p1], [p2]) => p2 - p1).map(([priority, {label, color}]) => (
                <div key={priority} className="flex items-center">
                  <div className={`w-4 h-4 rounded-full ${color} mr-2`}></div>
                  <span className="text-sm text-gray-600">{label}</span>
                </div>
              ))}
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-gray-400 mr-2"></div>
                <span className="text-sm text-gray-600">예외 일정</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-red-300 mr-2"></div>
                <span className="text-sm text-gray-600">개인 시간</span>
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
                  slotClass = 'bg-gray-400';
                } else if (isPersonalTimeSlot) {
                  slotClass = 'bg-red-300';
                } else if (slotInfo) {
                  slotClass = priorityConfig[slotInfo.priority]?.color || 'bg-blue-400';
                }

                let cursorClass = readOnly ? 'cursor-default' : 'cursor-pointer';
                if (isExceptionSlot || isPersonalTimeSlot) {
                  cursorClass = 'cursor-not-allowed';
                }

                return (
                  <div
                    key={time}
                    className={`border-b border-gray-100 h-8 flex items-center justify-center transition-colors ${slotClass} ${cursorClass}`}
                    onClick={() => {
                      if (!readOnly && !isExceptionSlot && !isPersonalTimeSlot) {
                        handleSlotClick(time);
                      }
                    }}
                    title={
                      isExceptionSlot
                        ? exception.title
                        : isPersonalTimeSlot
                        ? `개인시간: ${personalTime.title}`
                        : (slotInfo ? priorityConfig[slotInfo.priority]?.label : '클릭하여 선택')
                    }
                  >
                    {isExceptionSlot && (
                      <span className="text-xs text-white truncate px-1">{exception.title}</span>
                    )}
                    {isPersonalTimeSlot && (
                      <span className="text-xs text-white truncate px-1">{personalTime.title}</span>
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
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default DetailTimeGrid;