/**
 * ============================================================================
 * ScheduleLegend.js - Schedule Legend Component
 * ============================================================================
 */

import React from 'react';
import { getColorForImageIndex } from '../../../utils/scheduleAnalysis/assignScheduleColors';

/**
 * 스케줄 범례 컴포넌트
 */
const ScheduleLegend = ({
  schedulesByImage,
  customSchedulesForLegend,
  hoveredImageIndex,
  setHoveredImageIndex,
  setSelectedImageForOriginal
}) => {
  if (!schedulesByImage || (schedulesByImage.length <= 1 && (!customSchedulesForLegend || customSchedulesForLegend.length === 0))) {
    return null;
  }

  return (
    <div className="mt-3 pt-3 border-t border-purple-200">
      <div className="flex flex-wrap gap-3 justify-center">
        {schedulesByImage.map((imageData, idx) => {
          const color = getColorForImageIndex(idx);
          const isHovered = hoveredImageIndex === idx;
          return (
            <div
              key={idx}
              className="flex items-center gap-2 cursor-pointer transition-all hover:bg-purple-50 px-2 py-1 rounded"
              onMouseEnter={() => setHoveredImageIndex(idx)}
              onMouseLeave={() => setHoveredImageIndex(null)}
              onClick={() => setSelectedImageForOriginal({ data: imageData, index: idx })}
              title="클릭하여 원본 시간표 전체 보기"
            >
              <div
                className={`w-4 h-4 rounded border-2 transition-all ${isHovered ? 'scale-125' : ''}`}
                style={{ backgroundColor: color.bg, borderColor: color.border }}
              ></div>
              <span className={`text-xs transition-all ${isHovered ? 'text-purple-700 font-bold' : 'text-gray-700'}`}>
                {imageData.title || `이미지 ${idx + 1}`}
              </span>
            </div>
          );
        })}
        {customSchedulesForLegend && customSchedulesForLegend.length > 0 && customSchedulesForLegend.map((customData) => {
          const color = getColorForImageIndex(customData.sourceImageIndex);
          const isHovered = hoveredImageIndex === customData.sourceImageIndex;
          return (
            <div
              key={`custom-${customData.sourceImageIndex}`}
              className="flex items-center gap-2 transition-all hover:bg-purple-50 px-2 py-1 rounded"
              onMouseEnter={() => setHoveredImageIndex(customData.sourceImageIndex)}
              onMouseLeave={() => setHoveredImageIndex(null)}
              title="커스텀 일정"
            >
              <div
                className={`w-4 h-4 rounded border-2 transition-all ${isHovered ? 'scale-125' : ''}`}
                style={{ backgroundColor: color.bg, borderColor: color.border }}
              ></div>
              <span className={`text-xs transition-all ${isHovered ? 'text-purple-700 font-bold' : 'text-gray-700'}`}>
                {customData.title} 📌
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ScheduleLegend;
