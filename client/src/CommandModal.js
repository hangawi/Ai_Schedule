
import React, { useEffect, useRef } from 'react';
import { Mic } from 'lucide-react';

const CommandModal = ({ text, onClose }) => {
  const modalContentRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [text, onClose]);

  const handleBackdropClick = (e) => {
    if (modalContentRef.current && !modalContentRef.current.contains(e.target)) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"
      onClick={handleBackdropClick}
    >
      <div 
        ref={modalContentRef}
        className="bg-white rounded-lg shadow-xl p-6 w-11/12 max-w-md text-center"
      >
        <div className="flex justify-center items-center mb-4">
          <Mic className="text-blue-500" size={24} />
          <h2 className="text-xl font-bold ml-2 text-gray-800">음성 명령</h2>
        </div>
        <p className="text-gray-600 text-lg py-4" style={{ fontFamily: 'Spoqa Han Sans Neo', fontWeight: 500 }}>
          "{text}"
        </p>

        {/* VU Meter Placeholder */}
        <div className="flex justify-center items-end h-10 mt-4 space-x-1">
          <div className="w-2 bg-blue-400 rounded-full animate-pulse-vu" style={{ animationDelay: '0s' }}></div>
          <div className="w-2 bg-blue-500 rounded-full animate-pulse-vu" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 bg-blue-600 rounded-full animate-pulse-vu" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 bg-blue-500 rounded-full animate-pulse-vu" style={{ animationDelay: '0.3s' }}></div>
          <div className="w-2 bg-blue-400 rounded-full animate-pulse-vu" style={{ animationDelay: '0.4s' }}></div>
        </div>

        {/* Add custom animation keyframes for Tailwind CSS */}
        <style jsx>{`
          @keyframes pulse-vu {
            0%, 100% { height: 10%; opacity: 0.5; }
            50% { height: 90%; opacity: 1; }
          }
          .animate-pulse-vu {
            animation: pulse-vu 1.2s infinite ease-in-out alternate;
          }
        `}</style>
      </div>
    </div>
  );
};

export default CommandModal;
