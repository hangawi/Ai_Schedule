/**
 * ============================================================================
 * ChatMessage.js - Individual Chat Message Component
 * ============================================================================
 */

import React from 'react';

/**
 * 채팅 메시지 컴포넌트
 */
const ChatMessage = ({ message, conflictState, handleConflictResolution, handleOptionSelection }) => {
  return (
    <div
      className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
    >
      <div
        className={`max-w-[85%] rounded-2xl text-sm shadow-md ${
          message.sender === 'user'
            ? 'bg-gradient-to-br from-purple-600 to-purple-500 text-white'
            : 'bg-white text-gray-800 border border-gray-100'
        }`}
        style={{
          borderBottomRightRadius: message.sender === 'user' ? '4px' : '16px',
          borderBottomLeftRadius: message.sender === 'bot' ? '4px' : '16px'
        }}
      >
        <p className="px-4 pt-3 pb-1 whitespace-pre-line leading-relaxed">
          {message.text}
          {message.progress !== undefined && (
            <span className="ml-2 text-xs opacity-60">
              {message.progress}%
            </span>
          )}
        </p>

        {/* 충돌 해결 버튼 */}
        {message.isConflict && conflictState && (
          <div className="px-4 pb-3 space-y-2">
            <button
              onClick={() => handleConflictResolution('keep_new')}
              className="w-full px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              ✅ 새 일정 유지 (기존 제거)
            </button>
            <button
              onClick={() => handleConflictResolution('keep_existing')}
              className="w-full px-3 py-2 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              ⏸️ 기존 일정 유지 (새 일정 취소)
            </button>
            <button
              onClick={() => handleConflictResolution('keep_both')}
              className="w-full px-3 py-2 text-sm bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
            >
              ⚠️ 둘 다 유지 (겹침 허용)
            </button>
          </div>
        )}

        {/* 옵션 선택 버튼 */}
        {message.needsUserChoice && message.options && (
          <div className="px-4 pb-3 space-y-2">
            {message.options.map((option, idx) => {
              const daysStr = Array.isArray(option.days) ? option.days.join(', ') : option.days;
              return (
                <button
                  key={idx}
                  onClick={() => handleOptionSelection(option)}
                  className="w-full px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-left"
                >
                  {idx + 1}. {option.title} ({option.instructor || 'N/A'}) - {daysStr} {option.startTime}-{option.endTime}
                </button>
              );
            })}
          </div>
        )}

        <p className={`px-4 pb-2 text-xs ${
          message.sender === 'user' ? 'text-purple-200' : 'text-gray-400'
        }`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
};

export default ChatMessage;
