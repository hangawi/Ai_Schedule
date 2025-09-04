import React from 'react';
import { X, Check } from 'lucide-react';

const SharedTextModal = ({ text, onClose, onConfirm }) => {
  return (
    <div className="fixed inset-0 flex items-end sm:items-center justify-center z-50 bg-black bg-opacity-50 p-4">
      <div className="bg-white w-full max-w-md rounded-t-lg sm:rounded-lg shadow-xl p-4 sm:p-6 max-h-[80vh] sm:max-h-[90vh] overflow-y-auto transform transition-transform duration-300 ease-out">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 pr-2">공유된 텍스트로 일정 추가</h2>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700 flex-shrink-0 p-1"
            aria-label="닫기"
          >
            <X size={20} />
          </button>
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
            <X size={16} className="mr-2" />
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
