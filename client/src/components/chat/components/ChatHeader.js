/**
 * ===================================================================================================
 * [ChatHeader.js] - AI 채팅창의 헤더 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > client/src/components/chat/components/ChatHeader.js
 *
 * 🎯 주요 기능:
 *    - 채팅창의 제목("AI 일정 도우미") 표시
 *    - 현재 활성화된 탭에 따라 동적으로 다른 부제(설명) 표시
 *
 * 🔗 연결된 파일:
 *    - ../ChatBox.js: 이 헤더 컴포넌트를 사용하여 채팅창의 상단부를 구성
 *
 * 💡 UI 위치:
 *    - AI 채팅창의 최상단 헤더 영역
 *
 * ✏️ 수정 가이드:
 *    - 헤더의 제목을 변경하려면: `<h3>` 태그의 내용을 수정합니다.
 *    - 탭별 부제를 변경하거나 추가하려면: `getTabDescription` 함수의 switch-case 문을 수정합니다.
 *
 * 📝 참고사항:
 *    - 이 컴포넌트는 순수하게 UI 표시만 담당하는 Presentational Component 입니다.
 *
 * ===================================================================================================
 */
import React from 'react';

/**
 * ChatHeader
 *
 * @description AI 채팅창의 헤더 UI를 렌더링합니다. 현재 탭에 따라 다른 설명을 보여줍니다.
 * @param {object} props - 컴포넌트 props
 * @param {string} props.currentTab - 현재 활성화된 탭의 ID. (e.g., 'profile', 'events')
 * @returns {JSX.Element}
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