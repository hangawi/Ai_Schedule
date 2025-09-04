import React from 'react';
import { X, Check } from 'lucide-react';

const CopiedTextModal = ({ text, onClose, onConfirm }) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
      <div className="bg-white w-11/12 max-w-md rounded-lg shadow-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">복사된 텍스트로 일정 추가</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-2">클립보드에 복사된 내용으로 일정을 추가할까요?</p>
          <blockquote className="bg-gray-100 p-3 rounded-md border-l-4 border-blue-500 text-gray-800">
            {text}
          </blockquote>
        </div>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 flex items-center"
          >
            <X size={16} className="mr-2" />
            취소
          </button>
          <button
            onClick={() => onConfirm(text)}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center"
          >
            <Check size={16} className="mr-2" />
            일정 추가
          </button>
        </div>
      </div>
    </div>
  );
};

export default CopiedTextModal;
