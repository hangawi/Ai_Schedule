/**
 * ============================================================================
 * scrollUtils.js - 스크롤 관련 유틸리티 함수들
 * ============================================================================
 */

/**
 * 특정 ref 요소로 스크롤
 */
export const scrollToElement = (ref, behavior = 'smooth') => {
  ref?.current?.scrollIntoView({ behavior });
};
