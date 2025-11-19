/**
 * ============================================================================
 * useScrollToBottom.js - 자동 스크롤 커스텀 훅
 * ============================================================================
 */

import { useEffect } from 'react';

/**
 * 메시지 목록 하단으로 자동 스크롤 훅
 */
export const useScrollToBottom = (messagesEndRef, messages) => {
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, messagesEndRef]);
};
