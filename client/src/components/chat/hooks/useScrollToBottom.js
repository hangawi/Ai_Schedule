/**
 * ===================================================================================================
 * useScrollToBottom.js - 자동 스크롤 커스텀 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/chat/hooks
 *
 * 🎯 주요 기능:
 *    - 특정 의존성(예: 메시지 목록)이 변경될 때마다 지정된 ref 위치로 스크롤을 부드럽게 이동
 *
 * 🔗 연결된 파일:
 *    - `useGeneralChatState.js` - 이 훅에서 반환하는 `messagesEndRef`와 `messages`를 이 훅에 전달
 *    - 이 훅을 사용하는 채팅 관련 컴포넌트들
 *
 * 💡 UI 위치:
 *    - 챗봇 화면 등 메시지 목록이 있는 모든 스크롤 가능한 컨테이너
 *
 * ✏️ 수정 가이드:
 *    - 스크롤 동작 변경: `scrollIntoView`의 `behavior` 옵션 수정 (예: 'auto')
 *    - 스크롤 트리거 조건 변경: `useEffect`의 의존성 배열(`[messages]`) 수정
 *
 * 📝 참고사항:
 *    - 이 훅은 `useChatScroll`과 유사한 기능을 하지만, 좀 더 범용적인 이름과 파라미터를 가집니다.
 *    - `messagesEndRef`는 스크롤될 컨테이너의 맨 아래에 위치한 타겟 엘리먼트의 ref여야 합니다.
 *
 * ===================================================================================================
 */

import { useEffect } from 'react';

/**
 * useScrollToBottom
 *
 * @description 의존성 배열(`messages`)이 변경될 때마다 지정된 ref(`messagesEndRef`) 위치로
 *              화면을 부드럽게 스크롤하는 커스텀 훅입니다.
 * @param {React.MutableRefObject<HTMLDivElement>} messagesEndRef - 스크롤의 목적지가 되는 엘리먼트의 ref 객체.
 * @param {Array<any>} messages - 스크롤을 트리거할 의존성 배열. 보통 메시지 목록입니다.
 *
 * @example
 * // 채팅 컴포넌트 내에서 사용 예시
 * const messagesEndRef = useRef(null);
 * const { messages } = useGeneralChatState();
 * useScrollToBottom(messagesEndRef, messages);
 *
 * return (
 *   <div className="message-container">
 *     {messages.map(msg => <div key={msg.id}>{msg.text}</div>)}
 *     <div ref={messagesEndRef} />
 *   </div>
 * );
 *
 * @note
 * - `messagesEndRef`와 `messagesEndRef.current`가 유효할 때만 스크롤 동작이 실행됩니다.
 * - 새 메시지가 추가되어 `messages` 배열이 변경되면 `useEffect`가 실행되어 스크롤이 맨 아래로 이동합니다.
 */
export const useScrollToBottom = (messagesEndRef, messages) => {
  useEffect(() => {
    if (messagesEndRef && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, messagesEndRef]);
};
