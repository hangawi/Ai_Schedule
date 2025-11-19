/**
 * ============================================================================
 * ChatHeader.js - 채팅창 헤더 컴포넌트
 * ============================================================================
 */

import React from 'react';

/**
 * 채팅창 헤더 컴포넌트
 */
const ChatHeader = ({ currentTab }) => {
  const getTabDescription = () => {
    switch (currentTab) {
      case 'profile':
        return '내 프로필 일정 관리';
      case 'events':
        return '나의 일정 관리';
      case 'googleCalendar':
        return 'Google 캘린더 관리';
      default:
        return '일정 추가, 수정, 삭제를 도와드립니다';
    }
  };

  return (
    <div className="bg-blue-500 text-white p-3 rounded-t-lg">
      <h3 className="font-semibold">AI 일정 도우미</h3>
      <p className="text-xs opacity-90">
        {getTabDescription()}
      </p>
    </div>
  );
};

export default ChatHeader;
