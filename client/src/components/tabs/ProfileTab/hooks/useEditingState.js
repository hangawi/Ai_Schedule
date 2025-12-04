/**
 * ===================================================================================================
 * useEditingState.js - '내 프로필' 탭의 편집 관련 상태 관리 커스텀 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/ProfileTab/hooks/useEditingState.js
 *
 * 🎯 주요 기능:
 *    - '내 프로필' 탭의 편집 모드와 관련된 복잡한 상태들을 캡슐화하여 관리.
 *    - 편집 시작 시의 초기 상태(스케줄)를 저장하여 '취소' 기능 구현을 지원.
 *    - '방금 취소됨', '전체 삭제됨' 등의 플래그 상태를 관리하여 오작동을 방지.
 *    - 편집 모드 중일 때, 챗봇이 현재 편집 중인 스케줄 상태에 접근할 수 있도록 `window` 객체에 상태를 노출.
 *
 * 🔗 연결된 파일:
 *    - ../index.js (ProfileTab) - 이 훅을 사용하여 편집 상태를 관리.
 *
 * 💡 UI 위치:
 *    - 이 훅 자체는 UI가 없으나, 반환하는 상태값들이 '내 프로필' 탭의 헤더 버튼 및 스케줄 뷰의 동작을 제어합니다.
 *
 * ✏️ 수정 가이드:
 *    - 편집 취소 후의 동작이나 `window` 객체에 상태를 노출하는 방식을 변경하려면 이 파일을 수정해야 합니다.
 *    - `useEffect` 훅들은 각각의 의존성이 변경될 때 특정 부수 효과(side effect)를 실행하는 역할을 담당합니다.
 *
 * 📝 참고사항:
 *    - `window.__profileEditingState`는 편집 중에만 임시로 사용되며, 편집이 끝나면 삭제됩니다. 이는 챗봇 기능과의 연동을 위한 일종의 트릭(trick)입니다.
 *    - 부모 컴포넌트의 상태 변경을 트리거하기 위해 `onEditingChange` 콜백 함수를 사용합니다.
 *
 * ===================================================================================================
 */

import { useState, useEffect } from 'react';

/**
 * useEditingState
 * @description '내 프로필' 탭의 편집 모드와 관련된 상태(초기 상태 저장, 취소/삭제 플래그)를 관리하는 훅.
 * @param {boolean} isEditing - 현재 편집 모드인지 여부 (부모 컴포넌트로부터 받음).
 * @param {function} onEditingChange - 편집 상태가 변경될 때 부모에게 알리는 콜백.
 * @param {Array} defaultSchedule - 현재 기본 스케줄 데이터.
 * @param {Array} scheduleExceptions - 현재 예외 스케줄 데이터.
 * @param {Array} personalTimes - 현재 개인시간 데이터.
 * @returns {object} 편집 관련 상태 및 세터 함수들을 포함하는 객체.
 * @property {boolean} editingStarted - 편집 모드가 시작되었는지 여부.
 * @property {boolean} justCancelled - '취소' 버튼이 방금 눌렸는지 여부.
 * @property {function} setJustCancelled - `justCancelled` 상태를 업데이트하는 함수.
 * @property {boolean} wasCleared - '전체 초기화' 버튼이 눌렸는지 여부.
 * @property {function} setWasCleared - `wasCleared` 상태를 업데이트하는 함수.
 * @property {object} initialState - 편집 시작 시점의 스케줄 상태 스냅샷.
 * @property {function} setInitialState - `initialState`를 업데이트하는 함수.
 */
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
