/**
 * ============================================================================
 * TimetableUploadWithChat.js - 시간표 이미지 업로드 + 채팅 필터링 컴포넌트
 * ============================================================================
 *
 * 기능:
 * 1. 이미지 업로드
 * 2. 채팅으로 원하는 반 선택
 * 3. OCR 분석 후 바로 AI 최적 시간표 모달 띄우기
 */

import React from 'react';
import { X, ArrowLeft } from 'lucide-react';

// Hooks
import { useImageUpload } from './hooks/useImageUpload';
import { useChatState } from './hooks/useChatState';
import { useScheduleState } from './hooks/useScheduleState';
import { useModalState } from './hooks/useModalState';
import { useChatScroll } from './hooks/useChatScroll';
import { useOcrProcessing } from './hooks/useOcrProcessing';

// Handlers
import { createHandleImageSelect, createRemoveImage } from './handlers/imageHandlers';
import { createHandleProcessImages } from './handlers/ocrHandlers';
import { createHandleSendChat } from './handlers/chatHandlers';
import { createHandleSchedulesApplied, createHandleDuplicateRemove, createHandleDuplicateIgnore } from './handlers/modalHandlers';

// Components
import UploadSection from './components/UploadSection';
import ImagePreviewGrid from './components/ImagePreviewGrid';
import ChatSection from './components/ChatSection';
import DuplicateModal from './components/DuplicateModal';
import ProgressBar from './components/ProgressBar';
import ScheduleView from './components/ScheduleView';

const TimetableUploadWithChat = ({ onSchedulesExtracted, onClose }) => {
  // ========================================
  // 상태 관리 (커스텀 훅)
  // ========================================
  const {
    selectedImages,
    setSelectedImages,
    imagePreviews,
    setImagePreviews,
    fileInputRef
  } = useImageUpload();

  const {
    chatMessage,
    setChatMessage,
    chatHistory,
    setChatHistory,
    isFilteringChat,
    setIsFilteringChat,
    chatEndRef
  } = useChatState();

  const {
    originalSchedule,
    setOriginalSchedule,
    scheduleHistory,
    setScheduleHistory,
    redoStack,
    setRedoStack,
    extractedSchedules,
    setExtractedSchedules,
    schedulesByImage,
    setSchedulesByImage,
    baseSchedules,
    setBaseSchedules,
    overallTitle,
    setOverallTitle,
    filteredSchedules,
    setFilteredSchedules,
    fixedSchedules,
    setFixedSchedules,
    customSchedulesForLegend,
    setCustomSchedulesForLegend
  } = useScheduleState();

  const {
    showOptimizationModal,
    setShowOptimizationModal,
    slideDirection,
    setSlideDirection,
    duplicateInfo,
    setDuplicateInfo,
    showDuplicateModal,
    setShowDuplicateModal
  } = useModalState();

  const {
    isProcessing,
    setIsProcessing,
    progress,
    setProgress,
    error,
    setError
  } = useOcrProcessing();

  // ========================================
  // 부수 효과 (커스텀 훅)
  // ========================================
  useChatScroll(chatHistory, chatEndRef);

  // ========================================
  // 핸들러 생성 (팩토리 패턴)
  // ========================================
  const handleImageSelect = createHandleImageSelect(setSelectedImages, setImagePreviews, setError);
  const removeImage = createRemoveImage(selectedImages, imagePreviews, setSelectedImages, setImagePreviews);

  const handleProcessImages = createHandleProcessImages({
    selectedImages,
    setError,
    setIsProcessing,
    setProgress,
    setExtractedSchedules,
    setSchedulesByImage,
    setOriginalSchedule,
    originalSchedule,
    setBaseSchedules,
    setOverallTitle,
    setFilteredSchedules,
    setChatHistory,
    setDuplicateInfo,
    setShowDuplicateModal,
    setSelectedImages,
    setImagePreviews,
    imagePreviews
  });

  const handleSendChat = createHandleSendChat({
    chatMessage,
    extractedSchedules,
    setChatHistory,
    setChatMessage,
    setIsFilteringChat,
    showOptimizationModal,
    setShowOptimizationModal,
    schedulesByImage,
    fixedSchedules,
    originalSchedule,
    scheduleHistory,
    redoStack,
    setScheduleHistory,
    setRedoStack,
    setExtractedSchedules,
    setFilteredSchedules,
    setFixedSchedules,
    setCustomSchedulesForLegend,
    setSlideDirection,
    chatHistory
  });

  const handleSchedulesApplied = createHandleSchedulesApplied({
    setShowOptimizationModal,
    onSchedulesExtracted,
    setChatHistory,
    onClose
  });

  const handleDuplicateRemove = createHandleDuplicateRemove({
    duplicateInfo,
    selectedImages,
    imagePreviews,
    setSelectedImages,
    setImagePreviews,
    setShowDuplicateModal,
    setDuplicateInfo,
    handleProcessImages
  });

  const handleDuplicateIgnore = createHandleDuplicateIgnore({
    setShowDuplicateModal,
    setDuplicateInfo,
    handleProcessImages
  });

  // ========================================
  // JSX 렌더링
  // ========================================
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg" style={{ width: '50vw', height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* 헤더 */}
        <div className="flex justify-between items-center p-4 border-b" style={{ flexShrink: 0 }}>
          <div className="flex items-center gap-3">
            {showOptimizationModal && (
              <button
                onClick={() => setShowOptimizationModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                title="뒤로 가기"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <h2 className="text-xl font-bold">{filteredSchedules ? '최적 시간표' : '시간표 이미지 업로드'}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            disabled={isProcessing || isFilteringChat}
          >
            <X size={20} />
          </button>
        </div>

        {/* 내용 */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          {/* 분석 전: 업로드 UI만 */}
          {!filteredSchedules ? (
            <div className="w-full" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="p-4 flex-1" style={{ overflowY: 'auto' }}>
                <div className="space-y-4">
                  {/* 파일 선택 */}
                  <UploadSection
                    fileInputRef={fileInputRef}
                    handleImageSelect={handleImageSelect}
                    isProcessing={isProcessing}
                  />

                  {/* 이미지 미리보기 */}
                  <ImagePreviewGrid
                    imagePreviews={imagePreviews}
                    removeImage={removeImage}
                    isProcessing={isProcessing}
                  />

                  {/* 에러 메시지 */}
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                      {error}
                    </div>
                  )}
                </div>
              </div>

              {/* 진행률 + 분석 버튼 */}
              {selectedImages.length > 0 && !extractedSchedules && (
                <div className="border-t bg-white" style={{ flexShrink: 0 }}>
                  {/* 진행률 */}
                  <ProgressBar progress={progress} isProcessing={isProcessing} />

                  {/* 분석 버튼 */}
                  <div className="p-4">
                    <button
                      onClick={() => handleProcessImages()}
                      disabled={isProcessing}
                      className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? '분석 중...' : '시간표 분석 시작'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* 분석 후: 왼쪽 시간표 (70%) + 오른쪽 채팅 (30%) */
            <>
              {/* 왼쪽: 시간표 표시 */}
              <ScheduleView
                filteredSchedules={filteredSchedules}
                schedulesByImage={schedulesByImage}
                fixedSchedules={fixedSchedules}
                customSchedulesForLegend={customSchedulesForLegend}
                overallTitle={overallTitle}
                handleSchedulesApplied={handleSchedulesApplied}
              />

              {/* 오른쪽: 채팅 */}
              <ChatSection
                chatHistory={chatHistory}
                isFilteringChat={isFilteringChat}
                chatMessage={chatMessage}
                setChatMessage={setChatMessage}
                handleSendChat={handleSendChat}
                extractedSchedules={extractedSchedules}
                chatEndRef={chatEndRef}
              />
            </>
          )}
        </div>
      </div>

      {/* 중복 이미지 확인 모달 */}
      <DuplicateModal
        showDuplicateModal={showDuplicateModal}
        duplicateInfo={duplicateInfo}
        handleDuplicateRemove={handleDuplicateRemove}
        handleDuplicateIgnore={handleDuplicateIgnore}
      />
    </div>
  );
};

export default TimetableUploadWithChat;
