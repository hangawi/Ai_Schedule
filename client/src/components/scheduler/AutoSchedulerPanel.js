/**
 * ===================================================================================================
 * [파일명] AutoSchedulerPanel.js - 자동 시간 배정 제어판 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > [client/src/components/scheduler/AutoSchedulerPanel.js]
 *
 * 🎯 주요 기능:
 *    - 자동 시간 배정 실행 및 옵션 설정 (주당 최소 시간, 배정 모드)
 *    - 배정 모드 선택 (기본, 선착순, 오늘 기준)
 *    - 자동 확정 타이머 표시 및 실행
 *    - 배정 결과 수동 확정
 *    - 관련 데이터 초기화 기능 (이월시간, 완료시간, 전체 슬롯 등)
 *
 * 🔗 연결된 파일:
 *    - CoordinationTab/index.js (상위 컴포넌트로 추정): 이 패널을 사용하여 자동 배정 기능 제어
 *    - hooks/useCoordination.js (추정): onRun, onConfirmSchedule 등 실제 로직을 담고 있는 훅
 *
 * 💡 UI 위치:
 *    - [협업] 탭 > 우측 사이드바 > [자동 시간 배정] 섹션
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 자동 배정 UI 및 사용자 인터랙션 로직이 변경됨
 *    - 새로운 배정 모드 추가: `getModeLabel`, `handleModeChange` 및 드롭다운 UI에 새 옵션 추가
 *    - 자동 배정 실행 전 로직 변경: `handleRunWithRounding` 함수 수정 (현재 10분 단위 올림 처리)
 *    - 타이머 로직 변경: `useEffect` 훅 내부의 `updateTimer` 함수 수정
 *
 * 📝 참고사항:
 *    - '자동 배정 실행' 버튼 클릭 시, 입력된 분은 10분 단위로 올림 처리된 후 실행됩니다.
 *    - 자동 확정 기능은 방(Room) 정보에 `autoConfirmAt` 타임스탬프가 있을 경우에만 활성화됩니다.
 *    - 이 컴포넌트는 UI와 상태 관리만 담당하며, 실제 API 호출 등 주요 로직은 상위 컴포넌트로부터 props로 전달받습니다.
 *
 * ===================================================================================================
 */
import React, { useState, useEffect, useRef } from 'react';
import { Zap, WandSparkles, MessageSquare, Clock, Calendar, X, RefreshCw, History, CheckCircle } from 'lucide-react';

/**
 * [AutoSchedulerPanel]
 * @description 자동 시간 배정 기능을 제어하는 UI 패널. 사용자는 이 패널을 통해 배정 옵션을 설정하고,
 *              자동 배정을 실행하며, 배정된 스케줄을 확정하거나 관련 데이터를 초기화할 수 있습니다.
 * @param {object} options - 자동 배정 옵션 상태 (minHoursPerWeek, assignmentMode 등)
 * @param {function} setOptions - options 상태를 업데이트하는 함수
 * @param {function} onRun - 자동 배정 실행 함수
 * @param {boolean} isLoading - 자동 배정 실행 중 로딩 상태
 * @param {object} currentRoom - 현재 방 정보 객체 (자동 확정 시간 등에 사용)
 * @param {function} onResetCarryOverTimes - 이월 시간 초기화 함수
 * @param {function} onResetCompletedTimes - 완료 시간 초기화 함수
 * @param {function} onDeleteAllSlots - 모든 자동 배정 슬롯 삭제 함수
 * @param {function} onClearAllCarryOverHistories - 모든 이월 내역 삭제 함수
 * @param {function} onConfirmSchedule - 배정된 스케줄을 확정하는 함수
 * @param {Date} currentWeekStartDate - 현재 주의 시작 날짜 (현재 미사용)
 * @returns {JSX.Element} AutoSchedulerPanel 컴포넌트
 */
const AutoSchedulerPanel = ({
  options,
  setOptions,
  onRun,
  isLoading,
  currentRoom,
  onResetCarryOverTimes,
  onResetCompletedTimes,
  onDeleteAllSlots,
  onClearAllCarryOverHistories,
  onConfirmSchedule,
  currentWeekStartDate
}) => {
  const [shouldRun, setShouldRun] = useState(false);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowModeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getModeLabel = (mode) => {
    const labels = {
      normal: '기본 모드',
      first_come_first_served: '선착순 모드',
      from_today: '오늘 기준 배정'
    };
    return labels[mode] || '기본 모드';
  };

  const handleModeChange = (mode) => {
    setOptions(prev => ({ ...prev, assignmentMode: mode }));
    setShowModeDropdown(false);
  };
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setOptions(prev => ({ ...prev, [name]: Number(value) }));
  };

  // 시간/분 입력 처리 (입력값 그대로 저장)
  const handleTimeChange = (field, value) => {
    const numValue = value === '' ? 0 : Number(value);
    const hours = field === 'hours' ? numValue : (options.hours || 0);
    const minutes = field === 'minutes' ? numValue : (options.minutes || 0);

    // 시간 단위로 변환 (올림 없이 정확한 값)
    const totalHours = hours + (minutes / 60);

    setOptions(prev => ({
      ...prev,
      hours: hours,
      minutes: minutes,
      minHoursPerWeek: totalHours
    }));
  };

  // 상태 업데이트 후 자동 실행
  useEffect(() => {
    if (shouldRun) {
      setShouldRun(false);
      onRun();
    }
  }, [shouldRun, onRun]);
  
  // 기본 assignmentMode 설정
  useEffect(() => {
    if (!options.assignmentMode) {
      setOptions(prev => ({ ...prev, assignmentMode: 'normal' }));
    }
  }, []);

  /**
   * [useEffect - 자동 확정 타이머]
   * @description `currentRoom.autoConfirmAt` 값이 존재할 경우, 남은 시간을 계산하여 1초마다 화면에 업데이트하는 타이머를 설정합니다.
   *              시간이 0이 되면, 자동으로 `onConfirmSchedule(true)`를 호출하여 스케줄을 확정합니다.
   * @note `onConfirmSchedule(true)`의 `true` 인자는 확인 모달 없이 즉시 확정하도록 지시하는 플래그입니다.
   */
  useEffect(() => {
    if (!currentRoom?.autoConfirmAt) {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const confirmTime = new Date(currentRoom.autoConfirmAt);
      const diff = confirmTime - now;

      if (diff <= 0) {
        // 시간 종료 - 자동 확정 실행 (skipConfirm=true로 모달 건너뛰기)
        setTimeRemaining(0);
        if (currentRoom?.timeSlots?.some(slot => slot.assignedBy && slot.status === 'confirmed')) {
          onConfirmSchedule(true); // 자동 확정 시 확인 없이 바로 실행
        }
      } else {
        // 남은 시간 계산
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeRemaining({ minutes, seconds });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [currentRoom?.autoConfirmAt, currentRoom?.timeSlots, onConfirmSchedule]);

  /**
   * [handleRunWithRounding]
   * @description '자동 배정 실행' 버튼 클릭 시 호출되는 핸들러.
   *              사용자가 입력한 시간을 기준으로 분을 10분 단위로 올림(ceiling) 처리한 후,
   *              전체 주당 최소 시간을 재계산하여 상태를 업데이트하고, 실제 배정 실행 함수(onRun)를 호출합니다.
   * @note 상태 업데이트가 비동기적으로 처리되기 때문에, `setShouldRun(true)` 플래그를 사용하여
   *       상태가 완전히 업데이트된 후 `onRun`이 호출되도록 보장합니다.
   */
  const handleRunWithRounding = () => {
    const hours = options.hours || 0;
    const minutes = options.minutes || 0;

    // 분을 10분 단위로 올림
    const roundedMinutes = Math.ceil(minutes / 10) * 10;

    // 60분 이상이면 시간으로 변환
    const extraHours = Math.floor(roundedMinutes / 60);
    const finalMinutes = roundedMinutes % 60;
    const finalHours = hours + extraHours;

    // 시간 단위로 변환
    const totalHours = finalHours + (finalMinutes / 60);

    // 올림된 값으로 업데이트
    setOptions(prev => ({
      ...prev,
      hours: finalHours,
      minutes: finalMinutes,
      minHoursPerWeek: totalHours,
      assignmentMode: prev.assignmentMode || 'normal' // 실행 시 모드 보장
    }));

    // 상태 업데이트 후 실행하도록 플래그 설정
    setShouldRun(true);
  };

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 p-3 rounded-lg shadow-md mb-3 w-full">
      <h3 className="text-base font-bold text-gray-800 mb-2 flex items-center">
        <Zap size={16} className="mr-2 text-purple-600" />
        자동 시간 배정
      </h3>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">주당 최소 시간 (10분 단위 자동 올림)</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="number"
                value={options.hours ?? ''}
                onChange={(e) => handleTimeChange('hours', e.target.value)}
                className="w-full p-1.5 text-sm border rounded-md"
                min="0"
                max="10"
                placeholder="0"
              />
              <span className="text-xs text-gray-500 mt-0.5 block">시간</span>
            </div>
            <div className="flex-1">
              <input
                type="number"
                value={options.minutes ?? ''}
                onChange={(e) => handleTimeChange('minutes', e.target.value)}
                className="w-full p-1.5 text-sm border rounded-md"
                min="0"
                max="59"
                placeholder="0"
              />
              <span className="text-xs text-gray-500 mt-0.5 block">분</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2 mt-2">
        {/* 메인 버튼 */}
        <button
          onClick={handleRunWithRounding}
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white py-2 px-3 rounded-lg font-medium hover:from-purple-600 hover:to-purple-700 disabled:from-purple-300 disabled:to-purple-400 transition-all duration-200 shadow-md flex items-center justify-center text-sm"
        >
          <WandSparkles size={16} className="mr-2" />
          {isLoading ? '배정 중...' : '자동 배정 실행'}
        </button>
        
        {/* 자동 확정 타이머 */}
        {timeRemaining && timeRemaining !== 0 && (
          <div className="w-full bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-300 rounded-lg p-3 mb-2">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Clock size={18} className="text-orange-600 animate-pulse" />
              <span className="font-bold text-orange-700">자동 확정 대기 중</span>
            </div>
            <div className="text-center">
              <div className="text-2xl font-mono font-bold text-orange-600">
                {String(timeRemaining.minutes).padStart(2, '0')}:{String(timeRemaining.seconds).padStart(2, '0')}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {timeRemaining.minutes}분 {timeRemaining.seconds}초 후 자동 확정
              </div>
            </div>
          </div>
        )}

        {/* 확정 버튼 - 자동배정 후에만 표시 */}
        {currentRoom?.timeSlots?.some(slot => slot.assignedBy && slot.status === 'confirmed') && (
          <button
            onClick={onConfirmSchedule}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-2 px-3 rounded-lg font-medium hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-md flex items-center justify-center text-sm"
          >
            <CheckCircle size={16} className="mr-2" />
            {timeRemaining && timeRemaining !== 0 ? '지금 확정하기' : '배정 시간 확정'}
          </button>
        )}
        
        {/* 배정 모드 선택 드롭다운 */}
        <div className="mt-4 mode-dropdown" ref={dropdownRef}>
          <button
            onClick={() => setShowModeDropdown(!showModeDropdown)}
            className="w-full flex items-center justify-between px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-gray-700">📋</span>
              <span className="font-medium text-blue-600">
                {getModeLabel(options.assignmentMode)}
              </span>
            </div>
            <span className="text-gray-400">
              {showModeDropdown ? '▲' : '▼'}
            </span>
          </button>

          {showModeDropdown && (
            <div className="mt-2 border border-gray-200 rounded-lg bg-white shadow-lg overflow-hidden">
              {/* 보통 모드 */}
              <label className="flex items-start px-4 py-3 hover:bg-blue-50 cursor-pointer transition-colors border-b border-gray-100">
                <input
                  type="radio"
                  name="assignmentMode"
                  value="normal"
                  checked={options.assignmentMode === 'normal'}
                  onChange={(e) => handleModeChange(e.target.value)}
                  className="mt-1 mr-3"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">기본 모드</div>
                  <div className="text-xs text-gray-500 mt-1">
                    가능한 시간이 적은 멤버를 우선 배정
                  </div>
                </div>
                {options.assignmentMode === 'normal' && (
                  <span className="text-blue-600 text-xl">✓</span>
                )}
              </label>

              {/* 선착순 모드 */}
              <label className="flex items-start px-4 py-3 hover:bg-blue-50 cursor-pointer transition-colors border-b border-gray-100">
                <input
                  type="radio"
                  name="assignmentMode"
                  value="first_come_first_served"
                  checked={options.assignmentMode === 'first_come_first_served'}
                  onChange={(e) => handleModeChange(e.target.value)}
                  className="mt-1 mr-3"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">선착순 모드</div>
                  <div className="text-xs text-gray-500 mt-1">
                    방에 먼저 들어온 멤버를 우선 배정
                  </div>
                </div>
                {options.assignmentMode === 'first_come_first_served' && (
                  <span className="text-blue-600 text-xl">✓</span>
                )}
              </label>

              {/* 오늘 기준 배정 모드 (신규) */}
              <label className="flex items-start px-4 py-3 hover:bg-blue-50 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="assignmentMode"
                  value="from_today"
                  checked={options.assignmentMode === 'from_today'}
                  onChange={(e) => handleModeChange(e.target.value)}
                  className="mt-1 mr-3"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    🆕 오늘 기준 배정
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    오늘 날짜부터만 배정, 과거 날짜는 제외
                  </div>
                </div>
                {options.assignmentMode === 'from_today' && (
                  <span className="text-blue-600 text-xl">✓</span>
                )}
              </label>
            </div>
          )}
        </div>

        {/* 소형 버튼들 그리드 - 2열 2행 */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          {/* 1열 */}
          <button
            onClick={onResetCarryOverTimes}
            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white py-1.5 px-2 rounded-md font-medium hover:from-blue-600 hover:to-blue-700 text-xs transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center"
          >
            <Clock size={12} className="mr-1" />
            이월초기화
          </button>
          <button
            onClick={onResetCompletedTimes}
            className="bg-gradient-to-r from-green-500 to-green-600 text-white py-1.5 px-2 rounded-md font-medium hover:from-green-600 hover:to-green-700 text-xs transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center"
          >
            <Calendar size={12} className="mr-1" />
            완료초기화
          </button>
          {/* 2열 */}
          <button
            onClick={onClearAllCarryOverHistories}
            className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white py-1.5 px-2 rounded-md font-medium hover:from-yellow-600 hover:to-yellow-700 text-xs transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center"
          >
            <History size={12} className="mr-1" />
            내역 삭제
          </button>
          <button
            onClick={onDeleteAllSlots}
            className="bg-gradient-to-r from-red-500 to-red-600 text-white py-1.5 px-2 rounded-md font-medium hover:from-red-600 hover:to-red-700 disabled:from-red-300 disabled:to-red-400 transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center text-xs"
          >
            <X size={12} className="mr-1" />
            전체 비우기
          </button>
        </div>
      </div>
    </div>
  );
};

export default AutoSchedulerPanel;