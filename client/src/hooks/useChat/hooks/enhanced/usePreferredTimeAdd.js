/**
 * ============================================================================
 * usePreferredTimeAdd - 선호시간 추가 훅 (신규 기능!)
 * ============================================================================
 *
 * 기능:
 * - 챗봇으로 선호시간 추가
 * - 우선순위 자동 판단 (선호=3, 보통=2, 조정가능=1)
 * - 미지정 시 디폴트: 선호(3)
 *
 * 사용 예시:
 * - "12월 5일 9-12시 선호시간으로 해줘" → priority: 3
 * - "12월 5일 9-12시 보통으로 해줘" → priority: 2
 * - "12월 5일 9-12시" (우선순위 미지정) → priority: 3 (디폴트)
 * ============================================================================
 */

import { useCallback } from 'react';
import { auth } from '../../../../config/firebaseConfig';

export const usePreferredTimeAdd = (setEventAddedKey) => {
  /**
   * 선호시간 추가 핸들러
   * @param {Object} chatResponse - AI 응답
   * @param {Object} context - 컨텍스트 정보
   * @returns {Object} 처리 결과
   */
  const handlePreferredTimeAdd = useCallback(async (chatResponse, context) => {
    try {
      const {
        startDateTime,
        endDateTime,
        priority = 3, // 디폴트: 선호(3)
        title, // title은 사용하지 않음 (버튼 추가와 동일하게)
        response
      } = chatResponse;

      // 유효성 검증
      if (!startDateTime || !endDateTime) {
        return {
          success: false,
          message: '시작 시간과 종료 시간을 지정해주세요.'
        };
      }

      // priority 값 검증 (1, 2, 3만 유효)
      const validPriority = [1, 2, 3].includes(priority) ? priority : 3;

      // 날짜 및 시간 파싱
      const start = new Date(startDateTime);
      const end = new Date(endDateTime);

      // 로컬 날짜 문자열 생성 (YYYY-MM-DD)
      const year = start.getFullYear();
      const month = String(start.getMonth() + 1).padStart(2, '0');
      const day = String(start.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      // API 요청 데이터 구성 (title 제거 - 버튼 추가와 동일하게)
      const requestData = {
        scheduleExceptions: [{
          startTime: startDateTime,
          endTime: endDateTime,
          priority: validPriority,
          specificDate: dateStr,
          isFromChat: true // 챗봇에서 추가된 것 표시
        }]
      };

      // 서버에 저장 (profile 또는 events 탭에 따라)
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('로그인이 필요합니다.');
      }

      // 선호시간은 항상 프로필에 저장 (일정맞추기에서 조회 가능하도록)
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

      console.log('✅ [선호시간 추가] 서버 응답:', savedData);
      console.log('✅ [선호시간 추가] 요청 데이터:', requestData);

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
          type: 'add_preferred_time',
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
        message: response || `${priorityLabel} 시간을 추가했어요!`,
        data: savedData
      };

    } catch (error) {
      console.error('[선호시간 추가 오류]', error);
      return {
        success: false,
        message: `오류가 발생했습니다: ${error.message}`
      };
    }
  }, [setEventAddedKey]);

  return { handlePreferredTimeAdd };
};
