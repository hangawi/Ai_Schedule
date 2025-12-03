import React from 'react';
import { Zap, WandSparkles, MessageSquare, Clock, Calendar, X, RefreshCw, History } from 'lucide-react';

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
  currentWeekStartDate
}) => {
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'ownerFocusTime') {
      setOptions(prev => ({ ...prev, [name]: value }));
    } else {
      setOptions(prev => ({ ...prev, [name]: Number(value) }));
    }
  };

  // 시간/분 입력 처리 (10분 단위 올림)
  const handleTimeChange = (field, value) => {
    const hours = field === 'hours' ? Number(value) : (options.hours || 0);
    const minutes = field === 'minutes' ? Number(value) : (options.minutes || 0);

    // 분을 10분 단위로 올림
    const roundedMinutes = Math.ceil(minutes / 10) * 10;

    // 60분 이상이면 시간으로 변환
    const extraHours = Math.floor(roundedMinutes / 60);
    const finalMinutes = roundedMinutes % 60;
    const finalHours = hours + extraHours;

    // 시간 단위로 변환 (minHoursPerWeek)
    const totalHours = finalHours + (finalMinutes / 60);

    setOptions(prev => ({
      ...prev,
      hours: finalHours,
      minutes: finalMinutes,
      minHoursPerWeek: totalHours
    }));
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
                value={options.hours || 0}
                onChange={(e) => handleTimeChange('hours', e.target.value)}
                className="w-full p-1.5 text-sm border rounded-md"
                min="0"
                max="10"
                placeholder="시간"
              />
              <span className="text-xs text-gray-500 mt-0.5 block">시간</span>
            </div>
            <div className="flex-1">
              <input
                type="number"
                value={options.minutes || 0}
                onChange={(e) => handleTimeChange('minutes', e.target.value)}
                className="w-full p-1.5 text-sm border rounded-md"
                min="0"
                max="59"
                placeholder="분"
              />
              <span className="text-xs text-gray-500 mt-0.5 block">분</span>
            </div>
          </div>
          {options.minHoursPerWeek > 0 && (
            <p className="text-xs text-blue-600 mt-1">
              = {options.minHoursPerWeek.toFixed(2)}시간
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">방장 선호 시간</label>
          <select
            name="ownerFocusTime"
            value={options.ownerFocusTime || 'none'}
            onChange={handleInputChange}
            className="w-full p-1.5 text-sm border rounded-md"
          >
            <option value="none">선호도 없음</option>
            <option value="morning">오전 (09-12시)</option>
            <option value="lunch">점심 (12-14시)</option>
            <option value="afternoon">오후 (14-17시)</option>
            <option value="evening">저녁 (17-20시)</option>
          </select>
        </div>
      </div>

      <div className="space-y-2 mt-2">
        {/* 메인 버튼 */}
        <button
          onClick={onRun}
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white py-2 px-3 rounded-lg font-medium hover:from-purple-600 hover:to-purple-700 disabled:from-purple-300 disabled:to-purple-400 transition-all duration-200 shadow-md flex items-center justify-center text-sm"
        >
          <WandSparkles size={16} className="mr-2" />
          {isLoading ? '배정 중...' : '자동 배정 실행'}
        </button>

        {/* 소형 버튼들 그리드 - 2열 2행 */}
        <div className="grid grid-cols-2 gap-2">
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
