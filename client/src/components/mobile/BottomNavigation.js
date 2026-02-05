/**
 * BottomNavigation.js - 하단 네비게이션 바
 *
 * 기능:
 * - 새로고침: 데이터 새로고침 + 스크롤 맨 위로
 * - 카메라: 향후 구현
 * - 채팅: 달력 페이지 채팅 열기
 * - 마이크: 향후 구현
 */

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { RefreshCw, Camera, MessageCircle, Mic } from 'lucide-react';
import './BottomNavigation.css';

const BottomNavigation = ({
   onRefresh,
   onCamera,
   onChat,
   onMic
}) => {
   const [isRefreshing, setIsRefreshing] = useState(false);
   const navigate = useNavigate();
   const location = useLocation();

   // 새로고침 버튼
   const handleRefresh = async () => {
      if (!onRefresh || isRefreshing) return;
      setIsRefreshing(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      try {
         await onRefresh();
      } catch (e) {
         // ignore
      }
      setTimeout(() => setIsRefreshing(false), 600);
   };

   // 카메라 버튼 (사진으로 시간표 만들기) - 달력 페이지가 아니면 달력으로 이동 후 카메라 실행
   const handleCamera = () => {
      if (onCamera) {
         onCamera();
      } else {
         navigate('/mobile/calendar?camera=open');
      }
   };

   // 채팅 버튼 - 달력 페이지가 아니면 달력으로 이동
   const handleChat = () => {
      if (onChat) {
         onChat();
      } else {
         navigate('/mobile/calendar?chat=open');
      }
   };

   // 마이크 버튼 (음성) - 달력 페이지가 아니면 달력으로 이동 후 음성 시작
   const handleMic = () => {
      if (onMic) {
         onMic();
      } else {
         navigate('/mobile/calendar?voice=start');
      }
   };

   return (
      <nav className="bottom-navigation">
         {/* 새로고침 버튼 */}
         <button
            className={`nav-button ${isRefreshing ? 'refreshing' : ''}`}
            onClick={handleRefresh}
            aria-label="새로고침"
            disabled={isRefreshing}
         >
            <RefreshCw size={22} className={isRefreshing ? 'spin' : ''} />
            <span className="nav-label">새로고침</span>
         </button>

         {/* 카메라 버튼 */}
         <button
            className="nav-button"
            onClick={handleCamera}
            aria-label="카메라"
         >
            <Camera size={22} />
            <span className="nav-label">카메라</span>
         </button>

         {/* 채팅 버튼 */}
         <button
            className="nav-button"
            onClick={handleChat}
            aria-label="채팅"
         >
            <MessageCircle size={22} />
            <span className="nav-label">채팅</span>
         </button>

         {/* 마이크 버튼 */}
         <button
            className="nav-button"
            onClick={handleMic}
            aria-label="마이크"
         >
            <Mic size={22} />
            <span className="nav-label">마이크</span>
         </button>
      </nav>
   );
};

export default BottomNavigation;
