/**
 * ===================================================================================================
 * commandParser.js - 채팅 명령어 파싱 유틸리티
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/utils
 *
 * 🎯 주요 기능:
 *    - 사용자 입력(자연어)에서 명령어의 종류(삭제, 선택, 수정, 추가)를 감지
 *    - 입력에서 요일, 학년부, 과목명, 시간 등 주요 정보 추출
 *    - 각 명령어 종류에 맞게 관련 정보를 파싱하여 구조화된 객체로 반환
 *
 * 🔗 연결된 파일:
 *    - ../constants/modalConstants - 요일, 학년부 매핑 객체
 *    - ./timeUtils - 시간 파싱 유틸리티
 *    - ScheduleOptimizerModal.js - 이 파서들을 사용하여 사용자 명령을 해석
 *
 * 💡 UI 위치:
 *    - 이 파일은 UI가 없으며, '일정 최적화 모달' 내의 채팅창에서 입력된 명령어를 해석하는 로직에 사용됩니다.
 *
 * ✏️ 수정 가이드:
 *    - 새로운 명령어 타입 추가: `detectCommandType`에 새로운 정규식과 반환 값 추가, `parse[New]Command` 함수 생성
 *    - 새로운 키워드(요일, 과목 등) 추가: `DAY_MAP`, `GRADE_LEVEL_MAP` 또는 `extractTitle`의 정규식 수정
 *    - 파싱 로직 변경: 각 `parse...Command` 함수 내부의 정보 추출 및 조합 로직 수정
 *
 * 📝 참고사항:
 *    - 현재 파싱 로직은 정규 표현식과 문자열 포함 여부에 기반한 간단한 형태입니다.
 *    - 더 복잡한 자연어 처리를 위해서는 외부 NLP 라이브러리나 서비스 연동이 필요할 수 있습니다.
 *
 * ===================================================================================================
 */

import { DAY_MAP, GRADE_LEVEL_MAP } from '../constants/modalConstants';
import { parseTime } from './timeUtils';

/**
 * detectCommandType
 * @description 사용자 입력 문자열에서 명령어의 종류('delete', 'select', 'modify', 'add')를 감지합니다.
 * @param {string} input - 사용자 입력 문자열.
 * @returns {string} 감지된 명령어 타입 또는 'unknown'.
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
 * extractDay
 * @description 사용자 입력에서 한글 요일 키워드를 찾아 영문 요일 코드로 변환합니다.
 * @param {string} input - 사용자 입력 문자열.
 * @returns {string | null} 영문 요일 코드 (예: 'MON') 또는 null.
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
 * extractGradeLevel
 * @description 사용자 입력에서 학년부 키워드를 찾아 해당 정보 객체를 반환합니다.
 * @param {string} input - 사용자 입력 문자열.
 * @returns {{key: string, value: string} | null} 학년부 정보 객체 또는 null.
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
 * extractTitle
 * @description 사용자 입력에서 미리 정의된 과목명(제목) 키워드를 추출합니다.
 * @param {string} input - 사용자 입력 문자열.
 * @returns {string | null} 추출된 과목명 또는 null.
 */
export const extractTitle = (input) => {
  const titleMatch = input.match(/(피아노|태권도|영어|수학|국어|과학|축구|농구|수영|미술|음악|댄스|발레|체육|독서)/);
  return titleMatch ? titleMatch[1] : null;
};

/**
 * parseDeleteCommand
 * @description '삭제' 명령어에서 요일, 시간, 학년부 정보를 파싱합니다.
 * @param {string} input - '삭제' 관련 사용자 입력 문자열.
 * @returns {{day: string|null, time: {start: string, end: string}|null, gradeLevel: string|null}} 파싱된 정보 객체.
 */
export const parseDeleteCommand = (input) => {
  return {
    day: extractDay(input),
    time: parseTime(input),
    gradeLevel: extractGradeLevel(input)?.value || null
  };
};

/**
 * parseSelectCommand
 * @description '선택' 명령어에서 요일, 시간, 제목 정보를 파싱합니다.
 * @param {string} input - '선택' 관련 사용자 입력 문자열.
 * @returns {{day: string|null, time: {start: string, end: string}|null, title: string|null}} 파싱된 정보 객체.
 */
export const parseSelectCommand = (input) => {
  return {
    day: extractDay(input),
    time: parseTime(input),
    title: extractTitle(input)
  };
};

/**
 * parseModifyCommand
 * @description '수정' 명령어에서 요일, 학년부, 변경 전/후 시간 정보를 파싱합니다.
 * @param {string} input - '수정' 관련 사용자 입력 문자열.
 * @returns {{day: string|null, gradeLevel: string|null, oldTime: object|null, newTime: object|null}} 파싱된 정보 객체.
 */
export const parseModifyCommand = (input) => {
  const day = extractDay(input);
  const gradeLevel = extractGradeLevel(input)?.value || null;

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
 * parseAddCommand
 * @description '추가' 명령어에서 요일, 시간, 학년부, 제목 정보를 파싱합니다.
 * @param {string} input - '추가' 관련 사용자 입력 문자열.
 * @returns {{day: string|null, time: object|null, gradeLevel: string|null, title: string}} 파싱된 정보 객체.
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