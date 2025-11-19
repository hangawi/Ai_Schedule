/**
 * ============================================================================
 * ScheduleGrid.js - Schedule Grid Component
 * ============================================================================
 */

import React from 'react';
import ScheduleGridSelector from '../../tabs/ScheduleGridSelector';

/**
 * 스케줄 그리드 컴포넌트
 */
const ScheduleGrid = ({ personalTimes, currentFixedSchedules, hoveredImageIndex, timeRange }) => {
  return (
    <div className="px-5 py-4 overflow-y-auto flex-1">
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <ScheduleGridSelector
          schedule={[]}
          exceptions={[]}
          personalTimes={personalTimes}
          fixedSchedules={
            hoveredImageIndex !== null
              ? currentFixedSchedules.filter(fixed => fixed.sourceImageIndex === hoveredImageIndex)
              : currentFixedSchedules
          }
          readOnly={true}
          enableMonthView={false}
          showViewControls={false}
          initialTimeRange={timeRange}
          defaultShowMerged={true}
        />
      </div>
    </div>
  );
};

export default ScheduleGrid;
