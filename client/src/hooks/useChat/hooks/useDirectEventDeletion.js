/**
 * ===================================================================================================
 * useDirectEventDeletion.js - 챗봇을 통한 직접 일정 삭제 처리를 위한 커스텀 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/hooks/useChat/hooks/useDirectEventDeletion.js
 *
 * 🎯 주요 기능:
 *    - 'delete_specific_event' 인텐트와 함께 전달된 `eventId`를 사용하여 특정 일정을 직접 삭제.
 *    - 현재 컨텍스트('events' 또는 'profile')에 따라 다른 API 엔드포인트를 호출.
 *    - 'events' 탭: '/api/events/:eventId'에 DELETE 요청을 보내 이벤트(고정일정)를 삭제.
 *    - 'profile' 탭: '/api/users/profile/schedule'에서 전체 스케줄을 가져와 해당 일정을 제거하고 다시 PUT으로 업데이트.
 *    - 삭제 성공 시 'calendarUpdate' 이벤트를 발생시켜 UI를 갱신.
 *
 * 🔗 연결된 파일:
 *    - client/src/hooks/useChat/index.js: 이 훅을 사용하여 'delete_specific_event' 인텐트를 처리.
 *    - server/routes/events.js: '/api/events/:eventId' 라우트와 통신.
 *    - server/routes/profile.js: '/api/users/profile/schedule' 라우트와 통신.
 *
 * 💡 UI 위치:
 *    - 직접적인 UI 요소는 없으나, 채팅창을 통해 특정 일정을 삭제하는 기능의 핵심 로직.
 *
 * ✏️ 수정 가이드:
 *    - 'events' 탭의 삭제 API 변경 시: `fetch` 요청 URL과 메서드를 수정.
 *    - 'profile' 탭의 로직 변경 시: 스케줄을 가져와서 업데이트하는 전체 로직을 검토해야 함. 특히 `personalTimes`와 `scheduleExceptions` 배열을 다루는 부분을 주의.
 *
 * 📝 참고사항:
 *    - 'profile' 탭에서의 삭제는 읽기(GET), 수정(local), 쓰기(PUT)의 3단계로 동작하여 비효율적일 수 있음. 백엔드에 ID로 직접 삭제하는 API를 만드는 것이 권장됨.
 *    - `eventId`는 `message` 객체에 포함되어 전달되는 것으로 가정함.
 *
 * ===================================================================================================
 */
import { useCallback } from 'react';
import { auth } from '../../../config/firebaseConfig';
import { API_BASE_URL } from '../constants/apiConstants';

/**
 * useDirectEventDeletion
 *
 * @description 챗봇을 통해 특정 ID를 가진 이벤트를 직접 삭제하는 로직을 관리하는 커스텀 훅.
 * @param {Function} setEventAddedKey - 이벤트 삭제 후 상위 컴포넌트의 리렌더링을 유발하기 위한 상태 설정 함수.
 * @returns {{handleDirectDeletion: Function}} 채팅 메시지와 컨텍스트를 받아 특정 이벤트를 삭제하는 `handleDirectDeletion` 함수를 포함하는 객체.
 *
 * @example
 * const { handleDirectDeletion } = useDirectEventDeletion(setSomeKey);
 * // useChat 훅 등에서 호출됨
 * const result = await handleDirectDeletion({ eventId: 'some-event-id' }, context);
 */
export const useDirectEventDeletion = (setEventAddedKey) => {
  /**
   * handleDirectDeletion
   * @description 컨텍스트에 따라 적절한 API를 호출하여 특정 이벤트를 삭제합니다.
   * @param {Object} message - `eventId`를 포함하는 메시지 객체.
   * @param {Object} context - 현재 탭(`events` 또는 `profile`) 정보를 포함하는 컨텍스트 객체.
   * @returns {Promise<Object>} 작업 성공 여부와 메시지를 담은 결과 객체를 반환합니다.
   */
  const handleDirectDeletion = useCallback(async (message, context) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, message: '인증 토큰이 없습니다.' };
    }

    try {
      const eventIdToDelete = message.eventId;
      if (!eventIdToDelete) {
        return { success: false, message: '삭제할 일정의 ID가 없습니다.' };
      }

      // '나의 일정' 탭의 경우 /api/events 엔드포인트를 사용하여 직접 삭제
      if (context.context === 'events') {
        const response = await fetch(`${API_BASE_URL}/api/events/${eventIdToDelete}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.msg || '일정 삭제에 실패했습니다.');
        }

        // 성공적으로 삭제되었음을 UI에 알림
        window.dispatchEvent(new CustomEvent('calendarUpdate', {
          detail: { type: 'delete', eventId: eventIdToDelete, context: 'events' }
        }));
        setEventAddedKey(prevKey => prevKey + 1);

        return {
          success: true,
          message: `일정을 삭제했어요!`,
        };
      } else {
        // '내 프로필' 탭의 개인시간 또는 예외일정 삭제 로직
        const scheduleResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
          headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` }
        });

        if (!scheduleResponse.ok) {
          throw new Error('스케줄 정보를 가져오지 못했습니다.');
        }

        const scheduleData = await scheduleResponse.json();
        let eventTitle = '일정';
        let foundAndSpliced = false;

        // personalTimes에서 찾아서 제거
        if (scheduleData.personalTimes && scheduleData.personalTimes.length > 0) {
          const findIndex = scheduleData.personalTimes.findIndex(pt =>
            String(pt.id) === String(eventIdToDelete) || String(pt._id) === String(eventIdToDelete)
          );

          if (findIndex !== -1) {
            eventTitle = scheduleData.personalTimes[findIndex].title;
            scheduleData.personalTimes.splice(findIndex, 1);
            foundAndSpliced = true;
          }
        }

        // scheduleExceptions에서 찾아서 제거
        if (!foundAndSpliced && scheduleData.scheduleExceptions && scheduleData.scheduleExceptions.length > 0) {
          const findIndex = scheduleData.scheduleExceptions.findIndex(ex =>
            String(ex.id) === String(eventIdToDelete) || String(ex._id) === String(eventIdToDelete)
          );

          if (findIndex !== -1) {
            eventTitle = scheduleData.scheduleExceptions[findIndex].title;
            scheduleData.scheduleExceptions.splice(findIndex, 1);
            foundAndSpliced = true;
          }
        }

        if (!foundAndSpliced) {
          return { success: false, message: '삭제할 일정을 찾지 못했습니다.' };
        }

        // 유효한 scheduleExceptions만 필터링하여 정리
        const cleanedExceptions = (scheduleData.scheduleExceptions || [])
          .filter(exc => exc.startTime && exc.endTime && exc.specificDate)
          .map(exc => ({
            specificDate: exc.specificDate,
            startTime: exc.startTime,
            endTime: exc.endTime,
            title: exc.title || '',
            description: exc.description || ''
          }));

        // 수정된 전체 스케줄을 다시 서버로 전송
        const updateResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await currentUser.getIdToken()}`,
          },
          body: JSON.stringify({
            scheduleExceptions: cleanedExceptions,
            personalTimes: scheduleData.personalTimes || []
          }),
        });

        if (!updateResponse.ok) {
          const errorData = await updateResponse.json();
          throw new Error(errorData.msg || '일정 삭제에 실패했습니다.');
        }
        
        // UI 갱신
        window.dispatchEvent(new CustomEvent('calendarUpdate', {
          detail: { type: 'delete', eventId: eventIdToDelete, context: 'profile' }
        }));
        setEventAddedKey(prevKey => prevKey + 1);

        return {
          success: true,
          message: `${eventTitle} 일정을 삭제했어요!`,
        };
      }
    } catch (error) {
      console.error('삭제 중 오류 발생:', error);
      return { success: false, message: `삭제 중 오류 발생: ${error.message}` };
    }
  }, [setEventAddedKey]);

  return { handleDirectDeletion };
};