/**
 * ===================================================================================================
 * useScheduleState.js - 스케줄 관련 상태 관리 커스텀 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/chat/hooks
 *
 * 🎯 주요 기능:
 *    - OCR을 통해 추출된 원본 및 가공된 시간표 데이터 관련 상태 관리
 *    - 시간표 필터링 및 변경에 대한 히스토리(undo/redo) 상태 관리
 *    - 고정 시간표 및 범례용 커스텀 시간표 상태 관리
 *
 * 🔗 연결된 파일:
 *    - ../components/TimetableUploadWithChat.js - 이 훅을 사용하여 시간표 관련 상태를 종합적으로 관리
 *    - ../../modals/ScheduleOptimizationModal.js - 이 훅이 관리하는 상태(예: `filteredSchedules`)를 사용
 *
 * 💡 UI 위치:
 *    - 챗봇 화면 > 시간표 최적화 모달
 *
 * ✏️ 수정 가이드:
 *    - 새로운 시간표 관련 상태 추가: 이 훅에 `useState`를 추가하여 관리
 *    - 실행 취소/다시 실행 로직 변경: `scheduleHistory`, `redoStack` 상태를 조작하는 로직 수정
 *
 * 📝 참고사항:
 *    - 이 훅은 OCR 및 챗봇을 통한 시간표 처리의 복잡한 상태들을 중앙에서 관리하기 위해 설계되었습니다.
 *    - `originalSchedule`: OCR로 처음 추출된 순수 데이터
 *    - `extractedSchedules`, `schedulesByImage`: 사용자 필터링 및 상호작용에 따라 가공된 데이터
 *    - `scheduleHistory`, `redoStack`: 사용자의 필터링 변경 이력을 추적하여 undo/redo 기능을 구현하는 데 사용됩니다.
 *
 * ===================================================================================================
 */

import { useState } from 'react';

/**
 * useScheduleState
 *
 * @description OCR로 추출된 시간표와 관련된 모든 상태를 중앙에서 관리하는 커스텀 훅입니다.
 * @returns {Object} 시간표 관련 상태와 해당 상태를 업데이트하는 셋터 함수들을 포함하는 객체
 *
 * @property {Object | null} originalSchedule - OCR로 추출된 원본 시간표 데이터
 * @property {Function} setOriginalSchedule - `originalSchedule` 상태를 업데이트하는 함수
 * @property {Array<Object>} scheduleHistory - 사용자의 필터링 변경 이력을 저장하는 배열 (undo용)
 * @property {Function} setScheduleHistory - `scheduleHistory` 상태를 업데이트하는 함수
 * @property {Array<Object>} redoStack - 사용자가 undo한 작업을 저장하는 배열 (redo용)
 * @property {Function} setRedoStack - `redoStack` 상태를 업데이트하는 함수
 * @property {Array<Object> | null} extractedSchedules - 현재 사용자에게 표시되는 최적화/필터링된 시간표 목록
 * @property {Function} setExtractedSchedules - `extractedSchedules` 상태를 업데이트하는 함수
 * @property {Array<Object> | null} schedulesByImage - 이미지별로 그룹화된 시간표 목록
 * @property {Function} setSchedulesByImage - `schedulesByImage` 상태를 업데이트하는 함수
 * @property {Array<Object> | null} baseSchedules - 시간표의 기본이 되는 스케줄 (예: 정규 수업)
 * @property {Function} setBaseSchedules - `baseSchedules` 상태를 업데이트하는 함수
 * @property {string} overallTitle - 전체 시간표의 제목
 * @property {Function} setOverallTitle - `overallTitle` 상태를 업데이트하는 함수
 * @property {Array<Object> | null} filteredSchedules - 필터링이 적용된 시간표 목록
 * @property {Function} setFilteredSchedules - `filteredSchedules` 상태를 업데이트하는 함수
 * @property {Array<Object>} fixedSchedules - 사용자가 고정한 시간표 목록
 * @property {Function} setFixedSchedules - `fixedSchedules` 상태를 업데이트하는 함수
 * @property {Array<Object>} customSchedulesForLegend - 시간표 범례에 표시될 커스텀 시간표 목록
 * @property {Function} setCustomSchedulesForLegend - `customSchedulesForLegend` 상태를 업데이트하는 함수
 *
 * @example
 * // TimetableUploadWithChat 컴포넌트 내에서 사용
 * const { extractedSchedules, setExtractedSchedules, scheduleHistory, setScheduleHistory } = useScheduleState();
 */
export const useScheduleState = () => {
  const [originalSchedule, setOriginalSchedule] = useState(null);
  const [scheduleHistory, setScheduleHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [extractedSchedules, setExtractedSchedules] = useState(null);
  const [schedulesByImage, setSchedulesByImage] = useState(null);
  const [baseSchedules, setBaseSchedules] = useState(null);
  const [overallTitle, setOverallTitle] = useState('업로드된 시간표');
  const [filteredSchedules, setFilteredSchedules] = useState(null);
  const [fixedSchedules, setFixedSchedules] = useState([]);
  const [customSchedulesForLegend, setCustomSchedulesForLegend] = useState([]);

  return {
    originalSchedule,
    setOriginalSchedule,
    scheduleHistory,
    setScheduleHistory,
    redoStack,
    setRedoStack,
    extractedSchedules,
    setExtractedSchedules,
    schedulesByImage,
    setSchedulesByImage,
    baseSchedules,
    setBaseSchedules,
    overallTitle,
    setOverallTitle,
    filteredSchedules,
    setFilteredSchedules,
    fixedSchedules,
    setFixedSchedules,
    customSchedulesForLegend,
    setCustomSchedulesForLegend
  };
};
