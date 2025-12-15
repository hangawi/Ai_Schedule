/**
 * ===================================================================================================
 * useRangeDeletion.js - 챗봇을 통한 범위 일정 삭제 처리를 위한 커스텀 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/hooks/useChat/hooks/useRangeDeletion.js
 *
 * 🎯 주요 기능:
 *    - 'delete_range' 인텐트를 처리하여 지정된 기간 내의 모든 일정을 삭제.
 *    - 컨텍스트('profile', 'events')와 탭 타입('local', 'google')에 따라 다른 방식으로 삭제 로직을 수행.
 *    - 'profile' 탭: 전체 스케줄을 가져와서 해당 범위 내의 '예외일정'과 '개인시간'을 필터링하여 제외한 후, 다시 전체 스케줄을 업데이트.
 *    - 'events' 또는 'google' 탭: 해당 기간의 이벤트를 조회한 후, 각 이벤트를 순회하며 개별적으로 삭제 API를 호출.
 *    - 삭제 성공 시 'calendarUpdate' 이벤트를 발생시켜 UI를 갱신.
 *
 * 🔗 연결된 파일:
 *    - client/src/hooks/useChat/index.js: 이 훅을 사용하여 'delete_range' 인텐트를 처리.
 *    - server/routes/profile.js: '/api/users/profile/schedule' 라우트와 통신.
 *    - server/routes/events.js: '/api/events' 라우트와 통신.
 *    - server/routes/calendar.js: '/api/calendar/events/google' 라우트와 통신.
 *
 * 💡 UI 위치:
 *    - 직접적인 UI 요소는 없으나, 채팅창을 통해 "이번 주 일정 다 삭제해줘" 와 같은 범위 삭제 요청을 처리하는 핵심 로직.
 *
 * ✏️ 수정 가이드:
 *    - 'profile' 탭 삭제 로직 변경 시: `filteredExceptions`, `filteredPersonalTimes` 로직을 검토. 이 방식은 비효율적이므로 백엔드 API 개선을 고려.
 *    - 'events' 또는 'google' 탭 삭제 로직 변경 시: 이벤트 목록을 가져와 순회하며 삭제하는 부분을 검토. 백엔드에서 범위 삭제를 한번에 처리하는 API가 더 효율적.
 *
 * 📝 참고사항:
 *    - '내 프로필' 탭의 범위 삭제는 '고정 선호시간(defaultSchedule)'은 삭제하지 않고, '예외일정(exceptions)'과 '개인시간(personalTimes)'만 대상으로 함.
 *
 * ===================================================================================================
 */
import { useCallback } from 'react';
import { auth } from '../../../config/firebaseConfig';
import { API_BASE_URL } from '../constants/apiConstants';

/**
 * useRangeDeletion
 *
 * @description 챗봇을 통해 특정 기간의 이벤트를 삭제하는 로직을 관리하는 커스텀 훅.
 * @param {Function} setEventAddedKey - 이벤트 삭제 후 상위 컴포넌트의 리렌더링을 유발하기 위한 상태 설정 함수.
 * @returns {{handleRangeDeletion: Function}} AI 응답과 컨텍스트를 받아 범위 내 이벤트를 삭제하는 `handleRangeDeletion` 함수를 포함하는 객체.
 *
 * @example
 * const { handleRangeDeletion } = useRangeDeletion(setSomeKey);
 * // useChat 훅 등에서 호출됨
 * const result = await handleRangeDeletion(chatResponse, context);
 */
export const useRangeDeletion = (setEventAddedKey) => {
  /**
   * handleRangeDeletion
   * @description AI 응답에 지정된 시작일과 종료일 사이의 모든 일정을 삭제합니다.
   * @param {Object} chatResponse - AI가 파싱한 `startDate`와 `endDate`가 포함된 객체.
   * @param {Object} context - 현재 탭('profile', 'events') 및 탭 타입('local', 'google') 정보.
   * @returns {Promise<Object>} 작업 성공 여부와 메시지를 담은 결과 객체를 반환합니다.
   */
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
              // 개별 삭제 실패 시 다른 삭제는 계속 진행
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