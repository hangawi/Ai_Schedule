/**
 * ===================================================================================================
 * useRecurringPreferredTimeAdd.js - 챗봇으로 반복 선호시간을 추가하는 커스텀 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/hooks/useChat/hooks/enhanced/useRecurringPreferredTimeAdd.js
 *
 * 🎯 주요 기능:
 *    - 챗봇의 AI 응답(intent: add_recurring_preferred_time)을 기반으로 여러 날짜에 걸친 선호시간을 추가.
 *    - "매주", "이번 달" 등 AI가 파싱한 반복 날짜(dates)와 여러 시간대(timeRanges)를 처리.
 *    - 각 날짜와 시간대에 대해 선호시간 슬롯을 생성하여 일괄적으로 API에 전송.
 *    - '/api/users/profile/schedule' 엔드포인트를 사용해 사용자의 프로필에 선호시간을 저장.
 *
 * 🔗 연결된 파일:
 *    - client/src/hooks/useChat/enhanced.js: 이 훅을 사용하여 'add_recurring_preferred_time' 인텐트 처리 로직 구성.
 *    - client/src/config/firebaseConfig.js: Firebase auth를 통해 현재 사용자 정보를 가져옴.
 *
 * 💡 UI 위치:
 *    - 직접적인 UI 요소는 없으나, 채팅창을 통한 반복적인 선호시간 추가 기능의 핵심 로직.
 *
 * ✏️ 수정 가이드:
 *    - API 요청 데이터 구조 변경 시: `defaultScheduleSlots` 생성 로직과 `requestData` 객체 구조를 백엔드에 맞게 수정.
 *    - 다중 시간대 처리 로직 변경 시: `timeRangesToProcess` 배열을 구성하는 로직을 수정.
 *
 * 📝 참고사항:
 *    - 단일 시간대(startTime, endTime)와 다중 시간대(timeRanges) 입력을 모두 지원하여 하위 호환성을 가짐.
 *    - 이 훅은 여러 개의 선호시간 슬롯을 한번의 API 호출로 생성하는 역할을 담당.
 *
 * ===================================================================================================
 */
import { useCallback } from 'react';
import { auth } from '../../../../config/firebaseConfig';

/**
 * useRecurringPreferredTimeAdd
 *
 * @description 챗봇을 통해 반복되는 여러 개의 선호시간을 추가하는 로직을 관리하는 커스텀 훅.
 * @param {Function} setEventAddedKey - 이벤트 추가 후 상위 컴포넌트의 리렌더링을 유발하기 위한 상태 설정 함수.
 * @returns {{handleRecurringPreferredTimeAdd: Function}} AI 응답을 받아 반복 선호시간을 추가하는 `handleRecurringPreferredTimeAdd` 함수를 포함하는 객체.
 *
 * @example
 * const { handleRecurringPreferredTimeAdd } = useRecurringPreferredTimeAdd(setSomeKey);
 * // enhanced.js 등에서 라우터를 통해 호출됨
 * // await handleRecurringPreferredTimeAdd(chatResponse, context);
 */
export const useRecurringPreferredTimeAdd = (setEventAddedKey) => {
  /**
   * handleRecurringPreferredTimeAdd
   * @description AI 응답을 분석하여 여러 날짜에 걸친 반복 선호시간을 서버에 추가합니다.
   * @param {Object} chatResponse - AI가 파싱한 사용자 의도 및 시간/날짜 정보가 담긴 객체.
   * @param {Object} context - 현재 채팅 및 사용자 컨텍스트 정보.
   * @returns {Promise<Object>} 성공 여부와 메시지를 담은 결과 객체를 반환합니다.
   */
  const handleRecurringPreferredTimeAdd = useCallback(async (chatResponse, context) => {
    try {
      const {
        startTime,
        endTime,
        timeRanges, // 🆕 여러 시간 범위 지원
        dates = [],
        priority = 3, // 디폴트: 선호(3)
        title, // title은 사용하지 않음 (버튼 추가와 동일하게)
        response
      } = chatResponse;

      // 유효성 검증
      if (!dates || dates.length === 0) {
        return {
          success: false,
          message: '적용할 날짜를 지정해주세요.'
        };
      }

      // 시간 범위 검증: timeRanges 또는 startTime/endTime 중 하나는 있어야 함
      if (!timeRanges && (!startTime || !endTime)) {
        return {
          success: false,
          message: '시작 시간과 종료 시간을 지정해주세요.'
        };
      }

      // priority 값 검증 (1, 2, 3만 유효)
      const validPriority = [1, 2, 3].includes(priority) ? priority : 3;

      // 🆕 여러 시간 범위 처리
      let timeRangesToProcess = [];

      if (timeRanges && Array.isArray(timeRanges) && timeRanges.length > 0) {
        // timeRanges가 있으면 그것을 사용
        timeRangesToProcess = timeRanges;
      } else if (startTime && endTime) {
        // 기존 방식 (하위 호환성)
        timeRangesToProcess = [{ startTime, endTime }];
      }

      // 각 날짜 x 각 시간 범위마다 defaultSchedule 생성 (버튼 추가와 동일)
      const defaultScheduleSlots = [];

      for (const dateStr of dates) {
        for (const timeRange of timeRangesToProcess) {
          const { startTime: rangeStart, endTime: rangeEnd } = timeRange;

          // startTime과 endTime 파싱
          const [startHour, startMin] = rangeStart.split(':');
          const [endHour, endMin] = rangeEnd.split(':');

          const [year, month, day] = dateStr.split('-').map(Number);
          const dateObj = new Date(year, month - 1, day);

          defaultScheduleSlots.push({
            dayOfWeek: dateObj.getDay(),
            startTime: rangeStart,
            endTime: rangeEnd,
            priority: validPriority,
            specificDate: dateStr
          });
        }
      }

      // API 요청 데이터 구성 (버튼 추가와 동일하게 defaultSchedule에 저장)
      console.log('🔵 [반복 선호시간 추가] 시작:', { dates, timeRanges, priority: validPriority });
      console.log('🔵 [반복 선호시간 추가] defaultScheduleSlots:', defaultScheduleSlots);
      
      const requestData = {
        defaultSchedule: defaultScheduleSlots
      };

      // 서버에 저장
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

      // 🆕 더 상세한 메시지 생성
      const timeRangeCount = timeRangesToProcess.length;
      const totalSlots = dates.length * timeRangeCount;

      let detailedMessage = response;
      if (!detailedMessage) {
        if (timeRangeCount > 1) {
          detailedMessage = `${dates.length}일 x ${timeRangeCount}개 시간대 = 총 ${totalSlots}개 ${priorityLabel} 시간을 추가했어요!`;
        } else {
          detailedMessage = `${dates.length}일에 ${priorityLabel} 시간을 추가했어요!`;
        }
      }

      return {
        success: true,
        message: detailedMessage,
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