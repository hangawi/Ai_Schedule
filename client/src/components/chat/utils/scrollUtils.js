/**
 * ===================================================================================================
 * scrollUtils.js - 스크롤 관련 유틸리티 함수들
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/chat/utils
 *
 * 🎯 주요 기능:
 *    - 지정된 React ref가 가리키는 DOM 요소로 부드럽게 스크롤
 *
 * 🔗 연결된 파일:
 *    - 이 유틸리티를 필요로 하는 모든 컴포넌트 (예: 채팅창, 긴 목록 등)
 *
 * 💡 UI 위치:
 *    - 이 파일은 UI를 직접 렌더링하지 않으며, 특정 UI 요소로 스크롤하는 동작을 구현하는 데 사용됩니다.
 *
 * ✏️ 수정 가이드:
 *    - 기본 스크롤 동작 변경: `scrollToElement` 함수의 `behavior` 기본값을 수정 (예: 'auto')
 *
 * 📝 참고사항:
 *    - `useScrollToBottom`이나 `useChatScroll` 훅과 유사한 기능을 하지만,
 *      이 함수는 훅이 아니므로 컴포넌트의 렌더링 사이클과 독립적으로, 이벤트 핸들러 등에서 직접 호출할 수 있습니다.
 *
 * ===================================================================================================
 */

/**
 * scrollToElement
 *
 * @description React ref 객체가 가리키는 DOM 요소로 화면을 스크롤합니다.
 * @param {React.MutableRefObject<HTMLElement>} ref - 스크롤의 목적지가 되는 엘리먼트의 ref 객체.
 * @param {('smooth'|'auto')} [behavior='smooth'] - 스크롤 애니메이션의 동작 방식.
 *
 * @example
 * const topRef = useRef(null);
 *
 * // 버튼 클릭 시 맨 위로 스크롤
 * <button onClick={() => scrollToElement(topRef)}>맨 위로</button>
 *
 * // ...
 *
 * <div ref={topRef}></div>
 *
 * @note
 * - `ref`와 `ref.current`가 유효할 때만 `scrollIntoView`가 호출됩니다. (Optional Chaining `?.` 사용)
 */
export const scrollToElement = (ref, behavior = 'smooth') => {
  ref?.current?.scrollIntoView({ behavior });
};
