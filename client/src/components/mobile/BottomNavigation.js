/**
 * BottomNavigation.js - 하단 네비게이션 바
 * 
 * 기능:
 * - 새로고침: 페이지 새로고침
 * - 카메라: 향후 구현
 * - 채팅: 향후 구현
 * - 마이크: 향후 구현
 */

import React from 'react';
import './BottomNavigation.css';

const BottomNavigation = () => {
   // 새로고침 버튼
   const handleRefresh = () => {
      window.location.reload();
   };

   // 카메라 버튼 (향후 구현)
   const handleCamera = () => {
      console.log('카메라 버튼 클릭 - 향후 구현');
      alert('카메라 기능은 곧 추가됩니다!');
   };

   // 채팅 버튼 (향후 구현)
   const handleChat = () => {
      console.log('채팅 버튼 클릭 - 향후 구현');
      alert('채팅 기능은 곧 추가됩니다!');
   };

   // 마이크 버튼 (향후 구현)
   const handleMic = () => {
      console.log('마이크 버튼 클릭 - 향후 구현');
      alert('마이크 기능은 곧 추가됩니다!');
   };

   return (
      <nav className="bottom-navigation">
         {/* 새로고침 버튼 */}
         <button 
            className="nav-button"
            onClick={handleRefresh}
            aria-label="새로고침"
         >
            <span className="nav-label">새로고침</span>
         </button>

         {/* 카메라 버튼 */}
         <button 
            className="nav-button"
            onClick={handleCamera}
            aria-label="카메라"
         >
            <span className="nav-label">카메라</span>
         </button>

         {/* 채팅 버튼 */}
         <button 
            className="nav-button"
            onClick={handleChat}
            aria-label="채팅"
         >
            <span className="nav-label">채팅</span>
         </button>

         {/* 마이크 버튼 */}
         <button 
            className="nav-button"
            onClick={handleMic}
            aria-label="마이크"
         >
            <span className="nav-label">마이크</span>
         </button>
      </nav>
   );
};

export default BottomNavigation;
