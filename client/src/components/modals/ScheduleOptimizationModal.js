/**
 * ============================================================================
 * ScheduleOptimizationModal.js - 최적 시간표 모달 (리팩토링 완료)
 * ============================================================================
 */

import React, { useState, useMemo } from 'react';
import { CheckCircle } from 'lucide-react';
import OriginalScheduleModal from './OriginalScheduleModal';

// Utils
import { createInitialCombinations, convertToPersonalTimes, getTotalClassHours } from './utils/scheduleTransform';
import { getTimeRange } from './utils/timeUtils';

// Hooks
import { useModalState } from './hooks/useModalState';
import { useChatScroll } from './hooks/useChatScroll';

// Handlers
import { createHandlePrevious, createHandleNext, createHandleSelectSchedule } from './handlers/scheduleModalHandlers';
import { createHandleConflictResolution, createHandleOptionSelection } from './handlers/conflictModalHandlers';
import { createHandleChatSubmit } from './handlers/chatModalHandlers';
import { createHandleOpenOptimizer } from './handlers/optimizerHandlers';

// Components
import ScheduleHeader from './components/ScheduleHeader';
import ScheduleLegend from './components/ScheduleLegend';
import ScheduleGrid from './components/ScheduleGrid';
import ApplyScopeSelector from './components/ApplyScopeSelector';
import ChatArea from './components/ChatArea';

const ScheduleOptimizationModal = ({
  combinations,
  initialSchedules,
  onSelect,
  onClose,
  onSchedulesApplied,
  userAge,
  gradeLevel,
  isEmbedded = false,
  schedulesByImage = null,
  fixedSchedules = [],
  customSchedulesForLegend: customSchedulesForLegendProp = [],
  overallTitle = '업로드된 시간표'
}) => {
  // 초기 조합 생성
  const initialCombinations = useMemo(
    () => createInitialCombinations(combinations, initialSchedules),
    [combinations, initialSchedules]
  );

  const [modifiedCombinations, setModifiedCombinations] = useState(initialCombinations);

  // 상태 관리
  const {
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
  } = useModalState(
    initialCombinations,
    fixedSchedules,
    customSchedulesForLegendProp,
    modifiedCombinations
  );

  // 자동 스크롤
  useChatScroll(chatContainerRef, chatMessages);

  // 현재 조합 가져오기
  if (!modifiedCombinations || modifiedCombinations.length === 0) {
    return null;
  }

  if (currentIndex >= modifiedCombinations.length) {
    return null;
  }

  const currentCombination = modifiedCombinations[currentIndex];

  if (!currentCombination || !Array.isArray(currentCombination)) {
    return null;
  }

  // 변환
  const personalTimes = convertToPersonalTimes(currentCombination, hoveredImageIndex);
  const timeRange = getTimeRange(currentCombination, personalTimes);

  // 핸들러 생성
  const handlePrevious = createHandlePrevious(currentIndex, setCurrentIndex);
  const handleNext = createHandleNext(currentIndex, modifiedCombinations, setCurrentIndex);
  const handleSelectSchedule = createHandleSelectSchedule(
    currentCombination,
    currentFixedSchedules,
    applyScope,
    onSelect,
    onSchedulesApplied,
    onClose
  );

  const handleConflictResolution = createHandleConflictResolution(
    conflictState,
    schedulesByImage,
    modifiedCombinations,
    currentIndex,
    currentFixedSchedules,
    setModifiedCombinations,
    setCurrentFixedSchedules,
    setConflictState,
    setChatMessages
  );

  const handleOptionSelection = createHandleOptionSelection(
    currentFixedSchedules,
    schedulesByImage,
    modifiedCombinations,
    currentIndex,
    setModifiedCombinations,
    setCurrentFixedSchedules,
    setChatMessages
  );

  const handleChatSubmit = createHandleChatSubmit(
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
  );

  const handleOpenOptimizer = createHandleOpenOptimizer(
    currentCombination,
    originalSchedule,
    modifiedCombinations,
    currentIndex,
    setOriginalSchedule,
    setModifiedCombinations,
    setChatMessages,
    setAiOptimizationState
  );

  const modalContent = (
    <div className="bg-white rounded-xl shadow-2xl max-w-7xl w-full my-auto max-h-[85vh] overflow-hidden flex flex-col isolate" style={isEmbedded ? { maxWidth: '100%', maxHeight: '100%', height: '100%', borderRadius: 0, boxShadow: 'none' } : {}}>
      {/* 헤더 */}
      <ScheduleHeader onClose={onClose} isEmbedded={isEmbedded} />

      {/* 메인 컨텐츠 영역 */}
      <div className="flex flex-row flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {/* 왼쪽: 시간표 영역 */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ width: isEmbedded ? '100%' : 'auto' }}>
          {/* 시간표 제목 */}
          <div className="px-5 py-3 bg-purple-50 border-b border-purple-100 flex-shrink-0">
            <div className="text-center">
              <div className="text-base font-bold text-gray-800">
                {overallTitle}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                총 {currentCombination.length}개 수업 · {getTotalClassHours(currentCombination)}분
              </div>
            </div>

            {/* 범례 */}
            <ScheduleLegend
              schedulesByImage={schedulesByImage}
              customSchedulesForLegend={customSchedulesForLegend}
              hoveredImageIndex={hoveredImageIndex}
              setHoveredImageIndex={setHoveredImageIndex}
              setSelectedImageForOriginal={setSelectedImageForOriginal}
            />
          </div>

          {/* 주간 시간표 그리드 */}
          <ScheduleGrid
            personalTimes={personalTimes}
            currentFixedSchedules={currentFixedSchedules}
            hoveredImageIndex={hoveredImageIndex}
            timeRange={timeRange}
          />

          {/* 적용 범위 선택 */}
          <ApplyScopeSelector applyScope={applyScope} setApplyScope={setApplyScope} />

          {/* 액션 버튼 */}
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex-shrink-0">
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                닫기
              </button>
              <button
                onClick={handleSelectSchedule}
                className="flex-1 px-4 py-2 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors font-medium shadow-lg"
              >
                <CheckCircle size={18} className="inline mr-1.5" />
                이 시간표 선택하기
              </button>
            </div>
          </div>
        </div>

        {/* 오른쪽: 채팅 영역 */}
        <ChatArea
          isEmbedded={isEmbedded}
          schedulesByImage={schedulesByImage}
          customSchedulesForLegend={customSchedulesForLegend}
          hoveredImageIndex={hoveredImageIndex}
          setHoveredImageIndex={setHoveredImageIndex}
          setSelectedImageForOriginal={setSelectedImageForOriginal}
          chatMessages={chatMessages}
          chatContainerRef={chatContainerRef}
          chatEndRef={chatEndRef}
          conflictState={conflictState}
          handleConflictResolution={handleConflictResolution}
          handleOptionSelection={handleOptionSelection}
          chatInput={chatInput}
          setChatInput={setChatInput}
          aiOptimizationState={aiOptimizationState}
          handleChatSubmit={handleChatSubmit}
        />
      </div>
    </div>
  );

  return (
    <>
      {isEmbedded ? modalContent : (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000] p-6 overflow-y-auto">
          <div className="relative z-[1001]">
            {modalContent}
          </div>
        </div>
      )}

      {/* 원본 시간표 모달 */}
      {selectedImageForOriginal && (
        <OriginalScheduleModal
          imageData={selectedImageForOriginal.data}
          imageIndex={selectedImageForOriginal.index}
          onClose={() => setSelectedImageForOriginal(null)}
        />
      )}
    </>
  );
};

export default ScheduleOptimizationModal;
