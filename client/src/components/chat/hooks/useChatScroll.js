/**
 * ============================================================================
 * useChatScroll.js - 채팅 자동 스크롤 훅
 * ============================================================================
 */

import { useEffect } from 'react';

export const useChatScroll = (chatHistory, chatEndRef) => {
  useEffect(() => {
    console.log('useChatScroll - chatEndRef:', chatEndRef);
    console.log('useChatScroll - chatEndRef.current:', chatEndRef?.current);
    if (chatEndRef && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);
};
