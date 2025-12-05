import React, { useState, useEffect, useRef } from 'react';
import { Zap, WandSparkles, MessageSquare, Clock, Calendar, X, RefreshCw, History, CheckCircle } from 'lucide-react';

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

  // 자동 배정 실행 시 10분 단위 올림 처리
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
        
        {/* 확정 버튼 */}
        <button
          onClick={onConfirmSchedule}
          disabled={!currentRoom?.timeSlots?.some(slot => slot.assignedBy && slot.status === 'confirmed')}
          className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-2 px-3 rounded-lg font-medium hover:from-green-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 transition-all duration-200 shadow-md flex items-center justify-center text-sm"
        >
          <CheckCircle size={16} className="mr-2" />
          배정 시간 확정
        </button>
        
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
