/**
 * ============================================================================
 * DuplicateModal.js - 중복 이미지 확인 모달 컴포넌트
 * ============================================================================
 */

import React from 'react';

const DuplicateModal = ({
  showDuplicateModal,
  duplicateInfo,
  handleDuplicateRemove,
  handleDuplicateIgnore
}) => {
  if (!showDuplicateModal || !duplicateInfo) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" style={{ zIndex: 9999 }}>
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-bold mb-4">⚠️ 중복된 이미지 발견</h3>
        <div className="space-y-3 mb-6">
          <p className="text-gray-700">다음 이미지가 이미 업로드된 이미지와 중복됩니다:</p>
          {duplicateInfo.duplicates.map((dup, idx) => (
            <div key={idx} className="bg-yellow-50 border border-yellow-200 rounded p-3">
              <p className="font-semibold text-sm">"{dup.filename}"</p>
              <p className="text-xs text-gray-600 mt-1">
                → "{dup.duplicateWith}"와 {dup.similarity}% 유사
              </p>
            </div>
          ))}
          <p className="text-sm text-gray-600 mt-4">
            중복된 이미지를 제거하고 계속하시겠습니까?
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleDuplicateRemove}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            중복 제거하고 계속
          </button>
          <button
            onClick={handleDuplicateIgnore}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            중복 무시하고 계속
          </button>
        </div>
      </div>
    </div>
  );
};

export default DuplicateModal;
