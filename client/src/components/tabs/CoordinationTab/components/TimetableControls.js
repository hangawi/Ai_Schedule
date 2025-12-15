/**
 * ===================================================================================================
 * [파일명] TimetableControls.js - 시간표 보기 옵션 제어 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > [client/src/components/tabs/CoordinationTab/components/TimetableControls.js]
 *
 * 🎯 주요 기능:
 *    - 협업 방의 시간표(Timetable) 표시 방식을 제어하는 UI 컨트롤들을 모아놓은 컴포넌트.
 *    - 보기 모드 전환 (주간/월간).
 *    - 시간 표시 범위 전환 (기본 시간/24시간).
 *    - 멤버 시간표 표시 방식 전환 (병합/분할).
 *    - 이동수단 선택 및 이동시간 계산 상태 표시.
 *    - 월간 보기 시, 시간표의 색상 범례를 표시.
 *
 * 🔗 연결된 파일:
 *    - ../index.js (CoordinationTab): 이 컴포넌트를 사용하며 모든 상태와 핸들러를 props로 제공.
 *    - ../../../coordination/TravelModeButtons.js: 이동수단 선택 버튼 자식 컴포넌트.
 *    - ../../../../utils/coordinationModeUtils.js: 보기 모드를 사용자의 로컬 저장소에 저장하는 유틸리티.
 *
 * 💡 UI 위치:
 *    - [협업] 탭 > (방 선택 후) > 시간표 상단
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 시간표 상단의 컨트롤 바 UI가 변경됩니다.
 *    - 새로운 보기 옵션 추가: 새로운 버튼과 그에 따른 상태, 핸들러를 `CoordinationTab`에서 props로 전달받아 연결합니다.
 *    - 범례 수정: 월간 보기 시 표시되는 범례의 내용을 JSX 코드에서 직접 수정할 수 있습니다.
 *
 * 📝 참고사항:
 *    - 이 컴포넌트는 UI와 사용자 입력을 담당하며, 실제 상태 변경 로직은 모두 상위 컴포넌트에 위임합니다.
 *    - '주간'/'월간' 버튼 클릭 시 `saveViewMode` 유틸리티를 호출하여 사용자의 선택을 로컬 저장소에 저장, UX를 개선합니다.
 *
 * ===================================================================================================
 */
import React from 'react';
import { Calendar, Grid, Clock, Merge, Split } from 'lucide-react';
import TravelModeButtons from '../../../coordination/TravelModeButtons';
import { saveViewMode } from '../../../../utils/coordinationModeUtils';

/**
 * [TimetableControls]
 * @description 협업 시간표의 다양한 보기 옵션을 제어하는 컨트롤 패널 컴포넌트.
 * @param {string} viewMode - 현재 보기 모드 ('week' 또는 'month').
 * @param {function} setViewMode - 보기 모드를 변경하는 함수.
 * @param {boolean} showFullDay - 24시간 보기 모드 활성화 여부.
 * @param {function} setShowFullDay - 24시간 보기 모드를 토글하는 함수.
 * @param {boolean} showMerged - 멤버 시간표 병합 보기 활성화 여부.
 * @param {function} setShowMerged - 병합 보기를 토글하는 함수.
 * @param {string} travelMode - 현재 선택된 이동수단.
 * @param {function} onTravelModeChange - 이동수단 변경 시 호출될 함수.
 * @param {boolean} isTravelCalculating - 이동 시간 계산 중인지 여부.
 * @param {object} currentRoom - 현재 방 정보.
 * @param {boolean} isOwner - 현재 사용자가 방장인지 여부.
 * @param {number} scheduleStartHour - 시간표 기본 시작 시간.
 * @param {number} scheduleEndHour - 시간표 기본 종료 시간.
 * @returns {JSX.Element} 시간표 컨트롤 UI JSX 엘리먼트.
 */
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
          onModeChange={onTravelModeChange || (() => {})}
          disabled={!currentRoom || !currentRoom.timeSlots || currentRoom.timeSlots.length === 0}
          isOwner={isOwner}
          confirmedTravelMode={currentRoom?.confirmedTravelMode}
          currentRoom={currentRoom}
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