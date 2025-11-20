/**
 * 범위 삭제 훅
 */

import { useCallback } from 'react';
import { auth } from '../../../config/firebaseConfig';
import { API_BASE_URL } from '../constants/apiConstants';

export const useRangeDeletion = (setEventAddedKey) => {
  const handleRangeDeletion = useCallback(async (chatResponse, context) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return { success: false, message: '인증이 필요합니다.' };

      const startDate = new Date(chatResponse.startDate + 'T00:00:00+09:00');
      const endDate = new Date(chatResponse.endDate + 'T23:59:59+09:00');

      let deleteCount = 0;

      if (context.context === 'profile' && context.tabType === 'local') {
        const currentScheduleResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
          headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` }
        });
        const currentSchedule = await currentScheduleResponse.json();

        const filteredExceptions = (currentSchedule.scheduleExceptions || []).filter(exception => {
          const exceptionDate = new Date(exception.startTime);
          return exceptionDate < startDate || exceptionDate > endDate;
        });

        const filteredPersonalTimes = (currentSchedule.personalTimes || []).filter(pt => {
          if (!pt.specificDate) return true;
          const ptDate = new Date(pt.specificDate + 'T00:00:00+09:00');
          return ptDate < startDate || ptDate > endDate;
        });

        const exceptionsDeleteCount = (currentSchedule.scheduleExceptions || []).length - filteredExceptions.length;
        const personalTimesDeleteCount = (currentSchedule.personalTimes || []).length - filteredPersonalTimes.length;
        deleteCount = exceptionsDeleteCount + personalTimesDeleteCount;

        const response = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await currentUser.getIdToken()}`
          },
          body: JSON.stringify({
            defaultSchedule: currentSchedule.defaultSchedule || [],
            scheduleExceptions: filteredExceptions,
            personalTimes: filteredPersonalTimes
          })
        });

        if (response.ok) {
          window.dispatchEvent(new CustomEvent('calendarUpdate', {
            detail: { type: 'delete_range', startDate, endDate }
          }));
        }
      } else {
        const apiEndpoint = context.tabType === 'google'
          ? `${API_BASE_URL}/api/calendar/events/google`
          : `${API_BASE_URL}/api/events`;

        const eventsResponse = await fetch(`${apiEndpoint}?startDate=${chatResponse.startDate}&endDate=${chatResponse.endDate}`, {
          headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` }
        });

        if (eventsResponse.ok) {
          const eventsData = await eventsResponse.json();
          const events = eventsData.events || eventsData;

          for (const event of events) {
            try {
              const deleteResponse = await fetch(`${apiEndpoint}/${event._id || event.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` }
              });
              if (deleteResponse.ok) {
                deleteCount++;
              }
            } catch (err) {
              // Continue with other deletions
            }
          }

          if (deleteCount > 0) {
            setEventAddedKey(prevKey => prevKey + 1);
            window.dispatchEvent(new Event('calendarUpdate'));
          }
        }
      }

      return {
        success: deleteCount > 0,
        message: deleteCount > 0
          ? `${deleteCount}개의 일정을 삭제했어요!`
          : '삭제할 일정이 없습니다.',
        data: chatResponse
      };
    } catch (error) {
      return {
        success: false,
        message: `일정 삭제 중 오류가 발생했습니다: ${error.message}`,
        data: chatResponse
      };
    }
  }, [setEventAddedKey]);

  return { handleRangeDeletion };
};
