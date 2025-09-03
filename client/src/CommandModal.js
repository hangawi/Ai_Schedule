import React, { useRef, useState, useEffect } from 'react';
import { Mic } from 'lucide-react';

const CommandModal = ({ text, onClose, micVolume }) => {
  const modalContentRef = useRef(null);
  const [animatedText, setAnimatedText] = useState('');

  useEffect(() => {
    setAnimatedText(''); // Reset on new text
    if (!text) return;

    let i = 0;
    const typingInterval = setInterval(() => {
      if (i < text.length) {
        setAnimatedText(prev => prev + text[i]);
        i++;
      } else {
        clearInterval(typingInterval);
      }
    }, 70); // Adjust typing speed here

    return () => clearInterval(typingInterval);
  }, [text]);

  const handleBackdropClick = (e) => {
    if (modalContentRef.current && !modalContentRef.current.contains(e.target)) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 transition-opacity duration-300 ease-in-out"
      onClick={handleBackdropClick}
    >
      <div 
        ref={modalContentRef}
        className="bg-gradient-to-br from-blue-600 to-purple-700 rounded-2xl shadow-2xl p-8 w-11/12 max-w-md text-center transform scale-95 transition-all duration-300 ease-out"
        style={{ transform: `scale(${0.95 + micVolume * 0.05})` }} // Subtle scale based on volume
      >
        <div className="flex justify-center items-center mb-6">
          <Mic className="text-white" size={32} />
          <h2 className="text-2xl font-extrabold ml-3 text-white">음성 명령</h2>
        </div>
        <p className="text-white text-2xl font-semibold py-4 tracking-wide leading-relaxed" style={{ fontFamily: 'Spoqa Han Sans Neo', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
          {animatedText}
        </p>

        {/* VU Meter */}
        <div className="flex justify-center items-end h-12 mt-6 space-x-1.5">
          {[...Array(5)].map((_, i) => (
            <div 
              key={i}
              className="w-3 bg-white rounded-full transition-all duration-100 ease-out"
              style={{ height: `${Math.max(10, micVolume * 100 * (1 + i * 0.1))}px`, opacity: `${0.3 + micVolume * 0.7}` }}
            ></div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CommandModal;