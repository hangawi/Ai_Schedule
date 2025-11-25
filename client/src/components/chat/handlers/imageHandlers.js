/**
 * ============================================================================
 * imageHandlers.js - 이미지 관련 이벤트 핸들러 팩토리 함수들
 * ============================================================================
 */

import { validateImageFiles, createImagePreviews, removeItemAtIndex } from '../utils/imageUtils';

/**
 * 이미지 선택 핸들러 생성
 */
export const createHandleImageSelect = (setSelectedImages, setImagePreviews, setError) => {
  return (event) => {
    const files = Array.from(event.target.files);
    const validation = validateImageFiles(files);

    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setSelectedImages(validation.imageFiles);
    setError(null);

    // 미리보기 생성
    createImagePreviews(validation.imageFiles, (previews) => {
      setImagePreviews(previews);
    });
  };
};

/**
 * 이미지 제거 핸들러 생성
 */
export const createRemoveImage = (selectedImages, imagePreviews, setSelectedImages, setImagePreviews) => {
  return (index) => {
    const newImages = removeItemAtIndex(selectedImages, index);
    const newPreviews = removeItemAtIndex(imagePreviews, index);
    setSelectedImages(newImages);
    setImagePreviews(newPreviews);
  };
};
