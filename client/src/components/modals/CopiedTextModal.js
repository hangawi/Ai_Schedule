/**
 * ===================================================================================================
 * CopiedTextModal.js - 클립보드에 복사된 텍스트로 일정을 추가할지 묻는 모달
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/CopiedTextModal.js
 *
 * 🎯 주요 기능:
 *    - 클립보드에서 복사된 텍스트를 사용자에게 보여줌.
 *    - 텍스트에 포함된 영어 요일을 한국어로 번역하는 전처리 기능 수행.
 *    - 너무 긴 텍스트는 일부만 보여주는 요약 기능 포함.
 *    - 사용자가 '일정 추가' 또는 '취소'를 선택할 수 있도록 함.
 *    - AI가 텍스트를 분석하는 동안('isAnalyzing' 상태) 로딩 스피너를 표시하고 버튼을 비활성화.
 *
 * 🔗 연결된 파일:
 *    - ../../App.js - 클립보드 모니터링 로직에서 이 모달을 호출.
 *    - ../../utils/index.js - `translateEnglishDays` 유틸리티 함수 사용.
 *
 * 💡 UI 위치:
 *    - 클립보드 모니터링이 활성화된 상태에서 텍스트를 복사했을 때, 자동으로 화면 하단(모바일) 또는 중앙(데스크탑)에 나타나는 팝업 모달.
 *
 * ✏️ 수정 가이드:
 *    - 텍스트 요약 길이를 변경하려면 `MAX_DISPLAY_LENGTH` 상수를 조절합니다.
 *    - 번역 로직을 변경하려면 `translateEnglishDays` 유틸리티 함수를 수정해야 합니다.
 *    - AI 분석 중일 때의 UI를 변경하려면 `isAnalyzing` prop에 따른 조건부 렌더링 부분을 수정합니다.
 *
 * 📝 참고사항:
 *    - 이 모달은 텍스트를 최종적으로 파싱하지 않습니다. '일정 추가'를 누르면 전처리된 텍스트를 부모 컴포넌트로 넘겨,
 *      부모 컴포넌트가 챗봇 API로 해당 텍스트를 보내 분석 및 파싱을 요청합니다.
 *
 * ===================================================================================================
 */
import React from 'react';
import { Check, Loader2 } from 'lucide-react';
import { translateEnglishDays } from '../../utils';

/**
 * CopiedTextModal
 * @description 클립보드에서 복사된 텍스트를 보여주고, 이를 기반으로 일정을 추가할지 사용자에게 확인받는 모달.
 * @param {object} props - 컴포넌트 props
 * @param {string} props.text - 클립보드에서 복사된 원본 텍스트.
 * @param {boolean} props.isAnalyzing - AI가 현재 텍스트를 분석 중인지 여부.
 * @param {function} props.onClose - 모달을 닫는 함수.
 * @param {function} props.onConfirm - '일정 추가' 버튼 클릭 시 호출되는 콜백. 번역된 텍스트를 인자로 받음.
 * @returns {JSX.Element}
 */
const CopiedTextModal = ({ text, isAnalyzing, onClose, onConfirm }) => {
  const translatedText = translateEnglishDays(text);
  const hasTranslation = translatedText !== text;

  // 텍스트가 너무 길면 요약
  const MAX_DISPLAY_LENGTH = 200;
  const getDisplayText = (fullText) => {
    if (fullText.length <= MAX_DISPLAY_LENGTH) {
      return fullText;
    }
    return fullText.substring(0, MAX_DISPLAY_LENGTH) + '...';
  };

  const displayText = getDisplayText(text);
  const displayTranslatedText = getDisplayText(translatedText);

  return (
    <div className="fixed inset-0 flex items-end sm:items-center justify-center z-50 bg-black bg-opacity-50 p-4">
      <div className="bg-white w-full max-w-md rounded-t-lg sm:rounded-lg shadow-xl p-4 sm:p-6 max-h-[80vh] sm:max-h-[90vh] overflow-y-auto transform transition-transform duration-300 ease-out">
        <div className="flex items-center mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 pr-2">
            복사된 텍스트로 일정 추가
          </h2>
          {isAnalyzing && (
            <Loader2 size={18} className="animate-spin text-blue-500" />
          )}
        </div>
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-3">
            {isAnalyzing ? '일정 관련 텍스트인지 분석 중...' : '클립보드에 복사된 내용으로 일정을 추가할까요?'}
          </p>

          {hasTranslation && (
            <div className="mb-3">
              <p className="text-xs text-blue-600 mb-1">원본 텍스트:</p>
              <blockquote className="bg-blue-50 p-2 rounded-md border-l-2 border-blue-300 text-gray-700 text-sm">
                {displayText}
                {text.length > MAX_DISPLAY_LENGTH && (
                  <span className="text-xs text-gray-500 block mt-1">
                    ({text.length}자 중 {MAX_DISPLAY_LENGTH}자 표시)
                  </span>
                )}
              </blockquote>
            </div>
          )}

          <div>
            {hasTranslation && <p className="text-xs text-green-600 mb-1">변환된 텍스트:</p>}
            <blockquote className={`p-3 rounded-md border-l-4 text-gray-800 text-sm ${
              hasTranslation ? 'bg-green-50 border-green-500' : 'bg-gray-50 border-blue-500'
            }`}>
              {displayTranslatedText}
              {translatedText.length > MAX_DISPLAY_LENGTH && (
                <span className="text-xs text-gray-500 block mt-1">
                  ({translatedText.length}자 중 {MAX_DISPLAY_LENGTH}자 표시)
                </span>
              )}
            </blockquote>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:justify-end space-y-2 sm:space-y-0 sm:space-x-3">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-3 sm:py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 flex items-center justify-center text-base sm:text-sm"
          >
            취소
          </button>
          <button
            onClick={() => onConfirm(translatedText)}
            disabled={isAnalyzing}
            className={`w-full sm:w-auto px-4 py-3 sm:py-2 rounded-md flex items-center justify-center text-base sm:text-sm font-medium ${
              isAnalyzing 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {isAnalyzing ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                분석 중...
              </>
            ) : (
              <>
                <Check size={16} className="mr-2" />
                일정 추가
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CopiedTextModal;
