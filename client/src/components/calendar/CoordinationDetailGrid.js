import React, { useState, useEffect } from 'react';
import { X, Users, Zap, Clock, MessageSquare } from 'lucide-react';

// 10분 단위 시간 슬롯 생성
const generateTimeSlots = (startHour = 9, endHour = 18) => {
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
  3: { label: '선호', color: 'bg-blue-600' },
  2: { label: '보통', color: 'bg-blue-400' },
  1: { label: '조정 가능', color: 'bg-blue-200' },
};

const CoordinationDetailGrid = ({
  selectedDate,
  timeSlots = [],
  members = [],
  currentUser,
  isRoomOwner,
  roomData,
  onClose,
  onSlotSelect,
  selectedSlots = [],
  onAssignSlot,
  onRequestSlot,
  onRemoveSlot,
  onOpenNegotiation
}) => {
  const [timeRange, setTimeRange] = useState({ start: 9, end: 18 });
  const [showFullDay, setShowFullDay] = useState(false);

  const getCurrentTimeSlots = () => {
    return generateTimeSlots(timeRange.start, timeRange.end);
  };

  const getSlotData = (time) => {
    const selectedDayOfWeek = selectedDate.getDay();
    const dayNameMap = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday'
    };
    const selectedDayName = dayNameMap[selectedDayOfWeek];

    return timeSlots.filter(slot => {
      // 날짜로 필터링 (날짜가 있는 경우)
      if (slot.date) {
        try {
          const dateStr = selectedDate.toISOString().split('T')[0];
          const slotDate = new Date(slot.date).toISOString().split('T')[0];
          return slotDate === dateStr && slot.startTime === time;
        } catch (e) {
          // Invalid date format, skip
          return false;
        }
      }

      // 요일로 필터링 (자동배정 슬롯의 경우)
      if (slot.day) {
        return slot.day.toLowerCase() === selectedDayName && slot.startTime === time;
      }

      return false;
    });
  };

  const getNegotiationForSlot = (time) => {
    if (!roomData?.negotiations) return null;

    return roomData.negotiations.find(neg => {
      if (!neg.slotInfo?.date || neg.status !== 'active') return false;
      const negDate = new Date(neg.slotInfo.date).toISOString().split('T')[0];
      const selectedDateStr = selectedDate.toISOString().split('T')[0];
      return negDate === selectedDateStr && neg.slotInfo.startTime === time;
    });
  };

  const getSlotUsers = (time) => {
    const slots = getSlotData(time);
    const users = [];

    slots.forEach(slot => {
      const member = members.find(m => (m.user._id || m.user) === (slot.user._id || slot.user));
      if (member) {
        users.push({
          ...member,
          slot,
          isAssigned: !!(slot.assignedBy || slot.subject === '자동 배정'),
          priority: slot.priority || 2
        });
      }
    });

    return users;
  };

  const isSlotSelected = (time) => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    const dayMap = { 0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday' };
    const day = dayMap[selectedDate.getDay()];

    return selectedSlots.some(selectedSlot =>
      selectedSlot.date === dateStr &&
      selectedSlot.day === day &&
      selectedSlot.startTime === time
    );
  };

  const handleSlotClick = (time) => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    const dayMap = { 0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday' };
    const day = dayMap[selectedDate.getDay()];

    const slotData = {
      date: dateStr,
      day: day,
      startTime: time,
      endTime: calculateEndTime(time)
    };

    if (onSlotSelect) {
      onSlotSelect(slotData);
    }
  };

  const calculateEndTime = (startTime) => {
    const [h, m] = startTime.split(':').map(Number);
    const totalMinutes = h * 60 + m + 10;
    const endHour = Math.floor(totalMinutes / 60);
    const endMinute = totalMinutes % 60;
    return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
  };

  const formatDate = (date) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
  };

  const toggleTimeRange = () => {
    if (showFullDay) {
      setTimeRange({ start: 9, end: 18 });
      setShowFullDay(false);
    } else {
      setTimeRange({ start: 0, end: 24 });
      setShowFullDay(true);
    }
  };

  const timeSlots_generated = getCurrentTimeSlots();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-11/12 max-w-6xl max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {formatDate(selectedDate)} 세부 시간표
            </h3>
            <button
              onClick={toggleTimeRange}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                showFullDay
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {showFullDay ? '24시간' : '근무시간'}
            </button>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* 범례 */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-center space-x-6">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-semibold text-gray-700">상태:</span>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-blue-500 mr-2"></div>
                <span className="text-sm text-gray-600">수동 입력</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
                <span className="text-sm text-gray-600">자동 배정</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-orange-500 mr-2"></div>
                <span className="text-sm text-gray-600">협의 중</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-purple-500 mr-2"></div>
                <span className="text-sm text-gray-600">선택됨</span>
              </div>
            </div>
          </div>
        </div>

        {/* 시간표 그리드 */}
        <div className="overflow-auto" style={{ maxHeight: '60vh' }}>
          <div className="grid grid-cols-4 gap-0">
            {/* 시간 컬럼 */}
            <div className="bg-gray-50 border-r border-gray-200">
              <div className="p-3 text-center font-semibold text-gray-700 border-b border-gray-200">
                시간
              </div>
              {timeSlots_generated.map(time => (
                <div
                  key={time}
                  className="p-2 text-center text-sm font-medium text-gray-600 border-b border-gray-100 h-12 flex items-center justify-center"
                >
                  {time}
                </div>
              ))}
            </div>

            {/* 사용자 컬럼 */}
            <div className="col-span-1">
              <div className="p-3 text-center font-semibold text-gray-700 border-b border-gray-200">
                참가자
              </div>
              {timeSlots_generated.map(time => {
                const slotUsers = getSlotUsers(time);
                return (
                  <div key={time} className="border-b border-gray-100 h-12 p-1">
                    <div className="flex flex-wrap gap-1">
                      {slotUsers.map((userInfo, index) => (
                        <div
                          key={index}
                          className={`text-xs px-2 py-1 rounded flex items-center ${
                            userInfo.isAssigned
                              ? 'bg-green-100 text-green-800'
                              : priorityConfig[userInfo.priority]?.color?.replace('bg-', 'bg-') + ' text-white' || 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {userInfo.isAssigned && <Zap size={10} className="mr-1" />}
                          {userInfo.user.firstName}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 상태 컬럼 */}
            <div className="col-span-1">
              <div className="p-3 text-center font-semibold text-gray-700 border-b border-gray-200">
                상태
              </div>
              {timeSlots_generated.map(time => {
                const slotUsers = getSlotUsers(time);
                const negotiation = getNegotiationForSlot(time);
                const hasConflict = slotUsers.filter(u => !u.isAssigned).length > 1;

                return (
                  <div key={time} className="border-b border-gray-100 h-12 p-1 flex items-center justify-center">
                    {negotiation ? (
                      <div className="flex items-center text-orange-600">
                        <MessageSquare size={14} className="mr-1" />
                        <span className="text-xs">협의중</span>
                      </div>
                    ) : hasConflict ? (
                      <div className="flex items-center text-red-600">
                        <Clock size={14} className="mr-1" />
                        <span className="text-xs">충돌</span>
                      </div>
                    ) : slotUsers.some(u => u.isAssigned) ? (
                      <div className="flex items-center text-green-600">
                        <Zap size={14} className="mr-1" />
                        <span className="text-xs">배정됨</span>
                      </div>
                    ) : slotUsers.length > 0 ? (
                      <div className="flex items-center text-blue-600">
                        <Users size={14} className="mr-1" />
                        <span className="text-xs">신청됨</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 액션 컬럼 */}
            <div className="col-span-1">
              <div className="p-3 text-center font-semibold text-gray-700 border-b border-gray-200">
                액션
              </div>
              {timeSlots_generated.map(time => {
                const isSelected = isSlotSelected(time);

                return (
                  <div key={time} className="border-b border-gray-100 h-12 p-1 flex items-center justify-center">
                    <button
                      onClick={() => handleSlotClick(time)}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        isSelected
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {isSelected ? '선택됨' : '선택'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-between items-center">
          <p className="text-sm text-gray-600">
            시간대를 클릭하여 선택하고, 상단의 버튼들로 액션을 수행하세요.
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

export default CoordinationDetailGrid;