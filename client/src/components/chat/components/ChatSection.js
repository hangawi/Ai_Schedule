/**
 * ===================================================================================================
 * [ChatSection.js] - 시간표 분석 후 필터링을 위한 채팅 섹션 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > client/src/components/chat/components/ChatSection.js
 *
 * 🎯 주요 기능:
 *    - OCR로 추출된 스케줄을 필터링하기 위한 채팅 인터페이스 제공
 *    - 채팅 메시지 이력 표시
 *    - 사용자 입력 필드 및 전송 버튼
 *
 * 🔗 연결된 파일:
 *    - ../TimetableUploadWithChat.js: 이 컴포넌트를 사용하여 시간표 분석 후 화면 오른쪽에 채팅 섹션을 구성
 *    - ./MessageBubble.js: `SimpleMessageBubble`을 사용하여 채팅 메시지를 표시
 *
 * 💡 UI 위치:
 *    - '시간표 이미지 업로드' 모달에서 스케줄 분석이 완료된 후, 화면 오른쪽에 표시되는 채팅 영역
 *
 * ✏️ 수정 가이드:
 *    - 채팅 메시지 버블의 스타일을 변경하려면: `./MessageBubble.js`의 `SimpleMessageBubble` 컴포넌트를 수정합니다.
 *    - "생각 중..." 표시 로직을 변경하려면: `isFilteringChat` prop을 사용하는 부분을 수정합니다.
 *
 * 📝 참고사항:
 *    - 이 컴포넌트는 `TimetableUploadWithChat` 컴포넌트 내에서만 사용되며, 스케줄 필터링이라는 특정 목적을 가집니다.
 *
 * ===================================================================================================
 */
import React from 'react';
import { Send, MessageCircle } from 'lucide-react';
import { SimpleMessageBubble } from './MessageBubble';

/**
 * ChatSection
 *
 * @description OCR 분석 후, 추출된 스케줄을 필터링하기 위한 채팅 UI를 렌더링합니다.
 * @param {object} props - 컴포넌트 props
 * @param {Array<object>} props.chatHistory - 표시할 채팅 메시지 배열
 * @param {boolean} props.isFilteringChat - AI가 응답을 생성 중인지 여부 (로딩 인디케이터 표시용)
 * @param {string} props.chatMessage - 현재 입력 필드의 텍스트 값
 * @param {function} props.setChatMessage - 입력 필드 텍스트를 변경하는 상태 설정 함수
 * @param {function} props.handleSendChat - 메시지 전송 및 필터링 요청을 처리하는 함수
 * @param {Array<object>|null} props.extractedSchedules - 필터링의 대상이 되는 원본 추출 스케줄
 * @param {React.RefObject} props.chatEndRef - 채팅 스크롤을 맨 아래로 내리기 위한 ref
 * @returns {JSX.Element}
 */
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