/**
 * ===================================================================================================
 * useCalendarUpdate.js - 'calendarUpdate' 전역 이벤트 처리 커스텀 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/ProfileTab/hooks/useCalendarUpdate.js
 *
 * 🎯 주요 기능:
 *    - `window` 객체에 등록된 'calendarUpdate' 커스텀 이벤트를 감지(listen)하고 처리.
 *    - 다른 컴포넌트(주로 챗봇)에서 발생한 스케줄 변경 사항을 '내 프로필' 탭의 상태와 동기화.
 *    - 이벤트의 상세 내용(`event.detail`)을 분석하여 다양한 시나리오에 맞게 상태를 업데이트.
 *      - 단순 새로고침: 대부분의 경우 `fetchSchedule`을 호출하여 서버로부터 최신 데이터를 받아옴.
 *      - 챗봇 응답 처리: 챗봇을 통해 일정이 추가된 경우, API 재요청 없이 이벤트에 포함된 데이터로 직접 상태를 업데이트하여 성능을 최적화.
 *
 * 🔗 연결된 파일:
 *    - ../index.js (ProfileTab) - 이 훅을 사용하여 전역 이벤트를 구독.
 *    - ../../ChatBox.js (및 관련 훅) - 'calendarUpdate' 이벤트를 발생시키는 주요 컴포넌트.
 *
 * 💡 UI 위치:
 *    - 이 훅 자체는 UI가 없으나, '내 프로필' 탭의 데이터 동기화를 책임지는 핵심 로직입니다.
 *
 * ✏️ 수정 가이드:
 *    - 새로운 종류의 'calendarUpdate' 이벤트를 추가하려면 `handleCalendarUpdate` 함수 내에 `if` 분기문을 추가해야 합니다.
 *    - 챗봇을 통한 일정 추가 후의 클라이언트 상태 업데이트 방식을 변경하려면 `event.detail.type === 'add' && event.detail.chatResponse` 블록을 수정합니다.
 *
 * 📝 참고사항:
 *    - 이 훅은 `useEffect`를 사용하여 컴포넌트 마운트 시 이벤트 리스너를 등록하고, 언마운트 시 자동으로 제거합니다.
 *    - `isEditing && wasCleared` 조건문은 사용자가 '전체 초기화'를 누른 직후 챗봇으로 일정을 추가하는 특수한 예외 케이스를 처리하기 위한 로직입니다.
 *    - 전역 이벤트를 사용하는 것은 컴포넌트 간의 깊은 의존성 없이 상태를 동기화하기 위한 아키텍처 패턴 중 하나입니다.
 *
 * ===================================================================================================
 */

import { useEffect } from 'react';
import { getKoreanLocalDate } from '../utils/dateFormatter';

/**
 * useCalendarUpdate
 * @description 'calendarUpdate' 전역 이벤트를 수신하여 '내 프로필' 탭의 스케줄 상태를 동기화하는 훅.
 * @param {function} fetchSchedule - 서버에서 스케줄 데이터를 다시 가져오는 함수.
 * @param {boolean} isEditing - 현재 편집 모드인지 여부.
 * @param {boolean} wasCleared - '전체 초기화'가 방금 실행되었는지 여부.
 * @param {function} setPersonalTimes - 개인시간 상태를 업데이트하는 함수.
 * @param {function} setScheduleExceptions - 예외 스케줄 상태를 업데이트하는 함수.
 * @param {function} setDefaultSchedule - 기본 스케줄 상태를 업데이트하는 함수.
 */
export const useCalendarUpdate = (
  fetchSchedule,
  isEditing,
  wasCleared,
  setPersonalTimes,
  setScheduleExceptions,
  setDefaultSchedule
) => {
  useEffect(() => {
    const handleCalendarUpdate = async (event) => {
      // 🆕 선호시간 추가인 경우
      if (event.detail && event.detail.type === 'add_preferred_time' && event.detail.context === 'profile') {
        fetchSchedule();
        return;
      }

      // 🆕 반복 선호시간 추가인 경우
      if (event.detail && event.detail.type === 'add_recurring_preferred_time' && event.detail.context === 'profile') {
        fetchSchedule();
        return;
      }

      // 🆕 개인시간 추가인 경우
      if (event.detail && event.detail.type === 'add_personal_time' && event.detail.context === 'profile') {
        fetchSchedule();
        return;
      }

      // 범위 삭제인 경우
      if (event.detail && event.detail.type === 'delete_range') {
        fetchSchedule();
        return;
      }

      // 단일 일정 삭제인 경우
      if (event.detail && event.detail.type === 'delete' && event.detail.context === 'profile') {
        fetchSchedule();
        return;
      }

      // 시간표 추가인 경우
      if (event.detail && event.detail.type === 'schedule_added' && event.detail.context === 'profile') {
        fetchSchedule();
        return;
      }

      // 반복 일정 추가인 경우
      if (event.detail && event.detail.isRecurring && event.detail.context === 'profile') {
        fetchSchedule();
        return;
      }

      // 충돌 해결 후 일정 추가인 경우 (간단한 새로고침)
      if (event.detail && event.detail.type === 'add' && event.detail.context === 'profile' && !event.detail.chatResponse) {
        fetchSchedule();
        return;
      }

      // 일정 수정인 경우
      if (event.detail && event.detail.type === 'edit' && event.detail.context === 'profile') {
        fetchSchedule();
        return;
      }

      // 챗봇에서 추가한 일정인 경우
      if (event.detail && event.detail.type === 'add' && event.detail.chatResponse && event.detail.data) {
        // 편집 모드이고 초기화 상태인 경우, 서버 응답의 기존 데이터를 무시하고
        // 챗봇이 방금 추가한 항목만 추가
        if (isEditing && wasCleared) {
          const { chatResponse } = event.detail;

          // 챗봇이 추가한 새 항목은 personalTimes에 추가
          if (chatResponse.startDateTime && chatResponse.endDateTime) {
            const startDateTime = new Date(chatResponse.startDateTime);
            const endDateTime = new Date(chatResponse.endDateTime);

            const localDate = getKoreanLocalDate(startDateTime);

            // 챗봇으로 추가한 일정은 personalTimes(개인시간)에 추가
            const newPersonalTime = {
              id: `temp_${Date.now()}`,
              title: chatResponse.title || '챗봇 일정',
              type: 'event',
              startTime: `${String(startDateTime.getHours()).padStart(2, '0')}:${String(startDateTime.getMinutes()).padStart(2, '0')}`,
              endTime: `${String(endDateTime.getHours()).padStart(2, '0')}:${String(endDateTime.getMinutes()).padStart(2, '0')}`,
              days: [],
              isRecurring: false,
              specificDate: localDate,
              color: '#ef4444' // 빨간색
            };

            // personalTimes에 새 항목만 추가 (서버 데이터 무시)
            setPersonalTimes(prev => [...prev, newPersonalTime]);
          }
        } else {
          // 일반적인 경우: 서버 응답 데이터로 직접 업데이트
          const { data } = event.detail;

          if (data.personalTimes) {
            setPersonalTimes([...data.personalTimes]);
          }

          if (data.scheduleExceptions) {
            setScheduleExceptions(data.scheduleExceptions);
          }

          if (data.defaultSchedule) {
            setDefaultSchedule(data.defaultSchedule);
          }
        }
      } else if (!isEditing) {
        // 편집 모드가 아니고 일반 이벤트인 경우 전체 새로고침
        fetchSchedule();
      }
    };

    window.addEventListener('calendarUpdate', handleCalendarUpdate);
    return () => {
      window.removeEventListener('calendarUpdate', handleCalendarUpdate);
    };
  }, [fetchSchedule, isEditing, wasCleared, setPersonalTimes, setScheduleExceptions, setDefaultSchedule]);
};
