/**
 * ===================================================================================================
 * [ConflictActions.js] - 스케줄 충돌 시 사용자 선택을 받는 액션 버튼 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > client/src/components/chat/components/ConflictActions.js
 *
 * 🎯 주요 기능:
 *    - 스케줄 충돌이 발생했을 때, 해결을 위한 선택지(버튼)들을 사용자에게 제공
 *    - 사용자가 특정 액션을 선택하면 `onConflictChoice` 콜백 함수를 호출
 *
 * 🔗 연결된 파일:
 *    - ./MessageBubble.js: AI가 스케줄 충돌을 감지하고 해결 방법을 제안하는 메시지 버블 내에서 이 컴포넌트를 사용
 *
 * 💡 UI 위치:
 *    - AI 채팅창 내에서 스케줄 충돌 관련 메시지 아래에 버튼 그룹으로 표시됨
 *
 * ✏️ 수정 가이드:
 *    - 버튼의 스타일을 변경하려면: `<button>` 요소의 className을 수정합니다.
 *    - 액션 버튼을 감싸는 컨테이너의 스타일을 변경하려면: 최상위 `<div>`의 className을 수정합니다.
 *
 * 📝 참고사항:
 *    - `actions` 배열에 담긴 객체의 `label`이 버튼 텍스트가 됩니다.
 *    - 사용자가 버튼을 클릭하면 `action.id`와 관련 이벤트 정보가 부모 컴포넌트로 전달됩니다.
 *
 * ===================================================================================================
 */
import React from 'react';

/**
 * ConflictActions
 *
 * @description 스케줄 충돌 발생 시 사용자에게 해결 방법을 선택할 수 있는 버튼들을 렌더링합니다.
 * @param {object} props - 컴포넌트 props
 * @param {Array<object>} props.actions - 렌더링할 액션 버튼의 배열. 각 객체는 { id: string, label: string } 형태를 가짐.
 * @param {object} props.pendingEvent - 현재 추가하려다 충돌이 발생한 이벤트 객체.
 * @param {Array<object>} props.conflictingEvents - `pendingEvent`와 충돌하는 기존 이벤트들의 배열.
 * @param {function} props.onConflictChoice - 사용자가 액션 버튼을 클릭했을 때 호출되는 콜백 함수.
 * @returns {JSX.Element|null} 액션이 없으면 null을 반환, 있으면 버튼 그룹을 렌더링.
 */
const ConflictActions = ({ actions, pendingEvent, conflictingEvents, onConflictChoice }) => {
  if (!actions || actions.length === 0) return null;

  return (
    <div className="mt-3 p-2 bg-white bg-opacity-20 rounded border">
      <p className="text-xs font-semibold mb-2">어떻게 하시겠어요?</p>
      <div className="space-y-2">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => onConflictChoice(
              action.id,
              pendingEvent,
              conflictingEvents?.[0]
            )}
            className="w-full px-3 py-2 bg-white bg-opacity-40 hover:bg-opacity-60 rounded text-xs text-left transition-all font-medium"
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ConflictActions;