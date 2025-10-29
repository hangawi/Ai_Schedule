/**
 * AI 최적화 관련 핸들러
 */

import { optimizeScheduleWithGPT } from '../../../utils/scheduleOptimizer';

export const handleOpenOptimizer = async (
  currentCombination,
  detectConflicts,
  setChatMessages,
  setAiOptimizationState,
  optimizeScheduleWithGPT,
  modifiedCombinations,
  setModifiedCombinations,
  currentIndex,
  setOriginalSchedule,
  originalSchedule
) => {
  // 원본 시간표 저장 (AI 최적화 전)
  if (!originalSchedule) {
    console.log('💾 원본 시간표 저장:', currentCombination.length, '개 항목');
    setOriginalSchedule(JSON.parse(JSON.stringify(currentCombination)));
  }

  // 충돌 감지
  const conflicts = detectConflicts(currentCombination);

  console.log('🤖 AI 자동 최적화 시작:', conflicts.length, '건의 충돌');

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

  // 처리 중 메시지 (진행 상태 표시)
  const processingMessageId = Date.now();
  const processingMessage = {
    id: processingMessageId,
    text: `🤖 AI가 자동으로 스케줄을 분석하고 있어요...\n\n⏳ 겹치는 일정 ${conflicts.length}건을 해결 중...`,
    sender: 'bot',
    timestamp: new Date()
  };
  setChatMessages(prev => [...prev, processingMessage]);

  // AI 최적화 상태 활성화
  setAiOptimizationState(prev => ({
    ...prev,
    isProcessing: true
  }));

  // 진행 상태 업데이트 (점진적으로 증가, 속도 감소)
  let currentProgress = 0;
  let progressSpeed = 8; // 초기 속도
  const progressInterval = setInterval(() => {
    // 진행률에 따라 속도 감소
    if (currentProgress > 70) progressSpeed = 2; // 70% 이후 느리게
    else if (currentProgress > 50) progressSpeed = 4; // 50% 이후 조금 느리게

    currentProgress += progressSpeed;
    if (currentProgress > 98) currentProgress = 98; // 최대 98%까지 (100%는 완료 시)

    setChatMessages(prev => prev.map(msg =>
      msg.id === processingMessageId
        ? { ...msg, text: `🤖 AI가 자동으로 스케줄을 분석하고 있어요...\n\n⏳ 최적 시간표 생성 중... ${currentProgress}%` }
        : msg
    ));
  }, 500); // 0.5초마다 업데이트

  try {
    // 자동으로 AI 최적화 실행 (질문 없이)
    const result = await optimizeScheduleWithGPT(currentCombination, conflicts, {
      auto: true // 자동 모드
    });

    // 최적화된 스케줄로 업데이트
    if (result.optimizedSchedule && result.optimizedSchedule.length > 0) {
      const updatedCombinations = [...modifiedCombinations];
      updatedCombinations[currentIndex] = result.optimizedSchedule;
      setModifiedCombinations(updatedCombinations);
    }

    // 진행 상태 인터벌 정리
    clearInterval(progressInterval);

    // 100% 완료 표시
    setChatMessages(prev => prev.map(msg =>
      msg.id === processingMessageId
        ? { ...msg, text: `🤖 AI가 자동으로 스케줄을 분석하고 있어요...\n\n✅ 최적 시간표 생성 완료! 100%` }
        : msg
    ));

    // 결과 메시지 (대화형) - 즉시 표시
    setTimeout(() => {
      // 처리 중 메시지 제거
      setChatMessages(prev => prev.filter(msg => msg.id !== processingMessageId));

      const resultMessage = {
        id: Date.now(),
        text: `✨ 자동 최적화 완료!\n\n${result.explanation}\n\n혹시 수정하고 싶은 부분이 있으시면 말씀해주세요!\n예: "아까 시간표로 돌려줘", "예체능만 남겨줘", "학교공부 위주로"`,
        sender: 'bot',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, resultMessage]);

      // AI 최적화 모드 종료
      setAiOptimizationState({
        isActive: false,
        questions: [],
        currentQuestionIndex: 0,
        answers: {},
        isProcessing: false
      });
    }, 300); // 1000ms → 300ms로 단축
  } catch (error) {
    clearInterval(progressInterval);
    console.error('AI 자동 최적화 실패:', error);

    // 처리 중 메시지 제거
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
