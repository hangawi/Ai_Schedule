/**
 * ===================================================================================================
 * usePreferredTimeAdd.js - 챗봇을 통해 선호시간을 추가하는 커스텀 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/hooks/useChat/hooks/enhanced/usePreferredTimeAdd.js
 *
 * 🎯 주요 기능:
 *    - 챗봇의 AI 응답(intent: add_preferred_time)을 기반으로 사용자 선호시간을 추가.
 *    - AI가 추출한 날짜, 시간, 우선순위 정보를 파싱하여 API 요청 데이터 생성.
 *    - 우선순위가 지정되지 않은 경우 '선호'(priority: 3)를 기본값으로 설정.
 *    - '/api/users/profile/schedule' 엔드포인트로 선호시간 데이터를 전송.
 *    - 작업 완료 후 'calendarUpdate' 이벤트를 발생시켜 캘린더 UI를 갱신.
 *
 * 🔗 연결된 파일:
 *    - client/src/hooks/useChat/enhanced.js: 이 훅을 사용하여 'add_preferred_time' 인텐트 처리 로직을 구성.
 *    - client/src/config/firebaseConfig.js: Firebase auth를 통해 현재 사용자 정보를 가져옴.
 *
 * 💡 UI 위치:
 *    - 직접적인 UI 요소는 없으나, 채팅창을 통한 선호시간 추가 기능의 핵심 로직.
 *
 * ✏️ 수정 가이드:
 *    - API 엔드포인트 변경 시: `apiUrl` 변수를 수정.
 *    - 기본 우선순위 값 변경 시: `handlePreferredTimeAdd` 함수 내 `priority` 기본값을 수정.
 *    - API 요청 데이터 구조 변경 시: `requestData` 객체의 구조를 백엔드에 맞게 수정.
 *
 * 📝 참고사항:
 *    - 이 훅은 선호시간을 '개인일정'이 아닌 '프로필 선호시간(defaultSchedule)'으로 저장합니다.
 *    - 챗봇을 통한 빠른 시간 추가를 목적으로 하며, 복잡한 반복 설정은 지원하지 않습니다.
 *    - `setEventAddedKey`를 통해 상위 컴포넌트의 상태를 업데이트하여 리렌더링을 유발할 수 있습니다.
 *
 * ===================================================================================================
 */
import { useCallback } from 'react';
import { auth } from '../../../../config/firebaseConfig';

/**
 * usePreferredTimeAdd
 *
 * @description 챗봇을 통해 선호시간을 추가하는 로직을 관리하는 커스텀 훅.
 * @param {Function} setEventAddedKey - 이벤트(선호시간) 추가 후 상위 컴포넌트의 리렌더링을 유발하기 위한 상태 설정 함수.
 * @returns {{handlePreferredTimeAdd: Function}} AI 응답을 받아 선호시간을 추가하는 `handlePreferredTimeAdd` 함수를 포함하는 객체.
 *
 * @example
 * const { handlePreferredTimeAdd } = usePreferredTimeAdd(setSomeKey);
 * // enhanced.js 등에서 라우터를 통해 호출됨
 * // await handlePreferredTimeAdd(chatResponse, context);
 */
export const usePreferredTimeAdd = (setEventAddedKey) => {
  /**
   * handlePreferredTimeAdd
   * @description AI 응답(chatResponse)을 분석하여 사용자의 선호시간을 서버에 추가합니다.
   * @param {Object} chatResponse - AI가 파싱한 사용자 의도 및 시간 정보가 담긴 객체.
   * @param {Object} context - 현재 채팅 및 사용자 컨텍스트 정보.
   * @returns {Promise<Object>} 성공 여부와 메시지를 담은 결과 객체를 반환합니다.
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

      // API 요청 데이터 구성 (버튼 추가와 동일하게 defaultSchedule에 저장)
      console.log('🔵 [선호시간 추가] 시작:', { startDateTime, endDateTime, priority: validPriority });
      
      const requestData = {
        defaultSchedule: [{
          dayOfWeek: start.getDay(),
          startTime: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
          endTime: `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`,
          priority: validPriority,
          specificDate: dateStr
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