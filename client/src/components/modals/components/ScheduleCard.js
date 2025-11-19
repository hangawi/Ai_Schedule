/**
 * ============================================================================
 * ScheduleCard.js - Individual Schedule Card Component
 * ============================================================================
 */

import React from 'react';
import { Clock } from 'lucide-react';
import { GRADE_LEVEL_LABELS } from '../constants/modalConstants';

/**
 * 스케줄 카드 렌더링 컴포넌트
 */
const ScheduleCard = ({ schedule, index }) => {
  return (
    <div
      key={index}
      className="bg-white border border-purple-200 rounded-lg p-3 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-semibold text-gray-800 text-sm">
            {schedule.title}
          </h4>
          <div className="flex items-center mt-1 text-xs text-gray-600">
            <Clock size={12} className="mr-1" />
            {schedule.startTime} - {schedule.endTime}
            {schedule.inferredDuration && (
              <span className="ml-2 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
                추정
              </span>
            )}
          </div>
          {schedule.duration && (
            <div className="text-xs text-gray-500 mt-1">
              {schedule.duration}분 수업
            </div>
          )}
        </div>
        {schedule.gradeLevel && (
          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
            {GRADE_LEVEL_LABELS[schedule.gradeLevel]}
          </span>
        )}
      </div>
    </div>
  );
};

export default ScheduleCard;
