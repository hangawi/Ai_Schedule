/**
 * ===================================================================================================
 * useImageUpload.js - 이미지 업로드 관련 상태 관리 커스텀 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/chat/hooks
 *
 * 🎯 주요 기능:
 *    - 사용자가 선택한 이미지 파일 목록(`selectedImages`) 상태 관리
 *    - 생성된 이미지 미리보기 URL 목록(`imagePreviews`) 상태 관리
 *    - 파일 입력(`input type="file"`) 엘리먼트에 대한 ref(`fileInputRef`) 제공
 *
 * 🔗 연결된 파일:
 *    - ../components/UploadSection.js - 이 훅을 사용하여 이미지 업로드 UI의 상태를 관리
 *    - ../handlers/imageHandlers.js - 이 훅이 관리하는 상태를 업데이트하는 핸들러들이 위치
 *
 * 💡 UI 위치:
 *    - 챗봇 화면 > 이미지 업로드 섹션
 *
 * ✏️ 수정 가이드:
 *    - 이미지 업로드와 관련된 새로운 상태가 필요할 경우: 이 훅에 `useState`를 추가
 *    - 파일 입력 엘리먼트를 직접 제어해야 할 경우: `fileInputRef`를 사용
 *
 * 📝 참고사항:
 *    - 이 훅은 이미지 업로드와 관련된 상태(선택된 파일, 미리보기)와 ref를 하나로 묶어 제공함으로써
 *      관련 로직을 컴포넌트로부터 분리하고 재사용성을 높입니다.
 *    - 실제 파일 선택, 제거, 미리보기 생성 로직은 `imageHandlers.js`에 위임됩니다.
 *
 * ===================================================================================================
 */

import { useState, useRef } from 'react';

/**
 * useImageUpload
 *
 * @description 이미지 업로드 기능에 필요한 상태와 ref를 관리하는 커스텀 훅입니다.
 * @returns {Object} 이미지 업로드 관련 상태와 ref를 포함하는 객체
 *
 * @property {Array<File>} selectedImages - 사용자가 선택한 이미지 파일의 배열
 * @property {Function} setSelectedImages - `selectedImages` 상태를 업데이트하는 함수
 * @property {Array<string>} imagePreviews - 선택된 이미지의 미리보기 URL(Base64) 배열
 * @property {Function} setImagePreviews - `imagePreviews` 상태를 업데이트하는 함수
 * @property {React.MutableRefObject<HTMLInputElement>} fileInputRef - 파일 입력 엘리먼트를 가리키는 ref
 *
 * @example
 * // UploadSection 컴포넌트 내에서 사용
 * const {
 *   selectedImages,
 *   setSelectedImages,
 *   imagePreviews,
 *   setImagePreviews,
 *   fileInputRef
 * } = useImageUpload();
 *
 * const handleImageSelect = createHandleImageSelect(setSelectedImages, setImagePreviews, setError);
 *
 * return (
 *   <input type="file" ref={fileInputRef} onChange={handleImageSelect} />
 * );
 */
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
