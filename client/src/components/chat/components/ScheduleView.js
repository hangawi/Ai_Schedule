/**
 * ===================================================================================================
 * [ScheduleView.js] - 추출된 시간표를 표시하고 최적화 모달을 포함하는 뷰 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > client/src/components/chat/components/ScheduleView.js
 *
 * 🎯 주요 기능:
 *    - OCR 분석을 통해 필터링된 시간표를 시각적으로 표시하는 역할
 *    - `ScheduleOptimizationModal`을 내장하여, 추출된 스케줄의 최적 조합을 보여주고 선택할 수 있도록 함
 *    - `TimetableUploadWithChat` 컴포넌트의 레이아웃에서 좌측 메인 영역을 담당
 *
 * 🔗 연결된 파일:
 *    - ../../modals/ScheduleOptimizationModal.js: 주요 기능을 제공하는 내장 모달 컴포넌트
 *    - ../TimetableUploadWithChat.js: 이 뷰 컴포넌트를 사용하고 필요한 데이터를 전달
 *
 * 💡 UI 위치:
 *    - '시간표 이미지 업로드' 모달 내에서, 스케줄 분석이 완료된 후 화면 좌측의 넓은 영역
 *
 * ✏️ 수정 가이드:
 *    - 스케줄 표시 방식이나 최적화 로직을 변경하려면: `ScheduleOptimizationModal` 컴포넌트를 직접 수정해야 합니다.
 *    - 이 뷰 컴포넌트 자체의 레이아웃(너비, 정렬 등)을 변경하려면: 최상위 `<div>`의 inline style 또는 className을 수정합니다.
 *
 * 📝 참고사항:
 *    - `ScheduleOptimizationModal`은 `isEmbedded` prop이 true로 설정되어 모달 형태로 동작하지 않고 일반 컴포넌트처럼 렌더링됩니다.
 *    - `key` prop을 사용하여 `filteredSchedules`가 변경될 때마다 `ScheduleOptimizationModal`이 다시 렌더링되도록 합니다.
 *
 * ===================================================================================================
 */
import React from 'react';
import ScheduleOptimizationModal from '../../modals/ScheduleOptimizationModal';

/**
 * ScheduleView
 *
 * @description OCR로 추출된 스케줄을 표시하고, 내장된 `ScheduleOptimizationModal`을 통해 최적화된 스케줄 조합을 사용자에게 제공하는 뷰 컴포넌트입니다.
 * @param {object} props - 컴포넌트 props
 * @param {Array<object>} props.filteredSchedules - 필터링된 스케줄 객체 배열.
 * @param {object} props.schedulesByImage - 이미지별로 그룹화된 스케줄 데이터.
 * @param {Array<object>} props.fixedSchedules - 고정된 스케줄 객체 배열.
 * @param {Array<object>} props.customSchedulesForLegend - 범례에 사용될 커스텀 스케줄.
 * @param {string} props.overallTitle - 스케줄 뷰의 전체 제목.
 * @param {function} props.handleSchedulesApplied - 스케줄 적용 시 호출되는 콜백 함수.
 * @returns {JSX.Element}
 */
const ScheduleView = ({
  filteredSchedules,
  schedulesByImage,
  fixedSchedules,
  customSchedulesForLegend,
  overallTitle,
  handleSchedulesApplied
}) => {
  return (
    <div style={{ width: '70%', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid #e5e7eb' }}>
      <ScheduleOptimizationModal
        key={filteredSchedules && Array.isArray(filteredSchedules) ? JSON.stringify(filteredSchedules.map(s => s.title + s.startTime)) : 'default'}
        combinations={filteredSchedules ? [filteredSchedules] : []}
        initialSchedules={filteredSchedules}
        schedulesByImage={schedulesByImage}
        fixedSchedules={fixedSchedules}
        customSchedulesForLegend={customSchedulesForLegend}
        overallTitle={overallTitle}
        onClose={null}
        onSchedulesApplied={handleSchedulesApplied}
        isEmbedded={true}
        hideBackButton={true}
      />
    </div>
  );
};

export default ScheduleView;