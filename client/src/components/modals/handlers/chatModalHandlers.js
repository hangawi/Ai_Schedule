/**
 * ============================================================================
 * chatModalHandlers.js - Chat Submission and Processing Handlers
 * ============================================================================
 */

import { auth } from '../../../config/firebaseConfig';
import { addFixedSchedule } from '../../../services/fixedSchedule/fixedScheduleAPI';
import { detectCommandType, parseDeleteCommand, parseSelectCommand, parseModifyCommand, parseAddCommand } from '../utils/commandParser';
import { deleteSchedules, selectSchedule, modifySchedules, addSchedule } from '../utils/scheduleOperations';
import { DAY_MAP } from '../constants/modalConstants';

/**
 * 채팅 제출 핸들러 생성
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
          const existingIndices = new Set(customSchedulesForLegend.map(c => c.sourceImageIndex));
          const newCustoms = fixedResult.customSchedules.filter(c => !existingIndices.has(c.sourceImageIndex));
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
          originalSchedule: originalSchedule || modifiedCombinations[currentIndex],
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
 * AI 응답 처리
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
 * 폴백 명령 처리
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
    text: '사용 가능한 명령:\n- 삭제: "토요일 11:00 삭제"\n- 수정: "월요일 14:40을 16:00으로 수정"\n- 추가: "토요일 오후 3시 초등부 추가"',
    sender: 'bot',
    timestamp: new Date()
  };
  setChatMessages(prev => [...prev, botMessage]);
};
