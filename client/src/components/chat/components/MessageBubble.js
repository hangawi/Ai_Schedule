/**
 * ===================================================================================================
 * [MessageBubble.js] - AI 채팅창의 메시지 버블 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > client/src/components/chat/components/MessageBubble.js
 *
 * 🎯 주요 기능:
 *    - 사용자 및 AI 메시지를 시각적으로 구분하여 표시
 *    - 로딩, 성공, 오류 등 메시지 상태에 따른 시각적 피드백 제공
 *    - 스케줄 충돌 해결, 시간 추천, 스케줄 추가/확인 버튼 등 다양한 인터랙티브 요소 포함
 *    - 사용자 메시지에 이미지 미리보기 표시
 *
 * 🔗 연결된 파일:
 *    - ../ChatBox.js: 메인 채팅창에서 AI와의 대화 메시지를 렌더링
 *    - ../TimetableUploadWithChat.js: `SimpleMessageBubble`을 사용하여 시간표 업로드 모달 내 필터링 채팅 메시지를 렌더링
 *    - ./ConflictActions.js: 스케줄 충돌 시 액션 버튼 제공
 *    - ./TimeRecommendations.js, ./SuggestedTimes.js: AI 추천 시간 표시
 *    - ./ScheduleButtons.js: 스케줄 관련 예/아니오 및 기타 액션 버튼 제공
 *    - ./ExtractedSchedules.js: OCR로 추출된 스케줄 목록 표시
 *
 * 💡 UI 위치:
 *    - AI 채팅창 내의 메시지 목록 영역
 *
 * ✏️ 수정 가이드:
 *    - 메시지 버블의 기본 스타일(색상, 모서리 둥글기 등)을 변경하려면: `MESSAGE_STYLES` 상수를 수정합니다.
 *    - 메시지 상태(로딩, 성공, 오류)에 따른 아이콘이나 애니메이션을 변경하려면: 해당 JSX 부분을 수정합니다.
 *    - 포함된 서브 컴포넌트(ConflictActions, TimeRecommendations 등)의 레이아웃이나 기능을 변경하려면: 각 서브 컴포넌트 파일을 수정합니다.
 *
 * 📝 참고사항:
 *    - `MessageBubble`은 복합적인 인터랙티브 메시지를 처리하며, `SimpleMessageBubble`은 간소화된 텍스트 메시지 전용입니다.
 *    - 메시지 객체의 `_isScheduleMessage`, `_showButtons` 등 내부 플래그에 따라 동적으로 UI가 변경됩니다.
 *
 * ===================================================================================================
 */
import React from 'react';
import { MESSAGE_STYLES } from '../constants/chatConstants';
import ConflictActions from './ConflictActions';
import TimeRecommendations, { SuggestedTimes } from './TimeRecommendations';
import ScheduleButtons from './ScheduleButtons';
import ExtractedSchedules from './ExtractedSchedules';

/**
 * 메시지 스타일 결정 함수
 *
 * @description 메시지 객체의 속성을 기반으로 메시지 버블에 적용할 Tailwind CSS 스타일을 결정합니다.
 * @param {object} message - 메시지 객체
 * @returns {string} 메시지 버블에 적용될 Tailwind CSS 클래스 문자열
 */
const getMessageStyle = (message) => {
  if (message.sender === 'user') return MESSAGE_STYLES.USER;
  if (message.isLoading) return MESSAGE_STYLES.LOADING;
  if (message.success === false) return MESSAGE_STYLES.ERROR;
  if (message.success === true) return MESSAGE_STYLES.SUCCESS;
  if (message._isScheduleMessage) return MESSAGE_STYLES.SCHEDULE;
  return MESSAGE_STYLES.DEFAULT;
};

/**
 * 타임스탬프 텍스트 색상 결정 함수
 *
 * @description 메시지 객체의 속성을 기반으로 타임스탬프 텍스트에 적용할 Tailwind CSS 색상 클래스를 결정합니다.
 * @param {object} message - 메시지 객체
 * @returns {string} 타임스탬프 텍스트에 적용될 Tailwind CSS 색상 클래스 문자열
 */
const getTimestampColor = (message) => {
  if (message.sender === 'user') return 'text-blue-100';
  if (message.success === false) return 'text-red-600';
  if (message.success === true) return 'text-green-600';
  return 'text-gray-500';
};

/**
 * MessageBubble
 *
 * @description AI 채팅창에서 개별 메시지를 렌더링하는 컴포넌트. 메시지 유형에 따라 다양한 인터랙티브 요소를 포함할 수 있습니다.
 * @param {object} props - 컴포넌트 props
 * @param {object} props.message - 표시할 메시지 객체. sender, text, isLoading, success, actions, recommendations, suggestedTimes, extractedSchedules, _showButtons, _buttons, _nextStep, _scheduleData, _schedules 등의 속성을 포함할 수 있습니다.
 * @param {function} props.onConflictChoice - 충돌 액션 버튼 클릭 시 호출되는 콜백 함수.
 * @param {function} props.onTimeSelection - 시간 추천 선택 시 호출되는 콜백 함수.
 * @param {function} props.onAddSchedules - 추출된 스케줄 추가 버튼 클릭 시 호출되는 콜백 함수.
 * @param {function} props.onShowScheduleModal - 스케줄 최적화 모달 표시를 요청하는 콜백 함수.
 * @param {function} props.setExtractedScheduleData - 추출된 스케줄 데이터를 설정하는 함수.
 * @param {function} props.setShowScheduleModal - 스케줄 최적화 모달의 표시 여부를 설정하는 함수.
 * @param {function} props.setMessages - 채팅 메시지 목록을 업데이트하는 함수.
 * @param {function} props.setInputText - 채팅 입력 필드의 텍스트를 설정하는 함수.
 * @param {function} props.handleSend - 메시지 전송을 처리하는 함수.
 * @returns {JSX.Element}
 */
const MessageBubble = ({
  message,
  onConflictChoice,
  onTimeSelection,
  onAddSchedules,
  onShowScheduleModal,
  setExtractedScheduleData,
  setShowScheduleModal,
  setMessages,
  setInputText,
  handleSend
}) => {
  const messageStyle = getMessageStyle(message);
  const timestampColor = getTimestampColor(message);

  return (
    <div
      className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-sm p-3 rounded-lg text-sm ${messageStyle}`}>
        {/* 이미지 미리보기 (사용자 메시지만) */}
        {message.image && (
          <div className="mb-2">
            <img
              src={message.image}
              alt="업로드된 이미지"
              className="max-w-full h-auto rounded border"
              style={{ maxHeight: '150px' }}
            />
          </div>
        )}

        <div className="flex items-start">
          {message.isLoading && (
            <span className="animate-spin mr-2 mt-0.5">⏳</span>
          )}
          {message.success === true && (
            <span className="mr-2 mt-0.5">✅</span>
          )}
          {message.success === false && (
            <span className="mr-2 mt-0.5">❌</span>
          )}
          <p className="whitespace-pre-line">{message.text}</p>
        </div>

        {/* 충돌 선택 버튼 */}
        <ConflictActions
          actions={message.actions}
          pendingEvent={message.pendingEvent}
          conflictingEvents={message.conflictingEvents}
          onConflictChoice={onConflictChoice}
        />

        {/* 시간 추천 선택 버튼 (충돌 해결용) */}
        {message.recommendations && message.recommendations.length > 0 && (
          <TimeRecommendations
            recommendations={message.recommendations}
            pendingEvent={message.pendingEvent}
            conflictingEvent={message.conflictingEvent}
            nextStep={message._nextStep}
            onTimeSelection={onTimeSelection}
          />
        )}

        {/* 추천 시간대 선택 버튼 (기존 로직 유지) */}
        {message.suggestedTimes && message.suggestedTimes.length > 0 && !message.recommendations && (
          <SuggestedTimes
            suggestedTimes={message.suggestedTimes}
            onSelectTime={(slot) => {
              const timeMessage = `${slot.date} ${slot.start}부터 ${slot.end}까지 일정 추가해줘`;
              setInputText(timeMessage);
            }}
          />
        )}

        {/* 예/아니오 버튼 */}
        {message._showButtons && message._buttons && (
          <ScheduleButtons
            buttons={message._buttons}
            nextStep={message._nextStep}
            scheduleData={message._scheduleData}
            schedules={message._schedules}
            onShowModal={onShowScheduleModal}
            onAddSchedules={onAddSchedules}
            setExtractedScheduleData={setExtractedScheduleData}
            setShowScheduleModal={setShowScheduleModal}
            setMessages={setMessages}
            setInputText={setInputText}
            handleSend={handleSend}
          />
        )}

        {/* 추출된 스케줄 정보 표시 */}
        <ExtractedSchedules
          extractedSchedules={message.extractedSchedules}
          onAddSchedules={onAddSchedules}
        />

        <p className={`text-xs mt-1 ${timestampColor}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
};

/**
 * SimpleMessageBubble
 *
 * @description 간소화된 형태의 메시지 버블 컴포넌트. 주로 텍스트 메시지를 간단하게 표시할 때 사용됩니다.
 * @param {object} props - 컴포넌트 props
 * @param {object} props.message - 표시할 메시지 객체. sender, text 등의 속성을 포함.
 * @returns {JSX.Element}
 */
export const SimpleMessageBubble = ({ message }) => {
  return (
    <div className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] px-3 py-1.5 rounded-lg ${message.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200'}`}>
        <p className="text-xs whitespace-pre-wrap">{message.text}</p>
      </div>
    </div>
  );
};

export default MessageBubble;