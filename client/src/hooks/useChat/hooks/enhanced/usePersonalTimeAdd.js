/**
 * ============================================================================
 * usePersonalTimeAdd - 개인시간(불가능한 시간) 추가 훅
 * ============================================================================
 *
 * 기능:
 * - 챗봇으로 개인시간(불가능한 시간) 추가
 * - 빨간색 영역으로 표시됨
 * - 조율 불가능한 시간으로 처리
 *
 * 사용 예시:
 * - "12월 5일 9-12시 개인시간으로 해줘"
 * - "내일 오전 불가능한 시간으로 해줘"
 * ============================================================================
 */

import { useCallback } from 'react';
import { auth } from '../../../../config/firebaseConfig';

export const usePersonalTimeAdd = (setEventAddedKey) => {
  /**
   * 개인시간 추가 핸들러
   * @param {Object} chatResponse - AI 응답
   * @param {Object} context - 컨텍스트 정보
   * @returns {Object} 처리 결과
   */
  const handlePersonalTimeAdd = useCallback(async (chatResponse, context) => {
    try {
      const {
        startDateTime,
        endDateTime,
        title = '개인시간',
        response
      } = chatResponse;

      // 유효성 검증
      if (!startDateTime || !endDateTime) {
        return {
          success: false,
          message: '시작 시간과 종료 시간을 지정해주세요.'
        };
      }

      // 날짜 및 시간 파싱
      const start = new Date(startDateTime);
      const end = new Date(endDateTime);

      // 로컬 날짜 문자열 생성 (YYYY-MM-DD)
      const year = start.getFullYear();
      const month = String(start.getMonth() + 1).padStart(2, '0');
      const day = String(start.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      // PersonalTime 데이터 구성
      const personalTime = {
        id: `chat_${Date.now()}`,
        title: title,
        type: 'event',
        startTime: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
        endTime: `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`,
        days: [],
        isRecurring: false,
        specificDate: dateStr,
        color: '#ef4444', // 빨간색
        isFromChat: true
      };

      // API 요청 데이터 구성
      const requestData = {
        personalTimes: [personalTime]
      };

      // 서버에 저장
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('로그인이 필요합니다.');
      }

      // 개인시간은 항상 프로필에 저장 (일정맞추기에서 조회 가능하도록)
      const apiUrl = '/api/users/profile/schedule';

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
          type: 'add_personal_time',
          context: context.context,
          chatResponse: chatResponse,
          data: savedData
        }
      }));

      // 이벤트 갱신
      if (setEventAddedKey) {
        setEventAddedKey(prev => prev + 1);
      }

      return {
        success: true,
        message: response || '개인시간을 추가했어요!',
        data: savedData
      };

    } catch (error) {
      console.error('[개인시간 추가 오류]', error);
      return {
        success: false,
        message: `오류가 발생했습니다: ${error.message}`
      };
    }
  }, [setEventAddedKey]);

  return { handlePersonalTimeAdd };
};
