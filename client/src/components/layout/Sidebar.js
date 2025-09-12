import React from 'react';
import {
   Calendar,
   CalendarCheck,
   X,
   LayoutDashboard,
   ListTodo,
   Bot,
   History
} from 'lucide-react';

const NavItem = ({ icon, label, active, onClick, badge }) => (
  <button onClick={onClick} className={`w-full flex items-center px-3 py-2 text-sm rounded-lg ${active ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}>
    <span className="mr-2">{icon}</span>
    <span className="flex-1 text-left text-sm">{label}</span>
    {badge && <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{badge}</span>}
  </button>
);

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