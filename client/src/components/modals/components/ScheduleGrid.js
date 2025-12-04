/**
 * ===================================================================================================
 * ScheduleGrid.js - 개인 시간 및 고정 스케줄을 표시하는 읽기 전용 시간표 그리드 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/components/ScheduleGrid.js
 *
 * 🎯 주요 기능:
 *    - `ScheduleGridSelector` 컴포넌트를 래핑하여 최적화 모달에 맞게 설정.
 *    - 사용자의 개인 시간(personalTimes)과 고정된 스케줄(fixedSchedules)을 표시.
 *    - `hoveredImageIndex`에 따라 고정 스케줄을 필터링하여 특정 이미지 출처의 스케줄만 강조 표시.
 *    - 시간표를 읽기 전용으로 표시하며, 월별 보기 및 제어 버튼은 비활성화.
 *
 * 🔗 연결된 파일:
 *    - ../ScheduleOptimizationModal.js - 이 컴포넌트를 사용하여 최적화 모달 내에 시간표 그리드를 표시.
 *    - ../../tabs/ScheduleGridSelector.js - 실제 시간표 그리드 렌더링 로직을 담당하는 하위 컴포넌트.
 *
 * 💡 UI 위치:
 *    - '최적 시간표 제안' 모달의 좌측 시간표 미리보기 영역.
 *
 * ✏️ 수정 가이드:
 *    - 시간표 그리드의 상호작용 방식(예: 클릭 시 이벤트)을 변경하려면 `ScheduleGridSelector`의 `readOnly` prop을 조절하거나,
 *      `ScheduleGridSelector` 내부 로직을 수정해야 합니다.
 *    - `hoveredImageIndex`에 따른 필터링 로직을 변경하려면 `currentFixedSchedules`를 필터링하는 부분을 수정합니다.
 *
 * ===================================================================================================
 */
import React from 'react';
import ScheduleGridSelector from '../../tabs/ScheduleGridSelector';

/**
 * ScheduleGrid
 * @description ScheduleOptimizationModal 내에서 개인 시간과 고정 스케줄을 읽기 전용으로 표시하는 그리드 컴포넌트.
 *              `ScheduleGridSelector`를 래핑하여 최적화 모달에 필요한 특수한 필터링 및 설정(읽기 전용 등)을 적용합니다.
 * @param {object} props - 컴포넌트 props
 * @param {Array} props.personalTimes - 사용자의 개인 시간 데이터 배열.
 * @param {Array} props.currentFixedSchedules - 현재 고정된 스케줄 데이터 배열.
 * @param {number|null} props.hoveredImageIndex - 현재 마우스 오버된 이미지의 인덱스. 이 값에 따라 스케줄이 필터링됩니다.
 * @param {object} props.timeRange - 시간표 그리드의 표시 시간 범위를 정의하는 객체.
 * @returns {JSX.Element}
 */
const ScheduleGrid = ({ personalTimes, currentFixedSchedules, hoveredImageIndex, timeRange }) => {
  return (
    <div className="px-5 py-4 overflow-y-auto flex-1">
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <ScheduleGridSelector
          schedule={[]}
          exceptions={[]}
          personalTimes={personalTimes}
          fixedSchedules={
            hoveredImageIndex !== null
              ? currentFixedSchedules.filter(fixed => fixed.sourceImageIndex === hoveredImageIndex)
              : currentFixedSchedules
          }
          readOnly={true}
          enableMonthView={false}
          showViewControls={false}
          initialTimeRange={timeRange}
          defaultShowMerged={true}
        />
      </div>
    </div>
  );
};

export default ScheduleGrid;
