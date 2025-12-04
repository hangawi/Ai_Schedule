/**
 * ===================================================================================================
 * chatHandlers.js - 최적 시간표 모달 내 채팅 관련 로직을 처리하는 핸들러 파일
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/handlers/chatHandlers.js
 *
 * 🎯 주요 기능:
 *    - 사용자의 채팅 메시지를 AI 백엔드로 전송하고 응답을 처리합니다.
 *    - AI 응답을 파싱하여 시간표 상태를 업데이트하고, 채팅 메시지를 화면에 표시합니다.
 *    - 복잡한 AI 응답(JSON 구조)에서 실제 사용자에게 보여줄 설명 텍스트를 추출하고 정리하는 로직을 포함합니다.
 *
 * 🔗 연결된 파일:
 *    - ../ScheduleOptimizationModal.js - 이 파일의 `handleChatSubmit` 함수를 주입받아 사용합니다.
 *    - ../../../config/firebaseConfig.js - 사용자 인증(`auth`)에 사용됩니다.
 *
 * 💡 사용처:
 *    - `ScheduleOptimizationModal` 내의 `ChatArea` 컴포넌트에서 사용자 입력이 제출될 때 호출됩니다.
 *
 * ✏️ 수정 가이드:
 *    - AI 백엔드 API 엔드포인트가 변경되면 `fetch` 호출의 URL을 수정합니다.
 *    - AI 응답의 구조가 변경되면 `data.success` 및 `data.explanation` 처리 로직을 수정해야 합니다.
 *    - 특히 `cleanExplanation` 부분의 정규 표현식은 AI 응답 포맷에 크게 의존하므로, 응답 변경 시 주의 깊게 수정해야 합니다.
 *
 * 📝 참고사항:
 *    - 이 핸들러는 비동기적으로 AI 통신을 처리하며, 사용자 경험을 위해 "생각 중" 메시지를 표시하고 제거하는 로직을 포함합니다.
 *    - 대화의 연속성을 위해 직전 AI 응답을 백엔드로 전달합니다.
 *
 * ===================================================================================================
 */

import { auth } from '../../../config/firebaseConfig';

/**
 * handleChatSubmit
 * @description 사용자의 채팅 메시지를 받아 AI 백엔드에 전송하고, AI의 응답을 처리하여 시간표 및 채팅 UI를 업데이트합니다.
 *              사용자 메시지 추가, AI 처리 중 메시지 표시, 백엔드 API 호출, 응답 파싱 및 UI 업데이트,
 *              그리고 AI 응답 텍스트 정제 로직을 포함하는 복합적인 핸들러입니다.
 *
 * @param {Event} e - 폼 제출 이벤트 객체. `e.preventDefault()`를 통해 기본 동작을 방지합니다.
 * @param {string} chatInput - 현재 채팅 입력 필드의 값.
 * @param {function} setChatInput - `chatInput` 상태를 업데이트하는 함수.
 * @param {function} setChatMessages - `chatMessages` 상태(채팅 내역)를 업데이트하는 함수.
 * @param {Array<Array<object>>} modifiedCombinations - 현재 수정된 시간표 조합 배열.
 * @param {number} currentIndex - `modifiedCombinations` 배열 내 현재 활성화된 시간표 조합의 인덱스.
 * @param {Array<object>} originalSchedule - AI가 분석한 원본 스케줄 데이터.
 * @param {function} setModifiedCombinations - `modifiedCombinations` 상태를 업데이트하는 함수.
 * @param {object} dayMap - 한글 요일을 영문 코드로 매핑하는 객체 (예: {'월요일': 'MON'}).
 * @param {object} gradeLevelMap - 한글 학년부를 영문 코드로 매핑하는 객체 (예: {'초등부': 'elementary'}).
 * @param {function} parseTime - 시간 문자열을 파싱하는 유틸리티 함수.
 * @param {Array<object>} chatMessages - 현재까지의 채팅 메시지 배열 (대화 컨텍스트 유지를 위해 사용).
 * @param {Array<object>} fixedSchedules - 사용자가 고정한 스케줄 배열.
 * @param {function} setFixedSchedules - `fixedSchedules` 상태를 업데이트하는 함수.
 * @param {Array<object>} schedulesByImage - 이미지별로 그룹화된 스케줄 데이터.
 * @returns {object} 처리 여부 (`handled`)와 함께 `dayMap`, `gradeLevelMap`, `parseTime`을 반환합니다.
 *
 * @note
 * - `cleanExplanation` 로직은 AI의 원시 응답에서 불필요한 JSON 구조를 제거하고 가독성 좋은 텍스트로 가공하는 데 중점을 둡니다.
 * - 인증된 사용자만 AI 요청을 보낼 수 있습니다.
 * - `thinkingMessage`를 통해 AI 응답 대기 중임을 사용자에게 시각적으로 알립니다.
 */
export const handleChatSubmit = async (
  e,
  chatInput,
  setChatInput,
  setChatMessages,
  modifiedCombinations,
  currentIndex,
  originalSchedule,
  setModifiedCombinations,
  dayMap,
  gradeLevelMap,
  parseTime,
  chatMessages,  // 대화 히스토리
  fixedSchedules,  // 고정 일정
  setFixedSchedules,  // 고정 일정 업데이트
  schedulesByImage  // 이미지별 스케줄
) => {
  e.preventDefault();
  if (!chatInput.trim()) return;

  const userMessage = {
    id: Date.now(),
    text: chatInput,
    sender: 'user',
    timestamp: new Date()
  };

  setChatMessages(prev => [...prev, userMessage]);
  const input = chatInput.trim();
  setChatInput('');

  // AI 응답 대기 중 메시지
  const thinkingMessageId = Date.now() + 1;
  const thinkingMessage = {
    id: thinkingMessageId,
    text: '💭 답변을 생각하고 있어요...',
    sender: 'bot',
    timestamp: new Date()
  };
  setChatMessages(prev => [...prev, thinkingMessage]);

  // AI에게 자연어 요청 보내기
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setChatMessages(prev => prev.filter(msg => msg.id !== thinkingMessageId));
      setChatMessages(prev => [...prev, {
        id: Date.now(),
        text: '인증이 필요합니다.',
        sender: 'bot',
        timestamp: new Date()
      }]);
      return;
    }

    // 직전 봇 응답 찾기 (대화 컨텍스트 유지)
    const lastBotMessage = chatMessages
      ? [...chatMessages].reverse().find(msg => msg.sender === 'bot' && msg.text !== '💭 답변을 생각하고 있어요...')
      : null;
    const lastAiResponse = lastBotMessage ? lastBotMessage.text : null;

    const response = await fetch('http://localhost:5000/api/schedule/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await currentUser.getIdToken()}`
      },
      body: JSON.stringify({
        message: input,
        currentSchedule: modifiedCombinations[currentIndex],
        originalSchedule: originalSchedule || modifiedCombinations[currentIndex],
        lastAiResponse: lastAiResponse,  // 직전 AI 응답 전달
        fixedSchedules: fixedSchedules || [],  // 고정 일정
        schedulesByImage: schedulesByImage || []  // 이미지별 스케줄
      })
    });

    const data = await response.json();

    // 생각 중 메시지 제거
    setChatMessages(prev => prev.filter(msg => msg.id !== thinkingMessageId));

    if (data.success) {
      // 시간표 업데이트
      const updatedCombinations = [...modifiedCombinations];
      updatedCombinations[currentIndex] = data.schedule;
      setModifiedCombinations(updatedCombinations);

      // 고정 일정 업데이트 (서버에서 fixedSchedules를 반환하면)
      if (data.fixedSchedules && setFixedSchedules) {
        setFixedSchedules(data.fixedSchedules);
      }

      // explanation에서 JSON 형식 완전 제거
      let cleanExplanation = data.explanation;

      if (cleanExplanation) {
        // 1. JSON 코드 블록 제거 (```json ... ``` 또는 ``` ... ```)
        cleanExplanation = cleanExplanation.replace(/```json\s*[\s\S]*?\s*```/g, '');
        cleanExplanation = cleanExplanation.replace(/```\s*[\s\S]*?\s*```/g, '');

        // 2. 중괄호로 시작하는 JSON 객체 전체 제거 (여러 줄 포함)
        cleanExplanation = cleanExplanation.replace(/\{[\s\S]*?"understood"[\s\S]*?\}/g, '');
        cleanExplanation = cleanExplanation.replace(/\{[\s\S]*?"action"[\s\S]*?\}/g, '');

        // 3. JSON 필드 라인 제거
        cleanExplanation = cleanExplanation.replace(/"(understood|action|schedule|explanation)":\s*[^\n]*/g, '');

        // 4. 남은 중괄호, 대괄호, 쉼표 제거
        cleanExplanation = cleanExplanation.replace(/[{}\[\],]/g, '');

        // 5. 여러 줄 공백 정리
        cleanExplanation = cleanExplanation.replace(/\n{3,}/g, '\n\n').trim();

        // 6. 삭제된 수업 목록 줄바꿈 포맷팅
        // "• 월요일: 도덕 (09:00), 영어 (10:00)" → "월요일:\n  • 도덕 (09:00)\n  • 영어 (10:00)"
        cleanExplanation = cleanExplanation.replace(/• ([월화수목금토일]요일):\s*([^•\n]+)/g, (match, day, items) => {
          const itemList = items.split(/[,，]/).map(item => item.trim()).filter(item => item);
          if (itemList.length > 3) {
            // 3개 이상이면 줄바꿈
            return `${day}:\n${itemList.map(item => `  • ${item}`).join('\n')}`;
          }
          return match; // 3개 이하면 그대로
        });

        // 7. 빈 문자열이면 기본 메시지
        if (!cleanExplanation || cleanExplanation.length < 3) {
          cleanExplanation = data.understood || '처리했어요!';
        }
      }

      // AI 응답 메시지
      const botMessage = {
        id: Date.now() + 2,
        text: cleanExplanation,
        sender: 'bot',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, botMessage]);
      return { handled: true };
    }
  } catch (error) {
    // 생각 중 메시지 제거
    setChatMessages(prev => prev.filter(msg => msg.id !== thinkingMessageId));
  }

  return { handled: false, input, dayMap, gradeLevelMap, parseTime };
};
