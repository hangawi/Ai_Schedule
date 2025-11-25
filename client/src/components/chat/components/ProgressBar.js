/**
 * ============================================================================
 * ProgressBar.js - 진행률 표시 컴포넌트
 * ============================================================================
 */

import React from 'react';

const ProgressBar = ({ progress, isProcessing }) => {
  if (!isProcessing) return null;

  return (
    <div className="px-4 pt-3 pb-2">
      <div className="flex justify-between text-sm mb-1">
        <span>{progress.message}</span>
        <span>{progress.current}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress.current}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
