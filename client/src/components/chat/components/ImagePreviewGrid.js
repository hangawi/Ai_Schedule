/**
 * ===================================================================================================
 * [ImagePreviewGrid.js] - 업로드할 이미지 미리보기를 표시하는 그리드 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > client/src/components/chat/components/ImagePreviewGrid.js
 *
 * 🎯 주요 기능:
 *    - 사용자가 선택한 여러 이미지의 미리보기를 그리드 형태로 표시
 *    - 각 이미지에 대한 제거(X) 버튼 제공
 *    - 이미지 처리 중에는 제거 버튼 비활성화
 *
 * 🔗 연결된 파일:
 *    - ../TimetableUploadWithChat.js: 이 컴포넌트를 사용하여 업로드 전 선택된 이미지들을 보여줌
 *
 * 💡 UI 위치:
 *    - '시간표 이미지 업로드' 모달 내에서 이미지 선택 후 표시되는 영역
 *
 * ✏️ 수정 가이드:
 *    - 이미지 미리보기의 그리드 레이아웃(컬럼 수 등)을 변경하려면: 최상위 `<div>`의 `grid-cols-2` 클래스를 수정합니다.
 *    - 이미지 제거 버튼의 스타일을 변경하려면: `<button>` 요소의 className을 수정합니다.
 *
 * 📝 참고사항:
 *    - `imagePreviews` 배열이 비어있으면 아무것도 렌더링하지 않습니다.
 *    - `isProcessing` prop이 true일 때는 사용자의 이미지 제거 실수를 방지하기 위해 제거 버튼이 비활성화됩니다.
 *
 * ===================================================================================================
 */
import React from 'react';
import { X } from 'lucide-react';

/**
 * ImagePreviewGrid
 *
 * @description 업로드할 이미지들의 미리보기를 격자 형태로 표시하고, 각 이미지를 개별적으로 제거할 수 있는 기능을 제공합니다.
 * @param {object} props - 컴포넌트 props
 * @param {Array<object>} props.imagePreviews - 미리보기 이미지 객체들의 배열. 각 객체는 { id: number, url: string, name: string } 형태를 가짐.
 * @param {function} props.removeImage - 특정 인덱스의 이미지를 제거할 때 호출되는 콜백 함수.
 * @param {boolean} props.isProcessing - 이미지가 현재 처리 중인지 여부를 나타내는 boolean 값. true일 경우 제거 버튼 비활성화.
 * @param {boolean} props.isMobile - 모바일 환경 여부.
 * @returns {JSX.Element|null} `imagePreviews` 배열이 비어있으면 null을 반환, 그렇지 않으면 이미지 미리보기 그리드를 렌더링.
 */
const ImagePreviewGrid = ({ imagePreviews, removeImage, isProcessing, isMobile = false }) => {
  if (imagePreviews.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-sm">선택된 이미지 ({imagePreviews.length}개)</h3>
      <div 
        className="grid grid-cols-2 gap-2" 
        style={{ 
          maxHeight: isMobile ? '210px' : '280px',  // 모바일: 4개 이미지 (2행 × 96px + gap), 데스크톱: 4개 이미지 (2행 × 128px + gap)
          overflowY: 'auto'     // 5개 이상이면 스크롤
        }}
      >
        {imagePreviews.map((preview, index) => (
          <div key={preview.id} className="relative group">
            <img
              src={preview.url}
              alt={preview.name}
              className={`w-full ${isMobile ? 'h-24' : 'h-32'} object-cover rounded border`}
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