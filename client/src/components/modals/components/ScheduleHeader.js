/**
 * ============================================================================
 * ScheduleHeader.js - Schedule Header Component
 * ============================================================================
 */

import React from 'react';
import { ChevronLeft, X } from 'lucide-react';

/**
 * 스케줄 헤더 컴포넌트
 */
const ScheduleHeader = ({ onClose, isEmbedded }) => {
  if (isEmbedded) return null;

  return (
    <div className="bg-gradient-to-r from-purple-600 via-purple-500 to-blue-600 text-white px-5 py-3 flex-shrink-0">
      <div className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
          title="뒤로 가기"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 text-center">
          <h2 className="text-xl font-bold">최적 시간표 추천</h2>
          <p className="text-xs text-purple-100 mt-1">
            충돌 없는 시간표 조합을 찾았습니다
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
        >
          <X size={24} />
        </button>
      </div>
    </div>
  );
};

export default ScheduleHeader;
