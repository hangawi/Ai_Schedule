import React, { useState } from 'react';
import { X, Users, MessageSquare, Ban } from 'lucide-react';
import {
  getBlockedTimeInfo,
  getRoomExceptionInfo
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
  ownerOriginalSchedule,
}) => {
  const [timeRange, setTimeRange] = useState({ start: 0, end: 24 });

  const getOwnerScheduleInfoForTime = (date, time) => {
    if (!ownerOriginalSchedule) {
      console.log('⚠️ ownerOriginalSchedule가 없음!');
      return null;
    }

    const timeMinutes = timeToMinutes(time);
    const dayOfWeek = date.getDay();
    const dateStr = toYYYYMMDD(date);

    // 🔍 디버깅 로그 (처음 슬롯만)
    if (time === '00:00') {
      console.log(`📅 날짜: ${dateStr} (요일: ${dayOfWeek}), ownerOriginalSchedule:`, {
        defaultScheduleCount: ownerOriginalSchedule.defaultSchedule?.length || 0,
        personalTimesCount: ownerOriginalSchedule.personalTimes?.length || 0
      });
    }

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
      console.log('🔍 [일정맞추기-상세뷰] 09:00 시간의 defaultSchedule:', {
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
      if (time === '09:00' || (time === '13:00' && dayOfWeek === 4)) {
        console.log(`✅ [일정맞추기-상세뷰] ${time}에 preferred 타입 반환 (빈시간) - ${dateStr}`);
      }
      return { type: 'preferred' };
    }

    // 🔍 디버깅 로그 (샘플링)
    if (time === '13:00' && dayOfWeek === 4) {
      console.log(`❌ 목요일 13:00에 선호시간 없음 (${dateStr}) - non_preferred 반환`);
    }

    return { type: 'non_preferred' };
  };

  const getBlocksForDay = () => {
    const allPossibleSlots = generateTimeSlots(timeRange.start, timeRange.end);
    const slotMap = new Map();

    allPossibleSlots.forEach(time => {
      const blockingInfo = getBlockedTimeInfo(time, roomData.settings) || getRoomExceptionInfo(selectedDate, time, roomData.settings);
      const assignedSlots = timeSlots.filter(slot =>
        toYYYYMMDD(slot.date) === toYYYYMMDD(selectedDate) &&
        time >= slot.startTime && time < slot.endTime
      );
      const travelSlot = assignedSlots.find(slot => slot.isTravel);
      const activitySlots = assignedSlots.filter(slot => !slot.isTravel);

      const ownerInfo = getOwnerScheduleInfoForTime(selectedDate, time);

      let event = null;
      if (blockingInfo) {
        event = { type: 'blocked', name: blockingInfo.name };
      } else if (travelSlot) {
        event = { type: 'travel', name: '이동시간' };
      } else if (activitySlots.length > 0) {
        const userNames = assignedSlots.map(slot => {
            const member = members.find(m => {
              const memberUserId = m.user?._id?.toString() || m.user?.toString();
              const slotUserId = slot.user?._id?.toString() || slot.user?.toString();
              return memberUserId && slotUserId && memberUserId === slotUserId;
            });

            // slot.user가 populate되어 있으면 직접 사용 (우선순위 1)
            if (slot.user && typeof slot.user === 'object' && slot.user._id) {
              const user = slot.user;
              return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.firstName || '알 수 없음';
            }

            // slot.user가 ObjectId만 있으면 members에서 찾기 (우선순위 2)
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
        // 🔍 디버깅 로그 (샘플링)
        if (time === '13:00') {
          console.log(`🚫 ${time}에 방장 불가능 블록 설정됨`);
        }
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

  const formatDate = (date) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
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
                  content = `배정: ${block.users.join(', ')}`;
                  break;
                case 'blocked':
                  bgColor = 'bg-red-100';
                  textColor = 'text-red-800';
                  Icon = Ban;
                  content = block.name.includes('방장') ? block.name : `금지: ${block.name}`;
                  break;
                case 'travel':
                  bgColor = 'bg-green-100';
                  textColor = 'text-green-800';
                  Icon = Users; // Or another icon, maybe a car?
                  content = '이동시간';
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
