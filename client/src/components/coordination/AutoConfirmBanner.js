import React, { useState, useEffect } from 'react';
import { Clock, AlertCircle } from 'lucide-react';

/**
 * 자동 확정 타이머 배너 (모든 사용자에게 표시)
 * @param {Date} autoConfirmAt - 자동 확정 예정 시간
 * @param {boolean} isOwner - 방장 여부
 */
const AutoConfirmBanner = ({ autoConfirmAt, isOwner }) => {
  const [timeRemaining, setTimeRemaining] = useState(null);

  useEffect(() => {
    if (!autoConfirmAt) {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const confirmTime = new Date(autoConfirmAt);
      const diff = confirmTime - now;

      if (diff <= 0) {
        setTimeRemaining(0);
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeRemaining({ minutes, seconds });
      }
    };

    // 즉시 업데이트 (리셋 효과)
    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [String(autoConfirmAt)]);

  if (!timeRemaining || timeRemaining === 0) return null;

  return (
    <div className="mb-4 bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-300 rounded-lg p-4 shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500 bg-opacity-20 p-2 rounded-full">
            <Clock size={24} className="text-orange-600 animate-pulse" />
          </div>
          <div>
            <div className="font-bold text-orange-800 text-lg">
              {isOwner ? '자동 확정 대기 중' : '배정 시간 자동 확정 예정'}
            </div>
            <div className="text-sm text-gray-700 mt-0.5">
              {isOwner
                ? '시간 종료 시 자동으로 개인일정에 확정됩니다'
                : '방장이 자동배정한 시간이 곧 확정됩니다'}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-3xl font-mono font-bold text-orange-600">
            {String(timeRemaining.minutes).padStart(2, '0')}:{String(timeRemaining.seconds).padStart(2, '0')}
          </div>
          <div className="text-xs text-gray-600 mt-1">
            {timeRemaining.minutes}분 {timeRemaining.seconds}초 후 확정
          </div>
        </div>
      </div>

      {!isOwner && (
        <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded p-2">
          <AlertCircle size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-800">
            <strong>확정되면:</strong> 배정된 시간이 내 프로필 &gt; 개인시간에 자동 추가되며, 해당 선호시간이 삭제됩니다.
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoConfirmBanner;
