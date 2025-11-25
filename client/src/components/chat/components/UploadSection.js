/**
 * ============================================================================
 * UploadSection.js - 이미지 업로드 섹션 컴포넌트
 * ============================================================================
 */

import React from 'react';
import { Upload } from 'lucide-react';

const UploadSection = ({ fileInputRef, handleImageSelect, isProcessing }) => {
  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleImageSelect}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef?.current?.click()}
        disabled={isProcessing}
        className="w-full border-2 border-dashed border-gray-300 rounded-lg p-3 hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Upload className="mx-auto mb-1 text-gray-400" size={24} />
        <p className="text-xs text-gray-600">
          이미지 선택 (최대 10개)
        </p>
      </button>
    </div>
  );
};

export default UploadSection;
