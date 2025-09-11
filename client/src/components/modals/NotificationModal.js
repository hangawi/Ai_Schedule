import React from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

const NotificationModal = ({ isOpen, onClose, type, title, message }) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />;
      case 'error':
        return <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />;
      default:
        return <CheckCircle className="w-12 h-12 text-blue-500 mx-auto mb-4" />;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  const getButtonColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-500 hover:bg-green-600';
      case 'error':
        return 'bg-red-500 hover:bg-red-600';
      default:
        return 'bg-blue-500 hover:bg-blue-600';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-lg shadow-xl max-w-md w-full mx-auto border-2 ${getBgColor()}`}>
        <div className="p-6">
          <div className="flex justify-end mb-2">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>
          
          {getIcon()}
          
          <h3 className="text-lg font-semibold text-center text-gray-800 mb-2">
            {title}
          </h3>
          
          <p className="text-center text-gray-600 mb-6">
            {message}
          </p>
          
          <div className="flex justify-center">
            <button
              onClick={onClose}
              className={`px-6 py-2 text-white rounded-lg font-medium transition-colors ${getButtonColor()}`}
            >
              확인
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;