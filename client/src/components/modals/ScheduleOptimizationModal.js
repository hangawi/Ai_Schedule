/**
 * ===================================================================================================
 * ScheduleOptimizationModal.js - AI 기반 최적 시간표 제안 및 수정 인터페이스 모달
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/ScheduleOptimizationModal.js
 *
 * 🎯 주요 기능:
 *    - AI가 생성한 여러 시간표 조합(combinations)을 사용자에게 제시.
 *    - 사용자는 좌/우 버튼으로 여러 조합을 탐색할 수 있음.
 *    - 채팅 인터페이스를 통해 자연어 명령으로 현재 보고 있는 시간표를 동적으로 수정.
 *    - 채팅 수정 중 충돌이 발생하면, 사용자에게 해결 옵션을 제시.
 *    - '원본 보기' 기능을 통해 OCR로 추출된 원본 시간표를 확인할 수 있음.
 *    - 최종적으로 마음에 드는 시간표를 선택하고 적용 범위를 지정하여 저장.
 *
 * 🔗 연결된 파일:
 *    - ./utils/* - 데이터 변환(createInitialCombinations, convertToPersonalTimes) 및 시간 계산 로직.
 *    - ./hooks/useModalState.js - 이 모달의 복잡한 모든 상태를 중앙에서 관리하는 커스텀 훅.
 *    - ./handlers/* - 이전/다음, 선택, 충돌 해결, 채팅 제출 등 모든 이벤트 핸들러를 생성하는 팩토리 함수.
 *    - ./components/* - 헤더, 범례, 그리드, 채팅 등 UI를 구성하는 하위 컴포넌트.
 *
 * 💡 UI 위치:
 *    - AI 채팅을 통해 시간표 이미지(OCR)를 올리고 분석이 완료되면, 최적화된 시간표 후보들을 보여주기 위해 나타나는 핵심 모달.
 *
 * ✏️ 수정 가이드:
 *    - 이 컴포넌트는 UI 뼈대만 제공하고, 대부분의 로직은 `hooks`와 `handlers` 폴더의 파일들로 분리되어 있습니다.
 *    - 상태 관리 로직을 변경하려면 `useModalState.js`를 수정합니다.
 *    - 각 버튼의 동작 로직을 변경하려면 `handlers` 폴더 내의 해당 핸들러 생성 함수를 수정합니다.
 *    - UI 레이아웃을 변경하려면 이 파일의 JSX나 `components` 폴더의 하위 컴포넌트를 수정합니다.
 *
 * 📝 참고사항:
 *    - '리팩토링 완료'된 파일로, 관심사 분리(Separation of Concerns)가 잘 적용된 모범적인 사례입니다.
 *    - `isEmbedded` prop을 통해 일반 모달 형태뿐만 아니라 페이지 전체를 차지하는 뷰로도 렌더링될 수 있습니다.
 *    - Undo/Redo(실행 취소/다시 실행) 기능을 위해 `scheduleHistory`와 `redoStack` 상태를 관리합니다.
 *
 * ===================================================================================================
 */

import React, { useMemo, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import OriginalScheduleModal from './OriginalScheduleModal';

// Utils
import { convertToPersonalTimes, getTotalClassHours } from './utils/scheduleTransform';
import { getTimeRange } from './utils/timeUtils';

// Hooks
import { useModalState } from './hooks/useModalState';
import { useChatScroll } from './hooks/useChatScroll';

// Handlers
import { createHandlePrevious, createHandleNext, createHandleSelectSchedule } from './handlers/scheduleModalHandlers';
import { createHandleConflictResolution, createHandleOptionSelection } from './handlers/conflictModalHandlers';
import { createHandleChatSubmit } from './handlers/chatModalHandlers';

// Components
import ScheduleHeader from './components/ScheduleHeader';
import ScheduleLegend from './components/ScheduleLegend';
import ScheduleGrid from './components/ScheduleGrid';
import ApplyScopeSelector from './components/ApplyScopeSelector';
import ChatArea from './components/ChatArea';

/**
 * ScheduleOptimizationModal
 * @description AI가 추천하는 여러 시간표 조합을 보여주고, 사용자가 채팅을 통해 수정하며 최종안을 선택할 수 있도록 하는 복합 모달.
 * @param {object} props - 컴포넌트 props
 * @param {Array} props.combinations - AI가 생성한 시간표 조합의 배열.
 * @param {Array} props.initialSchedules - 최적화의 기반이 된 원본 스케줄 목록.
 * @param {function} props.onSelect - 사용자가 최종 시간표를 선택했을 때 호출되는 콜백.
 * @param {function} props.onClose - 모달을 닫는 함수.
 * @param {function} props.onSchedulesApplied - '전체 적용' 또는 '빈 시간만 적용'이 선택된 후 호출되는 콜백.
 * @param {number} props.userAge - 사용자 나이 (AI 프롬프트에 활용).
 * @param {string} props.gradeLevel - 사용자 학년 (AI 프롬프트에 활용).
 * @param {boolean} [props.isEmbedded=false] - 모달이 아닌 전체 페이지로 임베드되는지 여부.
 * @param {Array|null} [props.schedulesByImage=null] - 이미지별로 그룹화된 스케줄 데이터 (범례 표시에 사용).
 * @param {Array} [props.fixedSchedules=[]] - 사용자가 고정한 스케줄 목록.
 * @param {Array} [props.customSchedulesForLegendProp=[]] - 범례에 표시할 커스텀 스케줄 목록.
 * @param {string} [props.overallTitle='업로드된 시간표'] - 모달 상단에 표시될 전체 제목.
 * @returns {JSX.Element|null}
 */
const ScheduleOptimizationModal = ({
  combinations: initialCombinations, // prop 이름 변경
  initialSchedules,
  onSelect,
  onClose,
  onSchedulesApplied,
  userAge,
  gradeLevel,
  isEmbedded = false,
  isMobile = false,
  schedulesByImage = null,
  fixedSchedules = [],
  customSchedulesForLegend: customSchedulesForLegendProp = [],
  overallTitle = '업로드된 시간표'
}) => {
  console.log('📥 [ScheduleOptimizationModal] Props 수신:', {
    initialCombinations,
    combinationsLength: initialCombinations?.length || 0,
    firstCombinationLength: initialCombinations?.[0]?.length || 0,
    firstCombinationType: initialCombinations?.[0] ? typeof initialCombinations[0] : 'undefined'
  });
  // 상태 관리
  const {
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
  } = useModalState(
    initialCombinations,
    fixedSchedules,
    customSchedulesForLegendProp
  );

  // 자동 스크롤
  useChatScroll(chatContainerRef, chatMessages);

  // 현재 조합 가져오기
  console.log('🔍 [ScheduleOptimizationModal] 현재 조합 체크:', {
    modifiedCombinations,
    combinationsLength: modifiedCombinations?.length || 0,
    currentIndex,
    hasCurrentCombination: !!modifiedCombinations?.[currentIndex]
  });

  if (!modifiedCombinations || modifiedCombinations.length === 0 || currentIndex >= modifiedCombinations.length) {
    console.warn('⚠️ [ScheduleOptimizationModal] 조합 없음 - null 반환');
    return null;
  }

  const currentCombination = modifiedCombinations[currentIndex];
  console.log('✅ [ScheduleOptimizationModal] 현재 조합:', {
    currentCombination,
    isArray: Array.isArray(currentCombination),
    length: currentCombination?.length || 0,
    firstSchedule: currentCombination?.[0]
  });
  if (!currentCombination || !Array.isArray(currentCombination)) {
    return null;
  }

  // 변환
  const personalTimes = convertToPersonalTimes(currentCombination, hoveredImageIndex);
  console.log('🔄 [ScheduleOptimizationModal] 변환 결과:', {
    personalTimes,
    personalTimesLength: personalTimes?.length || 0,
    currentCombinationLength: currentCombination?.length || 0
  });
  
  const timeRange = getTimeRange(currentCombination, personalTimes, currentFixedSchedules);
  console.log('⏰ [ScheduleOptimizationModal] timeRange:', timeRange);

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
    setAiOptimizationState,
    gradeLevel, // 전달
    userAge // 전달
  );

  const modalContent = (
    <div
      className="bg-white rounded-xl shadow-2xl w-full my-auto overflow-hidden flex flex-col isolate"
      style={
        isEmbedded
          ? { maxWidth: '100%', maxHeight: '100%', height: '100%', borderRadius: 0, boxShadow: 'none' }
          : isMobile
          ? { maxWidth: '500px', width: '95%', maxHeight: '80vh', height: '80vh', borderRadius: '12px' }
          : { maxWidth: '7xl', maxHeight: '85vh' }
      }
    >
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
        <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000] overflow-y-auto ${isMobile ? 'p-2' : 'p-6'}`}>
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
