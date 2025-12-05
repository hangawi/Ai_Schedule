/**
 * ===================================================================================================
 * Sidebar.js - 애플리케이션의 사이드바 네비게이션 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/layout
 *
 * 🎯 주요 기능:
 *    - 앱의 주요 기능(탭)으로 이동하는 네비게이션 메뉴 제공
 *    - '새 일정 조율' 모달을 여는 버튼 제공
 *    - 모바일 환경에서 슬라이드 방식으로 표시/숨김 처리
 *    - 각 탭의 활성화 상태를 시각적으로 표시
 *    - 처리되지 않은 요청이 있을 경우 '일정 맞추기' 탭에 뱃지(알림 개수) 표시
 *
 * 🔗 연결된 파일:
 *    - SchedulingSystem.js - 이 컴포넌트를 사용하는 메인 레이아웃 컴포넌트
 *    - lucide-react: 아이콘 라이브러리
 *
 * 💡 UI 위치:
 *    - 데스크톱: 화면 왼쪽에 고정된 네비게이션 바
 *    - 모바일: 화면 왼쪽에서 슬라이드되어 나오는 메뉴
 *
 * ✏️ 수정 가이드:
 *    - 새로운 네비게이션 메뉴 추가: `NavItem` 컴포넌트를 사용하여 새로운 항목을 추가하고, `onClick` 핸들러에 `setActiveTab` 로직 연결
 *    - 메뉴 아이콘 또는 순서 변경: `NavItem` 컴포넌트의 props 또는 순서 변경
 *    - 모바일 슬라이드 애니메이션 변경: `nav` 태그의 Tailwind CSS 클래스(`transform`, `transition-transform`) 수정
 *
 * 📝 참고사항:
 *    - `NavItem`은 사이드바의 각 메뉴 항목을 구성하는 재사용 가능한 컴포넌트입니다.
 *    - 모바일 뷰에서의 사이드바 표시 여부는 `isSidebarOpen` 상태에 의해 제어됩니다.
 *    - 메뉴 항목 클릭 시, 해당 탭을 활성화하고 모바일 사이드바를 닫는 동작이 함께 수행됩니다.
 *
 * ===================================================================================================
 */

import React from 'react';
import { Calendar, CalendarCheck, X, LayoutDashboard, ListTodo, Bot, History } from 'lucide-react';

/**
 * NavItem
 * @description 사이드바의 각 네비게이션 메뉴 항목을 구성하는 컴포넌트입니다.
 * @param {Object} props - 컴포넌트 프롭스
 * @param {JSX.Element} props.icon - 메뉴 아이콘
 * @param {string} props.label - 메뉴 텍스트
 * @param {boolean} props.active - 현재 활성화된 메뉴인지 여부
 * @param {Function} props.onClick - 메뉴 클릭 시 호출될 함수
 * @param {string} [props.badge] - 표시할 알림 뱃지 텍스트
 */
const NavItem = ({ icon, label, active, onClick, badge }) => (
  <button onClick={onClick} className={`w-full flex items-center px-3 py-2 text-sm rounded-lg ${active ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}>
    <span className="mr-2">{icon}</span>
    <span className="flex-1 text-left text-sm">{label}</span>
    {badge && <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{badge}</span>}
  </button>
);

/**
 * Sidebar
 *
 * @description 애플리케이션의 메인 네비게이션 사이드바 컴포넌트입니다.
 * @param {Object} props - 컴포넌트 프롭스
 * @param {boolean} props.isSidebarOpen - (모바일) 사이드바가 열려있는지 여부
 * @param {Function} props.setIsSidebarOpen - 사이드바 열림 상태를 설정하는 함수
 * @param {string} props.activeTab - 현재 활성화된 탭의 ID
 * @param {Function} props.setActiveTab - 활성화된 탭을 변경하는 함수
 * @param {Function} props.setShowCreateModal - '새 일정 조율' 모달을 표시하는 함수
 * @param {number} props.exchangeRequestCount - '일정 맞추기' 탭에 표시할 알림 개수
 * @returns {JSX.Element} 사이드바 컴포넌트 UI
 */
const Sidebar = ({
  isSidebarOpen,
  setIsSidebarOpen,
  activeTab,
  setActiveTab,
  setShowCreateModal,
  exchangeRequestCount
}) => {
  return (
    <>
      <div className={`fixed inset-0 bg-black md:hidden ${isSidebarOpen ? 'bg-opacity-50' : 'bg-opacity-0 pointer-events-none'} transition-opacity duration-300 ease-in-out z-30`} onClick={() => setIsSidebarOpen(false)}></div>
      <nav className={`fixed md:relative inset-y-0 left-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out w-64 bg-white border-r border-gray-200 p-6 z-40 shadow-lg md:shadow-none`}>
        <div className="flex justify-between items-center mb-6 md:hidden">
          <h2 className="text-lg font-bold">메뉴</h2>
          <button onClick={() => setIsSidebarOpen(false)}><X size={24} /></button>
        </div>
        <div className="mb-6">
          <button onClick={() => { setShowCreateModal(true); setIsSidebarOpen(false); }} className="w-full bg-blue-500 text-white px-3 py-2 text-sm rounded-lg hover:bg-blue-600 flex items-center justify-center">
            <span>+ 새 일정 조율</span>
          </button>
        </div>
        <div className="space-y-1">
          <NavItem icon={<LayoutDashboard size={18} />} label="대시보드" active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }} />
          <NavItem icon={<ListTodo size={18} />} label="나의 일정" active={activeTab === 'events'} onClick={() => { setActiveTab('events'); setIsSidebarOpen(false); }} />
          <NavItem icon={<Calendar size={18} />} label="Google 캘린더" active={activeTab === 'googleCalendar'} onClick={() => { setActiveTab('googleCalendar'); setIsSidebarOpen(false); }} />
          <NavItem icon={<History size={18} />} label="조율 내역" active={activeTab === 'proposals'} onClick={() => { setActiveTab('proposals'); setIsSidebarOpen(false); }} />
          <NavItem icon={<CalendarCheck size={18} />} label="일정 맞추기" active={activeTab === 'coordination'} onClick={() => { setActiveTab('coordination'); setIsSidebarOpen(false); }} badge={exchangeRequestCount > 0 ? exchangeRequestCount.toString() : undefined} />
          <NavItem icon={<Bot size={18} />} label="내 AI 비서" active={activeTab === 'agent'} onClick={() => { setActiveTab('agent'); setIsSidebarOpen(false); }} />
        </div>
      </nav>
    </>
  );
};

export default Sidebar;
