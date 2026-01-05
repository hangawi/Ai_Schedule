/**
 * MobileDashboard.js - 모바일 메인 대시보드
 * 
 * 기능:
 * - 상단: 헤더 (삼선 버튼 등)
 * - 중앙: 3개 메뉴 버튼 (일정, 그룹, 달력)
 * - 하단: 네비게이션 바 (새로고침, 카메라, 채팅, 마이크)
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from './BottomNavigation';
import './MobileDashboard.css';

const MobileDashboard = () => {
   const navigate = useNavigate();

   // 메뉴 버튼 클릭 핸들러
   const handleScheduleClick = () => {
      console.log('일정 버튼 클릭 - 내 프로필 탭으로 이동');
      navigate('/mobile/schedule');
   };

   const handleGroupClick = () => {
      console.log('그룹 버튼 클릭 - 일정맞추기 그룹으로 이동');
      navigate('/mobile/groups');
   };

   const handleCalendarClick = () => {
      console.log('달력 버튼 클릭 - FullCalendar로 이동');
      navigate('/mobile/calendar');
   };

   return (
      <div className="mobile-dashboard">
         {/* 중앙 메뉴 버튼 영역 */}
         <main className="dashboard-content">
            <div className="menu-buttons-container">
               {/* 일정 버튼 */}
               <button 
                  className="menu-card schedule-card"
                  onClick={handleScheduleClick}
               >
                  <h2 className="card-title">일정</h2>
                  <p className="card-description">내 프로필 및 일정 관리</p>
               </button>

               {/* 그룹 버튼 */}
               <button 
                  className="menu-card group-card"
                  onClick={handleGroupClick}
               >
                  <h2 className="card-title">그룹</h2>
                  <p className="card-description">일정맞추기 그룹 목록</p>
               </button>

               {/* 달력 버튼 */}
               <button 
                  className="menu-card calendar-card"
                  onClick={handleCalendarClick}
               >
                  <h2 className="card-title">달력</h2>
                  <p className="card-description">전체 일정 달력 보기</p>
               </button>
            </div>
         </main>

         {/* 하단 네비게이션 */}
         <BottomNavigation />
      </div>
   );
};

export default MobileDashboard;
