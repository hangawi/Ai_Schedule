/**
 * ===================================================================================================
 * scheduleHandlers.js - 스케줄 관련 핸들러 함수들
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/chat/handlers
 *
 * 🎯 주요 기능:
 *    - OCR을 통해 추출된 시간표 데이터를 처리하고 사용자에게 다음 액션을 제안
 *    - 나이 필터링 등으로 인해 시간표가 비어있을 경우 사용자에게 강제 추가 여부 확인
 *    - 추출된 시간표의 충돌 여부를 안내하고 최적화된 시간표 예시 보기 제안
 *    - 사용자가 선택한 개별 시간표를 챗봇을 통해 일정에 추가하는 기능
 *    - "다시 짜줘" 명령어에 따라 기존 시간표 데이터를 기반으로 다른 조합을 생성하고 제시
 *
 * 🔗 연결된 파일:
 *    - ../utils/scheduleUtils - 일정 유틸리티 (addSchedulesToCalendar)
 *    - ../utils/chatUtils - 챗봇 유틸리티 (generateMultipleCombinations)
 *    - ./messageHandlers.js - 메시지 전송 핸들러 (handleRegenerateSchedules 호출)
 *
 * 💡 UI 위치:
 *    - 챗봇 화면 > 시간표 추출 결과 메시지, 시간표 최적화 모달
 *
 * ✏️ 수정 가이드:
 *    - 시간표 추출 후 메시지 내용 변경: `createSchedulesExtractedHandler` 내 `botMessage.text` 수정
 *    - 강제 추가 또는 시간표 예시 보기에 대한 사용자 인터랙션 로직 변경: `_nextStep` 관련 로직 수정
 *    - 개별 일정 추가 로직 변경: `createAddSchedulesHandler` 내 `onSendMessage` 호출 로직 수정
 *    - 시간표 조합 생성 로직 변경: `generateMultipleCombinations` 함수 수정 또는 `handleRegenerateSchedules` 내 조합 생성 방식 변경
 *
 * 📝 참고사항:
 *    - `_nextStep`, `_scheduleData`, `_showButtons` 등 챗봇 메시지 객체 내부 속성을 활용하여 대화 흐름을 제어합니다.
 *    - `handleRegenerateSchedules`는 이미 추출된 시간표 데이터가 있을 때만 작동합니다.
 *    - `createAddSchedulesHandler`는 각 일정을 챗봇 메시지 형태로 다시 `onSendMessage`를 통해 백엔드에 전달합니다.
 *
 * ===================================================================================================
 */

import { addSchedulesToCalendar } from '../utils/scheduleUtils';
import { generateMultipleCombinations } from '../utils/chatUtils';

/**
 * createSchedulesExtractedHandler
 *
 * @description OCR을 통해 시간표가 성공적으로 추출되었을 때 호출되는 핸들러를 생성합니다.
 *              추출 결과에 따라 사용자에게 메시지를 표시하고, 추가 액션(강제 추가, 시간표 예시 보기)을 제안합니다.
 * @param {Function} setMessages - 메시지 목록 상태 셋터 함수
 * @param {Function} setExtractedScheduleData - 추출된 시간표 데이터 상태 셋터 함수
 * @param {Function} setShowTimetableUpload - 시간표 업로드 컴포넌트 표시 여부 상태 셋터 함수
 * @param {Function} addSchedulesToCalendar - 캘린더에 일정을 추가하는 유틸리티 함수
 * @returns {Function} 시간표 추출 완료 핸들러
 *
 * @example
 * // TimetableUploadWithChat 컴포넌트 내에서 사용 예시
 * const handleSchedulesExtracted = createSchedulesExtractedHandler(
 *   setMessages, setExtractedScheduleData, setShowTimetableUpload, addSchedulesToCalendar
 * );
 * handleSchedulesExtracted(result);
 *
 * @note
 * - `result.type`이 'age_filtered'인 경우, 나이 필터링으로 인해 일정이 추가되지 않았음을 알리고 강제 추가 여부를 묻습니다.
 * - 추출된 시간표에 충돌이 있거나 없거나 관계없이 `_nextStep`을 'show_schedule_examples'로 설정하여 사용자에게 최적 시간표 예시 보기를 제안합니다.
 * - 사용자가 최적 조합 중 하나를 선택하여 (`result.type === 'schedule_selected'`) 이 핸들러가 다시 호출된 경우, 실제 일정을 캘린더에 추가합니다.
 * - `setExtractedScheduleData`를 통해 추출된 시간표 데이터를 전역적으로 관리합니다.
 */
export const createSchedulesExtractedHandler = (
  setMessages,
  setExtractedScheduleData,
  setShowTimetableUpload,
  addSchedulesToCalendar
) => {
  return async (result) => {
    // 나이 필터링으로 0개가 된 경우
    if (result.type === 'age_filtered') {
      const botMessage = {
        id: Date.now(),
        text: `총 ${result.allSchedulesCount}개의 시간표를 찾았지만, 나이(${result.data.age}세)에 맞지 않아 필터링되었습니다.\n\n예상 학년부: ${result.data.gradeLevel === 'elementary' ? '초등부' : result.data.gradeLevel === 'middle' ? '중등부' : '고등부'}\n\n그래도 추가하시겠습니까?`,
        sender: 'bot',
        timestamp: new Date(),
        _nextStep: 'force_add_filtered_schedules',
        _scheduleData: result.data,
        _showButtons: true,
        _buttons: [
          { text: '예, 강제로 추가', value: '강제추가' },
          { text: '아니오', value: '취소' }
        ],
        _isScheduleMessage: true
      };
      setMessages(prev => [...prev, botMessage]);
      setExtractedScheduleData(result.data);
      setShowTimetableUpload(false);
      return;
    }

    // 충돌 여부와 관계없이 항상 모달을 보여줌
    const botMessage = {
      id: Date.now(),
      text: `총 ${result.data.schedules.length}개의 시간표를 찾았습니다.${result.data.conflicts.length > 0 ? ` (${result.data.conflicts.length}개의 충돌 발견)` : ''}\n시간표 예시를 보시겠습니까?`,
      sender: 'bot',
      timestamp: new Date(),
      _nextStep: 'show_schedule_examples',
      _scheduleData: result.data,
      _showButtons: true,
      _buttons: [
        { text: '예', value: '예' },
        { text: '아니오', value: '아니오' }
      ],
      _isScheduleMessage: true
    };
    setMessages(prev => [...prev, botMessage]);
    setExtractedScheduleData(result.data);
    setShowTimetableUpload(false);

    if (result.type === 'schedule_selected') {
      // 사용자가 최적 조합 중 하나를 선택함
      const schedules = result.schedules;
      const applyScope = result.applyScope || 'month';

      // 실제로 일정 추가
      const result_add = await addSchedulesToCalendar(schedules, applyScope);

      const botMessage = {
        id: Date.now(),
        text: result_add.success
          ? `선택하신 시간표 ${result_add.count}개를 일정에 추가했습니다! ✅ 프로필 탭에서 확인하세요!`
          : `시간표 추가 중 오류가 발생했습니다: ${result_add.error}`,
        sender: 'bot',
        timestamp: new Date(),
        success: result_add.success
      };
      setMessages(prev => [...prev, botMessage]);
    }
  };
};

/**
 * createAddSchedulesHandler
 *
 * @description 배열로 전달된 여러 시간표를 챗봇을 통해 개별적으로 캘린더에 추가하는 핸들러를 생성합니다.
 *              각 시간표에 대해 `onSendMessage`를 호출하여 일정을 추가하고, 그 결과를 사용자에게 요약하여 전달합니다.
 * @param {Function} onSendMessage - 챗봇 메시지를 전송하고 응답을 받는 콜백 함수
 * @param {Function} setMessages - 메시지 목록 상태 셋터 함수
 * @returns {Function} 일정 추가 핸들러 (스케줄 배열을 인자로 받음)
 *
 * @example
 * // 예시: 추출된 시간표 목록을 캘린더에 추가
 * const addSchedules = createAddSchedulesHandler(onSendMessage, setMessages);
 * addSchedules([{ title: '수학', date: '2025-12-05', time: '10:00', location: '학원' }]);
 *
 * @note
 * - 일정을 추가하는 동안 로딩 메시지를 표시하여 사용자에게 피드백을 제공합니다.
 * - 각 일정이 개별적으로 처리되므로, 부분적인 성공/실패가 가능합니다.
 * - 최종적으로 추가된 일정의 성공/실패 여부와 개수를 요약하여 챗봇 메시지로 전달합니다.
 */
export const createAddSchedulesHandler = (onSendMessage, setMessages) => {
  return async (schedules) => {
    try {
      // 로딩 메시지 추가
      const loadingMessage = {
        id: Date.now(),
        text: '일정을 추가하고 있습니다...', 
        sender: 'bot',
        timestamp: new Date(),
        isLoading: true
      };
      setMessages(prev => [...prev, loadingMessage]);

      // 각 스케줄을 개별적으로 추가
      const results = [];
      for (const schedule of schedules) {
        try {
          const result = await onSendMessage(`"${schedule.title}" 일정을 ${schedule.date} ${schedule.time}에 추가해줘${schedule.location ? ` 장소: ${schedule.location}` : ''}`);
          results.push({
            schedule,
            success: result.success,
            message: result.message
          });
        } catch (error) {
          results.push({
            schedule,
            success: false,
            message: '일정 추가 중 오류가 발생했습니다.'
          });
        }
      }

      // 로딩 메시지 제거
      setMessages(prev => prev.filter(msg => !msg.isLoading));

      // 결과 메시지 생성
      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;

      const resultMessage = {
        id: Date.now() + 1,
        text: `총 ${totalCount}개 일정 중 ${successCount}개를 성공적으로 추가했습니다.`,
        sender: 'bot',
        timestamp: new Date(),
        success: successCount === totalCount
      };

      setMessages(prev => [...prev, resultMessage]);

    } catch (error) {
      // 로딩 메시지 제거
      setMessages(prev => prev.filter(msg => !msg.isLoading));

      const errorMessage = {
        id: Date.now() + 1,
        text: '일정 추가 중 오류가 발생했습니다.',
        sender: 'bot',
        timestamp: new Date(),
        success: false
      };

      setMessages(prev => [...prev, errorMessage]);
    }
  };
};

/**
 * handleRegenerateSchedules
 *
 * @description "다시 짜줘"와 같은 사용자 명령을 처리하여 기존에 추출된 시간표 데이터를 기반으로
 *              다른 조합의 최적 시간표를 생성하고 모달을 통해 사용자에게 제시합니다.
 * @param {Object | null} extractedScheduleData - 현재 추출된 시간표 데이터 (원본 스케줄 및 조합 정보 포함)
 * @param {Function} setExtractedScheduleData - 추출된 시간표 데이터 상태 셋터 함수
 * @param {Function} setShowScheduleModal - 시간표 모달 표시 여부 상태 셋터 함수
 * @param {Function} setMessages - 메시지 목록 상태 셋터 함수
 * @returns {boolean} 명령 처리 성공 여부 (true: 처리됨, false: 처리되지 않음)
 *
 * @example
 * // messageHandlers.js에서 사용자 입력에 따라 호출
 * if (userInputLower.includes('다시 짜줘')) {
 *   handleRegenerateSchedules(extractedScheduleData, setExtractedScheduleData, setShowScheduleModal, setMessages);
 * }
 *
 * @note
 * - `extractedScheduleData`가 존재해야만 작동하며, 없으면 사용자에게 이미지 업로드를 요청하는 메시지를 보냅니다.
 * - `generateMultipleCombinations` 유틸리티 함수를 사용하여 다양한 시간표 조합을 생성합니다.
 * - `optimalCombinations`를 업데이트하고 `setShowScheduleModal(true)`를 호출하여 새로운 조합이 담긴 모달을 표시합니다.
 * - 사용자에게 새로운 조합이 생성되었음을 알리는 챗봇 메시지를 추가합니다.
 */
export const handleRegenerateSchedules = (
  extractedScheduleData,
  setExtractedScheduleData,
  setShowScheduleModal,
  setMessages
) => {
  if (extractedScheduleData) {
    // 기존 스케줄 데이터로 다른 조합 생성
    const allSchedules = extractedScheduleData.allSchedulesBeforeFilter || extractedScheduleData.schedules || [];

    // 여러 조합 생성
    const combinations = generateMultipleCombinations(allSchedules);

    // extractedScheduleData 업데이트
    const updatedData = {
      ...extractedScheduleData,
      optimalCombinations: combinations,
      schedules: combinations[0]
    };

    setExtractedScheduleData(updatedData);
    setShowScheduleModal(true);

    const botMessage = {
      id: Date.now() + 1,
      text: `새로운 조합 ${combinations.length}개를 생성했습니다! 충돌 없는 최적 시간표를 확인해보세요 📅✨`,
      sender: 'bot',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, botMessage]);
    return true;
  } else {
    const botMessage = {
      id: Date.now() + 1,
      text: '먼저 시간표 이미지를 업로드해주세요! 그래야 다시 생성할 수 있어요 📸',
      sender: 'bot',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, botMessage]);
    return false;
  }
};