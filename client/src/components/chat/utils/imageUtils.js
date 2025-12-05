/**
 * ===================================================================================================
 * imageUtils.js - 이미지 처리 관련 유틸리티 함수들
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/chat/utils
 *
 * 🎯 주요 기능:
 *    - 이미지 파일 목록으로부터 Base64 형식의 미리보기 URL 생성
 *    - 업로드된 파일들의 유효성 검사 (이미지 형식, 최대 개수)
 *    - 배열에서 특정 인덱스의 항목을 제거하는 유틸리티
 *
 * 🔗 연결된 파일:
 *    - ../handlers/imageHandlers.js - 이 유틸리티 함수들을 사용하여 이미지 상태를 관리
 *
 * 💡 UI 위치:
 *    - 이 파일은 UI를 직접 렌더링하지 않으나, 이미지 업로드 및 미리보기 UI의 데이터 처리에 사용됩니다.
 *
 * ✏️ 수정 가이드:
 *    - 미리보기 생성 로직 변경: `createImagePreviews` 함수의 `FileReader` 로직 수정
 *    - 이미지 유효성 검사 규칙 변경: `validateImageFiles` 함수 내의 조건(파일 타입, 개수) 수정
 *
 * 📝 참고사항:
 *    - `createImagePreviews` 함수는 비동기적으로 작동하며, 모든 파일의 처리가 완료된 후 콜백 함수를 호출합니다.
 *    - `removeItemAtIndex`는 불변성을 유지하며 배열을 다루기 위한 순수 함수입니다.
 *
 * ===================================================================================================
 */

/**
 * createImagePreviews
 *
 * @description 여러 이미지 파일로부터 Base64 형식의 미리보기 URL을 비동기적으로 생성합니다.
 * @param {Array<File>} imageFiles - 미리보기를 생성할 File 객체 배열
 * @param {Function} callback - 모든 미리보기가 생성된 후 호출될 콜백 함수. 생성된 미리보기 객체 배열을 인자로 받습니다.
 *
 * @example
 * createImagePreviews(files, (previews) => {
 *   setImagePreviews(previews);
 * });
 *
 * @note
 * - `FileReader` API를 사용하여 각 파일을 비동기적으로 읽습니다.
 * - 모든 파일의 `onload` 이벤트가 완료되면 콜백이 실행됩니다.
 * - 각 미리보기 객체는 `id`, `url`, `name`을 포함합니다.
 */
export const createImagePreviews = (imageFiles, callback) => {
  if (!imageFiles || imageFiles.length === 0) {
    callback([]);
    return;
  }

  const previews = [];
  let loadedCount = 0;

  imageFiles.forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      previews[index] = { // 순서를 보장하기 위해 인덱스로 할당
        id: index,
        url: e.target.result,
        name: file.name
      };
      loadedCount++;

      if (loadedCount === imageFiles.length) {
        callback(previews);
      }
    };
    reader.onerror = () => {
      console.error(`Error reading file: ${file.name}`);
      loadedCount++;
      if (loadedCount === imageFiles.length) {
        callback(previews.filter(p => p)); // 실패한 파일을 제외하고 콜백
      }
    };
    reader.readAsDataURL(file);
  });
};

/**
 * validateImageFiles
 *
 * @description 사용자가 업로드한 파일 목록의 유효성을 검사합니다.
 *              이미지 파일만 필터링하고, 최대 업로드 개수를 확인합니다.
 * @param {Array<File>} files - 검증할 File 객체 배열
 * @returns {Object} 유효성 검사 결과 객체
 * @returns {boolean} .valid - 유효성 통과 여부
 * @returns {string} [.error] - 유효성 실패 시 에러 메시지
 * @returns {Array<File>} [.imageFiles] - 유효성을 통과한 이미지 파일 목록
 *
 * @example
 * const validation = validateImageFiles(event.target.files);
 * if (!validation.valid) {
 *   setError(validation.error);
 * } else {
 *   setSelectedImages(validation.imageFiles);
 * }
 */
export const validateImageFiles = (files) => {
  const imageFiles = files.filter(file => file.type.startsWith('image/'));

  if (imageFiles.length !== files.length) {
    // 이미지 파일이 아닌 것이 섞여 있을 때 경고를 줄 수 있으나, 현재는 조용히 필터링
  }
  
  if (imageFiles.length === 0 && files.length > 0) {
    return { valid: false, error: '이미지 파일만 업로드 가능합니다.' };
  }

  if (imageFiles.length > 10) {
    return { valid: false, error: '최대 10개의 이미지만 업로드 가능합니다.' };
  }

  return { valid: true, imageFiles };
};

/**
 * removeItemAtIndex
 *
 * @description 배열에서 특정 인덱스의 항목을 제거한 새로운 배열을 반환합니다. (불변성 유지)
 * @param {Array<any>} array - 원본 배열
 * @param {number} index - 제거할 항목의 인덱스
 * @returns {Array<any>} 해당 인덱스의 항목이 제거된 새로운 배열
 *
 * @example
 * const newArray = removeItemAtIndex([1, 2, 3], 1); // [1, 3]
 */
export const removeItemAtIndex = (array, index) => {
  return array.filter((_, i) => i !== index);
};
