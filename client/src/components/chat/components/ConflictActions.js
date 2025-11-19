/**
 * ============================================================================
 * ConflictActions.js - 충돌 처리 액션 버튼 컴포넌트
 * ============================================================================
 */

import React from 'react';

/**
 * 충돌 처리 액션 버튼 컴포넌트
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
