/**
 * ============================================================================
 * optimizerHandlers.js - AI Optimization Handlers
 * ============================================================================
 */

import { detectConflicts, optimizeScheduleWithGPT } from '../../../utils/scheduleOptimizer';

/**
 * AI 최적화 버튼 클릭 핸들러 생성
 */
export const createHandleOpenOptimizer = (
  currentCombination,
  originalSchedule,
  modifiedCombinations,
  currentIndex,
  setOriginalSchedule,
  setModifiedCombinations,
  setChatMessages,
  setAiOptimizationState
) => {
  return async () => {
    // 원본 시간표 저장
    if (!originalSchedule) {
      setOriginalSchedule(JSON.parse(JSON.stringify(currentCombination)));
    }

    // 충돌 감지
    const conflicts = detectConflicts(currentCombination);

    // 충돌이 없으면
    if (conflicts.length === 0) {
      const noConflictMessage = {
        id: Date.now(),
        text: '✅ 완벽해요! 겹치는 일정이 없어서 최적화가 필요없습니다.\n\n현재 시간표가 이미 최적 상태예요! 😊',
        sender: 'bot',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, noConflictMessage]);
      return;
    }

    // 처리 중 메시지
    const processingMessageId = Date.now();
    const processingMessage = {
      id: processingMessageId,
      text: `🤖 AI가 자동으로 스케줄을 분석하고 있어요...\n\n⏳ 겹치는 일정 ${conflicts.length}건을 해결 중...`,
      sender: 'bot',
      timestamp: new Date()
    };
    setChatMessages(prev => [...prev, processingMessage]);

    setAiOptimizationState(prev => ({
      ...prev,
      isProcessing: true
    }));

    // 진행 상태 업데이트
    let currentProgress = 0;
    let progressSpeed = 8;
    const progressInterval = setInterval(() => {
      if (currentProgress > 70) progressSpeed = 2;
      else if (currentProgress > 50) progressSpeed = 4;

      currentProgress += progressSpeed;
      if (currentProgress > 98) currentProgress = 98;

      setChatMessages(prev => prev.map(msg =>
        msg.id === processingMessageId
          ? { ...msg, text: `🤖 AI가 자동으로 스케줄을 분석하고 있어요...\n\n⏳ 최적 시간표 생성 중... ${currentProgress}%` }
          : msg
      ));
    }, 500);

    try {
      const result = await optimizeScheduleWithGPT(currentCombination, conflicts, {
        auto: true
      });

      if (result.optimizedSchedule && result.optimizedSchedule.length > 0) {
        const updatedCombinations = [...modifiedCombinations];
        updatedCombinations[currentIndex] = result.optimizedSchedule;
        setModifiedCombinations(updatedCombinations);
      }

      clearInterval(progressInterval);

      setChatMessages(prev => prev.map(msg =>
        msg.id === processingMessageId
          ? { ...msg, text: `🤖 AI가 자동으로 스케줄을 분석하고 있어요...\n\n✅ 최적 시간표 생성 완료! 100%` }
          : msg
      ));

      setTimeout(() => {
        setChatMessages(prev => prev.filter(msg => msg.id !== processingMessageId));

        const resultMessage = {
          id: Date.now(),
          text: `✨ 자동 최적화 완료!\n\n${result.explanation}\n\n혹시 수정하고 싶은 부분이 있으시면 말씀해주세요!\n예: "아까 시간표로 돌려줘", "예체능만 남겨줘", "학교공부 위주로"`,
          sender: 'bot',
          timestamp: new Date()
        };
        setChatMessages(prev => [...prev, resultMessage]);

        setAiOptimizationState({
          isActive: false,
          questions: [],
          currentQuestionIndex: 0,
          answers: {},
          isProcessing: false
        });
      }, 300);
    } catch (error) {
      clearInterval(progressInterval);
      setChatMessages(prev => prev.filter(msg => msg.id !== processingMessageId));

      const errorMessage = {
        id: Date.now(),
        text: `❌ 최적화 중 문제가 생겼어요.\n\n다시 시도하시거나, 채팅으로 직접 수정해주세요.\n예: "월요일 수학 삭제"`,
        sender: 'bot',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);

      setAiOptimizationState({
        isActive: false,
        questions: [],
        currentQuestionIndex: 0,
        answers: {},
        isProcessing: false
      });
    }
  };
};
