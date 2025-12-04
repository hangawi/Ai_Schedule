/**
 * ===================================================================================================
 * ScheduleLegend.js - 시간표 출처(이미지, 커스텀) 범례를 표시하고 상호작용을 제공하는 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/components/ScheduleLegend.js
 *
 * 🎯 주요 기능:
 *    - **이미지별 범례**: OCR로 업로드된 각 시간표 이미지에 고유한 색상을 부여하고, 해당 색상과 이미지 이름을 범례로 표시.
 *    - **커스텀 일정 범례**: 사용자가 추가한 커스텀 일정에 대한 범례를 표시.
 *    - **상호작용**:
 *      - 마우스 오버 시(hover) 해당 범례 아이템을 강조하고, 연관된 시간표 그리드의 스케줄을 하이라이트.
 *      - 이미지 범례 클릭 시, 해당 원본 시간표 이미지(OCR 전)를 모달로 띄워 보여줌.
 *
 * 🔗 연결된 파일:
 *    - ../ScheduleOptimizationModal.js - 이 컴포넌트를 사용하여 최적화 모달 내에 범례를 표시.
 *    - ../../../utils/scheduleAnalysis/assignScheduleColors.js - 범례 색상 할당 로직.
 *    - ../OriginalScheduleModal.js - 이미지 범례 클릭 시 호출되는 모달.
 *
 * 💡 UI 위치:
 *    - '최적 시간표 제안' 모달의 좌측 시간표 미리보기 영역 상단, 제목 아래에 위치.
 *
 * ✏️ 수정 가이드:
 *    - 범례 아이템의 디자인이나 상호작용 스타일을 변경하려면 이 파일의 JSX 내 `div`와 `span`에 적용된 Tailwind CSS 클래스를 수정합니다.
 *    - 범례가 렌더링되는 조건을 변경하려면 `schedulesByImage` 및 `customSchedulesForLegend` 체크 로직을 수정합니다.
 *
 * 📝 참고사항:
 *    - `hoveredImageIndex` 상태는 부모 컴포넌트(`ScheduleOptimizationModal`)에서 관리하며,
 *      이를 통해 그리드(`ScheduleGrid.js`)와의 시각적 연동을 구현합니다.
 *
 * ===================================================================================================
 */
import React from 'react';
import { getColorForImageIndex } from '../../../utils/scheduleAnalysis/assignScheduleColors';

/**
 * ScheduleLegend
 * @description OCR을 통해 업로드된 시간표 이미지들과 사용자가 추가한 커스텀 일정들에 대한 시각적 범례를 표시합니다.
 *              범례 항목에 마우스를 올리거나 클릭하여 상호작용할 수 있습니다.
 * @param {object} props - 컴포넌트 props
 * @param {Array<object>} props.schedulesByImage - 각 이미지에서 감지된 스케줄 데이터 및 이미지 정보의 배열.
 * @param {Array<object>} props.customSchedulesForLegend - 범례에 표시할 커스텀 스케줄 데이터의 배열.
 * @param {number|null} props.hoveredImageIndex - 현재 마우스 오버된 이미지의 인덱스. -1 또는 null이면 선택된 없음.
 * @param {function} props.setHoveredImageIndex - 마우스 오버된 이미지 인덱스를 설정하는 콜백 함수.
 * @param {function} props.setSelectedImageForOriginal - 원본 이미지 보기 모달을 열기 위한 콜백 함수.
 * @returns {JSX.Element|null}
 */
const ScheduleLegend = ({
  schedulesByImage,
  customSchedulesForLegend,
  hoveredImageIndex,
  setHoveredImageIndex,
  setSelectedImageForOriginal
}) => {
  if (!schedulesByImage || (schedulesByImage.length <= 1 && (!customSchedulesForLegend || customSchedulesForLegend.length === 0))) {
    return null;
  }

  return (
    <div className="mt-3 pt-3 border-t border-purple-200">
      <div className="flex flex-wrap gap-3 justify-center">
        {schedulesByImage.map((imageData, idx) => {
          const color = getColorForImageIndex(idx);
          const isHovered = hoveredImageIndex === idx;
          return (
            <div
              key={idx}
              className="flex items-center gap-2 cursor-pointer transition-all hover:bg-purple-50 px-2 py-1 rounded"
              onMouseEnter={() => setHoveredImageIndex(idx)}
              onMouseLeave={() => setHoveredImageIndex(null)}
              onClick={() => setSelectedImageForOriginal({ data: imageData, index: idx })}
              title="클릭하여 원본 시간표 전체 보기"
            >
              <div
                className={`w-4 h-4 rounded border-2 transition-all ${isHovered ? 'scale-125' : ''}`}
                style={{ backgroundColor: color.bg, borderColor: color.border }}
              ></div>
              <span className={`text-xs transition-all ${isHovered ? 'text-purple-700 font-bold' : 'text-gray-700'}`}>
                {imageData.title || `이미지 ${idx + 1}`}
              </span>
            </div>
          );
        })}
        {customSchedulesForLegend && customSchedulesForLegend.length > 0 && customSchedulesForLegend.map((customData) => {
          const color = getColorForImageIndex(customData.sourceImageIndex);
          const isHovered = hoveredImageIndex === customData.sourceImageIndex;
          return (
            <div
              key={`custom-${customData.sourceImageIndex}`}
              className="flex items-center gap-2 transition-all hover:bg-purple-50 px-2 py-1 rounded"
              onMouseEnter={() => setHoveredImageIndex(customData.sourceImageIndex)}
              onMouseLeave={() => setHoveredImageIndex(null)}
              title="커스텀 일정"
            >
              <div
                className={`w-4 h-4 rounded border-2 transition-all ${isHovered ? 'scale-125' : ''}`}
                style={{ backgroundColor: color.bg, borderColor: color.border }}
              ></div>
              <span className={`text-xs transition-all ${isHovered ? 'text-purple-700 font-bold' : 'text-gray-700'}`}>
                {customData.title} 📌
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ScheduleLegend;
