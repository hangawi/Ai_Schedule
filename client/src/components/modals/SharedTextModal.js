/**
 * ===================================================================================================
 * SharedTextModal.js - 외부 앱에서 공유된 텍스트로 일정을 추가할지 묻는 모달
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/SharedTextModal.js
 *
 * 🎯 주요 기능:
 *    - URL 쿼리 파라미터 등을 통해 외부에서 앱으로 공유된 텍스트를 사용자에게 보여줌.
 *    - 해당 텍스트를 기반으로 일정을 추가할 것인지 확인하는 UI 제공.
 *
 * 🔗 연결된 파일:
 *    - ../../App.js - 앱 진입 시 URL을 파싱하여 공유된 텍스트가 있을 경우 이 모달을 호출.
 *
 * 💡 UI 위치:
 *    - 공유 기능으로 텍스트를 포함하여 앱이 실행되었을 때 나타나는 팝업 모달.
 *
 * ✏️ 수정 가이드:
 *    - 모달의 디자인이나 문구를 변경하려면 이 파일의 JSX를 직접 수정합니다.
 *    - '일정 추가' 시 텍스트에 대한 전처리 로직을 추가하려면 `onConfirm` 호출 부분을 수정할 수 있습니다.
 *
 * 📝 참고사항:
 *    - `CopiedTextModal`과 유사하지만, 텍스트 번역이나 분석 중 상태 표시 같은 복잡한 기능 없이
 *      단순히 텍스트를 보여주고 확인/취소만 받는 더 간단한 버전입니다.
 *
 * ===================================================================================================
 */
import React from 'react';
import { Check } from 'lucide-react';

/**
 * SharedTextModal
 * @description 외부에서 공유된 텍스트를 보여주고, 이를 기반으로 일정 추가를 진행할지 사용자에게 확인받는 모달.
 * @param {object} props - 컴포넌트 props
 * @param {string} props.text - 공유된 텍스트 내용.
 * @param {function} props.onClose - 모달을 닫는 함수.
 * @param {function} props.onConfirm - '일정 추가' 버튼 클릭 시 호출되는 콜백. 공유된 텍스트를 인자로 받음.
 * @returns {JSX.Element}
 */
const SharedTextModal = ({ text, onClose, onConfirm }) => {
  return (
    <div className="fixed inset-0 flex items-end sm:items-center justify-center z-50 bg-black bg-opacity-50 p-4">
      <div className="bg-white w-full max-w-md rounded-t-lg sm:rounded-lg shadow-xl p-4 sm:p-6 max-h-[80vh] sm:max-h-[90vh] overflow-y-auto transform transition-transform duration-300 ease-out">
        <div className="mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">공유된 텍스트로 일정 추가</h2>
        </div>
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-3">아래 내용으로 일정을 추가할까요?</p>
          <blockquote className="bg-gray-50 p-3 rounded-md border-l-4 border-blue-500 text-gray-800 text-sm max-h-32 overflow-y-auto">
            {text}
          </blockquote>
        </div>
        <div className="flex flex-col sm:flex-row sm:justify-end space-y-2 sm:space-y-0 sm:space-x-3">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-3 sm:py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 flex items-center justify-center text-base sm:text-sm"
          >
            취소
          </button>
          <button
            onClick={() => onConfirm(text)}
            className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center justify-center text-base sm:text-sm font-medium"
          >
            <Check size={16} className="mr-2" />
            일정 추가
          </button>
        </div>
      </div>
    </div>
  );
};

export default SharedTextModal;
