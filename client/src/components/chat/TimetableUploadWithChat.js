/**
 * ===================================================================================================
 * [TimetableUploadWithChat.js] - 이미지 업로드와 채팅 필터링을 결합한 시간표 추출 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > client/src/components/chat/TimetableUploadWithChat.js
 *
 * 🎯 주요 기능:
 *    - 시간표 이미지 업로드 UI 제공 (분석 전)
 *    - 이미지 OCR 분석 후, 추출된 스케줄을 필터링하기 위한 채팅 UI 제공 (분석 후)
 *    - 전체 워크플로우(이미지 선택 -> OCR 처리 -> 채팅 필터링 -> 최종 결과)를 관리
 *    - 분석된 시간표를 시각적으로 보여주고, 채팅을 통해 동적으로 필터링
 *    - 중복 이미지 업로드 시 처리 모달(DuplicateModal) 관리
 *
 * 🔗 연결된 파일:
 *    - ./hooks/*.js: `useImageUpload`, `useChatState` 등 다양한 커스텀 훅을 통해 상태 로직을 분리
 *    - ./handlers/*.js: 이미지 처리, OCR, 채팅 전송 등 복잡한 이벤트 핸들러 로직을 분리
 *    - ./components/*.js: `UploadSection`, `ChatSection` 등 UI를 구성하는 하위 컴포넌트
 *
 * 💡 UI 위치:
 *    - `ChatBox.js` 내의 특정 액션(예: 시간표 업로드 버튼)을 통해 모달 형태로 표시됨
 *
 * ✏️ 수정 가이드:
 *    - 이 컴포넌트는 여러 커스텀 훅과 핸들러의 조합으로 동작하므로, 특정 기능을 수정하려면 해당 훅이나 핸들러 파일을 수정해야 합니다.
 *    - (예: 이미지 업로드 로직 수정 -> `useImageUpload.js`, `./handlers/imageHandlers.js`)
 *    - (예: OCR 처리 로직 수정 -> `./handlers/ocrHandlers.js`)
 *    - (예: 채팅 필터링 로직 수정 -> `./handlers/chatHandlers.js`)
 *    - UI 레이아웃(분석 전/후 화면 전환, 좌우 분할 등)을 변경하려면 이 파일의 JSX 구조를 직접 수정합니다.
 *
 * 📝 참고사항:
 *    - '관심사의 분리' 원칙에 따라 복잡한 상태 로직과 이벤트 핸들러가 각각 커스텀 훅과 핸들러 팩토리 함수로 모듈화되어 있습니다.
 *    - 분석 전에는 업로드 UI만 보이고, 분석이 완료되면 화면이 '시간표 뷰 + 채팅 뷰'로 전환됩니다.
 *
 * ===================================================================================================
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

/**
 * TimetableUploadWithChat
 *
 * @description 시간표 이미지 업로드, OCR 분석, 채팅을 통한 결과 필터링, 최종 스케줄 확정까지의 전체 과정을 담당하는 고수준 컴포넌트.
 * @param {object} props - 컴포넌트 props
 * @param {function} props.onSchedulesExtracted - 최종 확정된 스케줄을 상위 컴포넌트로 전달하는 콜백 함수.
 * @param {function} props.onClose - 모달을 닫을 때 호출되는 함수.
 * @returns {JSX.Element}
 */
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