/**
 * ===================================================================================================
 * ApplyScopeSelector.js - 시간표 적용 범위를 선택하는 UI 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/components/ApplyScopeSelector.js
 *
 * 🎯 주요 기능:
 *    - '이번 주만'과 '전체 달' 두 가지 옵션을 버튼 형태로 제공.
 *    - 사용자가 선택한 범위를 부모 컴포넌트의 상태(`applyScope`)에 반영.
 *    - 현재 선택된 범위를 시각적으로 하이라이트하여 표시.
 *
 * 🔗 연결된 파일:
 *    - ../ScheduleOptimizationModal.js - 이 컴포넌트를 사용하여 최종 스케줄 적용 범위를 결정.
 *
 * 💡 UI 위치:
 *    - '최적 시간표 제안' 모달의 하단, '이 시간표 선택하기' 버튼 바로 위에 위치.
 *
 * ✏️ 수정 가이드:
 *    - 새로운 적용 범위 옵션(예: '오늘만')을 추가하려면 JSX에 새로운 `<button>`을 추가하고, `onClick` 핸들러에 해당 상태값을 설정하는 로직을 구현합니다.
 *    - 버튼의 스타일을 변경하려면 이 파일의 Tailwind CSS 클래스를 수정합니다.
 *
 * 📝 참고사항:
 *    - 이 컴포넌트는 자체적으로 상태를 가지지 않고, props로 전달받은 `applyScope`와 `setApplyScope`를 사용하는
 *      제어 컴포넌트(controlled component)입니다.
 *
 * ===================================================================================================
 */
import React from 'react';

/**
 * ApplyScopeSelector
 * @description '이번 주만' 또는 '전체 달'과 같이 스케줄을 적용할 범위를 선택하는 버튼 그룹을 렌더링하는 컴포넌트.
 * @param {object} props - 컴포넌트 props
 * @param {string} props.applyScope - 현재 선택된 적용 범위 ('week' 또는 'month').
 * @param {function} props.setApplyScope - 적용 범위를 변경하기 위해 호출되는 상태 설정 함수.
 * @returns {JSX.Element}
 */
const ApplyScopeSelector = ({ applyScope, setApplyScope }) => {
  return (
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
  );
};

export default ApplyScopeSelector;
