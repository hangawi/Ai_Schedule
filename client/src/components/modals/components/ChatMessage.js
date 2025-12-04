/**
 * ===================================================================================================
 * ChatMessage.js - 채팅 메시지 하나를 렌더링하는 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/components/ChatMessage.js
 *
 * 🎯 주요 기능:
 *    - 사용자와 AI(bot)가 보낸 메시지를 각각 다른 스타일(정렬, 색상)의 말풍선으로 표시.
 *    - 메시지 내용, 전송 시간을 표시.
 *    - 메시지 유형에 따라 조건부로 인터랙티브 UI를 렌더링:
 *      - **충돌 발생 시 (`isConflict`):** '새 일정 유지', '기존 일정 유지', '둘 다 유지' 등 충돌 해결 버튼을 표시.
 *      - **사용자 선택 필요 시 (`needsUserChoice`):** AI가 제시하는 여러 옵션 중 하나를 선택할 수 있는 버튼 목록을 표시.
 *
 * 🔗 연결된 파일:
 *    - ./ChatArea.js - 이 컴포넌트를 사용하여 전체 채팅 내역을 렌더링.
 *    - ../handlers/conflictModalHandlers.js - 충돌 및 옵션 선택 버튼 클릭 시 호출될 핸들러 로직.
 *
 * 💡 UI 위치:
 *    - '최적 시간표 제안' 모달의 우측 채팅 영역 내에 표시되는 각 대화 말풍선.
 *
 * ✏️ 수정 가이드:
 *    - 말풍선의 스타일(색상, 모양 등)을 변경하려면 이 파일의 최상위 `div`에 적용된 Tailwind CSS 클래스를 수정합니다.
 *    - 충돌 해결 버튼의 문구나 종류를 변경하려면 JSX 내의 `message.isConflict` 블록을 수정합니다.
 *
 * 📝 참고사항:
 *    - 이 컴포넌트는 대화의 흐름 속에서 직접적인 액션을 유도함으로써 채팅의 상호작용성을 높이는 핵심적인 역할을 합니다.
 *    - 모든 액션은 props로 전달받은 핸들러 함수(`handleConflictResolution` 등)를 호출하여 부모 컴포넌트에 로직 처리를 위임합니다.
 *
 * ===================================================================================================
 */
import React from 'react';

/**
 * ChatMessage
 * @description 채팅 메시지 한 개의 UI를 렌더링합니다. 메시지 유형에 따라 버튼 등 상호작용 가능한 요소를 포함할 수 있습니다.
 * @param {object} props - 컴포넌트 props
 * @param {object} props.message - 표시할 메시지 객체. (sender, text, timestamp, isConflict, needsUserChoice, options 등 포함)
 * @param {object|null} props.conflictState - 현재 발생한 충돌의 상태 정보.
 * @param {function} props.handleConflictResolution - 충돌 해결 버튼 클릭 시 호출될 핸들러.
 * @param {function} props.handleOptionSelection - 옵션 선택 버튼 클릭 시 호출될 핸들러.
 * @returns {JSX.Element}
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
