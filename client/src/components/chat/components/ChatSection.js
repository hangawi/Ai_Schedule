/**
 * ============================================================================
 * ChatSection.js - 채팅 섹션 컴포넌트
 * ============================================================================
 */

import React from 'react';
import { Send, MessageCircle } from 'lucide-react';
import { SimpleMessageBubble } from './MessageBubble';

const ChatSection = ({
  chatHistory,
  isFilteringChat,
  chatMessage,
  setChatMessage,
  handleSendChat,
  extractedSchedules,
  chatEndRef
}) => {
  return (
    <div style={{ width: '30%', display: 'flex', flexDirection: 'column', backgroundColor: '#f9fafb' }}>
      {/* 채팅 메시지 */}
      <div className="p-3" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {chatHistory.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MessageCircle size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-xs">채팅으로 필터링</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {chatHistory.map((msg) => (
              <SimpleMessageBubble key={msg.id} message={msg} />
            ))}
            {isFilteringChat && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 px-3 py-1.5 rounded-lg">
                  <p className="text-xs text-gray-500">생각 중...</p>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* 채팅 입력 */}
      <div className="p-2 border-t bg-white" style={{ flexShrink: 0 }}>
        <div className="flex gap-1">
          <input
            type="text"
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
            disabled={!extractedSchedules || isFilteringChat}
            placeholder="예: 공연반만"
            className="flex-1 px-2 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <button
            onClick={handleSendChat}
            disabled={!extractedSchedules || !chatMessage.trim() || isFilteringChat}
            className="px-2 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatSection;
