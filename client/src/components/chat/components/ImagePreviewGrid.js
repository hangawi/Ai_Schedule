/**
 * ============================================================================
 * ImagePreviewGrid.js - 이미지 미리보기 그리드 컴포넌트
 * ============================================================================
 */

import React from 'react';
import { X } from 'lucide-react';

const ImagePreviewGrid = ({ imagePreviews, removeImage, isProcessing }) => {
  if (imagePreviews.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-sm">선택된 이미지 ({imagePreviews.length}개)</h3>
      <div className="grid grid-cols-2 gap-2">
        {imagePreviews.map((preview, index) => (
          <div key={preview.id} className="relative group">
            <img
              src={preview.url}
              alt={preview.name}
              className="w-full h-32 object-cover rounded border"
            />
            <button
              onClick={() => removeImage(index)}
              disabled={isProcessing}
              className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ImagePreviewGrid;
