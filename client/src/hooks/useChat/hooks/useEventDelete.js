/**
 * 일정 삭제 훅
 */

import { useCallback } from 'react';
import { auth } from '../../../config/firebaseConfig';
import { API_BASE_URL } from '../constants/apiConstants';
import { DELETE_ALL_KEYWORDS } from '../constants/keywordConstants';
import { filterEventsByDate, filterEventsByRange, convertProfileEvents } from '../utils/eventFilterUtils';

export const useEventDelete = (setEventAddedKey) => {
  const handleEventDelete = useCallback(async (chatResponse, context, message) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return { success: false, message: '인증이 필요합니다.' };

    // 시작 시간 설정
    if (!chatResponse.startDateTime && chatResponse.date) {
      const time = chatResponse.time || '12:00';
      chatResponse.startDateTime = `${chatResponse.date}T${time}:00+09:00`;
    }

    let eventsResponse;
    if (context.context === 'profile' && context.tabType === 'local') {
      eventsResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
        headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` }
      });
    } else if (context.tabType === 'local') {
      eventsResponse = await fetch(`${API_BASE_URL}/api/events`, {
        headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` }
      });
    } else {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const oneYearLater = new Date();
      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
      eventsResponse = await fetch(`${API_BASE_URL}/api/calendar/events?timeMin=${threeMonthsAgo.toISOString()}&timeMax=${oneYearLater.toISOString()}`, {
        headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` }
      });
    }

    if (!eventsResponse.ok) {
      throw new Error('일정 목록을 가져올 수 없습니다.');
    }

    const eventsData = await eventsResponse.json();

    let events;
    if (context.context === 'profile' && context.tabType === 'local') {
      events = convertProfileEvents(eventsData);
    } else if (context.tabType === 'local') {
      events = eventsData.events || eventsData;
    } else {
      events = eventsData;
    }

    if (!events || !Array.isArray(events)) {
      throw new Error('일정 목록 형식이 올바르지 않습니다.');
    }

    let matchingEvents;

    if (chatResponse.intent === 'delete_range') {
      const startDate = new Date(chatResponse.startDateTime);
      const endDate = new Date(chatResponse.endDateTime);
      matchingEvents = filterEventsByRange(events, startDate, endDate, chatResponse.title, context);
    } else {
      const targetDate = new Date(chatResponse.startDateTime);
      matchingEvents = filterEventsByDate(events, targetDate, chatResponse.title, context);
    }

    if (matchingEvents.length === 0) {
      return { success: false, message: '해당 일정을 찾을 수 없어요.' };
    }

    const shouldDeleteAll = DELETE_ALL_KEYWORDS.some(keyword => message.includes(keyword));

    if (matchingEvents.length > 1 && !shouldDeleteAll) {
      return { success: false, message: `${matchingEvents.length}개의 일정이 있어요. "전부 삭제"라고 하시거나 더 구체적으로 말씀해 주세요.` };
    }

    if (matchingEvents.length > 1 && shouldDeleteAll) {
      let deletedCount = 0;

      if (context.context === 'profile' && context.tabType === 'local') {
        const remainingExceptions = eventsData.scheduleExceptions.filter(ex =>
          !matchingEvents.some(match => !match.isPersonalTime && match._id === ex._id)
        );

        const remainingPersonalTimes = eventsData.personalTimes.filter(pt =>
          !matchingEvents.some(match => match.isPersonalTime && match._id === pt.id)
        );

        const updateResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await currentUser.getIdToken()}`,
          },
          body: JSON.stringify({
            defaultSchedule: eventsData.defaultSchedule,
            scheduleExceptions: remainingExceptions,
            personalTimes: remainingPersonalTimes
          }),
        });

        if (updateResponse.ok) {
          deletedCount = matchingEvents.length;
          window.dispatchEvent(new Event('calendarUpdate'));
        }
      } else {
        for (const event of matchingEvents) {
          try {
            let deleteResponse;
            if (context.tabType === 'local') {
              deleteResponse = await fetch(`${API_BASE_URL}/api/events/${event._id || event.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` }
              });
            } else {
              deleteResponse = await fetch(`${API_BASE_URL}/api/calendar/events/${event.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` }
              });
            }

            if (deleteResponse.ok) {
              deletedCount++;
            }
          } catch (error) {
            // Continue with other deletions
          }
        }
      }

      setEventAddedKey(prevKey => prevKey + 1);
      return {
        success: true,
        message: `${deletedCount}개의 일정을 삭제했어요!`,
        data: chatResponse
      };
    }

    // 단일 이벤트 삭제
    const eventToDelete = matchingEvents[0];
    let deleteResponse;

    if (context.context === 'profile' && context.tabType === 'local') {
      let remainingExceptions = eventsData.scheduleExceptions;
      let remainingPersonalTimes = eventsData.personalTimes;

      if (eventToDelete.isPersonalTime) {
        remainingPersonalTimes = eventsData.personalTimes.filter(pt =>
          String(pt.id) !== String(eventToDelete._id)
        );
      } else {
        remainingExceptions = eventsData.scheduleExceptions.filter(ex =>
          ex._id !== eventToDelete._id
        );
      }

      deleteResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await currentUser.getIdToken()}`,
        },
        body: JSON.stringify({
          defaultSchedule: eventsData.defaultSchedule,
          scheduleExceptions: remainingExceptions,
          personalTimes: remainingPersonalTimes
        }),
      });

      if (deleteResponse.ok) {
        window.dispatchEvent(new Event('calendarUpdate'));
      }
    } else if (context.tabType === 'local') {
      deleteResponse = await fetch(`${API_BASE_URL}/api/events/${eventToDelete._id || eventToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` }
      });
    } else {
      deleteResponse = await fetch(`${API_BASE_URL}/api/calendar/events/${eventToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` }
      });
    }

    if (!deleteResponse.ok) {
      throw new Error('일정 삭제에 실패했습니다.');
    }

    setEventAddedKey(prevKey => prevKey + 1);
    const deletedTitle = (context.context === 'profile' && context.tabType === 'local') || context.tabType === 'local' ? eventToDelete.title : eventToDelete.summary;
    return {
      success: true,
      message: `${deletedTitle || '일정'}을 삭제했어요!`,
      data: chatResponse
    };
  }, [setEventAddedKey]);

  return { handleEventDelete };
};
