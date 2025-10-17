import React, { useState } from 'react';
import { X, Users, Zap, Clock, MessageSquare, Ban } from 'lucide-react';
import {
  getBlockedTimeInfo,
  getRoomExceptionInfo
} from '../../utils/timetableHelpers';

const toYYYYMMDD = (date) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    return null;
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

const CoordinationDetailGrid = ({
  selectedDate,
  timeSlots = [],
  members = [],
  roomData,
  onClose,
}) => {
  const [timeRange, setTimeRange] = useState({ start: 0, end: 24 });

  const getBlocksForDay = () => {
    const allPossibleSlots = generateTimeSlots(timeRange.start, timeRange.end);
    const blocks = [];
    let currentBlock = null;

    allPossibleSlots.forEach(time => {
      const negotiation = roomData.negotiations?.find(neg => 
        toYYYYMMDD(neg.slotInfo.date) === toYYYYMMDD(selectedDate) &&
        time >= neg.slotInfo.startTime && time < neg.slotInfo.endTime
      );
      const blockingInfo = getBlockedTimeInfo(time, roomData.settings) || getRoomExceptionInfo(selectedDate, time, roomData.settings);
      const assignedSlots = timeSlots.filter(slot => 
        toYYYYMMDD(slot.date) === toYYYYMMDD(selectedDate) && 
        time >= slot.startTime && time < slot.endTime
      );

      let event = null;
      if (blockingInfo) {
        event = { type: 'blocked', name: blockingInfo.name, data: blockingInfo };
      } else if (negotiation) {
        event = { type: 'negotiation', name: `협의: ${negotiation._id}`, data: negotiation };
      } else if (assignedSlots.length > 0) {
        const userNames = assignedSlots.map(slot => {
            const member = members.find(m => (m.user._id || m.user) === (slot.user._id || slot.user));
            return member ? (member.user.name || `${member.user.firstName} ${member.user.lastName}`) : null;
        }).filter(Boolean).sort();
        const uniqueUserNames = [...new Set(userNames)];
        event = { type: 'assigned', name: uniqueUserNames.join(', '), users: uniqueUserNames };
      }

      const currentEventType = event ? event.type : 'empty';
      const currentEventName = event ? event.name : 'empty';

      if (currentBlock && currentBlock.type === currentEventType && currentBlock.name === currentEventName) {
        currentBlock.duration += 10;
      } else {
        if (currentBlock) {
          blocks.push(currentBlock);
        }
        currentBlock = {
          type: currentEventType,
          name: currentEventName,
          startTime: time,
          duration: 10,
          data: event?.data,
          users: event?.users,
        };
      }
    });

    if (currentBlock) {
      blocks.push(currentBlock);
    }

    return blocks;
  };

  const formatDate = (date) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
  };

  const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const getEndTimeForBlock = (block) => {
    const startMinutes = timeToMinutes(block.startTime);
    const endMinutes = startMinutes + block.duration;
    const hour = Math.floor(endMinutes / 60);
    const min = endMinutes % 60;
    return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  };

  const blocks = getBlocksForDay();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-bold text-gray-800">
            {formatDate(selectedDate)} 세부 시간표
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 80px)' }}>
          <div className="space-y-2">
            {blocks.map((block, index) => {
              let bgColor = 'bg-gray-50';
              let textColor = 'text-gray-600';
              let content = block.name;
              let Icon = null;

              switch (block.type) {
                case 'assigned':
                  bgColor = 'bg-blue-100';
                  textColor = 'text-blue-800';
                  Icon = Users;
                  break;
                case 'blocked':
                  bgColor = 'bg-red-100';
                  textColor = 'text-red-800';
                  Icon = Ban;
                  content = block.name.includes('방장') ? block.name : `금지: ${block.name}`;
                  break;
                case 'negotiation':
                  bgColor = 'bg-orange-100';
                  textColor = 'text-orange-800';
                  Icon = MessageSquare;
                  content = '협의 중';
                  break;
                default:
                  content = '빈 시간';
                  break;
              }

              return (
                <div key={index} className={`p-3 rounded-lg ${bgColor}`}>
                  <div className="flex justify-between items-center">
                    <span className={`text-sm font-medium ${textColor}`}>
                      {block.startTime} - {getEndTimeForBlock(block)}
                    </span>
                    <span className={`text-xs font-semibold ${textColor}`}>
                      {Math.floor(block.duration / 60) > 0 && `${Math.floor(block.duration / 60)}시간 `}
                      {block.duration % 60 > 0 && `${block.duration % 60}분`}
                    </span>
                  </div>
                  <div className={`text-sm mt-1 ${textColor} flex items-center`}>
                    {Icon && <Icon size={14} className="mr-2" />} 
                    {content}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoordinationDetailGrid;