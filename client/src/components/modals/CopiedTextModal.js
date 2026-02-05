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
 * ===================================================================================================
 */
import React from 'react';
import { Loader2, X, Clipboard, Calendar } from 'lucide-react';
import { translateEnglishDays } from '../../utils';

const CopiedTextModal = ({ text, isAnalyzing, onClose, onConfirm }) => {
  const translatedText = translateEnglishDays(text);
  const hasTranslation = translatedText !== text;

  const MAX_DISPLAY_LENGTH = 150;
  const getDisplayText = (fullText) => {
    if (fullText.length <= MAX_DISPLAY_LENGTH) {
      return fullText;
    }
    return fullText.substring(0, MAX_DISPLAY_LENGTH) + '...';
  };

  const displayText = getDisplayText(text);
  const displayTranslatedText = getDisplayText(translatedText);

  return (
    <div className="fixed inset-0 flex items-end justify-center z-50">
      {/* 배경 오버레이 */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 모달 컨텐츠 */}
      <div className="relative w-full bg-white rounded-t-3xl shadow-2xl animate-slide-up safe-area-bottom">
        {/* 드래그 핸들 */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        <div className="px-5 pb-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isAnalyzing ? 'bg-blue-100' : 'bg-green-100'
              }`}>
                {isAnalyzing ? (
                  <Loader2 size={20} className="animate-spin text-blue-600" />
                ) : (
                  <Clipboard size={20} className="text-green-600" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {isAnalyzing ? '분석 중...' : '일정 감지됨'}
                </h2>
                <p className="text-xs text-gray-500">
                  {isAnalyzing ? '텍스트를 분석하고 있습니다' : '클립보드에서 일정을 발견했습니다'}
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
            >
              <X size={18} className="text-gray-500" />
            </button>
          </div>

          {/* 텍스트 내용 */}
          <div className="mb-5">
            {hasTranslation && (
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">원본</p>
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <p className="text-sm text-gray-600 leading-relaxed">{displayText}</p>
                </div>
              </div>
            )}

            <div>
              {hasTranslation && (
                <p className="text-xs font-medium text-green-600 mb-1.5 uppercase tracking-wide">변환됨</p>
              )}
              <div className={`rounded-2xl p-4 border-2 ${
                hasTranslation 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-blue-50 border-blue-200'
              }`}>
                <p className="text-sm text-gray-800 leading-relaxed font-medium">
                  {displayTranslatedText}
                </p>
                {translatedText.length > MAX_DISPLAY_LENGTH && (
                  <p className="text-xs text-gray-400 mt-2">
                    +{translatedText.length - MAX_DISPLAY_LENGTH}자 더 있음
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 h-12 rounded-2xl bg-gray-100 text-gray-700 font-semibold text-base active:bg-gray-200 transition-colors"
            >
              취소
            </button>
            <button
              onClick={() => onConfirm(translatedText)}
              disabled={isAnalyzing}
              className={`flex-1 h-12 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-all ${
                isAnalyzing 
                  ? 'bg-gray-200 text-gray-400' 
                  : 'bg-blue-500 text-white active:bg-blue-600 shadow-lg shadow-blue-500/30'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  분석 중
                </>
              ) : (
                <>
                  <Calendar size={18} />
                  일정 추가
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 애니메이션 스타일 */}
      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        .safe-area-bottom {
          padding-bottom: calc(max(env(safe-area-inset-bottom), 20px) + 70px);
        }
      `}</style>
    </div>
  );
};

export default CopiedTextModal;
