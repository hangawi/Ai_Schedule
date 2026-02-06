/**
 * ===================================================================================================
 * useEventDelete.js - 챗봇을 통한 일정 삭제 처리를 위한 커스텀 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/hooks/useChat/hooks/useEventDelete.js
 *
 * 🎯 주요 기능:
 *    - 'delete_event' 또는 'delete_range' 인텐트를 처리하여 일정을 삭제.
 *    - 사용자 메시지에 포함된 키워드("선호시간", "개인일정", "전부")를 분석하여 삭제 대상을 필터링.
 *    - 날짜 또는 시간 범위를 기반으로 삭제할 이벤트를 검색.
 *    - 컨텍스트('profile', 'events') 및 탭 타입('local')에 따라 다른 방식으로 이벤트를 불러오고 삭제를 처리.
 *    - 삭제할 이벤트가 여러 개이고 "전부" 키워드가 없으면 사용자에게 재확인 요청.
 *
 * 🔗 연결된 파일:
 *    - client/src/hooks/useChat/index.js: 이 훅을 사용하여 삭제 관련 인텐트를 처리.
 *    - client/src/hooks/useChat/constants/keywordConstants.js: 'DELETE_ALL_KEYWORDS' 등 삭제 관련 키워드를 가져옴.
 *    - client/src/hooks/useChat/utils/eventFilterUtils.js: 날짜, 범위, 타입에 따라 이벤트를 필터링하는 유틸리티 함수를 사용.
 *
 * 💡 UI 위치:
 *    - 직접적인 UI 요소는 없으나, 채팅창을 통해 일정을 삭제하는 기능의 핵심 로직.
 *
 * ✏️ 수정 가이드:
 *    - 삭제 대상 필터링 로직 변경 시: `deleteOnlyPreferredTime`, `deleteOnlyPersonalTime` 플래그 설정 로직 및 `matchingEvents.filter` 부분을 수정.
 *    - 'profile' 탭의 다중/단일 삭제 로직 변경 시: `remainingExceptions`, `remainingPersonalTimes`, `remainingDefaultSchedule`을 계산하고 PUT 요청을 보내는 부분을 검토.
 *
 * 📝 참고사항:
 *    - '내 프로필' 탭에서의 삭제는 전체 스케줄을 가져와서 필터링한 후 다시 전체를 업데이트하는 방식으로 동작. (API 개선 필요)
 *    - '선호시간' 또는 '개인일정' 같은 타입 키워드가 있을 경우, AI가 추론한 `title`은 무시하고 타입 기준으로 필터링함.
 *
 * ===================================================================================================
 */
import { useCallback } from 'react';
import { auth } from '../../../config/firebaseConfig';
import { API_BASE_URL } from '../constants/apiConstants';
import { DELETE_ALL_KEYWORDS } from '../constants/keywordConstants';
import { filterEventsByDate, filterEventsByRange, convertProfileEvents } from '../utils/eventFilterUtils';

/**
 * useEventDelete
 *
 * @description 챗봇을 통해 이벤트를 삭제하는 로직을 관리하는 커스텀 훅.
 * @param {Function} setEventAddedKey - 이벤트 삭제 후 상위 컴포넌트의 리렌더링을 유발하기 위한 상태 설정 함수.
 * @returns {{handleEventDelete: Function}} AI 응답과 컨텍스트를 받아 이벤트를 삭제하는 `handleEventDelete` 함수를 포함하는 객체.
 *
 * @example
 * const { handleEventDelete } = useEventDelete(setSomeKey);
 * // useChat 훅 등에서 호출됨
 * const result = await handleEventDelete(chatResponse, context, "오늘 저녁 약속 삭제해줘");
 */
export const useEventDelete = (setEventAddedKey) => {
  /**
   * handleEventDelete
   * @description AI 응답과 사용자 메시지를 분석하여 조건에 맞는 이벤트를 찾아 삭제합니다.
   * @param {Object} chatResponse - AI가 파싱한 사용자 의도 및 시간/날짜 정보.
   * @param {Object} context - 현재 탭, 탭 타입 등 필요한 컨텍스트 정보.
   * @param {string} message - 사용자가 입력한 원본 메시지.
   * @returns {Promise<Object>} 작업 성공 여부와 메시지를 담은 결과 객체를 반환합니다.
   */
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

    if (message.includes('선호시간') || message.includes('선호 시간')) {
      deleteOnlyPreferredTime = true;
      if (chatResponse.title) delete chatResponse.title;

    } else if (message.includes('개인일정') || message.includes('개인 일정')) {
      deleteOnlyPersonalTime = true;
      if (chatResponse.title) delete chatResponse.title;

    }

    const hasDeleteAllKeyword = DELETE_ALL_KEYWORDS.some(keyword => message.includes(keyword));

    if (hasDeleteAllKeyword && !chatResponse.title && !deleteOnlyPreferredTime && !deleteOnlyPersonalTime) {
      chatResponse.title = '전체';

    }

    if (!chatResponse.startDateTime && chatResponse.date) {
      const time = chatResponse.time || '12:00';
      chatResponse.startDateTime = `${chatResponse.date}T${time}:00+09:00`;
      console.log('⏰ startDateTime 설정:', chatResponse.startDateTime);
    }

    // 🆕 구글 사용자 여부 확인
    const isGoogleUser = context.loginMethod === 'google';
    console.log('🗑️ [DELETE] loginMethod:', context.loginMethod, '| isGoogleUser:', isGoogleUser);

    let eventsResponse;
    if (isGoogleUser) {
      // 구글 사용자: Google Calendar에서 일정 조회
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const oneYearLater = new Date();
      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
      eventsResponse = await fetch(`${API_BASE_URL}/api/calendar/events?timeMin=${threeMonthsAgo.toISOString()}&timeMax=${oneYearLater.toISOString()}`, {
        headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` }
      });
    } else if (context.context === 'profile' && context.tabType === 'local') {
      eventsResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
        headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` }
      });
    } else {
      eventsResponse = await fetch(`${API_BASE_URL}/api/events`, {
        headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` }
      });
    }

    if (!eventsResponse.ok) throw new Error('일정 목록을 가져올 수 없습니다.');

    const eventsData = await eventsResponse.json();

    let events;
    if (isGoogleUser) {
      // 구글 캘린더 이벤트
      events = eventsData;
    } else if (context.context === 'profile' && context.tabType === 'local') {
      events = convertProfileEvents(eventsData);
    } else {
      events = eventsData.events || eventsData;
    }

    if (!events || !Array.isArray(events)) throw new Error('일정 목록 형식이 올바르지 않습니다.');

    let matchingEvents;
    if (chatResponse.intent === 'delete_range') {
      matchingEvents = filterEventsByRange(events, new Date(chatResponse.startDateTime), new Date(chatResponse.endDateTime), chatResponse.title, context);
    } else {
      matchingEvents = filterEventsByDate(events, new Date(chatResponse.startDateTime), chatResponse.title, context);
    }

    if (deleteOnlyPreferredTime) {
      matchingEvents = matchingEvents.filter(e => e.isDefaultSchedule || (!e.isPersonalTime && e.priority !== undefined));
    } else if (deleteOnlyPersonalTime) {
      matchingEvents = matchingEvents.filter(e => e.isPersonalTime);
    }

    if (matchingEvents.length === 0) return { success: false, message: '해당 일정을 찾을 수 없어요.' };

    const shouldDeleteAll = DELETE_ALL_KEYWORDS.some(keyword => message.includes(keyword));
    if (matchingEvents.length > 1 && !shouldDeleteAll) {
      return { success: false, message: `${matchingEvents.length}개의 일정이 있어요. "전부 삭제"라고 하시거나 더 구체적으로 말씀해 주세요.` };
    }

    // 다중 삭제 처리
    if (matchingEvents.length > 1 && shouldDeleteAll) {
      let deletedCount = 0;
      if (isGoogleUser) {
        // 🆕 구글 사용자: Google Calendar에서 다중 삭제
        for (const event of matchingEvents) {
          const deleteResponse = await fetch(`${API_BASE_URL}/api/calendar/events/${event.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` }
          });
          if (deleteResponse.ok) deletedCount++;
        }
      } else if (context.context === 'profile' && context.tabType === 'local') {
        const remainingExceptions = eventsData.scheduleExceptions.filter(ex => !matchingEvents.some(match => !match.isPersonalTime && !match.isDefaultSchedule && match._id === ex._id));
        const remainingPersonalTimes = eventsData.personalTimes.filter(pt => !matchingEvents.some(match => match.isPersonalTime && match._id === pt.id));
        const remainingDefaultSchedule = eventsData.defaultSchedule.filter((ds, index) => !matchingEvents.some(match => match.isDefaultSchedule && match._id === `default-${ds.dayOfWeek}-${index}`));

        const updateResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await currentUser.getIdToken()}` },
          body: JSON.stringify({
            defaultSchedule: remainingDefaultSchedule,
            scheduleExceptions: remainingExceptions,
            personalTimes: remainingPersonalTimes
          }),
        });

        if (updateResponse.ok) {
          deletedCount = matchingEvents.length;
          window.dispatchEvent(new CustomEvent('calendarUpdate', { detail: { type: 'delete', context: 'profile' } }));
        }
      } else {
        // 일반 사용자: 로컬 DB에서 다중 삭제
        for (const event of matchingEvents) {
          const deleteResponse = await fetch(`${API_BASE_URL}/api/events/${event._id || event.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` }
          });
          if (deleteResponse.ok) deletedCount++;
        }
      }
      setEventAddedKey(prevKey => prevKey + 1);
      return { success: true, message: `${deletedCount}개의 일정을 삭제했어요!`, data: chatResponse };
    }

    // 단일 삭제 처리
    const eventToDelete = matchingEvents[0];
    let deleteResponse;

    if (isGoogleUser) {
      // 🆕 구글 사용자: Google Calendar에서 단일 삭제
      deleteResponse = await fetch(`${API_BASE_URL}/api/calendar/events/${eventToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` }
      });
    } else if (context.context === 'profile' && context.tabType === 'local') {
      let { scheduleExceptions, personalTimes, defaultSchedule } = eventsData;
      if (eventToDelete.isPersonalTime) {
        personalTimes = personalTimes.filter(pt => String(pt.id) !== String(eventToDelete._id));
      } else if (eventToDelete.isDefaultSchedule) {
        defaultSchedule = defaultSchedule.filter((ds, index) => `default-${ds.dayOfWeek}-${index}` !== eventToDelete._id);
      } else {
        scheduleExceptions = scheduleExceptions.filter(ex => ex._id !== eventToDelete._id);
      }
      deleteResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await currentUser.getIdToken()}` },
        body: JSON.stringify({ defaultSchedule, scheduleExceptions, personalTimes }),
      });
      if(deleteResponse.ok) window.dispatchEvent(new CustomEvent('calendarUpdate', { detail: { type: 'delete', context: 'profile' } }));
    } else {
      // 일반 사용자: 로컬 DB에서 단일 삭제
      deleteResponse = await fetch(`${API_BASE_URL}/api/events/${eventToDelete._id || eventToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` }
      });
    }

    if (!deleteResponse.ok) throw new Error('일정 삭제에 실패했습니다.');

    // 🆕 조율방 확정 일정이면 불참 알림 (일반 사용자만 - 구글은 서버에서 처리)
    if (!isGoogleUser && eventToDelete.roomId) {
      try {
        await fetch(`${API_BASE_URL}/api/chat/${eventToDelete.roomId}/member-decline`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await currentUser.getIdToken()}`
          },
          body: JSON.stringify({ eventTitle: eventToDelete.title || '일정' })
        });
        console.log(`✅ 조율방(${eventToDelete.roomId})에 불참 알림 전송 완료`);
      } catch (notifyErr) {
        console.warn('조율방 불참 알림 실패:', notifyErr);
      }
    }

    setEventAddedKey(prevKey => prevKey + 1);
    const deletedTitle = isGoogleUser ? eventToDelete.summary : eventToDelete.title;

    return { success: true, message: `${deletedTitle || '일정'}을 삭제했어요!`, data: chatResponse };
  }, [setEventAddedKey]);

  return { handleEventDelete };
};