import React, { useState } from 'react';
import CoordinationTab from '../tabs/CoordinationTab';
import BottomNavigation from './BottomNavigation';
import './MobileGroupsView.css';

const MobileGroupsView = ({ user }) => {
   const [exchangeRequestCount, setExchangeRequestCount] = useState(0);

   return (
      <div className="mobile-groups-view">
         <div className="groups-header">
            <h1 className="groups-title">일정맞추기 그룹</h1>
            {exchangeRequestCount > 0 && (
               <span className="notification-badge">{exchangeRequestCount}</span>
            )}
         </div>
         
         <div className="groups-content">
            <CoordinationTab 
               user={user} 
               onExchangeRequestCountChange={setExchangeRequestCount}
            />
         </div>

         <BottomNavigation />
      </div>
   );
};

export default MobileGroupsView;
