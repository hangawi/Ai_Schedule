/**
 * ============================================================================
 * imageUtils.js - 이미지 처리 유틸리티 함수들
 * ============================================================================
 */

/**
 * 파일에서 이미지 미리보기 생성
 */
export const createImagePreviews = (imageFiles, callback) => {
  const previews = [];

  imageFiles.forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      previews.push({
        id: index,
        url: e.target.result,
        name: file.name
      });

      if (previews.length === imageFiles.length) {
        callback(previews);
      }
    };
    reader.readAsDataURL(file);
  });
};

/**
 * 이미지 파일 검증
 */
export const validateImageFiles = (files) => {
  const imageFiles = files.filter(file => file.type.startsWith('image/'));

  if (imageFiles.length === 0) {
    return { valid: false, error: '이미지 파일만 업로드 가능합니다.' };
  }

  if (imageFiles.length > 10) {
    return { valid: false, error: '최대 10개의 이미지만 업로드 가능합니다.' };
  }

  return { valid: true, imageFiles };
};

/**
 * 배열에서 특정 인덱스 항목 제거
 */
export const removeItemAtIndex = (array, index) => {
  return array.filter((_, i) => i !== index);
};
