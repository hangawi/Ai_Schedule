/**
 * ============================================================================
 * useRecurringPreferredTimeAdd - 반복 선호시간 추가 훅 (신규 기능!)
 * ============================================================================
 *
 * 기능:
 * - "이번달 전부", "매주 월요일" 같은 반복 패턴 지원
 * - 선호시간으로 여러 날짜에 동시 추가
 *
 * 사용 예시:
 * - "이번달 전부 9-12시 선호시간으로" → 이번 달 모든 날짜
 * - "이번달 월요일 전부 9-12시 보통으로" → 이번 달 모든 월요일
 * - "매주 월요일 9-12시 선호시간으로" → 매주 월요일 반복
 * ============================================================================
 */

import { useCallback } from 'react';
import { auth } from '../../../../config/firebaseConfig';

export const useRecurringPreferredTimeAdd = (setEventAddedKey) => {
  /**
   * 반복 선호시간 추가 핸들러
   * @param {Object} chatResponse - AI 응답
   * @param {Object} context - 컨텍스트 정보
   * @returns {Object} 처리 결과
   */
  const handleRecurringPreferredTimeAdd = useCallback(async (chatResponse, context) => {
    try {
      const {
        startTime,
        endTime,
        dates = [],
        priority = 3, // 디폴트: 선호(3)
        title = '선호시간',
        response
      } = chatResponse;

      // 유효성 검증
      if (!startTime || !endTime) {
        return {
          success: false,
          message: '시작 시간과 종료 시간을 지정해주세요.'
        };
      }

      if (!dates || dates.length === 0) {
        return {
          success: false,
          message: '적용할 날짜를 지정해주세요.'
        };
      }

      // priority 값 검증 (1, 2, 3만 유효)
      const validPriority = [1, 2, 3].includes(priority) ? priority : 3;

      // 각 날짜마다 scheduleException 생성
      const scheduleExceptions = dates.map(dateStr => {
        // startTime과 endTime을 ISO 형식으로 변환
        const [startHour, startMin] = startTime.split(':');
        const [endHour, endMin] = endTime.split(':');

        const [year, month, day] = dateStr.split('-').map(Number);

        const startDateTime = new Date(year, month - 1, day, parseInt(startHour), parseInt(startMin), 0);
        const endDateTime = new Date(year, month - 1, day, parseInt(endHour), parseInt(endMin), 0);

        return {
          title: title,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          priority: validPriority,
          specificDate: dateStr,
          isFromChat: true,
          isRecurring: true // 반복 일정 표시
        };
      });

      // API 요청 데이터 구성
      const requestData = {
        scheduleExceptions: scheduleExceptions
      };

      // 서버에 저장
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('로그인이 필요합니다.');
      }

      const apiUrl = context.context === 'profile'
        ? '/api/users/profile/schedule'
        : '/api/events';

      const serverResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await currentUser.getIdToken()}`
        },
        body: JSON.stringify(requestData)
      });

      if (!serverResponse.ok) {
        throw new Error('서버 저장 실패');
      }

      const savedData = await serverResponse.json();

      // 중복 체크
      if (savedData.isDuplicate) {
        return {
          success: true,
          message: '해당 시간은 이미 추가되어 있어요!',
          data: savedData
        };
      }

      // 달력 업데이트 이벤트 발생
      window.dispatchEvent(new CustomEvent('calendarUpdate', {
        detail: {
          type: 'add_recurring_preferred_time',
          context: context.context,
          chatResponse: chatResponse,
          data: savedData
        }
      }));

      // 이벤트 갱신
      if (setEventAddedKey) {
        setEventAddedKey(prev => prev + 1);
      }

      // 우선순위 레이블 변환
      const priorityLabel = {
        3: '선호',
        2: '보통',
        1: '조정 가능'
      }[validPriority];

      return {
        success: true,
        message: response || `${dates.length}일에 ${priorityLabel} 시간을 추가했어요!`,
        data: savedData
      };

    } catch (error) {
      console.error('[반복 선호시간 추가 오류]', error);
      return {
        success: false,
        message: `오류가 발생했습니다: ${error.message}`
      };
    }
  }, [setEventAddedKey]);

  return { handleRecurringPreferredTimeAdd };
};
