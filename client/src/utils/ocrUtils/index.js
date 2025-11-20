/**
 * OCR 시간표 추출 유틸리티 (리팩터링 버전)
 * 학원/학습 시간표 이미지에서 정보를 추출하고 처리
 */

// Imports for main functions
import { GRADE_LEVELS } from './constants/gradeLevelConstants';
import { calculateAge, getGradeLevelFromAge, inferGradeLevelFromTitle } from './utils/ageUtils';
import { extractDaysFromText, convertDaysToEnglish } from './utils/dayUtils';
import { inferClassDuration, processScheduleDays, splitOverlappingBlocks } from './utils/scheduleProcessingUtils';
import { detectConflicts } from './utils/conflictUtils';
import { analyzeScheduleImages } from './api/ocrApiClient';

// Re-exports for external use
// Constants
export { GRADE_LEVELS, GRADE_LEVEL_MAPPING, DEFAULT_CLASS_DURATION } from './constants/gradeLevelConstants';
export { DAY_MAPPING } from './constants/dayConstants';

// Utils
export { calculateAge, getGradeLevelFromAge, inferGradeLevelFromTitle } from './utils/ageUtils';
export { parseTime, convertAmPmTo24Hour, convertPeriodToTime, timeToMinutes, minutesToTime } from './utils/timeUtils';
export { extractDaysFromText, convertDaysToEnglish, getDefaultDaysByCount } from './utils/dayUtils';
export { inferClassDuration, filterByGradeLevel, splitMergedTimeSlots, splitOverlappingBlocks, processScheduleDays } from './utils/scheduleProcessingUtils';
export { detectConflicts } from './utils/conflictUtils';
export { generateOptimalCombinations } from './utils/optimizationUtils';
export { formatWeeklySchedule, summarizeSchedule } from './utils/formatUtils';

// API
export { performOCR, analyzeScheduleImages } from './api/ocrApiClient';

/**
 * OCR 텍스트에서 시간표 정보 파싱
 * @param {string} ocrText - OCR로 추출한 텍스트
 * @param {string} gradeLevel - 학년부
 * @returns {Array} - 파싱된 시간표 배열
 */
export const parseScheduleFromOCR = (ocrText, gradeLevel) => {
  if (!ocrText) return [];

  const schedules = [];
  const lines = ocrText.split('\n');

  let currentSchedule = null;

  lines.forEach((line, index) => {
    line = line.trim();
    if (!line) return;

    // 학년부 키워드 감지
    let detectedGradeLevel = null;
    if (line.includes('초등') || line.includes('초등부')) {
      detectedGradeLevel = GRADE_LEVELS.ELEMENTARY;
    } else if (line.includes('중등') || line.includes('중학') || line.includes('중등부')) {
      detectedGradeLevel = GRADE_LEVELS.MIDDLE;
    } else if (line.includes('고등') || line.includes('고등부')) {
      detectedGradeLevel = GRADE_LEVELS.HIGH;
    }

    // 시간 정보 추출
    const timeMatch = line.match(/(\d{1,2}):(\d{2})\s*[-~]\s*(\d{1,2}):(\d{2})/);

    // 요일 정보 추출
    const days = extractDaysFromText(line);

    // 과목명 추출 (간단한 휴리스틱)
    const subjectMatch = line.match(/([가-힣]+)\s*(?:수업|강의|학원|반)?/);

    if (timeMatch || days || detectedGradeLevel) {
      // 새로운 시간표 항목 생성
      const schedule = {
        title: subjectMatch ? subjectMatch[1] : `수업 ${schedules.length + 1}`,
        gradeLevel: detectedGradeLevel || gradeLevel,
        days: days,
        startTime: timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : null,
        endTime: timeMatch ? `${timeMatch[3].padStart(2, '0')}:${timeMatch[4]}` : null,
        originalText: line,
        source: 'ocr'
      };

      // 수업 시간 추론
      const withDuration = inferClassDuration(schedule, schedule.gradeLevel);
      schedules.push(withDuration);
    }
  });

  return schedules;
};

/**
 * 여러 이미지에서 시간표 추출 및 통합
 * @param {Array<File>} imageFiles - 이미지 파일 배열
 * @param {Function} progressCallback - 진행률 콜백 (0-100)
 * @param {string} birthdate - 사용자 생년월일
 * @param {boolean} skipDuplicateCheck - 중복 체크 건너뛰기
 * @returns {Promise<Object>} - 추출된 시간표와 메타데이터
 */
export const extractSchedulesFromImages = async (imageFiles, progressCallback, birthdate, skipDuplicateCheck = false) => {
  const age = calculateAge(birthdate);
  const gradeLevel = getGradeLevelFromAge(age);

  // 진행률 보고
  if (progressCallback) progressCallback(10);

  // 백엔드 API를 사용하여 구조화된 시간표 데이터 가져오기 (10% → 95%)
  const apiResponse = await analyzeScheduleImages(imageFiles, birthdate, progressCallback, skipDuplicateCheck);

  // 중복 감지 시 즉시 반환
  if (apiResponse.hasDuplicates) {
    return apiResponse; // 중복 정보 그대로 반환
  }

  // 최적화된 스케줄 우선 사용
  const rawSchedules = apiResponse.optimizedSchedules || apiResponse.allSchedules || [];
  const schedulesByImage = apiResponse.schedulesByImage || [];
  const baseSchedules = apiResponse.baseSchedules || [];
  const overallTitle = apiResponse.overallTitle || '업로드된 시간표';

  // gradeLevel이 null인 경우 imageTitle/overallTitle에서 추론
  rawSchedules.forEach(schedule => {
    if (!schedule.gradeLevel || schedule.gradeLevel === 'null') {
      const inferredGrade = inferGradeLevelFromTitle(schedule.imageTitle || overallTitle);
      if (inferredGrade) {
        schedule.gradeLevel = inferredGrade;
      }
    }
  });

  if (progressCallback) progressCallback(96);

  // 최적화된 스케줄이면 추가 처리 없이 바로 사용
  if (apiResponse.optimizedSchedules) {
    // 충돌 감지 (참고용)
    const conflicts = detectConflicts(rawSchedules);

    // 요일만 한글 → 영문 변환
    const schedulesWithEnglishDays = rawSchedules.map(schedule => {
      let days = schedule.days;
      if (days && Array.isArray(days)) {
        days = convertDaysToEnglish(days);
      }
      return { ...schedule, days, source: 'ocr' };
    });

    return {
      age,
      gradeLevel,
      schedules: schedulesWithEnglishDays,
      allSchedulesBeforeFilter: schedulesWithEnglishDays,
      conflicts,
      optimalCombinations: [schedulesWithEnglishDays],
      ocrResults: [],
      hasConflicts: conflicts.length > 0,
      schedulesByImage: schedulesByImage,
      baseSchedules: baseSchedules,
      overallTitle: overallTitle,
      optimizedSchedules: schedulesWithEnglishDays,
      optimizationAnalysis: apiResponse.optimizationAnalysis
    };
  }

  // 요일을 영문 코드로 변환
  let processedSchedules = processScheduleDays(rawSchedules, gradeLevel);

  // 수업 시간이 없는 경우 추론
  const schedulesWithDuration = processedSchedules.map((schedule, index) =>
    inferClassDuration(schedule, schedule.gradeLevel, index)
  );

  // 겹치는 시간 블록 분할
  const schedulesWithSplit = splitOverlappingBlocks(schedulesWithDuration);

  if (progressCallback) progressCallback(80);

  // 충돌 감지 (참고용)
  const conflicts = detectConflicts(schedulesWithSplit);

  // 최적 조합 생성 건너뛰기 - 모든 스케줄 그대로 사용
  const optimalCombinations = [schedulesWithSplit];

  if (progressCallback) progressCallback(90);

  if (progressCallback) progressCallback(100);

  return {
    age,
    gradeLevel,
    schedules: schedulesWithSplit,
    allSchedulesBeforeFilter: schedulesWithSplit,
    conflicts,
    optimalCombinations,
    ocrResults: [],
    hasConflicts: conflicts.length > 0,
    schedulesByImage: schedulesByImage,
    baseSchedules: baseSchedules,
    overallTitle: overallTitle
  };
};
