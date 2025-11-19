/**
 * ============================================================================
 * useChatScroll.js - Chat Auto-Scroll Hook
 * ============================================================================
 */

import { useEffect } from 'react';

/**
 * 채팅 자동 스크롤 Hook
 */
export const useChatScroll = (chatContainerRef, chatMessages) => {
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, chatContainerRef]);
};
