import React, { useState, useEffect } from 'react';
import { Navigation, Clock } from 'lucide-react';

const CurrentEventNavigator = ({ timeSlots = [], travelSlots = [], members = [] }) => {
  const [currentEvent, setCurrentEvent] = useState(null);

  useEffect(() => {
    const findCurrentEvent = () => {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const today = now.toISOString().split('T')[0];

      const timeToMinutes = (timeStr) => {
        if (!timeStr || !timeStr.includes(':')) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
      };

      const nowMinutes = timeToMinutes(currentTime);

      // Check travel slots first
      const currentTravel = travelSlots.find(slot => {
        const slotDate = new Date(slot.date).toISOString().split('T')[0];
        if (slotDate !== today) return false;
        const startMinutes = timeToMinutes(slot.startTime);
        const endMinutes = timeToMinutes(slot.endTime);
        return nowMinutes >= startMinutes && nowMinutes < endMinutes;
      });

      if (currentTravel) {
        setCurrentEvent({ type: 'travel', text: `이동 중: ${currentTravel.to} (으)로` });
        return;
      }

      // Check activity slots
      const currentActivity = timeSlots.find(slot => {
        if (slot.isTravel) return false;
        const slotDate = new Date(slot.date).toISOString().split('T')[0];
        if (slotDate !== today) return false;
        const startMinutes = timeToMinutes(slot.startTime);
        const endMinutes = timeToMinutes(slot.endTime);
        return nowMinutes >= startMinutes && nowMinutes < endMinutes;
      });

      if (currentActivity) {
        let memberName = '알 수 없는 사용자';
        const userId = currentActivity.user?._id || currentActivity.user;
        const member = members.find(m => (m.user?._id || m.user)?.toString() === userId?.toString());
        if (member && member.user) {
          memberName = member.user.name || `${member.user.firstName} ${member.user.lastName}`.trim();
        }
        setCurrentEvent({ type: 'activity', text: `지금은 ${memberName}님의 일정입니다.` });
        return;
      }

      setCurrentEvent(null); // No event
    };

    findCurrentEvent(); // Initial check
    const intervalId = setInterval(findCurrentEvent, 60000); // Check every minute

    return () => clearInterval(intervalId);
  }, [timeSlots, travelSlots, members]);

  return (
    <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200 h-full flex flex-col">
      <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center">
        <Navigation size={16} className="mr-2 text-green-600" />
        실시간 일정 안내
      </h3>
      <div className="flex-grow flex items-center justify-center text-center">
        {currentEvent ? (
          <div className="flex flex-col items-center">
            <Clock size={24} className={`mb-2 ${currentEvent.type === 'travel' ? 'text-blue-500' : 'text-green-500'}`} />
            <p className="text-sm font-semibold text-gray-700">{currentEvent.text}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Clock size={24} className="mb-2 text-gray-400" />
            <p className="text-sm font-semibold text-gray-500">현재 진행 중인 일정이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CurrentEventNavigator;