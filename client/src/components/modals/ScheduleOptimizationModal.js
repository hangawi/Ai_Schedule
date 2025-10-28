import React, { useState } from 'react';
import { Calendar, Clock, X, CheckCircle, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatWeeklySchedule, summarizeSchedule } from '../../utils/ocrUtils';
import ScheduleGridSelector from '../tabs/ScheduleGridSelector';

const ScheduleOptimizationModal = ({
  combinations,
  onSelect,
  onClose,
  userAge,
  gradeLevel
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [applyScope, setApplyScope] = useState('month'); // 'week' 또는 'month'

  if (!combinations || combinations.length === 0) {
    return null;
  }

  const currentCombination = combinations[currentIndex];
  const weeklySchedule = formatWeeklySchedule(currentCombination);

  // ScheduleGridSelector를 위해 personalTimes 형식으로 변환
  const personalTimes = currentCombination.map((schedule, index) => {
    if (!schedule.days || schedule.days.length === 0) return null;

    const dayMap = {
      'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4,
      'FRI': 5, 'SAT': 6, 'SUN': 7
    };

    const mappedDays = schedule.days.map(day => dayMap[day] || day).filter(d => d);

    return {
      id: Date.now() + index,
      type: 'study',
      days: mappedDays,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      title: schedule.title || '수업',
      color: '#9333ea',
      description: schedule.description || '',
      isRecurring: true
    };
  }).filter(item => item !== null);

  console.log('📅 Modal personalTimes:', personalTimes);

  // 시간표 데이터에서 최소/최대 시간 추출
  const getTimeRange = () => {
    let minHour = 24;
    let maxHour = 0;

    currentCombination.forEach(schedule => {
      if (schedule.startTime) {
        const startHour = parseInt(schedule.startTime.split(':')[0]);
        minHour = Math.min(minHour, startHour);
      }
      if (schedule.endTime) {
        const endHour = parseInt(schedule.endTime.split(':')[0]);
        maxHour = Math.max(maxHour, endHour + 1); // 끝 시간 +1
      }
    });

    // 최소 9시, 최대 22시로 제한
    minHour = Math.max(Math.min(minHour, 9), 0);
    maxHour = Math.min(Math.max(maxHour, 18), 24);

    return { start: minHour, end: maxHour };
  };

  const timeRange = getTimeRange();

  const dayLabels = {
    MON: '월요일',
    TUE: '화요일',
    WED: '수요일',
    THU: '목요일',
    FRI: '금요일',
    SAT: '토요일',
    SUN: '일요일'
  };

  const gradeLevelLabels = {
    elementary: '초등부',
    middle: '중등부',
    high: '고등부'
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < combinations.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleSelectSchedule = () => {
    onSelect(currentCombination, applyScope); // applyScope 전달
    onClose();
  };

  const getTotalClassHours = () => {
    let total = 0;
    currentCombination.forEach(schedule => {
      if (schedule.duration) {
        total += schedule.duration;
      }
    });
    return total;
  };

  const renderScheduleCard = (schedule, index) => {
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
              {gradeLevelLabels[schedule.gradeLevel]}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-6 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full my-auto max-h-[85vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-5 py-3 rounded-t-xl flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
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

        {/* 사용자 정보 */}
        <div className="px-5 py-3 bg-purple-50 border-b border-purple-100 flex-shrink-0">
          <div className="flex items-center space-x-4 text-xs">
            <div className="flex items-center">
              <span className="font-medium text-gray-700">나이:</span>
              <span className="ml-2 text-gray-900">{userAge}세</span>
            </div>
            <div className="flex items-center">
              <span className="font-medium text-gray-700">학년부:</span>
              <span className="ml-2 text-gray-900">{gradeLevelLabels[gradeLevel]}</span>
            </div>
            <div className="flex items-center ml-auto">
              <CheckCircle size={16} className="text-green-600 mr-2" />
              <span className="text-green-700 font-medium">
                {combinations.length}개의 최적 조합 발견
              </span>
            </div>
          </div>
        </div>

        {/* 조합 네비게이션 */}
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className={`flex items-center px-3 py-1.5 text-sm rounded-lg transition-colors ${
                currentIndex === 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              <ChevronLeft size={20} className="mr-1" />
              이전
            </button>

            <div className="text-center">
              <div className="text-base font-bold text-gray-800">
                조합 {currentIndex + 1} / {combinations.length}
              </div>
              <div className="text-xs text-gray-600">
                총 {currentCombination.length}개 수업 · {getTotalClassHours()}분
              </div>
            </div>

            <button
              onClick={handleNext}
              disabled={currentIndex === combinations.length - 1}
              className={`flex items-center px-3 py-1.5 text-sm rounded-lg transition-colors ${
                currentIndex === combinations.length - 1
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              다음
              <ChevronRight size={20} className="ml-1" />
            </button>
          </div>
        </div>

        {/* 주간 시간표 그리드 */}
        <div className="px-5 py-4 overflow-y-auto flex-1">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <ScheduleGridSelector
              schedule={[]}
              exceptions={[]}
              personalTimes={personalTimes}
              readOnly={true}
              enableMonthView={false}
              showViewControls={false}
              initialTimeRange={timeRange}
            />
          </div>
        </div>

        {/* 시간표 요약 */}
        <div className="px-5 py-3 bg-blue-50 border-t border-blue-100 flex-shrink-0">
          <div className="flex items-start">
            <AlertTriangle size={18} className="text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 mb-1 text-sm">시간표 요약</h4>
              <div className="text-xs text-blue-800 whitespace-pre-line">
                {summarizeSchedule(currentCombination)}
              </div>
            </div>
          </div>
        </div>

        {/* 적용 범위 선택 */}
        <div className="px-5 py-3 bg-blue-50 border-t border-blue-100 flex-shrink-0">
          <div className="flex items-center justify-center gap-3">
            <span className="font-medium text-gray-700 text-sm">적용 범위:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setApplyScope('week')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors font-medium ${
                  applyScope === 'week'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                이번 주만
              </button>
              <button
                onClick={() => setApplyScope('month')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors font-medium ${
                  applyScope === 'month'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                전체 달
              </button>
            </div>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 rounded-b-xl flex-shrink-0">
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              닫기
            </button>
            <button
              onClick={handleSelectSchedule}
              className="flex-1 px-4 py-2 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors font-medium shadow-lg"
            >
              <CheckCircle size={18} className="inline mr-1.5" />
              이 시간표 선택하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleOptimizationModal;
