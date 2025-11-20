/**
 * 직접 일정 삭제 훅 (intent: 'delete_specific_event')
 */

import { useCallback } from 'react';
import { auth } from '../../../config/firebaseConfig';
import { API_BASE_URL } from '../constants/apiConstants';

export const useDirectEventDeletion = (setEventAddedKey) => {
  const handleDirectDeletion = useCallback(async (message, context) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, message: '인증 토큰이 없습니다.' };
    }

    try {
      // '나의 일정' 탭의 경우 /api/events 엔드포인트를 사용하여 직접 삭제
      if (context.context === 'events') {
        const eventIdToDelete = message.eventId;
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
        // 기존 '내 프로필' 탭 로직
        const scheduleResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
          headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` }
        });

        if (!scheduleResponse.ok) {
          throw new Error('스케줄 정보를 가져오지 못했습니다.');
        }

        const scheduleData = await scheduleResponse.json();
        const eventIdToDelete = message.eventId;
        let eventTitle = '일정';
        let foundAndSpliced = false;

        // personalTimes에서 찾기
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

        // scheduleExceptions에서 찾기
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

        // 유효한 scheduleExceptions만 필터링
        const cleanedExceptions = (scheduleData.scheduleExceptions || [])
          .filter(exc => exc.startTime && exc.endTime && exc.specificDate)
          .map(exc => ({
            specificDate: exc.specificDate,
            startTime: exc.startTime,
            endTime: exc.endTime,
            title: exc.title || '',
            description: exc.description || ''
          }));

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
      return { success: false, message: `삭제 중 오류 발생: ${error.message}` };
    }
  }, [setEventAddedKey]);

  return { handleDirectDeletion };
};
