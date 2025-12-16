/**
 * ===================================================================================================
 * TravelModeButtons.js - 이동 수단 선택 버튼 그룹 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/coordination
 *
 * 🎯 주요 기능:
 *    - '일반', '대중교통', '자동차', '자전거', '도보' 등 다양한 이동 수단을 선택하는 버튼 그룹 제공
 *    - 현재 선택된 이동 수단을 시각적으로 강조하여 표시
 *    - 각 버튼 클릭 시 선택된 모드를 부모 컴포넌트로 전달
 *    - `disabled` prop을 통해 버튼 그룹 전체를 비활성화하는 기능
 *
 * 🔗 연결된 파일:
 *    - CoordinationTab/index.js - 이 컴포넌트를 사용하여 이동 수단 모드를 변경
 *    - lucide-react: 아이콘 라이브러리
 *
 * 💡 UI 위치:
 *    - 조율 탭 > 타임테이블 상단의 컨트롤 영역
 *
 * ✏️ 수정 가이드:
 *    - 새로운 이동 수단 추가: `modes` 배열에 새로운 모드 객체({ id, label, icon, color }) 추가
 *    - 버튼 스타일 변경: `getButtonClasses` 함수 내의 Tailwind CSS 클래스 수정
 *
 * 📝 참고사항:
 *    - '일반' 모드는 이동 시간을 고려하지 않는 기본 상태를 의미합니다.
 *    - 각 이동 수단은 서로 다른 색상 테마를 가지고 있어 시각적 구분이 용이합니다.
 *    - `disabled` 상태일 때는 모든 버튼이 비활성화되고, 사용자에게 툴팁으로 안내 메시지를 보여줍니다.
 *
 * ===================================================================================================
 */

import React from 'react';
import { Car, Train, Bike, Footprints, Zap } from 'lucide-react';

/**
 * TravelModeButtons
 *
 * @description 이동 시간 계산에 사용될 이동 수단을 선택하는 버튼 그룹 컴포넌트입니다.
 * @param {Object} props - 컴포넌트 프롭스
 * @param {string} [props.selectedMode='normal'] - 현재 선택된 이동 수단 모드
 *        ('normal', 'transit', 'driving', 'bicycling', 'walking')
 * @param {Function} props.onModeChange - 이동 수단 모드가 변경될 때 호출되는 콜백 함수. 새 모드의 id를 인자로 받습니다.
 * @param {Function} [props.onConfirm] - 이동 수단 모드를 확정할 때 호출되는 콜백 함수
 * @param {boolean} [props.disabled=false] - 버튼을 비활성화할지 여부
 * @param {boolean} [props.isOwner=false] - 방장 여부
 * @param {string} [props.confirmedTravelMode=null] - 확정된 이동수단 모드
 * @param {Object} [props.currentRoom=null] - 현재 방 정보
 * @returns {JSX.Element} 이동 수단 선택 버튼 그룹 UI
 *
 * @example
 * const [mode, setMode] = useState('normal');
 * <TravelModeButtons selectedMode={mode} onModeChange={setMode} onConfirm={handleConfirm} disabled={false} isOwner={true} confirmedTravelMode={null} currentRoom={currentRoom} />
 */
const TravelModeButtons = ({
  selectedMode = 'normal',
  onModeChange,
  onConfirm,
  disabled = false,
  isOwner = false,
  confirmedTravelMode = null,
  currentRoom = null
}) => {
  const modes = [
    { id: 'normal', label: '일반', icon: Zap, color: 'purple' },
    { id: 'transit', label: '대중교통', icon: Train, color: 'blue' },
    { id: 'driving', label: '자동차', icon: Car, color: 'green' },
    { id: 'bicycling', label: '자전거', icon: Bike, color: 'orange' },
    { id: 'walking', label: '도보', icon: Footprints, color: 'gray' }
  ];

  // 1. 조원이면 버튼 완전히 숨김
  if (!isOwner) {
    return null;
  }

  // 2. 방장이고 확정 후: 확정된 모드만 표시 (읽기 전용)
  if (isOwner && confirmedTravelMode) {
    const confirmedMode = modes.find(m => m.id === confirmedTravelMode);
    if (!confirmedMode) return null;

    const Icon = confirmedMode.icon;

    return (
      <div className="flex items-center gap-2 ml-4">
        <div className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 ${
          confirmedMode.color === 'blue' ? 'bg-blue-100 text-blue-700 border border-blue-300' :
          confirmedMode.color === 'green' ? 'bg-green-100 text-green-700 border border-green-300' :
          confirmedMode.color === 'orange' ? 'bg-orange-100 text-orange-700 border border-orange-300' :
          confirmedMode.color === 'gray' ? 'bg-gray-100 text-gray-700 border border-gray-300' :
          'bg-purple-100 text-purple-700 border border-purple-300'
        }`}>
          <Icon size={16} />
          <span>{confirmedMode.label} (확정)</span>
        </div>
        <span className="text-xs text-gray-500">
          ✓ 이동수단이 확정되어 변경할 수 없습니다
        </span>
      </div>
    );
  }

  // 3. 방장이고 확정 전이고 타임슬롯이 없으면: 숨김 (자동배정 실행 전)
  if (isOwner && !confirmedTravelMode && (!currentRoom?.timeSlots || currentRoom.timeSlots.length === 0)) {
    return null;
  }

  // 4. 방장이고 확정 전이고 타임슬롯이 있으면: 모든 버튼 표시 (자동배정 실행 후)
  const getButtonClasses = (mode) => {
    const baseClasses = "px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5";

    if (disabled) {
      return `${baseClasses} bg-gray-100 text-gray-400 cursor-not-allowed`;
    }

    const colorMap = {
      purple: selectedMode === mode.id ? 'bg-purple-500 text-white shadow-md' : 'bg-purple-50 text-purple-600 hover:bg-purple-100',
      blue: selectedMode === mode.id ? 'bg-blue-500 text-white shadow-md' : 'bg-blue-50 text-blue-600 hover:bg-blue-100',
      green: selectedMode === mode.id ? 'bg-green-500 text-white shadow-md' : 'bg-green-50 text-green-600 hover:bg-green-100',
      orange: selectedMode === mode.id ? 'bg-orange-500 text-white shadow-md' : 'bg-orange-50 text-orange-600 hover:bg-orange-100',
      gray: selectedMode === mode.id ? 'bg-gray-500 text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
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

      {/* 확정 버튼 (방장만, 확정 전에만) */}
      {onConfirm && (
        <button
          onClick={onConfirm}
          disabled={disabled}
          className="px-4 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-all duration-200 shadow-md disabled:bg-gray-300 disabled:cursor-not-allowed ml-2"
          title="선택한 모드를 조원들에게 표시"
        >
          적용
        </button>
      )}
    </div>
  );
};

export default TravelModeButtons;