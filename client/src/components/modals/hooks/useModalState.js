/**
 * ============================================================================
 * useModalState.js - Modal State Management Hook
 * ============================================================================
 */

import { useState, useRef, useEffect } from 'react';

/**
 * 모달 상태 관리 Hook
 */
export const useModalState = (initialCombinations, fixedSchedules, customSchedulesForLegendProp) => {
  // ⭐ modifiedCombinations를 useState로 초기화
  const [modifiedCombinations, setModifiedCombinations] = useState(initialCombinations || []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [applyScope, setApplyScope] = useState('month');
  const [originalSchedule, setOriginalSchedule] = useState(null);
  const [scheduleHistory, setScheduleHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [selectedSchedules, setSelectedSchedules] = useState({});
  const [aiOptimizationState, setAiOptimizationState] = useState({
    isActive: false,
    questions: [],
    currentQuestionIndex: 0,
    answers: {},
    isProcessing: false
  });
  const [hoveredImageIndex, setHoveredImageIndex] = useState(null);
  const [selectedImageForOriginal, setSelectedImageForOriginal] = useState(null);
  const [currentFixedSchedules, setCurrentFixedSchedules] = useState(fixedSchedules || []);
  const [customSchedulesForLegend, setCustomSchedulesForLegend] = useState(customSchedulesForLegendProp || []);
  const [conflictState, setConflictState] = useState(null);

  const chatEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // fixedSchedules prop 변경 시 동기화
  useEffect(() => {
    setCurrentFixedSchedules(fixedSchedules || []);
  }, [fixedSchedules]);

  // customSchedulesForLegend prop 변경 시 동기화
  useEffect(() => {
    if (customSchedulesForLegendProp && customSchedulesForLegendProp.length > 0) {
      setCustomSchedulesForLegend(customSchedulesForLegendProp);
    }
  }, [customSchedulesForLegendProp]);

  // 모달이 열릴 때 원본 저장 및 환영 메시지
  useEffect(() => {
    // ⭐ 안전 체크: modifiedCombinations가 배열이고 currentIndex가 유효한지 확인
    if (!originalSchedule &&
        Array.isArray(modifiedCombinations) &&
        modifiedCombinations.length > 0 &&
        currentIndex < modifiedCombinations.length &&
        modifiedCombinations[currentIndex]) {
      setOriginalSchedule(JSON.parse(JSON.stringify(modifiedCombinations[currentIndex])));
    }

    if (chatMessages.length === 0) {
      const welcomeMessage = {
        id: Date.now(),
        text: `안녕하세요! 😊\n\n시간표 수정이 필요하시면 말씀해주세요!\n\n예: "금요일 6시까지만", "수요일 공연반 삭제", "아까 시간표로 돌려줘"`,
        sender: 'bot',
        timestamp: new Date()
      };
      setChatMessages([welcomeMessage]);
    }
  }, [modifiedCombinations, currentIndex, originalSchedule, chatMessages.length]);

  return {
    modifiedCombinations,
    setModifiedCombinations,
    currentIndex,
    setCurrentIndex,
    applyScope,
    setApplyScope,
    originalSchedule,
    setOriginalSchedule,
    scheduleHistory,
    setScheduleHistory,
    redoStack,
    setRedoStack,
    chatMessages,
    setChatMessages,
    chatInput,
    setChatInput,
    selectedSchedules,
    setSelectedSchedules,
    aiOptimizationState,
    setAiOptimizationState,
    hoveredImageIndex,
    setHoveredImageIndex,
    selectedImageForOriginal,
    setSelectedImageForOriginal,
    currentFixedSchedules,
    setCurrentFixedSchedules,
    customSchedulesForLegend,
    setCustomSchedulesForLegend,
    conflictState,
    setConflictState,
    chatEndRef,
    chatContainerRef
  };
};
