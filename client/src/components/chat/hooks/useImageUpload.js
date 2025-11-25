/**
 * ============================================================================
 * useImageUpload.js - 이미지 업로드 관련 상태 관리 훅
 * ============================================================================
 */

import { useState, useRef } from 'react';

export const useImageUpload = () => {
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const fileInputRef = useRef(null);

  return {
    selectedImages,
    setSelectedImages,
    imagePreviews,
    setImagePreviews,
    fileInputRef
  };
};
