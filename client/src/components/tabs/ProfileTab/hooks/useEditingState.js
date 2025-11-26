// 편집 상태 관리 훅

import { useState, useEffect } from 'react';

export const useEditingState = (
  isEditing,
  onEditingChange,
  defaultSchedule,
  scheduleExceptions,
  personalTimes
) => {
  const [editingStarted, setEditingStarted] = useState(false);
  const [justCancelled, setJustCancelled] = useState(false);
  const [wasCleared, setWasCleared] = useState(false);
  const [initialState, setInitialState] = useState({
    defaultSchedule: [],
    scheduleExceptions: [],
    personalTimes: []
  });

  // 편집 모드일 때 현재 상태를 window에 저장하여 챗봇이 사용할 수 있도록 함
  useEffect(() => {
    if (isEditing) {
      window.__profileEditingState = {
        defaultSchedule,
        scheduleExceptions,
        personalTimes
      };
    } else {
      delete window.__profileEditingState;
    }
  }, [isEditing, defaultSchedule, scheduleExceptions, personalTimes]);

  // 편집 상태가 변경될 때 부모 컴포넌트에 알림
  useEffect(() => {
    if (onEditingChange) {
      onEditingChange(isEditing);
    }
  }, [isEditing, onEditingChange]);

  // 편집 모드 진입 추적
  useEffect(() => {
    if (isEditing && !editingStarted) {
      setEditingStarted(true);
    } else if (!isEditing) {
      setEditingStarted(false);
    }
  }, [isEditing, editingStarted]);

  return {
    editingStarted,
    justCancelled,
    setJustCancelled,
    wasCleared,
    setWasCleared,
    initialState,
    setInitialState
  };
};
