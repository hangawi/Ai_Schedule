/**
 * ===================================================================================================
 * chatModalHandlers.js - 최적 시간표 모달 내 채팅 메시지 제출 및 처리 로직을 관리하는 핸들러 파일
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/handlers/chatModalHandlers.js
 *
 * 🎯 주요 기능:
 *    - 사용자의 채팅 입력을 받아 백엔드 AI 서비스(고정 일정 처리 API 또는 일반 채팅 API)에 전송.
 *    - AI 응답을 해석하여 시간표 데이터를 업데이트하고, 충돌 해결 또는 사용자 선택 옵션을 제시.
 *    - API 통신이 불가능하거나 AI가 처리하지 못하는 경우를 대비하여 로컬에서 간단한 명령어(삭제, 추가, 이동 등)를 파싱하여 처리.
 *    - 채팅 UI(메시지, 입력 필드, 진행 상태)를 업데이트하고, 스케줄 변경 이력을 관리(Undo/Redo).
 *
 * 🔗 연결된 파일:
 *    - ../../../config/firebaseConfig.js - 사용자 인증을 위해 Firebase Auth 객체 `auth` 사용.
 *    - ../../../services/fixedSchedule/fixedScheduleAPI.js - 고정 일정 추가 관련 API 호출.
 *    - ../utils/commandParser.js - 사용자 입력 명령어를 파싱하여 명령 유형과 파라미터를 추출.
 *    - ../utils/scheduleOperations.js - 파싱된 명령에 따라 실제 시간표 데이터 조작 (삭제, 선택, 수정, 추가).
 *    - ../constants/modalConstants.js - 요일 매핑 등 상수 정의.
 *    - ../ScheduleOptimizationModal.js - 이 파일의 핸들러들을 사용하여 모달의 복잡한 로직을 처리.
 *
 * 💡 사용처:
 *    - `ScheduleOptimizationModal` 컴포넌트 내부에서 채팅 입력 폼이 제출될 때 `createHandleChatSubmit` 함수가 호출됩니다.
 *
 * ✏️ 수정 가이드:
 *    - AI API 엔드포인트 변경 시, `fetch` 요청 URL을 업데이트해야 합니다.
 *    - AI 응답 형식이나 로컬 명령어 파싱 로직이 변경될 경우 `handleAiResponse` 또는 `handleFallbackCommand` 함수를 수정해야 합니다.
 *    - 채팅 메시지 표시 방식이나 진행률 시뮬레이션 로직은 `createHandleChatSubmit` 내에서 조정할 수 있습니다.
 *
 * 📝 참고사항:
 *    - 이 파일은 `ScheduleOptimizationModal`의 핵심 로직을 담당하며, 여러 하위 유틸리티 및 API 서비스와 유기적으로 연동됩니다.
 *    - `createHandleChatSubmit`는 클로저를 통해 부모 컴포넌트의 다양한 상태와 함수에 접근합니다.
 *
 * ===================================================================================================
 */

import { auth } from '../../../config/firebaseConfig';
import { addFixedSchedule } from '../../../services/fixedSchedule/fixedScheduleAPI';
import { detectCommandType, parseDeleteCommand, parseSelectCommand, parseModifyCommand, parseAddCommand } from '../utils/commandParser';
import { deleteSchedules, selectSchedule, modifySchedules, addSchedule } from '../utils/scheduleOperations';
import { DAY_MAP } from '../constants/modalConstants';

/**
 * createHandleChatSubmit
 * @description 채팅 메시지 제출 이벤트를 처리하는 비동기 핸들러 함수를 생성합니다.
 *              사용자 메시지 처리, AI 응답 대기, 백엔드 API 호출, 응답 기반 시간표 및 UI 업데이트,
 *              그리고 실패 시 로컬 명령 파싱으로의 폴백 로직을 포함합니다.
 *
 * @param {string} chatInput - 현재 채팅 입력 필드의 값.
 * @param {Array<Array<object>>} modifiedCombinations - 현재 수정된 시간표 조합 배열.
 * @param {number} currentIndex - `modifiedCombinations` 배열 내 현재 활성화된 시간표 조합의 인덱스.
 * @param {Array<object>} schedulesByImage - 이미지별로 그룹화된 스케줄 데이터 (범례 및 AI 컨텍스트용).
 * @param {Array<object>} currentFixedSchedules - 현재 고정된 스케줄 배열.
 * @param {Array<object>} originalSchedule - AI가 분석한 원본 스케줄 데이터 (컨텍스트용).
 * @param {Array<Array<object>>} scheduleHistory - 시간표 변경 이력 (Undo 기능용).
 * @param {Array<Array<object>>} redoStack - 되돌리기 기능(Redo)을 위한 스택.
 * @param {Array<object>} customSchedulesForLegend - 범례에 표시될 커스텀 스케줄 목록.
 * @param {function} setChatInput - `chatInput` 상태를 업데이트하는 함수.
 * @param {function} setChatMessages - `chatMessages` 상태(채팅 내역)를 업데이트하는 함수.
 * @param {function} setModifiedCombinations - `modifiedCombinations` 상태를 업데이트하는 함수.
 * @param {function} setCurrentFixedSchedules - `currentFixedSchedules` 상태를 업데이트하는 함수.
 * @param {function} setCustomSchedulesForLegend - `customSchedulesForLegend` 상태를 업데이트하는 함수.
 * @param {function} setConflictState - 충돌 상태를 업데이트하는 함수.
 * @param {function} setScheduleHistory - `scheduleHistory` 상태를 업데이트하는 함수.
 * @param {function} setRedoStack - `redoStack` 상태를 업데이트하는 함수.
 * @param {function} setAiOptimizationState - AI 최적화 상태(처리 중 여부 등)를 업데이트하는 함수.
 * @returns {function(Event): Promise<void>} 채팅 제출 이벤트를 처리하는 비동기 함수.
 */
export const createHandleChatSubmit = (
  chatInput,
  modifiedCombinations,
  currentIndex,
  schedulesByImage,
  currentFixedSchedules,
  originalSchedule,
  scheduleHistory,
  redoStack,
  customSchedulesForLegend,
  setChatInput,
  setChatMessages,
  setModifiedCombinations,
  setCurrentFixedSchedules,
  setCustomSchedulesForLegend,
  setConflictState,
  setScheduleHistory,
  setRedoStack,
  setAiOptimizationState
) => {
  return async (e) => {
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
      text: '💭 답변을 생성하고 있어요...', 
      sender: 'bot',
      timestamp: new Date(),
      progress: 0
    };
    setChatMessages(prev => [...prev, thinkingMessage]);

    // 진행률 시뮬레이션
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += Math.random() * 15 + 5;
      if (progress > 95) progress = 95;

      setChatMessages(prev => prev.map(msg =>
        msg.id === thinkingMessageId
          ? { ...msg, progress: Math.round(progress) }
          : msg
      ));
    }, 300);

    // 고정 일정 처리 우선 시도
    try {
      const fixedResult = await addFixedSchedule(
        input,
        modifiedCombinations[currentIndex],
        schedulesByImage,
        currentFixedSchedules
      );

      clearInterval(progressInterval);
      setChatMessages(prev => prev.filter(msg => msg.id !== thinkingMessageId));

      if (!fixedResult.success && fixedResult.intent === 'none') {
        throw new Error('NOT_FIXED_SCHEDULE');
      }

      // 사용자 선택이 필요한 경우
      if (fixedResult.needsUserChoice) {
        const botMessage = {
          id: Date.now() + 2,
          text: fixedResult.message,
          sender: 'bot',
          timestamp: new Date(),
          needsUserChoice: true,
          options: fixedResult.options
        };
        setChatMessages(prev => [...prev, botMessage]);
        return;
      }

      // 충돌 발생 시
      if (fixedResult.hasConflict) {
        setConflictState({
          pendingFixed: fixedResult.pendingFixed,
          conflicts: fixedResult.conflicts,
          message: fixedResult.message
        });

        const botMessage = {
          id: Date.now() + 2,
          text: fixedResult.message,
          sender: 'bot',
          timestamp: new Date(),
          isConflict: true
        };
        setChatMessages(prev => [...prev, botMessage]);
        return;
      }

      // 충돌 없음 → 시간표 업데이트
      if (fixedResult.optimizedSchedule) {
        const updatedCombinations = [...modifiedCombinations];
        updatedCombinations[currentIndex] = fixedResult.optimizedSchedule;
        setModifiedCombinations(updatedCombinations);
        setCurrentFixedSchedules(fixedResult.fixedSchedules);

        if (fixedResult.customSchedules) {
          const existingTitles = new Set(customSchedulesForLegend.map(c => c.sourceImageIndex));
          const newCustoms = fixedResult.customSchedules.filter(c => !existingTitles.has(c.sourceImageIndex));
          setCustomSchedulesForLegend([...customSchedulesForLegend, ...newCustoms]);
        }

        if (fixedResult.titlesToRemoveFromLegend && fixedResult.titlesToRemoveFromLegend.length > 0) {
          setCustomSchedulesForLegend(prev =>
            prev.filter(c => !fixedResult.titlesToRemoveFromLegend.includes(c.title))
          );
        }

        const botMessage = {
          id: Date.now() + 2,
          text: `${fixedResult.message}\n\n✨ 시간표가 자동으로 재최적화되었습니다!\n- 총 ${fixedResult.stats.total}개 수업\n- 고정 ${fixedResult.stats.fixed}개\n- 제외 ${fixedResult.stats.removed || 0}개`,
          sender: 'bot',
          timestamp: new Date()
        };
        setChatMessages(prev => [...prev, botMessage]);
        return;
      }

      // 기타 성공
      const botMessage = {
        id: Date.now() + 2,
        text: fixedResult.message,
        sender: 'bot',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, botMessage]);
      return;
    } catch (error) {
      if (error.message === 'NOT_FIXED_SCHEDULE') {
        // 기존 AI 채팅 API로 폴백 - 아래 코드에서 처리
      } else {
        clearInterval(progressInterval);
        setChatMessages(prev => prev.filter(msg => msg.id !== thinkingMessageId));

        const errorMessage = {
          id: Date.now() + 2,
          text: '고정 일정 처리 중 오류가 발생했습니다. 다시 시도해주세요.',
          sender: 'bot',
          timestamp: new Date()
        };
        setChatMessages(prev => [...prev, errorMessage]);
        return;
      }
    }

    // 기존 AI 채팅 API로 폴백
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setChatMessages(prev => [...prev, { id: Date.now(), sender: 'bot', text: '로그인이 필요합니다.' }]);
        setAiOptimizationState(prev => ({ ...prev, isProcessing: false }));
        return;
      }
      const idToken = await currentUser.getIdToken();

      const lastBotMessage = [...setChatMessages].reverse().find(msg => msg.sender === 'bot' && !msg.text.includes('💭'));
      const lastAiResponse = lastBotMessage ? lastBotMessage.text : null;

      const response = await fetch('http://localhost:5000/api/schedule/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          message: input,
          currentSchedule: modifiedCombinations[currentIndex],
          originalSchedule: originalSchedule || modifiedCombinations[currentIndex], // Use originalSchedule here (FIXED)
          scheduleHistory: scheduleHistory,
          lastAiResponse: lastAiResponse,
          redoStack: redoStack,
          fixedSchedules: currentFixedSchedules,
          schedulesByImage: schedulesByImage,
          existingCustomSchedules: customSchedulesForLegend
        })
      });

      const data = await response.json();

      clearInterval(progressInterval);

      setChatMessages(prev => prev.map(msg =>
        msg.id === thinkingMessageId ? { ...msg, progress: 100 } : msg
      ));

      setTimeout(() => {
        setChatMessages(prev => prev.filter(msg => msg.id !== thinkingMessageId));
      }, 300);

      if (data.success) {
        handleAiResponse(data, modifiedCombinations, currentIndex, schedulesByImage, setModifiedCombinations, setScheduleHistory, setRedoStack, setCustomSchedulesForLegend, setCurrentFixedSchedules, setChatMessages);
        return;
      }
    } catch (error) {
      clearInterval(progressInterval);
      setChatMessages(prev => prev.filter(msg => msg.id !== thinkingMessageId));
      // 에러 시 기존 명령어 파싱 방식으로 폴백 - 아래에서 처리
    }

    // 폴백: 명령 파싱
    handleFallbackCommand(input, modifiedCombinations, currentIndex, setModifiedCombinations, setChatMessages);
  };
};

/**
 * handleAiResponse
 * @description AI 백엔드로부터 받은 응답 데이터를 기반으로 시간표 상태와 채팅 메시지를 업데이트하는 함수.
 *              AI의 'action' 필드에 따라 다양한 시간표 조작(삭제, 추가, 이동, 되돌리기 등)을 수행하고,
 *              관련 UI 상태(시간표 조합, 변경 이력, 커스텀 스케줄, 고정 스케줄)를 적절히 변경합니다.
 *
 * @param {object} data - AI 백엔드로부터 받은 응답 데이터 객체. (success, action, schedule, explanation 등 포함)
 * @param {Array<Array<object>>} modifiedCombinations - 현재 수정된 시간표 조합 배열.
 * @param {number} currentIndex - `modifiedCombinations` 배열 내 현재 활성화된 시간표 조합의 인덱스.
 * @param {Array<object>} schedulesByImage - 이미지별로 그룹화된 스케줄 데이터 (커스텀 스케줄 필터링에 사용).
 * @param {function} setModifiedCombinations - `modifiedCombinations` 상태를 업데이트하는 함수.
 * @param {function} setScheduleHistory - `scheduleHistory` 상태를 업데이트하는 함수.
 * @param {function} setRedoStack - `redoStack` 상태를 업데이트하는 함수.
 * @param {function} setCustomSchedulesForLegend - `customSchedulesForLegend` 상태를 업데이트하는 함수.
 * @param {function} setCurrentFixedSchedules - `currentFixedSchedules` 상태를 업데이트하는 함수.
 * @param {function} setChatMessages - `chatMessages` 상태(채팅 내역)를 업데이트하는 함수.
 * @returns {void}
 */
const handleAiResponse = (data, modifiedCombinations, currentIndex, schedulesByImage, setModifiedCombinations, setScheduleHistory, setRedoStack, setCustomSchedulesForLegend, setCurrentFixedSchedules, setChatMessages) => {
  if (data.action === 'delete' || data.action === 'add' || data.action === 'move') {
    setScheduleHistory(prev => [...prev, modifiedCombinations[currentIndex]]);
    setRedoStack([]);

    const updatedCombinations = [...modifiedCombinations];
    updatedCombinations[currentIndex] = data.schedule;
    setModifiedCombinations(updatedCombinations);

    if (data.action === 'delete') {
      const usedCustomTitles = new Set();
      data.schedule.forEach(item => {
        if (item.sourceImageIndex >= (schedulesByImage?.length || 0)) {
          usedCustomTitles.add(item.title);
        }
      });
      setCustomSchedulesForLegend(prev => prev.filter(c => usedCustomTitles.has(c.title)));
    }

    if (data.action === 'add' && data.customSchedules && data.customSchedules.length > 0) {
      setCustomSchedulesForLegend(prev => {
        const existingTitles = new Set(prev.map(c => c.title));
        const newCustoms = data.customSchedules.filter(c => !existingTitles.has(c.title));
        return [...prev, ...newCustoms];
      });
    }

    if (data.action === 'move' && data.fixedSchedules) {
      setCurrentFixedSchedules(data.fixedSchedules);
    }
  } else if (data.action === 'redo') {
    const updatedCombinations = [...modifiedCombinations];
    updatedCombinations[currentIndex] = data.schedule;
    setModifiedCombinations(updatedCombinations);
    setRedoStack(prev => prev.slice(0, -1));
    setScheduleHistory(prev => [...prev, modifiedCombinations[currentIndex]]);
  } else if (data.action === 'step_back') {
    const updatedCombinations = [...modifiedCombinations];
    updatedCombinations[currentIndex] = data.schedule;
    setModifiedCombinations(updatedCombinations);
    setRedoStack(prev => [...prev, modifiedCombinations[currentIndex]]);
    setScheduleHistory(prev => prev.slice(0, -1));

    const usedCustomTitles = new Set();
    data.schedule.forEach(item => {
      if (item.sourceImageIndex >= (schedulesByImage?.length || 0)) {
        usedCustomTitles.add(item.title);
      }
    });
    setCustomSchedulesForLegend(prev => prev.filter(c => usedCustomTitles.has(c.title)));
  } else if (data.action === 'undo') {
    const updatedCombinations = [...modifiedCombinations];
    updatedCombinations[currentIndex] = data.schedule;
    setModifiedCombinations(updatedCombinations);
    setScheduleHistory([]);
    setCustomSchedulesForLegend([]);
    setCurrentFixedSchedules([]);
  }

  const botMessage = {
    id: Date.now() + 2,
    text: data.explanation,
    sender: 'bot',
    timestamp: new Date()
  };
  setChatMessages(prev => [...prev, botMessage]);
};

/**
 * handleFallbackCommand
 * @description AI 백엔드가 처리하지 못했거나 API 호출에 실패했을 때, 사용자의 명령어를 로컬에서 파싱하여 처리하는 함수.
 *              주어진 입력(`input`)을 삭제, 선택, 수정, 추가 명령 중 하나로 분류하고,
 *              해당 스케줄 작업을 수행한 후 채팅 UI에 결과를 피드백합니다.
 *
 * @param {string} input - 사용자가 채팅으로 입력한 명령어 텍스트.
 * @param {Array<Array<object>>} modifiedCombinations - 현재 수정된 시간표 조합 배열.
 * @param {number} currentIndex - `modifiedCombinations` 배열 내 현재 활성화된 시간표 조합의 인덱스.
 * @param {function} setModifiedCombinations - `modifiedCombinations` 상태를 업데이트하는 함수.
 * @param {function} setChatMessages - `chatMessages` 상태(채팅 내역)를 업데이트하는 함수.
 * @returns {void}
 */
const handleFallbackCommand = (input, modifiedCombinations, currentIndex, setModifiedCombinations, setChatMessages) => {
  const commandType = detectCommandType(input);

  if (commandType === 'delete') {
    const params = parseDeleteCommand(input);
    const currentSchedules = [...modifiedCombinations[currentIndex]];
    const { filteredSchedules, deletedCount, hasChanges } = deleteSchedules(currentSchedules, params);

    if (hasChanges) {
      const updatedCombinations = [...modifiedCombinations];
      updatedCombinations[currentIndex] = filteredSchedules;
      setModifiedCombinations(updatedCombinations);

      const message = deletedCount > 0
        ? `✅ ${deletedCount}개의 시간표를 삭제했습니다.`
        : `✅ 월요일 시간표를 제거했습니다.`;

      setChatMessages(prev => [...prev, { id: Date.now() + 1, text: message, sender: 'bot', timestamp: new Date() }]);
    } else {
      setChatMessages(prev => [...prev, { id: Date.now() + 1, text: '❌ 해당 조건에 맞는 시간표를 찾을 수 없습니다.', sender: 'bot', timestamp: new Date() }]);
    }
    return;
  }

  if (commandType === 'select') {
    const params = parseSelectCommand(input);
    const currentSchedules = [...modifiedCombinations[currentIndex]];
    const result = selectSchedule(currentSchedules, params);

    if (result.success) {
      const updatedCombinations = [...modifiedCombinations];
      updatedCombinations[currentIndex] = result.filteredSchedules;
      setModifiedCombinations(updatedCombinations);
    }

    setChatMessages(prev => [...prev, { id: Date.now() + 1, text: result.message, sender: 'bot', timestamp: new Date() }]);
    return;
  }

  if (commandType === 'modify') {
    const params = parseModifyCommand(input);
    const currentSchedules = [...modifiedCombinations[currentIndex]];
    const result = modifySchedules(currentSchedules, params);

    if (result.success) {
      const updatedCombinations = [...modifiedCombinations];
      updatedCombinations[currentIndex] = result.newSchedules;
      setModifiedCombinations(updatedCombinations);
    }

    setChatMessages(prev => [...prev, { id: Date.now() + 1, text: result.message, sender: 'bot', timestamp: new Date() }]);
    return;
  }

  if (commandType === 'add') {
    const params = parseAddCommand(input);
    const currentSchedules = [...modifiedCombinations[currentIndex]];
    const result = addSchedule(currentSchedules, params);

    if (result.success) {
      const updatedCombinations = [...modifiedCombinations];
      updatedCombinations[currentIndex] = result.updatedSchedules;
      setModifiedCombinations(updatedCombinations);
    }

    setChatMessages(prev => [...prev, { id: Date.now() + 1, text: result.message, sender: 'bot', timestamp: new Date() }]);
    return;
  }

  // 알 수 없는 명령
  const botMessage = {
  id: Date.now() + 1,
  text: `사용 가능한 명령:
- 삭제: "토요일 11:00 삭제"
- 수정: "월요일 14:40을 16:00으로 수정"
- 추가: "토요일 오후 3시 초등부 추가"`,
  sender: 'bot',
  timestamp: new Date()
};

  setChatMessages(prev => [...prev, botMessage]);
};
