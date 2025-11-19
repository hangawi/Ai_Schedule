/**
 * ============================================================================
 * commandParser.js - Command Parsing Utilities
 * ============================================================================
 */

import { DAY_MAP, GRADE_LEVEL_MAP } from '../constants/modalConstants';
import { parseTime } from './timeUtils';

/**
 * 명령 타입 감지
 */
export const detectCommandType = (input) => {
  const deletePattern = /삭제|지워|없애/;
  const selectPattern = /선택|남겨|유지/;
  const modifyPattern = /수정|변경|바꿔/;
  const addPattern = /추가|넣어|생성/;

  if (deletePattern.test(input)) return 'delete';
  if (selectPattern.test(input)) return 'select';
  if (modifyPattern.test(input)) return 'modify';
  if (addPattern.test(input)) return 'add';

  return 'unknown';
};

/**
 * 요일 추출
 */
export const extractDay = (input) => {
  for (const [key, value] of Object.entries(DAY_MAP)) {
    if (input.includes(key)) {
      return value;
    }
  }
  return null;
};

/**
 * 학년부 추출
 */
export const extractGradeLevel = (input) => {
  for (const [key, value] of Object.entries(GRADE_LEVEL_MAP)) {
    if (input.includes(key)) {
      return { key, value };
    }
  }
  return null;
};

/**
 * 제목 추출 (과목명 등)
 */
export const extractTitle = (input) => {
  const titleMatch = input.match(/(피아노|태권도|영어|수학|국어|과학|축구|농구|수영|미술|음악|댄스|발레|체육|독서)/);
  return titleMatch ? titleMatch[1] : null;
};

/**
 * 삭제 명령 파싱
 */
export const parseDeleteCommand = (input) => {
  return {
    day: extractDay(input),
    time: parseTime(input),
    gradeLevel: extractGradeLevel(input)?.value || null
  };
};

/**
 * 선택 명령 파싱
 */
export const parseSelectCommand = (input) => {
  return {
    day: extractDay(input),
    time: parseTime(input),
    title: extractTitle(input)
  };
};

/**
 * 수정 명령 파싱
 */
export const parseModifyCommand = (input) => {
  const day = extractDay(input);
  const gradeLevel = extractGradeLevel(input)?.value || null;

  // "을/를/에서" 기준으로 이전 시간과 이후 시간 분리
  const modifyMatch = input.match(/(.+?)(을|를|에서)\s*(.+?)(으로|로)\s*(.+)/);
  let oldTime = null;
  let newTime = null;

  if (modifyMatch) {
    const beforePart = modifyMatch[1] + modifyMatch[3];
    const afterPart = modifyMatch[5];
    oldTime = parseTime(beforePart);
    newTime = parseTime(afterPart);
  }

  return { day, gradeLevel, oldTime, newTime };
};

/**
 * 추가 명령 파싱
 */
export const parseAddCommand = (input) => {
  const day = extractDay(input);
  const time = parseTime(input);
  const gradeLevelInfo = extractGradeLevel(input);

  return {
    day,
    time,
    gradeLevel: gradeLevelInfo?.value || null,
    title: gradeLevelInfo?.key || '수업'
  };
};
