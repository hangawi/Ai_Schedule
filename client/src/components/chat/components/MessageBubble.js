/**
 * ============================================================================
 * MessageBubble.js - 메시지 버블 컴포넌트
 * ============================================================================
 */

import React from 'react';
import { MESSAGE_STYLES } from '../constants/chatConstants';
import ConflictActions from './ConflictActions';
import TimeRecommendations, { SuggestedTimes } from './TimeRecommendations';
import ScheduleButtons from './ScheduleButtons';
import ExtractedSchedules from './ExtractedSchedules';

/**
 * 메시지 스타일 결정 함수
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
 */
const getTimestampColor = (message) => {
  if (message.sender === 'user') return 'text-blue-100';
  if (message.success === false) return 'text-red-600';
  if (message.success === true) return 'text-green-600';
  return 'text-gray-500';
};

/**
 * 메시지 버블 컴포넌트
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

export default MessageBubble;
