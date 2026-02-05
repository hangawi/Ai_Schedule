/**
 * ===================================================================================================
 * useRecurringEventAdd.js - 반복 일정 추가 처리를 위한 커스텀 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/hooks/useChat/hooks/useRecurringEventAdd.js
 *
 * 🎯 주요 기능:
 *    - 'add_recurring_event' 인텐트를 처리하여 여러 날짜에 반복되는 일정을 추가.
 *    - 컨텍스트('profile', 'events', 'google')에 따라 적절한 데이터 형식으로 일정 추가.
 *    - 일정 추가 전 충돌 체크를 수행하고, 충돌 시 대안 시간을 제안.
 *    - 'profile' 탭의 경우 personalTimes에 추가하여 빨간색으로 표시.
 *
 * 🔗 연결된 파일:
 *    - client/src/hooks/useChat/index.js - 이 훅을 사용하여 반복 일정 추가 처리.
 *    - client/src/utils/index.js - 충돌 체크(checkScheduleConflict) 및 대안 시간 탐색(findAvailableTimeSlots) 유틸리티 사용.
 *    - client/src/hooks/useChat/utils/apiRequestUtils.js - API 요청 데이터 생성 유틸리티 사용.
 *
 * 💡 UI 위치:
 *    - 채팅창을 통해 "매주 월요일 2시에 수학학원 일정 추가해줘"와 같은 반복 일정 추가 요청을 처리.
 *
 * ✏️ 수정 가이드:
 *    - 충돌 감지 로직 변경 시: checkScheduleConflict 호출 부분 및 결과 처리 로직 수정.
 *    - 데이터 생성 방식 변경 시: apiRequestUtils.js 내 관련 함수 또는 이 파일의 데이터 생성 부분 수정.
 *    - 성공/실패 메시지 포맷 변경 시: 반환되는 message 문자열 구성 로직 수정.
 *
 * 📝 참고사항:
 *    - 프로필 탭에서는 PUT 요청을 통해 전체 스케줄을 업데이트하는 방식을 사용.
 *    - 다른 탭에서는 각 날짜별로 POST 요청을 개별적으로 보냄.
 *
 * ===================================================================================================
 */

import { useCallback } from 'react';
import { auth } from '../../../config/firebaseConfig';
import { API_BASE_URL } from '../constants/apiConstants';
import { checkScheduleConflict, findAvailableTimeSlots } from '../../../utils';
import { createGoogleEventData, createLocalEventData, createProfilePersonalTime } from '../utils/apiRequestUtils';
import { calculateDuration, timeToHour } from '../utils/dateUtils';
import { createConflictMessage, createSuccessResponse, createErrorResponse } from '../utils/responseUtils';

/**
 * useRecurringEventAdd
 *
 * @description 챗봇을 통해 여러 날짜에 반복되는 일정을 추가하는 로직을 관리하는 커스텀 훅.
 * @param {Object} eventActions - 일정 관련 액션 함수들이 포함된 객체 (예: addEvent).
 * @param {Function} setEventAddedKey - 일정 추가 후 상위 컴포넌트의 리렌더링을 유발하기 위한 상태 설정 함수.
 * @returns {{handleRecurringEventAdd: Function}} AI 응답과 컨텍스트를 받아 반복 일정을 추가하는 handleRecurringEventAdd 함수를 포함하는 객체.
 */
export const useRecurringEventAdd = (eventActions, setEventAddedKey) => {
  /**
   * handleRecurringEventAdd
   *
   * @description AI 응답에 포함된 여러 날짜에 대해 일정을 추가합니다. 충돌 발생 시 대안 시간을 제안합니다.
   * @param {Object} chatResponse - AI가 파싱한 dates, startTime, endTime, title 등이 포함된 객체.
   * @param {Object} context - 현재 탭('profile', 'events') 및 탭 타입('local', 'google'), 현재 이벤트 목록 정보.
   * @returns {Promise<Object>} 작업 성공 여부, 메시지, 대안 시간 등을 담은 결과 객체를 반환합니다.
   *
   * @example
   * const { handleRecurringEventAdd } = useRecurringEventAdd(actions, setKey);
   * const result = await handleRecurringEventAdd(chatResponse, context);
   */
  const handleRecurringEventAdd = useCallback(async (chatResponse, context) => {
    if (!eventActions || !eventActions.addEvent) {
      return { success: false, message: '일정 추가 기능이 아직 준비되지 않았습니다.' };
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, message: 'Google 계정 인증이 필요합니다.' };
    }

    try {
      let successCount = 0;
      let failCount = 0;
      const errors = [];

      // 프로필 탭의 경우 한 번에 모든 날짜 추가
      if (context.context === 'profile' && context.tabType === 'local') {
        const currentScheduleResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
          headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` }
        });
        const currentSchedule = await currentScheduleResponse.json();

        const conflictDates = [];
        const newPersonalTimes = [];
        const durationMinutes = calculateDuration(chatResponse.startTime, chatResponse.endTime);
        const requestedTimeHour = timeToHour(chatResponse.startTime);

        // 각 날짜별로 충돌 체크
        for (const date of chatResponse.dates) {
          const startDateTime = new Date(`${date}T${chatResponse.startTime}:00+09:00`);
          const endDateTime = new Date(`${date}T${chatResponse.endTime}:00+09:00`);

          // 해당 날짜의 기존 일정만 수집 (scheduleExceptions + personalTimes)
          const existingEvents = [
            ...(currentSchedule.scheduleExceptions || [])
              .filter(exc => exc.specificDate === date)
              .map(exc => ({
                startTime: exc.startTime,
                endTime: exc.endTime,
                title: exc.title
              })),
            ...(currentSchedule.personalTimes || [])
              .filter(pt => pt.specificDate === date)
              .map(pt => {
                const ptStartDateTime = new Date(`${pt.specificDate}T${pt.startTime}:00+09:00`);
                const ptEndDateTime = new Date(`${pt.specificDate}T${pt.endTime}:00+09:00`);
                return {
                  startTime: ptStartDateTime.toISOString(),
                  endTime: ptEndDateTime.toISOString(),
                  title: pt.title
                };
              })
          ];

          // 1단계: 정확히 동일한 일정이 이미 있는지 체크 (중복 방지)
          const exactDuplicate = existingEvents.find(evt => {
            const evtStart = new Date(evt.startTime);
            const evtEnd = new Date(evt.endTime);
            return evtStart.getTime() === startDateTime.getTime() &&
                   evtEnd.getTime() === endDateTime.getTime() &&
                   evt.title === (chatResponse.title || '일정');
          });

          if (exactDuplicate) {
            conflictDates.push({
              date,
              conflictWith: '동일한 일정이 이미 존재합니다',
              alternatives: []
            });
            failCount++;
            continue;
          }

          // 2단계: 시간 충돌 체크
          const { hasConflict, conflicts } = checkScheduleConflict(
            startDateTime.toISOString(),
            endDateTime.toISOString(),
            existingEvents
          );

          if (hasConflict) {
            // 충돌 발생 - 대안 시간 찾기
            const availableSlots = findAvailableTimeSlots(date, existingEvents, durationMinutes, requestedTimeHour);

            conflictDates.push({
              date,
              conflictWith: conflicts[0]?.title || '기존 일정',
              alternatives: availableSlots.slice(0, 2)
            });
            failCount++;
          } else {
            // 충돌 없으면 personalTimes에 추가 (빨간색)
            const newEvent = createProfilePersonalTime(chatResponse, date);
            newPersonalTimes.push(newEvent);

            // existingEvents에도 추가하여 같은 요청 내에서 중복 방지
            existingEvents.push({
              startTime: startDateTime.toISOString(),
              endTime: endDateTime.toISOString(),
              title: newEvent.title
            });

            successCount++;
          }
        }

        // 기존 personalTimes에 id가 없는 경우 생성
        const existingPersonalTimes = (currentSchedule.personalTimes || []).map((pt, idx) => {
          if (!pt.id) {
            return { ...pt, id: Date.now() + idx };
          }
          return pt;
        });

        const allPersonalTimes = [
          ...existingPersonalTimes,
          ...newPersonalTimes
        ];

        const response = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await currentUser.getIdToken()}`
          },
          body: JSON.stringify({
            defaultSchedule: currentSchedule.defaultSchedule || [],
            scheduleExceptions: currentSchedule.scheduleExceptions || [],
            personalTimes: allPersonalTimes
          })
        });

        if (response.ok && newPersonalTimes.length > 0) {
          const responseData = await response.json();
          window.dispatchEvent(new CustomEvent('calendarUpdate', {
            detail: {
              type: 'add',
              data: responseData,
              context: 'profile',
              isRecurring: true,
              datesCount: newPersonalTimes.length
            }
          }));
        } else if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          errors.push(`프로필 스케줄 업데이트 실패: ${errorData.msg || response.statusText}`);
        }

        if (conflictDates.length > 0) {
          return {
            ...createConflictMessage(successCount, failCount, conflictDates, chatResponse.title, chatResponse.startTime),
            data: chatResponse
          };
        }
      } else {
        // Google 캘린더와 나의 일정 탭은 각 날짜별로 개별 추가
        const conflictDates = [];

        for (const date of chatResponse.dates) {
          try {
            const events = context.currentEvents || [];
            const startDateTime = `${date}T${chatResponse.startTime}:00+09:00`;
            const endDateTime = `${date}T${chatResponse.endTime}:00+09:00`;
            const { hasConflict, conflicts } = checkScheduleConflict(startDateTime, endDateTime, events);

            if (hasConflict) {
              conflictDates.push({
                date,
                conflictWith: conflicts[0]?.summary || conflicts[0]?.title || '기존 일정'
              });
              failCount++;
              continue;
            }

            let eventData;
            let apiEndpoint;

            eventData = createLocalEventData(chatResponse, date);
            apiEndpoint = `${API_BASE_URL}/api/events`;

            const response = await fetch(apiEndpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await currentUser.getIdToken()}`
              },
              body: JSON.stringify(eventData)
            });

            if (response.ok) {
              successCount++;
            } else {
              failCount++;
              errors.push(`${date}: ${response.statusText}`);
            }
          } catch (dateError) {
            failCount++;
            errors.push(`${date}: ${dateError.message}`);
          }
        }

        if (conflictDates.length > 0) {
          const durationMinutes = calculateDuration(chatResponse.startTime, chatResponse.endTime);
          const requestedTimeHour = timeToHour(chatResponse.startTime);
          const allAlternatives = [];

          for (const conflictInfo of conflictDates) {
            const events = context.currentEvents || [];
            const availableSlots = findAvailableTimeSlots(conflictInfo.date, events, durationMinutes, requestedTimeHour);
            if (availableSlots.length > 0) {
              allAlternatives.push({
                date: conflictInfo.date,
                conflictWith: conflictInfo.conflictWith,
                alternatives: availableSlots.slice(0, 2)
              });
            }
          }

          if (conflictDates.length > 0) {
            let conflictMessage = `\n\n⚠️ ${conflictDates.length}일은 ${chatResponse.startTime}에 이미 일정이 있어서 건너뛰었어요:\n`;
            if (allAlternatives.length > 0) {
              allAlternatives.forEach(alt => {
                conflictMessage += `\n📅 ${alt.date} - "${alt.conflictWith}"과(와) 겹침\n`;
                conflictMessage += `   추천 시간: `;
                alt.alternatives.forEach((slot, idx) => {
                  conflictMessage += `${slot.start}-${slot.end}`;
                  if (idx < alt.alternatives.length - 1) conflictMessage += ', ';
                });
              });
            } else {
              conflictDates.forEach(conflict => {
                conflictMessage += `\n📅 ${conflict.date} - "${conflict.conflictWith}"과(와) 겹침`;
              });
              conflictMessage += `\n빈 시간을 찾을 수 없습니다.`;
            }

            return {
              success: successCount > 0,
              message: successCount > 0
                ? `${chatResponse.title || '일정'}을 ${successCount}일간 추가했어요!${conflictMessage}`
                : `모든 날짜에서 충돌이 발생했습니다.${conflictMessage}`,
              data: chatResponse,
              suggestedTimes: allAlternatives.length > 0 ? allAlternatives.flatMap(alt =>
                alt.alternatives.map(slot => ({
                  date: alt.date,
                  start: slot.start,
                  end: slot.end
                }))
              ) : undefined
            };
          }
        }
      }

      if (!(context.context === 'profile' && context.tabType === 'local')) {
        setEventAddedKey(prevKey => prevKey + 1);
        window.dispatchEvent(new Event('calendarUpdate'));
      } else {
        setEventAddedKey(prevKey => prevKey + 1);
      }

      if (successCount > 0 && failCount === 0) {
        return {
          success: true,
          message: `${chatResponse.title || '일정'}을 ${successCount}일간 추가했어요!`,
          data: chatResponse
        };
      } else if (successCount > 0 && failCount > 0) {
        return {
          success: true,
          message: `${successCount}일 추가 성공, ${failCount}일 실패했습니다.`,
          data: chatResponse
        };
      } else {
        return {
          success: false,
          message: `일정 추가에 실패했습니다. ${errors[0] || ''}`,
          data: chatResponse
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `반복 일정 추가 중 오류가 발생했습니다: ${error.message}`,
        data: chatResponse
      };
    }
  }, [eventActions, setEventAddedKey]);

  return { handleRecurringEventAdd };
};
