import React from 'react';
import { Check, Loader2 } from 'lucide-react';
import { translateEnglishDays } from '../../utils';

const CopiedTextModal = ({ text, isAnalyzing, onClose, onConfirm }) => {
  const translatedText = translateEnglishDays(text);
  const hasTranslation = translatedText !== text;

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
              <blockquote className="bg-blue-50 p-2 rounded-md border-l-2 border-blue-300 text-gray-700 text-sm max-h-24 overflow-y-auto">
                {text}
              </blockquote>
            </div>
          )}
          
          <div>
            {hasTranslation && <p className="text-xs text-green-600 mb-1">변환된 텍스트:</p>}
            <blockquote className={`p-3 rounded-md border-l-4 text-gray-800 text-sm max-h-32 overflow-y-auto ${
              hasTranslation ? 'bg-green-50 border-green-500' : 'bg-gray-50 border-blue-500'
            }`}>
              {translatedText}
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
