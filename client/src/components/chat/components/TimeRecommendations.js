/**
 * ===================================================================================================
 * [TimeRecommendations.js] - AI 채팅창 내 시간 추천 및 선택 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > client/src/components/chat/components/TimeRecommendations.js
 *
 * 🎯 주요 기능:
 *    - 스케줄 충돌 해결 또는 재조정을 위한 대체 시간 옵션을 버튼 형태로 제시 (`TimeRecommendations`)
 *    - 일반적인 상황에서 AI가 제안하는 추천 시간대를 버튼 형태로 표시 (`SuggestedTimes`)
 *    - 사용자가 추천 시간을 선택하면 해당 시간 정보를 상위 컴포넌트로 전달
 *
 * 🔗 연결된 파일:
 *    - ../MessageBubble.js: AI 응답 메시지 내에서 시간 추천 정보를 시각화할 때 이 컴포넌트들을 사용
 *
 * 💡 UI 위치:
 *    - AI 채팅창 내, AI가 시간 관련 제안을 할 때 메시지 아래에 버튼 그룹으로 표시됨
 *
 * ✏️ 수정 가이드:
 *    - 추천 시간 버튼의 스타일이나 텍스트 형식을 변경하려면: 각 컴포넌트 내부의 `<button>` 요소를 수정합니다.
 *    - `TimeRecommendations`의 `action` 결정 로직을 변경하려면: `nextStep` prop을 기반으로 하는 삼항 연산자를 수정합니다.
 *
 * 📝 참고사항:
 *    - `TimeRecommendations`는 `pendingEvent`와 `conflictingEvent` 정보를 함께 전달하여 더 복잡한 충돌 해결 로직을 지원합니다.
 *    - 두 컴포넌트 모두 `recommendations` 또는 `suggestedTimes` prop이 비어있으면 아무것도 렌더링하지 않습니다.
 *
 * ===================================================================================================
 */
import React from 'react';

/**
 * TimeRecommendations
 *
 * @description 스케줄 충돌 해결 또는 재조정을 위해 AI가 제안하는 대체 시간 옵션들을 버튼 형태로 렌더링합니다.
 * @param {object} props - 컴포넌트 props
 * @param {Array<object>} props.recommendations - 추천 시간 옵션 객체 배열. 각 객체는 { display: string, ... } 형태를 가짐.
 * @param {object} props.pendingEvent - 충돌을 일으킨 보류 중인 이벤트 객체.
 * @param {object} props.conflictingEvent - 충돌하는 기존 이벤트 객체.
 * @param {string} props.string - AI 대화의 다음 단계를 나타내는 문자열 (예: 'select_alternative_time').
 * @param {function} props.onTimeSelection - 추천 시간 버튼 클릭 시 호출되는 콜백 함수.
 * @returns {JSX.Element|null} `recommendations` 배열이 비어있으면 null을 반환, 그렇지 않으면 추천 시간 버튼 그룹을 렌더링.
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
 * SuggestedTimes
 *
 * @description AI가 일반적인 상황에서 제안하는 시간대 옵션들을 버튼 형태로 렌더링합니다. (주로 챗봇의 기존 로직에서 사용)
 * @param {object} props - 컴포넌트 props
 * @param {Array<object>} props.suggestedTimes - 제안된 시간 슬롯 객체 배열. 각 객체는 { date: string, start: string, end: string, ... } 형태를 가짐.
 * @param {function} props.onSelectTime - 제안된 시간 버튼 클릭 시 호출되는 콜백 함수.
 * @returns {JSX.Element|null} `suggestedTimes` 배열이 비어있으면 null을 반환, 그렇지 않으면 제안된 시간 버튼 그룹을 렌더링.
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