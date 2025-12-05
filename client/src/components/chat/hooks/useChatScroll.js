/**
 * ===================================================================================================
 * useChatScroll.js - 채팅 자동 스크롤 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/chat/hooks
 *
 * 🎯 주요 기능:
 *    - 채팅 기록(chatHistory)이 업데이트될 때마다 채팅창을 맨 아래로 부드럽게 스크롤
 *
 * 🔗 연결된 파일:
 *    - ../components/ChatSection.js - 이 훅을 사용하여 채팅창 스크롤을 관리
 *
 * 💡 UI 위치:
 *    - 챗봇 화면 > 채팅 메시지 영역
 *
 * ✏️ 수정 가이드:
 *    - 스크롤 동작 변경: `scrollIntoView`의 `behavior` 옵션 수정 (예: 'auto')
 *    - 스크롤 조건 변경: `useEffect`의 의존성 배열 또는 내부 로직 수정
 *
 * 📝 참고사항:
 *    - 이 훅은 `chatHistory` 배열이 변경될 때마다 실행됩니다.
 *    - `chatEndRef`는 스크롤의 타겟이 되는 DOM 엘리먼트(보통 채팅창의 맨 아래에 위치한 빈 div)의 ref입니다.
 *
 * ===================================================================================================
 */

import { useEffect } from 'react';

/**
 * useChatScroll
 *
 * @description 채팅 기록(chatHistory)이 업데이트될 때마다 채팅창을 부드럽게 맨 아래로 스크롤하는 커스텀 훅입니다.
 * @param {Array<Object>} chatHistory - 채팅 메시지 목록. 이 배열이 변경될 때 스크롤이 트리거됩니다.
 * @param {React.MutableRefObject<HTMLDivElement>} chatEndRef - 스크롤의 목적지가 되는 엘리먼트의 ref 객체.
 *
 * @example
 * // ChatSection 컴포넌트 내에서 사용 예시
 * const chatEndRef = useRef(null);
 * useChatScroll(chatHistory, chatEndRef);
 *
 * return (
 *   <div className="chat-messages">
 *     {messages.map(msg => <Message key={msg.id} {...msg} />)}
 *     <div ref={chatEndRef} />
 *   </div>
 * );
 *
 * @note
 * - `chatEndRef`가 유효하고 `chatEndRef.current`가 DOM 엘리먼트를 가리킬 때만 스크롤이 실행됩니다.
 * - `{ behavior: 'smooth' }` 옵션 덕분에 스크롤이 부드럽게 이동합니다.
 */
export const useChatScroll = (chatHistory, chatEndRef) => {
  useEffect(() => {
    if (chatEndRef && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, chatEndRef]);
};
