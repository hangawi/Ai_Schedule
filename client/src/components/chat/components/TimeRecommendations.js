/**
 * ============================================================================
 * TimeRecommendations.js - 시간 추천 버튼 컴포넌트
 * ============================================================================
 */

import React from 'react';

/**
 * 시간 추천 버튼 컴포넌트 (충돌 해결용)
 */
const TimeRecommendations = ({
  recommendations,
  pendingEvent,
  conflictingEvent,
  nextStep,
  onTimeSelection
}) => {
  if (!recommendations || recommendations.length === 0) return null;

  const action = nextStep === 'select_alternative_time' ? 'alternative' : 'reschedule';

  return (
    <div className="mt-3 p-2 bg-white bg-opacity-20 rounded border">
      <p className="text-xs font-semibold mb-2">시간을 선택하세요:</p>
      <div className="space-y-1">
        {recommendations.map((rec, index) => (
          <button
            key={index}
            onClick={() => onTimeSelection(
              rec,
              pendingEvent,
              conflictingEvent,
              action,
              nextStep
            )}
            className="w-full px-3 py-2 bg-white bg-opacity-40 hover:bg-opacity-60 rounded text-xs text-left transition-all"
          >
            ⏰ {rec.display}
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * 추천 시간대 선택 버튼 컴포넌트 (기존 로직용)
 */
export const SuggestedTimes = ({ suggestedTimes, onSelectTime }) => {
  if (!suggestedTimes || suggestedTimes.length === 0) return null;

  return (
    <div className="mt-3 p-2 bg-white bg-opacity-20 rounded border">
      <p className="text-xs font-semibold mb-2">추천 시간:</p>
      <div className="space-y-1">
        {suggestedTimes.map((slot, index) => (
          <button
            key={index}
            onClick={() => onSelectTime(slot)}
            className="w-full px-3 py-2 bg-white bg-opacity-40 hover:bg-opacity-60 rounded text-xs text-left transition-all"
          >
            📅 {slot.date} {slot.start} - {slot.end}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TimeRecommendations;
