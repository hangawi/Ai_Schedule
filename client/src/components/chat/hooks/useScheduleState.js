/**
 * ============================================================================
 * useScheduleState.js - 스케줄 관련 상태 관리 훅
 * ============================================================================
 */

import { useState } from 'react';

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
