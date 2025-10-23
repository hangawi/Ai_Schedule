import React from 'react';
import { Car, Train, Bike, Footprints, Zap } from 'lucide-react';

/**
 * 이동 수단 선택 버튼 컴포넌트
 * @param {string} selectedMode - 현재 선택된 모드 ('normal', 'transit', 'driving', 'bicycling', 'walking')
 * @param {function} onModeChange - 모드 변경 핸들러
 * @param {boolean} disabled - 버튼 비활성화 여부 (자동배정 전)
 */
const TravelModeButtons = ({ selectedMode = 'normal', onModeChange, disabled = false }) => {
  const modes = [
    { id: 'normal', label: '일반', icon: Zap, color: 'purple' },
    { id: 'transit', label: '대중교통', icon: Train, color: 'blue' },
    { id: 'driving', label: '자동차', icon: Car, color: 'green' },
    { id: 'bicycling', label: '자전거', icon: Bike, color: 'orange' },
    { id: 'walking', label: '도보', icon: Footprints, color: 'gray' }
  ];

  const getButtonClasses = (mode) => {
    const baseClasses = "px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5";

    if (disabled) {
      return `${baseClasses} bg-gray-100 text-gray-400 cursor-not-allowed`;
    }

    const colorMap = {
      purple: selectedMode === mode.id
        ? 'bg-purple-500 text-white shadow-md'
        : 'bg-purple-50 text-purple-600 hover:bg-purple-100',
      blue: selectedMode === mode.id
        ? 'bg-blue-500 text-white shadow-md'
        : 'bg-blue-50 text-blue-600 hover:bg-blue-100',
      green: selectedMode === mode.id
        ? 'bg-green-500 text-white shadow-md'
        : 'bg-green-50 text-green-600 hover:bg-green-100',
      orange: selectedMode === mode.id
        ? 'bg-orange-500 text-white shadow-md'
        : 'bg-orange-50 text-orange-600 hover:bg-orange-100',
      gray: selectedMode === mode.id
        ? 'bg-gray-500 text-white shadow-md'
        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
    };

    return `${baseClasses} ${colorMap[mode.color]}`;
  };

  return (
    <div className="flex items-center gap-2 ml-4">
      {modes.map((mode) => {
        const Icon = mode.icon;
        return (
          <button
            key={mode.id}
            onClick={() => !disabled && onModeChange(mode.id)}
            disabled={disabled}
            className={getButtonClasses(mode)}
            title={disabled ? '자동 배정을 먼저 실행해주세요' : `${mode.label} 모드로 전환`}
          >
            <Icon size={16} />
            <span>{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default TravelModeButtons;
