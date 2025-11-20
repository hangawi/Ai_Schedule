// Timetable controls component

import React from 'react';
import { Calendar, Grid, Clock, Merge, Split } from 'lucide-react';
import TravelModeButtons from '../../../coordination/TravelModeButtons';
import { saveViewMode } from '../../../../utils/coordinationModeUtils';

const TimetableControls = ({
  viewMode,
  setViewMode,
  showFullDay,
  setShowFullDay,
  showMerged,
  setShowMerged,
  travelMode,
  onTravelModeChange,
  isTravelCalculating,
  currentRoom,
  isOwner,
  scheduleStartHour,
  scheduleEndHour
}) => {
  return (
    <div className="flex justify-between items-center mb-4">
      <div className="flex items-center">
        <h3 className="text-lg font-bold text-gray-800 flex items-center">
          <Calendar size={20} className="mr-2 text-green-600" />
          시간표 ({showFullDay ? '00' : String(scheduleStartHour).padStart(2, '0')}:00 - {showFullDay ? '24' : String(scheduleEndHour).padStart(2, '0')}:00)
        </h3>
        <TravelModeButtons
          selectedMode={travelMode}
          onModeChange={onTravelModeChange}
          disabled={!currentRoom || !currentRoom.timeSlots || currentRoom.timeSlots.length === 0}
        />
        {isTravelCalculating && (
          <span className="ml-2 text-sm text-gray-500">계산 중...</span>
        )}
      </div>
      <div className="flex items-center space-x-2">
        {viewMode === 'month' && (
          <div className="flex items-center space-x-4 text-xs text-gray-600 mr-4">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-sm bg-white border mr-1"></div>
              <span>가능 시간</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-sm bg-blue-500 mr-1"></div>
              <span>내 배정</span>
            </div>
            {!isOwner && (
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-sm bg-purple-500 mr-1"></div>
                <span>배정된 시간</span>
              </div>
            )}
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-sm bg-red-500 mr-1"></div>
              <span>금지 시간</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-sm bg-yellow-500 mr-1"></div>
              <span>협의 중</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-sm bg-green-500 mr-1"></div>
              <span>이동시간</span>
            </div>
          </div>
        )}
        <button
          onClick={() => setShowFullDay(!showFullDay)}
          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
            showFullDay
              ? 'bg-purple-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <Clock size={16} className="mr-1 inline" />
          {showFullDay ? '24시간' : '기본'}
        </button>
        <button
          onClick={() => setShowMerged(!showMerged)}
          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
            showMerged
              ? 'bg-green-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {showMerged ? (
            <>
              <Split size={16} className="mr-1 inline" />
              분할
            </>
          ) : (
            <>
              <Merge size={16} className="mr-1 inline" />
              병합
            </>
          )}
        </button>
        <button
          onClick={() => { setViewMode('week'); saveViewMode('week'); }}
          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'week'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <Grid size={16} className="mr-1 inline" />
          주간
        </button>
        <button
          onClick={() => { setViewMode('month'); saveViewMode('month'); }}
          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'month'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <Calendar size={16} className="mr-1 inline" />
          월간
        </button>
      </div>
    </div>
  );
};

export default TimetableControls;
