/**
 * ============================================================================
 * ApplyScopeSelector.js - Apply Scope Selector Component
 * ============================================================================
 */

import React from 'react';

/**
 * 적용 범위 선택 컴포넌트
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
