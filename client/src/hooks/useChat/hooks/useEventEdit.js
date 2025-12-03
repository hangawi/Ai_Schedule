/**
 * 일정 수정 훅
 */

import { useCallback } from 'react';
import { auth } from '../../../config/firebaseConfig';
import { API_BASE_URL } from '../constants/apiConstants';
import { filterEventsByDate } from '../utils/eventFilterUtils';
import { createLocalEventUpdateBody, createGoogleEventUpdateBody } from '../utils/apiRequestUtils';
import { toTimeString } from '../utils/dateUtils';

export const useEventEdit = (setEventAddedKey) => {
  const handleEventEdit = useCallback(async (chatResponse, context, message = '') => {
    console.log('✏️ [EDIT] 시작 =================');
    console.log('📝 chatResponse:', JSON.stringify(chatResponse, null, 2));
    console.log('🏷️ context:', JSON.stringify(context, null, 2));
    console.log('💬 message:', message);

    const currentUser = auth.currentUser;
    if (!currentUser) return { success: false, message: '인증이 필요합니다.' };

    // 프로필 탭에서는 originalTitle 없이도 가능 (선호시간/개인시간)
    const isProfileTab = context.context === 'profile' && context.tabType === 'local';

    // 🆕 타입별 필터링 (Delete와 동일한 로직)
    const isPreferredTimeEdit = message.includes('선호시간') || message.includes('선호 시간');
    const isPersonalTimeEdit = message.includes('개인일정') || message.includes('개인 일정');

    if (isPreferredTimeEdit || isPersonalTimeEdit) {
      // LLM이 추론한 title 무시
      if (chatResponse.originalTitle || chatResponse.title) {
        console.log('✏️ [EDIT] 타입 명시 감지 → title 무시:', chatResponse.originalTitle || chatResponse.title);
        delete chatResponse.originalTitle;
        delete chatResponse.title;
      }
      console.log(isPreferredTimeEdit ? '🔍 "선호시간 수정" 감지' : '🔍 "개인일정 수정" 감지');
    }

    if (!chatResponse.originalDate) {
      return { success: false, message: '수정할 일정의 날짜가 필요합니다.' };
    }

    if (!isProfileTab && !chatResponse.originalTitle) {
      return { success: false, message: '수정할 일정의 제목이 필요합니다.' };
    }

    console.log('✅ 검증 통과:', isProfileTab ? '프로필 탭' : '일정 탭');

    try {
      // 1. 기존 일정 찾기
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
        const originalDate = new Date(chatResponse.originalDate);
        const originalDayOfWeek = originalDate.getDay() === 0 ? 7 : originalDate.getDay();

        const exceptions = (eventsData.scheduleExceptions || []).filter(exc => exc.specificDate === chatResponse.originalDate);
        const personalTimes = (eventsData.personalTimes || []).filter(pt => pt.specificDate === chatResponse.originalDate);
        const defaultScheduleForDay = (eventsData.defaultSchedule || []).filter(ds => ds.dayOfWeek === originalDayOfWeek);

        events = [
          ...exceptions,
          ...personalTimes.map(pt => ({ ...pt, isPersonalTime: true })),
          ...defaultScheduleForDay.map((ds, index) => ({
            ...ds,
            _id: `default-${ds.dayOfWeek}-${eventsData.defaultSchedule.indexOf(ds)}`,
            isDefaultSchedule: true,
            title: `우선순위 ${ds.priority}`
          }))
        ];
      } else if (context.tabType === 'local') {
        events = eventsData.events || eventsData;
      } else {
        events = eventsData;
      }

      // 제목으로 일정 찾기
      const targetDate = new Date(chatResponse.originalDate);
      const searchTitle = chatResponse.originalTitle || '';
      console.log('🔍 검색 조건:', {
        targetDate: targetDate.toISOString(),
        searchTitle,
        originalStartTime: chatResponse.originalStartTime
      });

      let matchingEvents = filterEventsByDate(events, targetDate, searchTitle, context);
      console.log('🎯 매칭된 이벤트:', matchingEvents.length, '개');

      // 🆕 타입별 필터링 적용
      if (isPreferredTimeEdit) {
        matchingEvents = matchingEvents.filter(e =>
          e.isDefaultSchedule || (!e.isPersonalTime && e.priority !== undefined)
        );
        console.log('🔵 선호시간만 필터링:', matchingEvents.length, '개');
      } else if (isPersonalTimeEdit) {
        matchingEvents = matchingEvents.filter(e => e.isPersonalTime);
        console.log('🔴 개인일정만 필터링:', matchingEvents.length, '개');
      }

      // originalStartTime이 있으면 추가 필터링
      if (chatResponse.originalStartTime && matchingEvents.length > 1) {
        const targetHour = parseInt(chatResponse.originalStartTime.split(':')[0]);
        matchingEvents = matchingEvents.filter(e => {
          if (e.startTime) {
            const eventHour = new Date(e.startTime).getHours();
            return eventHour === targetHour;
          }
          return false;
        });
        console.log('⏰ 시간 필터링 후:', matchingEvents.length, '개');
      }

      const eventToEdit = matchingEvents[0];

      if (!eventToEdit) {
        const titleMsg = chatResponse.originalTitle ? `"${chatResponse.originalTitle}" ` : '';
        return { success: false, message: `${titleMsg}일정을 찾을 수 없어요.` };
      }

      console.log('✅ 수정 대상:', {
        _id: eventToEdit._id,
        title: eventToEdit.title,
        isDefaultSchedule: eventToEdit.isDefaultSchedule,
        isPersonalTime: eventToEdit.isPersonalTime
      });

      // 2. 일정 수정 수행 (각 탭별로 다르게)
      if (context.context === 'profile' && context.tabType === 'local') {
        // 프로필 탭 - 로컬 일정 수정
        let updatedPersonalTimes = [...(eventsData.personalTimes || [])];
        let updatedExceptions = [...(eventsData.scheduleExceptions || [])];
        let updatedDefaultSchedule = [...(eventsData.defaultSchedule || [])];

        if (eventToEdit.isPersonalTime) {
          const index = updatedPersonalTimes.findIndex(pt =>
            String(pt.id) === String(eventToEdit.id || eventToEdit._id)
          );

          if (index !== -1) {
            updatedPersonalTimes[index] = {
              ...updatedPersonalTimes[index],
              title: chatResponse.newTitle || updatedPersonalTimes[index].title,
              specificDate: chatResponse.newDate || updatedPersonalTimes[index].specificDate,
              startTime: chatResponse.newStartTime || updatedPersonalTimes[index].startTime,
              endTime: chatResponse.newEndTime || updatedPersonalTimes[index].endTime
            };
          }
        } else if (eventToEdit.isDefaultSchedule) {
          // defaultSchedule 수정
          const dsIndex = eventsData.defaultSchedule.findIndex((ds, idx) => {
            const matchId = `default-${ds.dayOfWeek}-${idx}`;
            return matchId === eventToEdit._id;
          });

          if (dsIndex !== -1) {
            updatedDefaultSchedule[dsIndex] = {
              ...updatedDefaultSchedule[dsIndex],
              priority: chatResponse.newPriority !== undefined ? chatResponse.newPriority : updatedDefaultSchedule[dsIndex].priority,
              startTime: chatResponse.newStartTime || updatedDefaultSchedule[dsIndex].startTime,
              endTime: chatResponse.newEndTime || updatedDefaultSchedule[dsIndex].endTime
            };
          }
        } else {
          const index = updatedExceptions.findIndex(ex =>
            ex._id === eventToEdit._id
          );

          if (index !== -1) {
            const oldStart = new Date(updatedExceptions[index].startTime);
            const oldEnd = new Date(updatedExceptions[index].endTime);

            let newStartTime, newEndTime;

            if (chatResponse.newDate) {
              newStartTime = new Date(`${chatResponse.newDate}T${toTimeString(oldStart)}:00+09:00`);
              newEndTime = new Date(`${chatResponse.newDate}T${toTimeString(oldEnd)}:00+09:00`);
            } else {
              newStartTime = new Date(oldStart);
              newEndTime = new Date(oldEnd);
            }

            if (chatResponse.newStartTime) {
              const [hour, min] = chatResponse.newStartTime.split(':');
              newStartTime.setHours(parseInt(hour), parseInt(min));
            }

            if (chatResponse.newEndTime) {
              const [hour, min] = chatResponse.newEndTime.split(':');
              newEndTime.setHours(parseInt(hour), parseInt(min));
            }

            updatedExceptions[index] = {
              ...updatedExceptions[index],
              priority: chatResponse.newPriority !== undefined ? chatResponse.newPriority : updatedExceptions[index].priority,
              title: chatResponse.newTitle || updatedExceptions[index].title,
              specificDate: chatResponse.newDate || updatedExceptions[index].specificDate,
              startTime: newStartTime.toISOString(),
              endTime: newEndTime.toISOString()
            };
          }
        }

        const updateResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await currentUser.getIdToken()}`
          },
          body: JSON.stringify({
            defaultSchedule: updatedDefaultSchedule,
            scheduleExceptions: updatedExceptions,
            personalTimes: updatedPersonalTimes
          })
        });

        if (!updateResponse.ok) {
          throw new Error('일정 수정에 실패했습니다.');
        }

        const responseData = await updateResponse.json();

        window.dispatchEvent(new CustomEvent('calendarUpdate', {
          detail: {
            type: 'edit',
            data: responseData,
            context: 'profile'
          }
        }));
        setEventAddedKey(prevKey => prevKey + 1);

        return {
          success: true,
          message: chatResponse.response || `"${chatResponse.originalTitle}" 일정을 수정했어요!`,
          data: chatResponse
        };

      } else if (context.tabType === 'local') {
        // 나의 일정 탭 - 로컬 일정 수정
        const updateBody = createLocalEventUpdateBody(eventToEdit, chatResponse);

        const updateResponse = await fetch(`${API_BASE_URL}/api/events/${eventToEdit._id || eventToEdit.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await currentUser.getIdToken()}`
          },
          body: JSON.stringify(updateBody)
        });

        if (!updateResponse.ok) {
          throw new Error('일정 수정에 실패했습니다.');
        }

        setEventAddedKey(prevKey => prevKey + 1);

        return {
          success: true,
          message: chatResponse.response || `"${chatResponse.originalTitle}" 일정을 수정했어요!`,
          data: chatResponse
        };

      } else {
        // Google 캘린더 탭 - Google 일정 수정
        const updateBody = createGoogleEventUpdateBody(eventToEdit, chatResponse);

        const updateResponse = await fetch(`${API_BASE_URL}/api/calendar/events/${eventToEdit.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await currentUser.getIdToken()}`
          },
          body: JSON.stringify(updateBody)
        });

        if (!updateResponse.ok) {
          throw new Error('일정 수정에 실패했습니다.');
        }

        setEventAddedKey(prevKey => prevKey + 1);

        return {
          success: true,
          message: chatResponse.response || `"${chatResponse.originalTitle}" 일정을 수정했어요!`,
          data: chatResponse
        };
      }

    } catch (error) {
      return { success: false, message: `일정 수정 중 오류가 발생했습니다: ${error.message}` };
    }
  }, [setEventAddedKey]);

  return { handleEventEdit };
};
