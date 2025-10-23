/**
 * 이동 시간 슬롯 시각화 컴포넌트
 */

import React from 'react';
import { Car, Train, Bike, Footprints, ArrowRight, Clock } from 'lucide-react';

const TravelTimeSlot = ({ travelSlot, compact = false }) => {
  if (!travelSlot || !travelSlot.travelInfo) {
    return null;
  }

  const { from, to, travelInfo, travelMode } = travelSlot;

  // 이동 수단별 아이콘
  const getModeIcon = () => {
    const iconSize = compact ? 14 : 16;
    switch (travelMode) {
      case 'driving':
        return <Car size={iconSize} />;
      case 'transit':
        return <Train size={iconSize} />;
      case 'bicycling':
        return <Bike size={iconSize} />;
      case 'walking':
        return <Footprints size={iconSize} />;
      default:
        return <Clock size={iconSize} />;
    }
  };

  // 이동 수단별 색상
  const getModeColor = () => {
    switch (travelMode) {
      case 'driving':
        return 'bg-green-100 border-green-300 text-green-700';
      case 'transit':
        return 'bg-blue-100 border-blue-300 text-blue-700';
      case 'bicycling':
        return 'bg-orange-100 border-orange-300 text-orange-700';
      case 'walking':
        return 'bg-gray-100 border-gray-300 text-gray-700';
      default:
        return 'bg-purple-100 border-purple-300 text-purple-700';
    }
  };

  // 이동 수단 한글 이름
  const getModeName = () => {
    switch (travelMode) {
      case 'driving':
        return '자동차';
      case 'transit':
        return '대중교통';
      case 'bicycling':
        return '자전거';
      case 'walking':
        return '도보';
      default:
        return '이동';
    }
  };

  if (compact) {
    // 간단한 버전 (주간/월간 뷰용)
    return (
      <div className={`${getModeColor()} border rounded px-2 py-1 text-xs flex items-center justify-between`}>
        <div className="flex items-center gap-1">
          {getModeIcon()}
          <span className="font-medium">이동</span>
        </div>
        <span className="text-xs opacity-75">{travelInfo.durationText}</span>
      </div>
    );
  }

  // 상세 버전 (확장된 뷰용)
  return (
    <div className={`${getModeColor()} border-2 rounded-lg p-3 mb-2`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {getModeIcon()}
          <span className="font-bold text-sm">{getModeName()} 이동</span>
        </div>
        <div className="flex items-center gap-1 text-xs font-semibold">
          <Clock size={12} />
          {travelInfo.durationText}
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="font-medium truncate max-w-[100px]" title={from}>
          {from}
        </span>
        <ArrowRight size={14} className="flex-shrink-0" />
        <span className="font-medium truncate max-w-[100px]" title={to}>
          {to}
        </span>
      </div>

      {travelInfo.distanceText && (
        <div className="mt-2 text-xs opacity-75">
          거리: {travelInfo.distanceText}
        </div>
      )}
    </div>
  );
};

export default TravelTimeSlot;
