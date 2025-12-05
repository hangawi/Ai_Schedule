/**
 * ===================================================================================================
 * imageHandlers.js - 이미지 관련 이벤트 핸들러 팩토리 함수들
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/chat/handlers
 *
 * 🎯 주요 기능:
 *    - 이미지 파일 선택 시 유효성 검사 및 미리보기 생성
 *    - 선택된 이미지 목록에서 특정 이미지 제거
 *
 * 🔗 연결된 파일:
 *    - ../utils/imageUtils - 이미지 유틸리티 함수 (validateImageFiles, createImagePreviews, removeItemAtIndex)
 *    - ../../hooks/useImageUpload - 이미지 업로드 훅 (해당 핸들러를 사용하는 곳)
 *
 * 💡 UI 위치:
 *    - 챗봇 화면 > 이미지 업로드 섹션 (파일 선택 입력, 이미지 미리보기)
 *
 * ✏️ 수정 가이드:
 *    - 이미지 유효성 검사 로직 변경: `validateImageFiles` 함수 수정
 *    - 이미지 미리보기 생성 방식 변경: `createImagePreviews` 함수 수정
 *    - 이미지 선택/제거 로직 변경: `createHandleImageSelect` 또는 `createRemoveImage` 함수 내부 수정
 *
 * 📝 참고사항:
 *    - 이 핸들러들은 `useImageUpload` 훅에서 사용되어 이미지 관련 상태 관리를 추상화함
 *    - `setError` 콜백을 통해 에러 메시지를 사용자에게 표시
 *
 * ===================================================================================================
 */

import { validateImageFiles, createImagePreviews, removeItemAtIndex } from '../utils/imageUtils';

/**
 * createHandleImageSelect
 *
 * @description 이미지 파일 선택 시 호출될 이벤트 핸들러를 생성합니다.
 *              선택된 파일들의 유효성을 검사하고, 유효한 파일들로 상태를 업데이트하며, 이미지 미리보기를 생성합니다.
 * @param {Function} setSelectedImages - 선택된 이미지 파일 목록을 설정하는 useState 셋터 함수
 * @param {Function} setImagePreviews - 이미지 미리보기 URL/Base64 목록을 설정하는 useState 셋터 함수
 * @param {Function} setError - 에러 메시지를 설정하는 useState 셋터 함수
 * @returns {Function} 이미지 파일 선택 이벤트 핸들러
 *
 * @example
 * // useImageUpload 훅 내부에서 사용 예시
 * const handleImageSelect = createHandleImageSelect(setSelectedImages, setImagePreviews, setError);
 * <input type="file" multiple onChange={handleImageSelect} />
 *
 * @note
 * - `event.target.files`에서 파일 목록을 가져옵니다.
 * - `validateImageFiles`를 통해 파일 형식 및 크기 등의 유효성을 검사합니다.
 * - 유효성 검사 실패 시 에러 메시지를 설정하고 함수를 종료합니다.
 * - `createImagePreviews`를 사용하여 이미지 미리보기를 비동기적으로 생성합니다.
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
 * createRemoveImage
 *
 * @description 특정 인덱스의 이미지를 선택 목록과 미리보기 목록에서 제거하는 핸들러를 생성합니다.
 * @param {Array<File>} selectedImages - 현재 선택된 이미지 파일 목록
 * @param {Array<string>} imagePreviews - 현재 이미지 미리보기 URL/Base64 목록
 * @param {Function} setSelectedImages - 선택된 이미지 파일 목록을 설정하는 useState 셋터 함수
 * @param {Function} setImagePreviews - 이미지 미리보기 URL/Base64 목록을 설정하는 useState 셋터 함수
 * @returns {Function} 이미지를 제거하는 함수 (인덱스를 인자로 받음)
 *
 * @example
 * // useImageUpload 훅 내부에서 사용 예시
 * const removeImage = createRemoveImage(selectedImages, imagePreviews, setSelectedImages, setImagePreviews);
 * <button onClick={() => removeImage(index)}>X</button>
 *
 * @note
 * - `removeItemAtIndex` 유틸리티 함수를 사용하여 불변성을 유지하면서 항목을 제거합니다.
 * - 제거 후 업데이트된 목록으로 상태를 재설정합니다.
 */
export const createRemoveImage = (selectedImages, imagePreviews, setSelectedImages, setImagePreviews) => {
  return (index) => {
    const newImages = removeItemAtIndex(selectedImages, index);
    const newPreviews = removeItemAtIndex(imagePreviews, index);
    setSelectedImages(newImages);
    setImagePreviews(newPreviews);
  };
};

