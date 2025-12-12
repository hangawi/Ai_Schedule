/**
 * ===================================================================================================
 * usePersonalTimeAdd.js - 사용자의 요청에 따라 개인시간(불가능한 시간)을 추가하는 커스텀 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/hooks/useChat/hooks/enhanced/usePersonalTimeAdd.js
 *
 * 🎯 주요 기능:
 *    - 챗봇을 통해 사용자로부터 개인시간 추가 요청을 받습니다.
 *    - 시작 시간 (`startDateTime`)과 종료 시간 (`endDateTime`)을 파싱하여 개인시간 데이터를 구성합니다.
 *    - 개인시간은 캘린더에 빨간색으로 표시되며, 다른 일정과의 조율 불가능한 시간으로 처리됩니다.
 *    - Firebase 인증을 통해 현재 로그인된 사용자의 ID 토큰을 사용하여 백엔드 API (`/api/users/profile/schedule`)에 개인시간을 저장합니다.
 *    - 저장 후 `calendarUpdate` 이벤트를 발생시켜 캘린더 UI를 갱신합니다.
 *
 * 🔗 연결된 파일:
 *    - ../../enhancedIntentHandlers.js - 이 훅의 `handlePersonalTimeAdd` 함수를 호출하는 강화된 인텐트 핸들러.
 *    - ../../useChat/enhanced.js - `useChatEnhanced` 훅에서 이 훅을 사용합니다.
 *    - ../../../config/firebaseConfig.js - Firebase 인증 모듈 (`auth`)을 가져옵니다.
 *    - client/src/components/profile/PersonalInfoEdit.js - 프로필 탭에서 개인시간이 표시되고 관리될 수 있습니다.
 *    - server/routes/profile.js, server/controllers/userController.js - 개인시간 저장 관련 백엔드 API.
 *
 * 💡 UI 위치:
 *    - 채팅창을 통해 명령어가 입력될 때 (예: "내일 오전 불가능한 시간으로 해줘")
 *    - 프로필 탭의 개인시간 설정 영역에 추가된 시간이 표시됩니다.
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 챗봇을 통한 개인시간 추가 로직 및 캘린더에 개인시간이 표시되는 방식이 변경됩니다.
 *    - 개인시간 저장 API 엔드포인트 변경: `apiUrl` 변수 값을 수정합니다.
 *    - 개인시간의 기본 색상 변경: `color` 필드의 헥스 코드를 수정합니다.
 *    - 개인시간 데이터 유효성 검증 로직 추가/변경: `if (!startDateTime || !endDateTime)` 블록을 수정합니다.
 *
 * 📝 참고사항:
 *    - `setEventAddedKey`는 캘린더 컴포넌트의 리렌더링을 트리거하여 UI를 업데이트하는 데 사용됩니다.
 *    - 개인시간은 항상 사용자의 프로필 스케줄에 저장되며, 이는 `일정맞추기` 기능에서 다른 멤버들에게도 불가능한 시간으로 조회될 수 있습니다.
 *    - 중복된 개인시간 요청에 대한 기본적인 처리 로직이 포함되어 있습니다.
 *
 * ===================================================================================================
 */

import { useCallback } from 'react';
import { auth } from '../../../../config/firebaseConfig';

/**
 * usePersonalTimeAdd
 *
 * @description 챗봇을 통해 사용자로부터 개인시간(다른 사람과 일정을 조율할 수 없는 시간) 추가 요청을 받아 처리하는 커스텀 훅.
 *              이 훅은 Firebase 인증을 통해 현재 사용자를 식별하고, 개인시간 데이터를 백엔드 API에 저장합니다.
 * @param {Function} setEventAddedKey - 캘린더 UI를 갱신하기 위한 상태 업데이트 함수. 이 함수를 호출하여 캘린더 컴포넌트의 리렌더링을 유도합니다.
 * @returns {Object} { handlePersonalTimeAdd } - 개인시간 추가 로직을 실행하는 비동기 함수 `handlePersonalTimeAdd`를 반환합니다.
 *
 * @example
 * // 컴포넌트 내에서 usePersonalTimeAdd 훅 사용 예시
 * const { handlePersonalTimeAdd } = usePersonalTimeAdd(setEventAddedKey);
 * // AI 응답에 따라 개인시간 추가 처리
 * const result = await handlePersonalTimeAdd(chatResponse, { context: 'profile' });
 *
 * @note
 * - 이 훅은 `useCallback`으로 `handlePersonalTimeAdd` 함수를 감싸 메모이제이션하여 불필요한 재생성을 방지합니다.
 * - 개인시간은 주로 `profile` 탭에서 관리되며, `coordination` 탭에서 다른 멤버들의 일정을 조율할 때 고려됩니다.
 * - API 호출 시 사용자의 인증 토큰이 필요하므로, 사용자 로그인 상태가 필수적입니다.
 */
export const usePersonalTimeAdd = (setEventAddedKey) => {
  /**
   * handlePersonalTimeAdd
   *
   * @description AI 모델이 파악한 `chatResponse`를 기반으로 개인시간을 생성하고,
   *              백엔드 API를 통해 서버에 저장합니다.
   *              저장 성공 시, 캘린더 업데이트 이벤트를 발생시켜 UI를 갱신합니다.
   * @param {Object} chatResponse - AI 모델로부터 파싱된 응답 객체. `startDateTime`, `endDateTime`, `title` 등의 필드를 포함해야 합니다.
   * @param {Object} context - 현재 애플리케이션의 상태 및 사용자 컨텍스트.
   * @returns {Promise<Object>} 개인시간 추가 처리 결과를 포함하는 객체를 반환합니다 (성공 여부, 메시지, 데이터 등).
   *
   * @example
   * // 사용 예시 (createEnhancedIntentRouter 내부에서 호출됨)
   * const result = await handlePersonalTimeAdd(
   *   { intent: 'add_personal_time', startDateTime: '...', endDateTime: '...' },
   *   currentContext
   * );
   *
   * @note
   * - `startDateTime`과 `endDateTime`이 없는 경우, 유효성 검증에 실패하여 에러 메시지를 반환합니다.
   * - 개인시간은 빨간색(`'#ef4444'`)으로 표시되며, `isFromChat: true` 플래그를 가집니다.
   * - API 엔드포인트는 항상 `/api/users/profile/schedule`로 고정되어, 사용자의 프로필에 직접 저장됩니다.
   * - 서버 응답에 `isDuplicate`가 true로 오면, 중복된 시간으로 간주하고 성공 메시지를 반환합니다.
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
        id: Date.now(),
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
