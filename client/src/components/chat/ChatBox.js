/**
 * ===================================================================================================
 * ChatBox Component (챗봇 컴포넌트)
 * ===================================================================================================
 *
 * 설명: AI 챗봇 인터페이스
 *
 * 주요 기능:
 * - 사용자 메시지 입력
 * - AI 응답 표시
 * - 자동 스크롤
 * - 메시지 히스토리
 *
 * 지원 명령:
 * - 시간 변경: "화요일로 바꿔줘"
 * - 빈 시간 확인: "수요일에 시간 있어?"
 * - 선호시간 추가: "화요일 9시부터 12시 추가"
 *
 * 관련 파일:
 * - server/controllers/chatbotController.js
 * - client/src/components/chat/ChatInterface.js
 *
 * ===================================================================================================
 */

/**
 * ============================================================================
 * ChatBox.js - AI 일정 도우미 채팅 UI (리팩토링 완료)
 * ============================================================================
 *
 * 모든 탭에서 사용되는 메인 채팅 컴포넌트
 * - 오른쪽 하단 고정 버튼으로 표시
 * - 헤더: "AI 일정 도우미"
 *
 * [탭별 기능]
 * - profile: 내 프로필 일정 관리
 * - events: 나의 일정 관리
 * - googleCalendar: Google 캘린더 관리
 * - coordination: 배정 시간 변경 (실제 로직은 useChat.js에서 처리)
 * ============================================================================
 */

import React from 'react';
import { MessageCircle } from 'lucide-react';
import TimetableUploadWithChat from './TimetableUploadWithChat';
import ScheduleOptimizationModal from '../modals/ScheduleOptimizationModal';
import { CHAT_SIZE } from './constants/chatConstants';
import { useGeneralChatState } from './hooks/useChatState';
import { useMobileDetection } from './hooks/useMobileDetection';
import { useScrollToBottom } from './hooks/useScrollToBottom';
import ChatHeader from './components/ChatHeader';
import MessageBubble from './components/MessageBubble';
import ChatInput from './components/ChatInput';
import { createSchedulesExtractedHandler, createAddSchedulesHandler } from './handlers/scheduleHandlers';
import { createConflictChoiceHandler, createTimeSelectionHandler } from './handlers/conflictHandlers';
import { createSendHandler, createKeyPressHandler } from './handlers/messageHandlers';
import { addSchedulesToCalendar } from './utils/scheduleUtils';

const ChatBox = ({ onSendMessage, speak, currentTab, onEventUpdate }) => {
  // 상태 관리
  const {
    messages,
    setMessages,
    inputText,
    setInputText,
    isOpen,
    setIsOpen,
    selectedImage,
    setSelectedImage,
    imagePreview,
    setImagePreview,
    showTimetableUpload,
    setShowTimetableUpload,
    showScheduleModal,
    setShowScheduleModal,
    extractedScheduleData,
    setExtractedScheduleData,
    messagesEndRef,
    imageInputRef,
    removeImage,
  } = useGeneralChatState();

  // 모바일 감지
  const isMobile = useMobileDetection();

  // 자동 스크롤
  useScrollToBottom(messagesEndRef, messages);

  // 핸들러 생성
  const handleSchedulesExtracted = createSchedulesExtractedHandler(
    setMessages,
    setExtractedScheduleData,
    setShowTimetableUpload,
    (schedules, applyScope) => addSchedulesToCalendar(schedules, applyScope, onEventUpdate)
  );

  const handleAddSchedules = createAddSchedulesHandler(onSendMessage, setMessages);

  const handleConflictChoice = createConflictChoiceHandler(
    currentTab,
    onSendMessage,
    setMessages,
    onEventUpdate
  );

  const handleTimeSelection = createTimeSelectionHandler(
    currentTab,
    onSendMessage,
    setMessages,
    onEventUpdate
  );

  const handleSend = createSendHandler(
    messages,
    inputText,
    selectedImage,
    extractedScheduleData,
    onSendMessage,
    setMessages,
    setInputText,
    setShowScheduleModal,
    setExtractedScheduleData,
    removeImage,
    onEventUpdate
  );

  const handleKeyPress = createKeyPressHandler(handleSend);

  return (
    <>
      {/* 채팅 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-4 right-4 w-14 h-14 rounded-full shadow-lg transition-all duration-300 z-50 flex items-center justify-center ${
          isOpen ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
        } text-white`}
      >
        {isOpen ? (
          <span className="font-bold text-lg">AI</span>
        ) : (
          <MessageCircle size={24} />
        )}
      </button>

      {/* 채팅창 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 z-40"
          onClick={() => setIsOpen(false)}
        >
          <div
            className={`fixed ${isMobile ? 'bottom-20 right-2 left-2' : 'bottom-20 right-4'} ${isMobile ? `max-h-[${CHAT_SIZE.MOBILE.MAX_HEIGHT}] h-[${CHAT_SIZE.MOBILE.HEIGHT}]` : `h-[${CHAT_SIZE.DESKTOP.HEIGHT}]`} bg-white rounded-lg shadow-xl border z-50 flex flex-col`}
            onClick={(e) => e.stopPropagation()}
            style={isMobile ? {
              maxHeight: Math.min(750, window.innerHeight * 0.7),
              minHeight: CHAT_SIZE.MOBILE.MIN_HEIGHT
            } : {
              width: CHAT_SIZE.DESKTOP.WIDTH
            }}
          >
            {/* 헤더 */}
            <ChatHeader currentTab={currentTab} />

            {/* 메시지 영역 */}
            <div
              className="overflow-y-auto p-3 space-y-3 flex-1"
              style={{
                minHeight: isMobile ? CHAT_SIZE.MESSAGE_AREA.MOBILE_MIN_HEIGHT : CHAT_SIZE.MESSAGE_AREA.DESKTOP_MIN_HEIGHT,
                maxHeight: isMobile ? CHAT_SIZE.MESSAGE_AREA.MOBILE_MAX_HEIGHT : CHAT_SIZE.MESSAGE_AREA.DESKTOP_MAX_HEIGHT
              }}
            >
              {messages.length === 0 && (
                <div className="text-center text-gray-500 text-sm mt-4">
                  <p className="font-semibold">안녕하세요! 일정 관리를 도와드리겠습니다.</p>
                  <div className="mt-3 text-xs space-y-1">
                    <p><span className="font-medium text-blue-600">추가:</span> "내일 오후 3시 회의 추가해줘"</p>
                    <p><span className="font-medium text-red-600">삭제:</span> "내일 회의 일정 삭제해줘"</p>
                    <p><span className="font-medium text-green-600">수정:</span> "회의 시간을 4시로 수정해줘"</p>
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onConflictChoice={handleConflictChoice}
                  onTimeSelection={handleTimeSelection}
                  onAddSchedules={handleAddSchedules}
                  onShowScheduleModal={() => setShowScheduleModal(true)}
                  setExtractedScheduleData={setExtractedScheduleData}
                  setShowScheduleModal={setShowScheduleModal}
                  setMessages={setMessages}
                  setInputText={setInputText}
                  handleSend={handleSend}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* 입력 영역 */}
            <ChatInput
              inputText={inputText}
              setInputText={setInputText}
              selectedImage={selectedImage}
              isMobile={isMobile}
              onSend={handleSend}
              onKeyPress={handleKeyPress}
              onTimetableUploadClick={() => setShowTimetableUpload(true)}
            />
          </div>
        </div>
      )}

      {/* 시간표 업로드 모달 */}
      {showTimetableUpload && (
        <TimetableUploadWithChat
          onSchedulesExtracted={handleSchedulesExtracted}
          onClose={() => setShowTimetableUpload(false)}
        />
      )}

      {/* 최적 시간표 모달 */}
      {showScheduleModal && extractedScheduleData && (
        <ScheduleOptimizationModal
          combinations={extractedScheduleData.optimalCombinations}
          onSelect={(schedules, applyScope) => {
            handleSchedulesExtracted({
              type: 'schedule_selected',
              schedules: schedules,
              applyScope: applyScope,
              data: extractedScheduleData
            });
            setShowScheduleModal(false);
          }}
          onClose={() => setShowScheduleModal(false)}
          userAge={extractedScheduleData.age}
          gradeLevel={extractedScheduleData.gradeLevel}
        />
      )}
    </>
  );
};

export default ChatBox;
