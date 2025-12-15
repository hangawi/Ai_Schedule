/**
 * ===================================================================================================
 * useEventEdit.js - 챗봇을 통한 일정 수정 처리를 위한 커스텀 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/hooks/useChat/hooks/useEventEdit.js
 *
 * 🎯 주요 기능:
 *    - 'edit_event' 인텐트를 처리하여 기존 일정을 수정.
 *    - 원본 일정의 날짜(`originalDate`), 제목(`originalTitle`), 시간(`originalStartTime`)을 기반으로 수정 대상을 검색.
 *    - 사용자 메시지에 포함된 키워드("선호시간", "개인일정")를 분석하여 수정 대상을 명확히 함.
 *    - 컨텍스트('profile', 'events')와 탭 타입('local', 'google')에 따라 다른 방식으로 일정을 검색하고 수정 API를 호출.
 *    - 수정 성공 시 'calendarUpdate' 이벤트를 발생시켜 UI를 갱신.
 *
 * 🔗 연결된 파일:
 *    - client/src/hooks/useChat/index.js: 이 훅을 사용하여 'edit_event' 인텐트를 처리.
 *    - client/src/hooks/useChat/utils/eventFilterUtils.js: 날짜, 제목, 시간으로 수정할 이벤트를 필터링.
 *    - client/src/hooks/useChat/utils/apiRequestUtils.js: 수정 API 요청 본문을 생성.
 *
 * 💡 UI 위치:
 *    - 직접적인 UI 요소는 없으나, 채팅창을 통해 기존 일정을 수정하는 기능의 핵심 로직.
 *
 * ✏️ 수정 가이드:
 *    - 수정 대상 검색 로직 변경 시: `filterEventsByDate` 및 시간 필터링 부분을 수정.
 *    - 각 탭/타입별 API 요청 방식 변경 시: `if/else` 분기 내에서 API 호출 및 `updateBody` 생성 로직을 검토.
 *    - 'profile' 탭에서 `defaultSchedule`, `personalTimes`, `scheduleExceptions`을 다루는 로직은 복잡하므로 수정 시 주의가 필요.
 *
 * 📝 참고사항:
 *    - '내 프로필' 탭의 로컬 일정 수정은 전체 스케줄을 가져와서 수정한 뒤 다시 전체를 업데이트하는 비효율적인 구조를 가짐.
 *    - 특정 시간을 명시하지 않으면 해당 날짜의 첫 번째 매칭되는 일정을 수정 대상으로 삼을 수 있음.
 *
 * ===================================================================================================
 */
import { useCallback } from 'react';
import { auth } from '../../../config/firebaseConfig';
import { API_BASE_URL } from '../constants/apiConstants';
import { filterEventsByDate, convertProfileEvents } from '../utils/eventFilterUtils';
import { createLocalEventUpdateBody, createGoogleEventUpdateBody } from '../utils/apiRequestUtils';
import { toTimeString } from '../utils/dateUtils';

/**
 * useEventEdit
 *
 * @description 챗봇을 통해 기존 이벤트를 수정하는 로직을 관리하는 커스텀 훅.
 * @param {Function} setEventAddedKey - 이벤트 수정 후 상위 컴포넌트의 리렌더링을 유발하기 위한 상태 설정 함수.
 * @returns {{handleEventEdit: Function}} AI 응답과 컨텍스트를 받아 이벤트를 수정하는 `handleEventEdit` 함수를 포함하는 객체.
 *
 * @example
 * const { handleEventEdit } = useEventEdit(setSomeKey);
 * // useChat 훅 등에서 호출됨
 * const result = await handleEventEdit(chatResponse, context, "오늘 저녁 약속 8시로 변경해줘");
 */
export const useEventEdit = (setEventAddedKey) => {
  /**
   * handleEventEdit
   * @description AI 응답을 기반으로 기존 일정을 찾아 수정합니다.
   * @param {Object} chatResponse - AI가 파싱한 원본 및 수정될 일정 정보.
   * @param {Object} context - 현재 탭, 탭 타입 등 필요한 컨텍스트 정보.
   * @param {string} [message=''] - 사용자가 입력한 원본 메시지.
   * @returns {Promise<Object>} 작업 성공 여부와 메시지를 담은 결과 객체를 반환합니다.
   */
  const handleEventEdit = useCallback(async (chatResponse, context, message = '') => {
    console.log('✏️ [EDIT] 시작 =================');
    console.log('📝 chatResponse:', JSON.stringify(chatResponse, null, 2));
    console.log('🏷️ context:', JSON.stringify(context, null, 2));
    console.log('💬 message:', message);

    const currentUser = auth.currentUser;
    if (!currentUser) return { success: false, message: '인증이 필요합니다.' };

    const isProfileTab = context.context === 'profile' && context.tabType === 'local';
    const isPreferredTimeEdit = message.includes('선호시간') || message.includes('선호 시간');
    const isPersonalTimeEdit = message.includes('개인일정') || message.includes('개인 일정');

    if (isPreferredTimeEdit || isPersonalTimeEdit) {
      if (chatResponse.originalTitle || chatResponse.title) {
        delete chatResponse.originalTitle;
        delete chatResponse.title;
      }
    }

    if (!chatResponse.originalDate) return { success: false, message: '수정할 일정의 날짜가 필요합니다.' };
    if (!isProfileTab && !chatResponse.originalTitle) return { success: false, message: '수정할 일정의 제목이 필요합니다.' };

    try {
      // 1. 기존 일정 목록 가져오기
      let eventsResponse;
      if (isProfileTab) {
        eventsResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, { headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` } });
      } else if (context.tabType === 'local') {
        eventsResponse = await fetch(`${API_BASE_URL}/api/events`, { headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` } });
      } else {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const oneYearLater = new Date();
        oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
        eventsResponse = await fetch(`${API_BASE_URL}/api/calendar/events?timeMin=${threeMonthsAgo.toISOString()}&timeMax=${oneYearLater.toISOString()}`, { headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` } });
      }

      if (!eventsResponse.ok) throw new Error('일정 목록을 가져올 수 없습니다.');

      const eventsData = await eventsResponse.json();
      const events = isProfileTab ? convertProfileEvents(eventsData, chatResponse.originalDate) : (eventsData.events || eventsData);

      // 2. 수정 대상 일정 찾기
      let matchingEvents = filterEventsByDate(events, new Date(chatResponse.originalDate), chatResponse.originalTitle || '', context);

      if (isPreferredTimeEdit) {
        matchingEvents = matchingEvents.filter(e => e.isDefaultSchedule || (!e.isPersonalTime && e.priority !== undefined));
      } else if (isPersonalTimeEdit) {
        matchingEvents = matchingEvents.filter(e => e.isPersonalTime);
      }

      if (chatResponse.originalStartTime && matchingEvents.length > 1) {
        const targetHour = parseInt(chatResponse.originalStartTime.split(':')[0]);
        matchingEvents = matchingEvents.filter(e => {
          if (!e.startTime) return false;
          const eventHour = e.isDefaultSchedule ? parseInt(e.startTime.split(':')[0]) : new Date(e.startTime).getHours();
          return eventHour === targetHour;
        });
      }

      const eventToEdit = matchingEvents[0];
      if (!eventToEdit) {
        const titleMsg = chatResponse.originalTitle ? `"${chatResponse.originalTitle}" ` : '';
        return { success: false, message: `${titleMsg}일정을 찾을 수 없어요.` };
      }

      // 3. 일정 수정 API 호출
      let updateResponse;
      if (isProfileTab) {
        let { personalTimes = [], scheduleExceptions = [], defaultSchedule = [] } = eventsData;

        if (eventToEdit.isPersonalTime) {
          const index = personalTimes.findIndex(pt => String(pt.id) === String(eventToEdit.id || eventToEdit._id));
          if (index !== -1) {
            personalTimes[index] = { ...personalTimes[index], title: chatResponse.newTitle || personalTimes[index].title, specificDate: chatResponse.newDate || personalTimes[index].specificDate, startTime: chatResponse.newStartTime || personalTimes[index].startTime, endTime: chatResponse.newEndTime || personalTimes[index].endTime };
          }
        } else if (eventToEdit.isDefaultSchedule) {
          const dsIndex = defaultSchedule.findIndex((ds, idx) => `default-${ds.dayOfWeek}-${idx}` === eventToEdit._id);
          if (dsIndex !== -1) {
            defaultSchedule[dsIndex] = { ...defaultSchedule[dsIndex], priority: chatResponse.newPriority !== undefined ? chatResponse.newPriority : defaultSchedule[dsIndex].priority, startTime: chatResponse.newStartTime || defaultSchedule[dsIndex].startTime, endTime: chatResponse.newEndTime || defaultSchedule[dsIndex].endTime };
          }
        } else {
          const index = scheduleExceptions.findIndex(ex => ex._id === eventToEdit._id);
          if (index !== -1) {
            const oldStart = new Date(scheduleExceptions[index].startTime);
            const oldEnd = new Date(scheduleExceptions[index].endTime);
            let newStartTime = chatResponse.newDate ? new Date(`${chatResponse.newDate}T${toTimeString(oldStart)}:00+09:00`) : new Date(oldStart);
            let newEndTime = chatResponse.newDate ? new Date(`${chatResponse.newDate}T${toTimeString(oldEnd)}:00+09:00`) : new Date(oldEnd);
            if (chatResponse.newStartTime) newStartTime.setHours(...chatResponse.newStartTime.split(':').map(Number));
            if (chatResponse.newEndTime) newEndTime.setHours(...chatResponse.newEndTime.split(':').map(Number));
            scheduleExceptions[index] = { ...scheduleExceptions[index], priority: chatResponse.newPriority !== undefined ? chatResponse.newPriority : scheduleExceptions[index].priority, title: chatResponse.newTitle || scheduleExceptions[index].title, specificDate: chatResponse.newDate || scheduleExceptions[index].specificDate, startTime: newStartTime.toISOString(), endTime: newEndTime.toISOString() };
          }
        }
        updateResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await currentUser.getIdToken()}` }, body: JSON.stringify({ defaultSchedule, scheduleExceptions, personalTimes }) });

      } else { // '나의 일정' 또는 'Google' 탭
        const endpoint = context.tabType === 'local' ? `/api/events/${eventToEdit._id || eventToEdit.id}` : `/api/calendar/events/${eventToEdit.id}`;
        const updateBody = context.tabType === 'local' ? createLocalEventUpdateBody(eventToEdit, chatResponse) : createGoogleEventUpdateBody(eventToEdit, chatResponse);
        updateResponse = await fetch(`${API_BASE_URL}${endpoint}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await currentUser.getIdToken()}` }, body: JSON.stringify(updateBody) });
      }

      if (!updateResponse.ok) throw new Error('일정 수정에 실패했습니다.');

      // 4. UI 갱신
      window.dispatchEvent(new CustomEvent('calendarUpdate', { detail: { type: 'edit', context: context.context } }));
      setEventAddedKey(prevKey => prevKey + 1);

      return { success: true, message: chatResponse.response || `"${chatResponse.originalTitle || '일정'}"을 수정했어요!`, data: chatResponse };

    } catch (error) {
      return { success: false, message: `일정 수정 중 오류가 발생했습니다: ${error.message}` };
    }
  }, [setEventAddedKey]);

  return { handleEventEdit };
};