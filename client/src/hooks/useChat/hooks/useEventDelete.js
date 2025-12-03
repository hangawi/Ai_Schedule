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
    console.log('🗑️ [DELETE] 시작 =================');
    console.log('📝 chatResponse:', JSON.stringify(chatResponse, null, 2));
    console.log('🏷️ context:', JSON.stringify(context, null, 2));
    console.log('💬 message:', message);

    const currentUser = auth.currentUser;
    if (!currentUser) return { success: false, message: '인증이 필요합니다.' };

    // 타입별 필터링 플래그 ("전부" 키워드 불필요!)
    let deleteOnlyPreferredTime = false;
    let deleteOnlyPersonalTime = false;

    // "선호시간" 키워드만으로 선호시간 타입 필터링 (title 무시!)
    if (message.includes('선호시간') || message.includes('선호 시간')) {
      deleteOnlyPreferredTime = true;
      // LLM이 추론한 title 무시 (사용자가 명시적으로 "선호시간"이라고 했음)
      if (chatResponse.title) {
        console.log('🔍 "선호시간 삭제" 감지 → title 무시:', chatResponse.title);
        delete chatResponse.title;
      }
      console.log('🔍 "선호시간 삭제" 감지 → 선호시간만 삭제');
    }
    // "개인일정" 키워드만으로 개인일정 타입 필터링 (title 무시!)
    else if (message.includes('개인일정') || message.includes('개인 일정')) {
      deleteOnlyPersonalTime = true;
      // LLM이 추론한 title 무시 (사용자가 명시적으로 "개인일정"이라고 했음)
      if (chatResponse.title) {
        console.log('🔍 "개인일정 삭제" 감지 → title 무시:', chatResponse.title);
        delete chatResponse.title;
      }
      console.log('🔍 "개인일정 삭제" 감지 → 개인일정만 삭제');
    }

    // "전부 삭제" 키워드 체크
    const hasDeleteAllKeyword = DELETE_ALL_KEYWORDS.some(keyword => message.includes(keyword));

    if (hasDeleteAllKeyword && !chatResponse.title && !deleteOnlyPreferredTime && !deleteOnlyPersonalTime) {
      // "일정 전부" → 모든 일정 삭제
      chatResponse.title = '전체';
      console.log('🔍 "전부 삭제" 키워드 감지 → title을 "전체"로 설정');
    }

    // 시작 시간 설정
    if (!chatResponse.startDateTime && chatResponse.date) {
      const time = chatResponse.time || '12:00';
      chatResponse.startDateTime = `${chatResponse.date}T${time}:00+09:00`;
      console.log('⏰ startDateTime 설정:', chatResponse.startDateTime);
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
    console.log('📦 eventsData:', {
      defaultSchedule: eventsData.defaultSchedule?.length || 0,
      scheduleExceptions: eventsData.scheduleExceptions?.length || 0,
      personalTimes: eventsData.personalTimes?.length || 0
    });

    let events;
    if (context.context === 'profile' && context.tabType === 'local') {
      events = convertProfileEvents(eventsData);
      console.log('🔄 convertProfileEvents 결과:', events.length, '개 이벤트');
      console.log('📋 events 샘플:', events.slice(0, 3).map(e => ({
        _id: e._id,
        title: e.title,
        isDefaultSchedule: e.isDefaultSchedule,
        isPersonalTime: e.isPersonalTime,
        dayOfWeek: e.dayOfWeek,
        specificDate: e.specificDate
      })));
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
      console.log('📅 범위 삭제:', startDate, '~', endDate);
      matchingEvents = filterEventsByRange(events, startDate, endDate, chatResponse.title, context);
    } else {
      const targetDate = new Date(chatResponse.startDateTime);
      console.log('📅 타겟 날짜:', targetDate);
      console.log('📅 요일:', targetDate.getDay() === 0 ? 7 : targetDate.getDay());
      matchingEvents = filterEventsByDate(events, targetDate, chatResponse.title, context);
    }

    console.log('🎯 매칭된 이벤트:', matchingEvents.length, '개');
    console.log('📋 매칭된 이벤트 상세:', matchingEvents.map(e => ({
      _id: e._id,
      title: e.title,
      isDefaultSchedule: e.isDefaultSchedule,
      isPersonalTime: e.isPersonalTime,
      dayOfWeek: e.dayOfWeek,
      priority: e.priority
    })));

    // 타입별 필터링 적용
    if (deleteOnlyPreferredTime) {
      matchingEvents = matchingEvents.filter(e => e.isDefaultSchedule || (!e.isPersonalTime && e.priority !== undefined));
      console.log('🔵 선호시간만 필터링:', matchingEvents.length, '개');
    } else if (deleteOnlyPersonalTime) {
      matchingEvents = matchingEvents.filter(e => e.isPersonalTime);
      console.log('🔴 개인일정만 필터링:', matchingEvents.length, '개');
    }

    if (matchingEvents.length === 0) {
      console.log('❌ 매칭된 이벤트 없음');
      return { success: false, message: '해당 일정을 찾을 수 없어요.' };
    }

    const shouldDeleteAll = DELETE_ALL_KEYWORDS.some(keyword => message.includes(keyword));

    if (matchingEvents.length > 1 && !shouldDeleteAll) {
      return { success: false, message: `${matchingEvents.length}개의 일정이 있어요. "전부 삭제"라고 하시거나 더 구체적으로 말씀해 주세요.` };
    }

    if (matchingEvents.length > 1 && shouldDeleteAll) {
      let deletedCount = 0;

      if (context.context === 'profile' && context.tabType === 'local') {
        console.log('🏢 프로필 탭 다중 삭제 시작');

        const remainingExceptions = eventsData.scheduleExceptions.filter(ex =>
          !matchingEvents.some(match => !match.isPersonalTime && !match.isDefaultSchedule && match._id === ex._id)
        );
        console.log('📊 Exception: 원본', eventsData.scheduleExceptions.length, '→ 남은', remainingExceptions.length);

        const remainingPersonalTimes = eventsData.personalTimes.filter(pt =>
          !matchingEvents.some(match => match.isPersonalTime && match._id === pt.id)
        );
        console.log('📊 PersonalTime: 원본', eventsData.personalTimes.length, '→ 남은', remainingPersonalTimes.length);

        const remainingDefaultSchedule = eventsData.defaultSchedule.filter((ds, index) => {
          const matchId = `default-${ds.dayOfWeek}-${index}`;
          const shouldRemove = matchingEvents.some(match => match.isDefaultSchedule && match._id === matchId);
          if (shouldRemove) {
            console.log('🗑️ defaultSchedule 삭제:', ds.dayOfWeek, matchId);
          }
          return !shouldRemove;
        });
        console.log('📊 DefaultSchedule: 원본', eventsData.defaultSchedule.length, '→ 남은', remainingDefaultSchedule.length);

        const updateBody = {
          defaultSchedule: remainingDefaultSchedule,
          scheduleExceptions: remainingExceptions,
          personalTimes: remainingPersonalTimes
        };
        console.log('📤 API 요청 body:', JSON.stringify(updateBody, null, 2));

        const updateResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await currentUser.getIdToken()}`,
          },
          body: JSON.stringify(updateBody),
        });

        console.log('📥 API 응답 상태:', updateResponse.status, updateResponse.statusText);
        if (updateResponse.ok) {
          deletedCount = matchingEvents.length;
          const responseData = await updateResponse.json();

          // 프로필 탭 전용 이벤트 발송
          window.dispatchEvent(new CustomEvent('calendarUpdate', {
            detail: {
              type: 'delete',
              data: responseData,
              context: 'profile'
            }
          }));

          // 전역 이벤트도 발송
          window.dispatchEvent(new Event('calendarUpdate'));

          console.log('✅ 다중 삭제 성공:', deletedCount, '개');
          console.log('📡 calendarUpdate 이벤트 발송 완료');
        } else {
          const errorText = await updateResponse.text();
          console.log('❌ API 오류:', errorText);
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
    console.log('🎯 단일 삭제 대상:', {
      _id: eventToDelete._id,
      title: eventToDelete.title,
      isDefaultSchedule: eventToDelete.isDefaultSchedule,
      isPersonalTime: eventToDelete.isPersonalTime,
      dayOfWeek: eventToDelete.dayOfWeek
    });
    let deleteResponse;

    if (context.context === 'profile' && context.tabType === 'local') {
      console.log('🏢 프로필 탭 단일 삭제 시작');
      let remainingExceptions = eventsData.scheduleExceptions;
      let remainingPersonalTimes = eventsData.personalTimes;
      let remainingDefaultSchedule = eventsData.defaultSchedule;

      if (eventToDelete.isPersonalTime) {
        console.log('🔴 PersonalTime 삭제:', eventToDelete._id);
        remainingPersonalTimes = eventsData.personalTimes.filter(pt =>
          String(pt.id) !== String(eventToDelete._id)
        );
        console.log('📊 PersonalTime: 원본', eventsData.personalTimes.length, '→ 남은', remainingPersonalTimes.length);
      } else if (eventToDelete.isDefaultSchedule) {
        console.log('🟦 DefaultSchedule 삭제:', eventToDelete._id);
        remainingDefaultSchedule = eventsData.defaultSchedule.filter((ds, index) => {
          const matchId = `default-${ds.dayOfWeek}-${index}`;
          console.log('  체크:', matchId, 'vs', eventToDelete._id, '→', matchId !== eventToDelete._id);
          return matchId !== eventToDelete._id;
        });
        console.log('📊 DefaultSchedule: 원본', eventsData.defaultSchedule.length, '→ 남은', remainingDefaultSchedule.length);
      } else {
        console.log('🟢 Exception 삭제:', eventToDelete._id);
        remainingExceptions = eventsData.scheduleExceptions.filter(ex =>
          ex._id !== eventToDelete._id
        );
        console.log('📊 Exception: 원본', eventsData.scheduleExceptions.length, '→ 남은', remainingExceptions.length);
      }

      const updateBody = {
        defaultSchedule: remainingDefaultSchedule,
        scheduleExceptions: remainingExceptions,
        personalTimes: remainingPersonalTimes
      };
      console.log('📤 API 요청 body:', JSON.stringify(updateBody, null, 2));

      deleteResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await currentUser.getIdToken()}`,
        },
        body: JSON.stringify(updateBody),
      });

      console.log('📥 API 응답 상태:', deleteResponse.status, deleteResponse.statusText);
      if (deleteResponse.ok) {
        const responseData = await deleteResponse.json();
        console.log('✅ 단일 삭제 성공, 응답:', responseData);

        // 프로필 탭 전용 이벤트 발송
        window.dispatchEvent(new CustomEvent('calendarUpdate', {
          detail: {
            type: 'delete',
            data: responseData,
            context: 'profile'
          }
        }));

        // 전역 이벤트도 발송
        window.dispatchEvent(new Event('calendarUpdate'));

        console.log('📡 calendarUpdate 이벤트 발송 완료');
      } else {
        const errorText = await deleteResponse.text();
        console.log('❌ API 오류:', errorText);
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

    console.log('🔄 setEventAddedKey 호출');
    setEventAddedKey(prevKey => prevKey + 1);

    const deletedTitle = (context.context === 'profile' && context.tabType === 'local') || context.tabType === 'local' ? eventToDelete.title : eventToDelete.summary;
    console.log('✅ [DELETE] 완료 =================');
    return {
      success: true,
      message: `${deletedTitle || '일정'}을 삭제했어요!`,
      data: chatResponse
    };
  }, [setEventAddedKey]);

  return { handleEventDelete };
};
