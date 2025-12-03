/**
 * 단일 일정 추가 훅
 */

import { useCallback } from 'react';
import { auth } from '../../../config/firebaseConfig';
import { API_BASE_URL } from '../constants/apiConstants';
import { checkScheduleConflict } from '../../../utils';
import { createConflictResponse } from '../utils/responseUtils';
import { createSingleProfilePersonalTime } from '../utils/apiRequestUtils';

export const useEventAdd = (eventActions, setEventAddedKey) => {
  const handleEventAdd = useCallback(async (chatResponse, context) => {
    // 프로필 탭에서는 eventActions 불필요 (직접 API 호출)
    if (context.context !== 'profile' && (!eventActions || !eventActions.addEvent)) {
      return { success: false, message: '일정 추가 기능이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.' };
    }

    console.log('📅 [일정 추가] 시작:', { title: chatResponse.title, startDateTime: chatResponse.startDateTime });

    if (!chatResponse.title) chatResponse.title = '약속';
    if (!chatResponse.endDateTime && chatResponse.startDateTime) {
      try {
        const start = new Date(chatResponse.startDateTime);
        if (isNaN(start.getTime())) {
          throw new Error('유효하지 않은 시작 시간입니다.');
        }
        start.setHours(start.getHours() + 1);
        chatResponse.endDateTime = start.toISOString();
      } catch (timeError) {
        throw new Error('날짜 형식이 올바르지 않습니다.');
      }
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, message: 'Google 계정 인증이 필요합니다.' };
    }

    try {
      const targetDate = chatResponse.startDateTime.split('T')[0];
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

      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json();
        let events = [];

        if (context.context === 'profile' && context.tabType === 'local') {
          const exceptions = (eventsData.scheduleExceptions || [])
            .filter(exc => exc.specificDate === targetDate);

          const personalTimes = (eventsData.personalTimes || [])
            .filter(pt => pt.specificDate === targetDate)
            .map(pt => ({
              ...pt,
              startTime: `${targetDate}T${pt.startTime}:00+09:00`,
              endTime: `${targetDate}T${pt.endTime}:00+09:00`
            }));

          events = [...exceptions, ...personalTimes];

        } else if (context.tabType === 'local') {
          events = eventsData.events || eventsData;
        } else {
          events = eventsData;
        }

        const conflictCheck = checkScheduleConflict(chatResponse.startDateTime, chatResponse.endDateTime, events);

        if (conflictCheck.hasConflict) {
          const conflictTitle = conflictCheck.conflicts[0]?.summary || conflictCheck.conflicts[0]?.title || '일정';
          const startTime = new Date(chatResponse.startDateTime);

          return createConflictResponse(
            conflictTitle,
            startTime,
            conflictCheck.conflicts,
            {
              title: chatResponse.title,
              description: chatResponse.description,
              startTime: chatResponse.startDateTime,
              endTime: chatResponse.endDateTime,
              duration: (new Date(chatResponse.endDateTime) - new Date(chatResponse.startDateTime)) / (60 * 1000),
              priority: 3,
              category: 'general',
              allExistingEvents: events
            }
          );
        }
      }
    } catch (conflictError) {
      // Continue with adding the event
    }

    const eventData = {
      title: chatResponse.title || '일정',
      description: chatResponse.description || '',
      startDateTime: chatResponse.startDateTime,
      endDateTime: chatResponse.endDateTime
    };

    let apiEndpoint;
    let requestBody = eventData;

    switch (context.tabType) {
      case 'google':
        apiEndpoint = `${API_BASE_URL}/api/calendar/events/google`;
        break;
      case 'local':
        if (context.context === 'profile') {
          // 🔥 항상 최신 상태 가져오기 (복합 명령어 race condition 방지)
          console.log('📥 [프로필 탭] 최신 스케줄 가져오기 중...');
          const currentScheduleResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
            headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` }
          });
          if (!currentScheduleResponse.ok) {
            throw new Error('현재 스케줄을 가져올 수 없습니다.');
          }
          const currentSchedule = await currentScheduleResponse.json();
          console.log('📥 [프로필 탭] 현재 defaultSchedule 개수:', currentSchedule.defaultSchedule?.length || 0);

          const startDateTimeStr = eventData.startDateTime;
          const endDateTimeStr = eventData.endDateTime;
          const specificDate = startDateTimeStr.split('T')[0];
          const startTime = startDateTimeStr.split('T')[1].substring(0, 5);
          const endTime = endDateTimeStr.split('T')[1].substring(0, 5);

          const newPersonalTime = createSingleProfilePersonalTime(eventData, specificDate, startTime, endTime);

          const existingPersonalTimes = Array.isArray(currentSchedule.personalTimes)
            ? [...currentSchedule.personalTimes]
            : [];

          console.log('📅 [프로필 탭] personalTimes에 일정 추가:', { title: eventData.title, specificDate, startTime, endTime });

          apiEndpoint = `${API_BASE_URL}/api/users/profile/schedule`;
          requestBody = {
            defaultSchedule: currentSchedule.defaultSchedule,
            scheduleExceptions: currentSchedule.scheduleExceptions || [],
            personalTimes: [...existingPersonalTimes, newPersonalTime]
          };
        } else {
          apiEndpoint = `${API_BASE_URL}/api/events`;
          requestBody = {
            title: eventData.title,
            date: eventData.startDateTime.split('T')[0],
            time: eventData.startDateTime.split('T')[1].substring(0, 5),
            participants: [],
            priority: 3,
            description: eventData.description
          };
        }
        break;
      default:
        apiEndpoint = `${API_BASE_URL}/api/calendar/events/google`;
    }

    const httpMethod = (context.context === 'profile' && context.tabType === 'local') ? 'PUT' : 'POST';

    const response = await fetch(apiEndpoint, {
      method: httpMethod,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await currentUser.getIdToken()}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      if (context.tabType === 'google') {
        throw new Error(errorData.msg || 'Google 캘린더에 일정을 추가하지 못했습니다.');
      } else {
        throw new Error(errorData.msg || '로컬 일정을 추가하지 못했습니다.');
      }
    }

    const responseData = await response.json();

    console.log('✅ [일정 추가] 성공:', { title: chatResponse.title, responseData });

    if (context.tabType === 'local') {
      if (context.context === 'profile') {
        const updateEvent = new CustomEvent('calendarUpdate', {
          detail: {
            type: 'add',
            data: responseData,
            chatResponse: chatResponse
          }
        });
        window.dispatchEvent(updateEvent);
        console.log('📡 calendarUpdate 이벤트 발송 (프로필 탭)');
      }
      setEventAddedKey(prevKey => prevKey + 1);
    } else {
      setTimeout(() => {
        setEventAddedKey(prevKey => prevKey + 1);
      }, 1000);
    }

    return {
      success: true,
      message: `${chatResponse.title} 일정을 추가했어요!`,
      data: chatResponse
    };
  }, [eventActions, setEventAddedKey]);

  return { handleEventAdd };
};
