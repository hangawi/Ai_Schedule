/**
 * ============================================================================
 * ChatInput.js - 채팅 입력 영역 컴포넌트
 * ============================================================================
 */

import React from 'react';
import { Send, Image } from 'lucide-react';

/**
 * 채팅 입력 영역 컴포넌트
 */
const ChatInput = ({
  inputText,
  setInputText,
  selectedImage,
  isMobile,
  onSend,
  onKeyPress,
  onTimetableUploadClick
}) => {
  return (
    <div className="p-3 border-t bg-white rounded-b-lg flex-shrink-0">
      <div className={`flex ${isMobile ? 'space-x-2' : 'space-x-2'}`}>
        {/* 시간표 업로드 버튼 */}
        <button
          onClick={onTimetableUploadClick}
          className={`${isMobile ? 'p-2 w-12 h-12' : 'p-3'} bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center justify-center flex-shrink-0`}
          title="시간표 업로드"
        >
          <Image size={isMobile ? 20 : 18} />
        </button>

        {/* 입력 필드 */}
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={onKeyPress}
          placeholder={selectedImage ? "이미지에 대한 추가 설명 (선택사항)" : "일정을 말씀해주세요..."}
          className={`flex-1 ${isMobile ? 'p-2 text-base' : 'p-3 text-sm'} border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
        />

        {/* 전송 버튼 */}
        <button
          onClick={onSend}
          disabled={!inputText.trim() && !selectedImage}
          className={`${isMobile ? 'p-2 w-12 h-12' : 'p-3'} bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0`}
        >
          <Send size={isMobile ? 20 : 18} />
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
