/**
 * ===================================================================================================
 * useEventAdd.js - 챗봇을 통한 단일 일정 추가 처리를 위한 커스텀 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/hooks/useChat/hooks/useEventAdd.js
 *
 * 🎯 주요 기능:
 *    - 'add_event' 인텐트를 처리하여 단일 일정을 추가.
 *    - 일정 추가 전, 현재 캘린더의 다른 일정과 충돌이 발생하는지 확인.
 *    - 충돌 발생 시, 사용자에게 충돌 사실을 알리고 확인을 요청하는 응답을 생성.
 *    - 컨텍스트(활성 탭: 'profile', 'events')와 탭 타입('local', 'google')에 따라 다른 API 엔드포인트와 요청 본문을 구성하여 일정을 추가.
 *    - 'profile' 탭에서는 개인 시간(`personalTimes`)으로, 'events' 탭에서는 고정 일정(`events`)으로 추가.
 *
 * 🔗 연결된 파일:
 *    - client/src/hooks/useChat/index.js: 이 훅을 사용하여 'add_event' 인텐트를 처리.
 *    - client/src/utils/index.js: `checkScheduleConflict` 함수를 사용하여 충돌을 확인.
 *    - client/src/hooks/useChat/utils/responseUtils.js: `createConflictResponse` 함수로 충돌 응답을 생성.
 *    - client/src/hooks/useChat/utils/apiRequestUtils.js: `createSingleProfilePersonalTime` 함수로 프로필 개인시간 요청 데이터를 생성.
 *
 * 💡 UI 위치:
 *    - 직접적인 UI 요소는 없으나, 채팅창을 통해 단일 일정을 추가하는 기능의 핵심 로직.
 *
 * ✏️ 수정 가이드:
 *    - 충돌 확인 로직 변경: `checkScheduleConflict` 호출 부분 및 관련 로직을 수정.
 *    - 각 탭('profile', 'events', 'google')별 API 요청 방식 변경 시: `switch (context.tabType)` 내부의 `apiEndpoint` 및 `requestBody` 구성 로직을 수정.
 *
 * 📝 참고사항:
 *    - 종료 시간이 지정되지 않은 경우, 시작 시간으로부터 1시간 뒤로 자동 설정됩니다.
 *    - 프로필에 개인 시간을 추가할 때는 Race Condition을 방지하기 위해, 항상 최신 프로필 스케줄을 다시 가져와서 업데이트합니다.
 *
 * ===================================================================================================
 */
import { useCallback } from 'react';
import { auth } from '../../../config/firebaseConfig';
import { API_BASE_URL } from '../constants/apiConstants';
import { checkScheduleConflict } from '../../../utils';
import { createConflictResponse } from '../utils/responseUtils';
import { createSingleProfilePersonalTime } from '../utils/apiRequestUtils';

/**
 * useEventAdd
 *
 * @description 챗봇을 통해 단일 일정을 추가하고 충돌을 처리하는 로직을 관리하는 커스텀 훅.
 * @param {Object} eventActions - 이벤트 관련 액션 함수들 (현재는 사용되지 않거나 'profile' 컨텍스트에서 우회됨).
 * @param {Function} setEventAddedKey - 이벤트 추가 후 상위 컴포넌트의 리렌더링을 유발하기 위한 상태 설정 함수.
 * @returns {{handleEventAdd: Function}} AI 응답을 받아 단일 일정을 추가하는 `handleEventAdd` 함수를 포함하는 객체.
 *
 * @example
 * const { handleEventAdd } = useEventAdd(eventActions, setSomeKey);
 * // useChat 훅 등에서 호출됨
 * const result = await handleEventAdd(chatResponse, context);
 */
export const useEventAdd = (eventActions, setEventAddedKey) => {
  /**
   * handleEventAdd
   * @description AI 응답을 기반으로 단일 일정을 추가합니다. 충돌을 확인하고, 컨텍스트에 따라 적절한 API를 호출합니다.
   * @param {Object} chatResponse - AI가 파싱한 사용자 의도 및 일정 정보가 담긴 객체.
   * @param {Object} context - 현재 탭, 탭 타입 등 필요한 컨텍스트 정보.
   * @returns {Promise<Object>} 작업 성공 여부, 메시지, 충돌 시 관련 정보 등을 담은 결과 객체를 반환합니다.
   */
  const handleEventAdd = useCallback(async (chatResponse, context) => {
    // 프로필 탭에서는 eventActions 불필요 (직접 API 호출)
    if (context.context !== 'profile' && (!eventActions || !eventActions.addEvent)) {
      return { success: false, message: '일정 추가 기능이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.' };
    }

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

    // 충돌 확인 로직
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
      // 충돌 확인 중 오류가 발생해도 일단 일정 추가는 계속 진행
      console.warn('[충돌 확인 오류]', conflictError);
    }

    const eventData = {
      title: chatResponse.title || '일정',
      description: chatResponse.description || '',
      startDateTime: chatResponse.startDateTime,
      endDateTime: chatResponse.endDateTime,
      location: chatResponse.location || ''
    };

    let apiEndpoint;
    let requestBody = eventData;
    let httpMethod = 'POST';

    console.log('[useEventAdd] tabType:', context.tabType, '| context:', context.context, '| eventData:', eventData);

    switch (context.tabType) {
      case 'local':
        if (context.context === 'profile') {
          // '내 프로필' 탭의 개인시간으로 추가
          console.log('📥 [프로필 탭] 최신 스케줄 가져오기 중...');
          const currentScheduleResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
            headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` }
          });
          if (!currentScheduleResponse.ok) {
            throw new Error('현재 스케줄을 가져올 수 없습니다.');
          }
          const currentSchedule = await currentScheduleResponse.json();
          
          const specificDate = eventData.startDateTime.split('T')[0];
          const startTime = eventData.startDateTime.split('T')[1]?.substring(0, 5) || '00:00';
          const endTime = eventData.endDateTime.split('T')[1]?.substring(0, 5) || '23:59';
          const newPersonalTime = createSingleProfilePersonalTime(eventData, specificDate, startTime, endTime);

          const existingPersonalTimes = Array.isArray(currentSchedule.personalTimes)
            ? [...currentSchedule.personalTimes]
            : [];
          
          apiEndpoint = `${API_BASE_URL}/api/users/profile/schedule`;
          requestBody = {
            defaultSchedule: currentSchedule.defaultSchedule,
            scheduleExceptions: currentSchedule.scheduleExceptions || [],
            personalTimes: [...existingPersonalTimes, newPersonalTime]
          };
          httpMethod = 'PUT';
        } else {
          // '나의 일정' 탭의 고정일정으로 추가
          apiEndpoint = `${API_BASE_URL}/api/events`;
          requestBody = {
            title: eventData.title,
            date: eventData.startDateTime.split('T')[0],
            time: eventData.startDateTime.split('T')[1].substring(0, 5),
            participants: [],
            priority: 3,
            description: eventData.description,
            location: eventData.location
          };
        }
        break;
      default:
        // 기본값은 로컬 DB
        apiEndpoint = `${API_BASE_URL}/api/events`;
        requestBody = {
          title: eventData.title,
          date: eventData.startDateTime.split('T')[0],
          time: eventData.startDateTime.split('T')[1].substring(0, 5),
          participants: [],
          priority: 3,
          description: eventData.description,
          location: eventData.location
        };
    }

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
      throw new Error(errorData.msg || '일정을 추가하지 못했습니다.');
    }

    const responseData = await response.json();

    // UI 갱신
    if (context.context === 'profile' || context.context === 'events') {
      const updateEvent = new CustomEvent('calendarUpdate', {
        detail: {
          type: 'add',
          data: responseData,
          chatResponse: chatResponse,
          context: context.context
        }
      });
      window.dispatchEvent(updateEvent);
    }
    setEventAddedKey(prevKey => prevKey + 1);

    return {
      success: true,
      message: `${chatResponse.title} 일정을 추가했어요!`,
      data: chatResponse
    };
  }, [eventActions, setEventAddedKey]);

  return { handleEventAdd };
};