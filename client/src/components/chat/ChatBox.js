/**
 * ===================================================================================================
 * [ChatBox.js] - AI 일정 도우미 채팅 UI 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > client/src/components/chat/ChatBox.js
 *
 * 🎯 주요 기능:
 *    - 모든 탭에서 공통으로 사용되는 플로팅 채팅 인터페이스 제공
 *    - 사용자 메시지 입력 및 AI 응답 표시
 *    - 시간표 이미지 업로드 및 스케줄 최적화 모달 트리거
 *    - 탭별 컨텍스트에 맞는 채팅 기능 위임 (onSendMessage)
 *
 * 🔗 연결된 파일:
 *    - ./TimetableUploadWithChat.js - 시간표 업로드 및 분석 채팅 컴포넌트
 *    - ../modals/ScheduleOptimizationModal.js - 최적 스케줄 제안 모달
 *    - ./hooks/useChatState.js - 채팅 관련 UI 상태 관리 훅
 *    - ./handlers/*.js - 메시지 전송, 스케줄 추가 등 이벤트 핸들러
 *    - ../../SchedulingSystem.js - 앱의 메인 컴포넌트에서 이 ChatBox를 렌더링하고 `onSendMessage` 콜백을 제공
 *
 * 💡 UI 위치:
 *    - 화면 우측 하단에 고정된 플로팅 버튼
 *    - 버튼 클릭 시 채팅창이 열림
 *
 * ✏️ 수정 가이드:
 *    - 채팅창의 전체적인 레이아웃이나 크기를 변경하려면: 이 파일의 JSX 구조 및 `CHAT_SIZE` 상수를 수정합니다.
 *    - 메시지 전송, 스케줄 추출 등 핵심 로직을 수정하려면: ./handlers/ 폴더의 관련 핸들러 파일을 수정합니다.
 *    - 채팅 UI(헤더, 입력창, 메시지 버블)를 수정하려면: ./components/ 폴더의 각 하위 컴포넌트를 수정합니다.
 *
 * 📝 참고사항:
 *    - 이 컴포넌트는 UI의 뼈대를 담당하며, 실제 채팅 로직(AI와의 통신 등)은 `onSendMessage` prop을 통해 상위 컴포넌트(SchedulingSystem)로부터 주입받습니다.
 *    - 모바일과 데스크탑 환경에 따라 동적으로 스타일이 변경됩니다.
 *
 * ===================================================================================================
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

/**
 * ChatBox
 *
 * @description AI 챗봇의 전체 UI를 구성하고 사용자 상호작용을 처리하는 메인 컨테이너 컴포넌트입니다.
 * @param {object} props - 컴포넌트 props
 * @param {function} props.onSendMessage - 메시지 전송 시 호출되는 콜백 함수. 실제 AI 통신 로직을 담고 있음.
 * @param {function} props.speak - TTS(Text-to-Speech) 함수 (현재는 사용되지 않음).
 * @param {string} props.currentTab - 현재 활성화된 탭의 ID.
 * @param {function} props.onEventUpdate - 스케줄이 추가/변경되었을 때 상위 컴포넌트에 알리는 콜백.
 * @returns {JSX.Element}
 */
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