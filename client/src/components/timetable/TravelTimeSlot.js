/**
 * ===================================================================================================
 * TravelTimeSlot.js - 이동 시간 슬롯 시각화 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/timetable
 *
 * 🎯 주요 기능:
 *    - 이동 시간 슬롯을 시각적으로 렌더링
 *    - 이동 수단(자동차, 대중교통 등)에 따라 다른 아이콘과 색상 표시
 *    - 'compact' 모드와 '상세' 모드의 두 가지 뷰 제공
 *
 * 🔗 연결된 파일:
 *    - ./WeekView.js - 주간 뷰에서 이 컴포넌트를 사용하여 이동 시간을 표시
 *    - ./TimetableGrid.js - 이 컴포넌트를 간접적으로 사용
 *
 * 💡 UI 위치:
 *    - 탭: 조율 탭 (CoordinationTab)
 *    - 섹션: 타임테이블 그리드 내 이동 시간 슬롯
 *
 * ✏️ 수정 가이드:
 *    - 새로운 이동 수단을 추가하려면: getModeIcon, getModeColor, getModeName 함수에 case 추가
 *    - 'compact' 모드 UI 변경: compact prop이 true일 때의 JSX 수정
 *    - '상세' 모드 UI 변경: compact prop이 false일 때의 JSX 수정
 *
 * 📝 참고사항:
 *    - travelSlot prop이 없거나 travelSlot.travelInfo가 없으면 아무것도 렌더링하지 않음
 *    - compact 모드는 주간/월간 뷰와 같이 공간이 제한된 곳에 사용하기 적합
 *
 * ===================================================================================================
 */

import React from 'react';
import { Car, Train, Bike, Footprints, ArrowRight, Clock } from 'lucide-react';

/**
 * TravelTimeSlot - 이동 시간 슬롯을 시각화하는 컴포넌트
 *
 * @description 이동 수단, 출발지, 도착지, 소요 시간 등의 정보를 바탕으로 이동 시간 슬롯을 표시합니다.
 *              'compact' prop을 통해 간단한 버전과 상세 버전을 선택할 수 있습니다.
 *
 * @component
 *
 * @param {Object} props - 컴포넌트 props
 * @param {Object} props.travelSlot - 이동 시간 슬롯 데이터
 * @param {string} props.travelSlot.from - 출발지
 * @param {string} props.travelSlot.to - 도착지
 * @param {Object} props.travelSlot.travelInfo - 이동 정보 (Google Maps API 응답)
 * @param {string} props.travelSlot.travelInfo.durationText - 소요 시간 텍스트 (예: "15분")
 * @param {string} [props.travelSlot.travelInfo.distanceText] - 이동 거리 텍스트 (예: "5.3 km")
 * @param {string} props.travelSlot.travelMode - 이동 수단 ('driving', 'transit', 'bicycling', 'walking')
 * @param {boolean} [props.compact=false] - compact 모드 여부. true이면 간단한 버전으로 표시됩니다.
 *
 * @returns {JSX.Element|null} 이동 시간 슬롯 UI 또는 null
 */
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
