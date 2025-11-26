// calendarUpdate 이벤트 처리 훅

import { useEffect } from 'react';
import { getKoreanLocalDate } from '../utils/dateFormatter';

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
