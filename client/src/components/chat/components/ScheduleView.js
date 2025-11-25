/**
 * ============================================================================
 * ScheduleView.js - 스케줄 뷰 컴포넌트
 * ============================================================================
 */

import React from 'react';
import ScheduleOptimizationModal from '../../modals/ScheduleOptimizationModal';

const ScheduleView = ({
  filteredSchedules,
  schedulesByImage,
  fixedSchedules,
  customSchedulesForLegend,
  overallTitle,
  handleSchedulesApplied
}) => {
  return (
    <div style={{ width: '70%', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid #e5e7eb' }}>
      <ScheduleOptimizationModal
        key={filteredSchedules && Array.isArray(filteredSchedules) ? JSON.stringify(filteredSchedules.map(s => s.title + s.startTime)) : 'default'}
        initialSchedules={filteredSchedules}
        schedulesByImage={schedulesByImage}
        fixedSchedules={fixedSchedules}
        customSchedulesForLegend={customSchedulesForLegend}
        overallTitle={overallTitle}
        onClose={null}
        onSchedulesApplied={handleSchedulesApplied}
        isEmbedded={true}
        hideBackButton={true}
      />
    </div>
  );
};

export default ScheduleView;
