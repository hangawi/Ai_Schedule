/**
 * ===================================================================================================
 * [UploadSection.js] - 이미지 파일 선택을 위한 UI 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > client/src/components/chat/components/UploadSection.js
 *
 * 🎯 주요 기능:
 *    - 사용자가 로컬 기기에서 시간표 이미지 파일을 선택할 수 있는 버튼 제공
 *    - 파일 선택 입력 (`<input type="file">`)과 연동
 *
 * 🔗 연결된 파일:
 *    - ../TimetableUploadWithChat.js: 이 섹션을 사용하여 이미지 업로드 기능을 제공
 *
 * 💡 UI 위치:
 *    - '시간표 이미지 업로드' 모달 내에서 파일 선택을 위한 메인 영역
 *
 * ✏️ 수정 가이드:
 *    - 버튼의 텍스트나 아이콘을 변경하려면: 내부 `<Upload>` 컴포넌트와 `<p>` 태그의 내용을 수정합니다.
 *    - 버튼의 스타일(색상, 테두리, 호버 효과 등)을 변경하려면: `<button>` 요소의 className을 수정합니다.
 *
 * 📝 참고사항:
 *    - `isProcessing` prop이 true일 때는 버튼이 비활성화되어 중복 클릭을 방지합니다.
 *    - `handleImageSelect` 콜백을 통해 선택된 파일들을 상위 컴포넌트로 전달합니다.
 *
 * ===================================================================================================
 */
import React from 'react';
import { Upload } from 'lucide-react';

/**
 * UploadSection
 *
 * @description 시간표 이미지 파일을 선택하기 위한 UI를 렌더링하는 컴포넌트. 숨겨진 파일 입력 필드를 트리거하는 버튼을 제공합니다.
 * @param {object} props - 컴포넌트 props
 * @param {React.RefObject} props.fileInputRef - 숨겨진 파일 입력 필드에 대한 React ref.
 * @param {function} props.handleImageSelect - 파일 선택 시 호출되는 콜백 함수.
 * @param {boolean} props.isProcessing - 이미지가 현재 처리 중인지 여부를 나타내는 boolean 값. true일 경우 버튼 비활성화.
 * @returns {JSX.Element}
 */
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