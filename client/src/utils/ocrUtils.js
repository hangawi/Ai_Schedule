/**
 * OCR 시간표 추출 유틸리티
 * 학원/학습 시간표 이미지에서 정보를 추출하고 처리
 */

// 학년부 정의
export const GRADE_LEVELS = {
  ELEMENTARY: 'elementary',  // 초등부 (8-13세)
  MIDDLE: 'middle',          // 중등부 (14-16세)
  HIGH: 'high'               // 고등부 (17-19세)
};

// 학년부 한글 → 영어 변환
export const GRADE_LEVEL_MAPPING = {
  '초등부': 'elementary',
  '초등학생': 'elementary',
  '초등': 'elementary',
  '중등부': 'middle',
  '중학생': 'middle',
  '중등': 'middle',
  '고등부': 'high',
  '고등학생': 'high',
  '고등': 'high'
};

// 학년부별 기본 수업 시간 (분)
export const DEFAULT_CLASS_DURATION = {
  [GRADE_LEVELS.ELEMENTARY]: 40,  // 초등부 40분
  '초등부': 40,
  '초등학생': 40,
  '초등': 40,
  [GRADE_LEVELS.MIDDLE]: 45,       // 중등부 45분
  '중등부': 45,
  '중학생': 45,
  '중등': 45,
  [GRADE_LEVELS.HIGH]: 50,         // 고등부 50분
  '고등부': 50,
  '고등학생': 50,
  '고등': 50
};

// 요일 매핑
const DAY_MAPPING = {
  '월': 'MON',
  '화': 'TUE',
  '수': 'WED',
  '목': 'THU',
  '금': 'FRI',
  '토': 'SAT',
  '일': 'SUN',
  'monday': 'MON',
  'tuesday': 'TUE',
  'wednesday': 'WED',
  'thursday': 'THU',
  'friday': 'FRI',
  'saturday': 'SAT',
  'sunday': 'SUN'
};

/**
 * 생년월일로부터 나이 계산
 * @param {string} birthdate - YYYY-MM-DD 형식의 생년월일
 * @returns {number} - 만 나이
 */
export const calculateAge = (birthdate) => {
  if (!birthdate) return null;

  const today = new Date();
  const birth = new Date(birthdate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
};

/**
 * 나이로부터 학년부 판단
 * @param {number} age - 만 나이
 * @returns {string} - GRADE_LEVELS의 값
 */
export const getGradeLevelFromAge = (age) => {
  if (!age || age < 8) return null;

  if (age <= 13) return GRADE_LEVELS.ELEMENTARY;
  if (age <= 16) return GRADE_LEVELS.MIDDLE;
  if (age <= 19) return GRADE_LEVELS.HIGH;

  return GRADE_LEVELS.HIGH; // 19세 이상은 고등부로 취급
};

/**
 * 텍스트에서 요일 패턴 추출
 * 예: "주3회(월,수,금)", "주 2회 (화,목)" 등
 * @param {string} text - 분석할 텍스트
 * @returns {Array} - 요일 배열 ['MON', 'WED', 'FRI']
 */
export const extractDaysFromText = (text) => {
  if (!text) return [];

  const days = [];

  // 괄호 안의 요일 찾기
  const bracketMatch = text.match(/[(\(]([^\)]+)[\)]/);
  if (bracketMatch) {
    const daysText = bracketMatch[1];
    Object.keys(DAY_MAPPING).forEach(korDay => {
      if (daysText.includes(korDay)) {
        days.push(DAY_MAPPING[korDay]);
      }
    });
  }

  // "주X회" 패턴도 체크
  const weekPatternMatch = text.match(/주\s*(\d+)\s*회/);
  if (weekPatternMatch && days.length === 0) {
    const count = parseInt(weekPatternMatch[1]);
    // 횟수만 있고 요일이 명시되지 않은 경우는 null 반환하여 추가 처리 필요함을 표시
    return null;
  }

  return days.length > 0 ? days : null;
};

/**
 * 시간 문자열 파싱 (다양한 형식 지원)
 * @param {string} timeStr - "14:00", "오후 2시", "2:00 PM" 등
 * @returns {Object} - {hour, minute}
 */
export const parseTime = (timeStr) => {
  if (!timeStr) return null;

  // "14:00" 형식
  const standardMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (standardMatch) {
    return {
      hour: parseInt(standardMatch[1]),
      minute: parseInt(standardMatch[2])
    };
  }

  // "오후 2시", "오전 10시 30분" 형식
  const koreanMatch = timeStr.match(/(오전|오후)\s*(\d{1,2})\s*시\s*(\d{1,2})?\s*분?/);
  if (koreanMatch) {
    let hour = parseInt(koreanMatch[2]);
    const isPM = koreanMatch[1] === '오후';
    const minute = koreanMatch[3] ? parseInt(koreanMatch[3]) : 0;

    if (isPM && hour !== 12) hour += 12;
    if (!isPM && hour === 12) hour = 0;

    return { hour, minute };
  }

  // "2:00 PM" 형식
  const englishMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (englishMatch) {
    let hour = parseInt(englishMatch[1]);
    const minute = parseInt(englishMatch[2]);
    const isPM = englishMatch[3].toUpperCase() === 'PM';

    if (isPM && hour !== 12) hour += 12;
    if (!isPM && hour === 12) hour = 0;

    return { hour, minute };
  }

  return null;
};

/**
 * 학년부 필터링
 * @param {Array} schedules - 추출된 시간표 배열
 * @param {string} targetGradeLevel - 대상 학년부
 * @returns {Array} - 필터링된 시간표
 */
export const filterByGradeLevel = (schedules, targetGradeLevel) => {
  if (!targetGradeLevel || !schedules) return schedules;

  return schedules.filter(schedule => {
    // gradeLevel이 명시되어 있으면 그것을 사용
    if (schedule.gradeLevel) {
      return schedule.gradeLevel === targetGradeLevel;
    }

    // 텍스트에서 학년부 키워드 찾기
    const text = ((schedule.title || '') + ' ' + (schedule.description || '')).toLowerCase();

    if (targetGradeLevel === GRADE_LEVELS.ELEMENTARY) {
      return text.includes('초등') || text.includes('초등부');
    } else if (targetGradeLevel === GRADE_LEVELS.MIDDLE) {
      return text.includes('중등') || text.includes('중학') || text.includes('중등부');
    } else if (targetGradeLevel === GRADE_LEVELS.HIGH) {
      return text.includes('고등') || text.includes('고등부');
    }

    // 학년부를 특정할 수 없으면 포함
    return true;
  });
};

/**
 * PM/AM 시간을 24시간 형식으로 변환
 * @param {string} timeStr - "PM 1시", "오후 2:30", "1:00 PM" 등
 * @returns {string|null} - "13:00" 형식의 시간
 */
const convertAmPmTo24Hour = (timeStr) => {
  if (!timeStr) return null;

  const pmPattern = /(?:pm|오후|p\.m\.?)\s*(\d{1,2})(?::(\d{2}))?/i;
  const amPattern = /(?:am|오전|a\.m\.?)\s*(\d{1,2})(?::(\d{2}))?/i;
  const pmAfterPattern = /(\d{1,2})(?::(\d{2}))?\s*(?:pm|오후|p\.m\.?)/i;
  const amAfterPattern = /(\d{1,2})(?::(\d{2}))?\s*(?:am|오전|a\.m\.?)/i;

  let match = timeStr.match(pmPattern) || timeStr.match(pmAfterPattern);
  if (match) {
    let hour = parseInt(match[1]);
    const minute = match[2] ? parseInt(match[2]) : 0;
    if (hour !== 12) hour += 12;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  match = timeStr.match(amPattern) || timeStr.match(amAfterPattern);
  if (match) {
    let hour = parseInt(match[1]);
    const minute = match[2] ? parseInt(match[2]) : 0;
    if (hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  return null;
};

/**
 * 교시 정보를 실제 시간으로 변환
 * @param {string} description - "1교시", "2교시" 등
 * @returns {string|null} - "09:00" 형식의 시작 시간
 */
const convertPeriodToTime = (description) => {
  if (!description) return null;

  const periodMatch = description.match(/(\d+)교시/);
  if (!periodMatch) return null;

  const period = parseInt(periodMatch[1]);

  // 초등학교 교시별 시간표 (40분 수업 + 10분 쉬는 시간)
  const periodTimes = {
    1: '09:00',
    2: '09:50',
    3: '10:40',
    4: '11:30',
    5: '13:00', // 점심시간 후
    6: '13:50',
    7: '14:40',
    8: '15:30'
  };

  return periodTimes[period] || null;
};

/**
 * 시간표에 기본 수업 시간 추론하여 추가
 * @param {Object} schedule - 시간표 객체
 * @param {string} gradeLevel - 학년부
 * @returns {Object} - 수업 시간이 추가된 시간표
 */
export const inferClassDuration = (schedule, gradeLevel, index = 0) => {
  if (!schedule) return schedule;

  // startTime 처리
  let startTime = schedule.startTime;
  const originalStartTime = startTime;

  // 1. startTime에 PM/AM이 포함되어 있으면 24시간 형식으로 변환
  if (startTime) {
    const converted = convertAmPmTo24Hour(startTime);
    if (converted) {
      startTime = converted;
    }
  }

  // 2. startTime이 null이면 description에서 교시 정보나 PM/AM 시간 추출
  if (!startTime && schedule.description) {
    const ampmConverted = convertAmPmTo24Hour(schedule.description);
    const periodConverted = convertPeriodToTime(schedule.description);
    startTime = ampmConverted || periodConverted;
    if (startTime) {
    }
  }

  // 3. title에서도 시도
  if (!startTime && schedule.title) {
    const converted = convertAmPmTo24Hour(schedule.title);
    if (converted) {
      startTime = converted;
    }
  }

  // 4. 여전히 startTime이 없으면 기본 시간 할당 (9시부터 시작, 1시간 간격)
  if (!startTime) {
    const defaultStartHour = 9 + index; // 9시, 10시, 11시...
    startTime = `${String(defaultStartHour).padStart(2, '0')}:00`;
  }

  // 이미 endTime이 있으면 그대로 반환
  if (schedule.endTime) return { ...schedule, startTime };

  // startTime이 있고 endTime이 없으면 기본 시간 추가
  if (startTime && !schedule.endTime) {
    const duration = DEFAULT_CLASS_DURATION[gradeLevel] || 50;

    // HH:MM 형식의 시간을 파싱
    const timeMatch = startTime.match(/(\d{1,2}):(\d{2})/);
    if (!timeMatch) return { ...schedule, startTime };

    const startHour = parseInt(timeMatch[1]);
    const startMinute = parseInt(timeMatch[2]);

    // 종료 시간 계산
    const totalMinutes = startHour * 60 + startMinute + duration;
    const endHour = Math.floor(totalMinutes / 60) % 24;
    const endMinute = totalMinutes % 60;

    const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;

    return {
      ...schedule,
      startTime: startTime,
      endTime: endTime,
      inferredDuration: true,
      duration: duration
    };
  }

  return { ...schedule, startTime };
};

/**
 * 시간표 충돌 감지
 * @param {Array} schedules - 시간표 배열
 * @returns {Array} - 충돌하는 시간표 쌍들의 배열
 */
export const detectConflicts = (schedules) => {
  const conflicts = [];

  for (let i = 0; i < schedules.length; i++) {
    for (let j = i + 1; j < schedules.length; j++) {
      const schedule1 = schedules[i];
      const schedule2 = schedules[j];

      // 같은 요일에 겹치는지 확인
      const commonDays = schedule1.days?.filter(day =>
        schedule2.days?.includes(day)
      );

      if (commonDays && commonDays.length > 0) {
        // 시간이 겹치는지 확인
        const start1 = parseTime(schedule1.startTime);
        const end1 = parseTime(schedule1.endTime);
        const start2 = parseTime(schedule2.startTime);
        const end2 = parseTime(schedule2.endTime);

        if (start1 && end1 && start2 && end2) {
          const time1Start = start1.hour * 60 + start1.minute;
          const time1End = end1.hour * 60 + end1.minute;
          const time2Start = start2.hour * 60 + start2.minute;
          const time2End = end2.hour * 60 + end2.minute;

          // 시간 겹침 체크
          if (time1Start < time2End && time1End > time2Start) {
            conflicts.push({
              schedule1: schedule1,
              schedule2: schedule2,
              conflictDays: commonDays
            });
          }
        }
      }
    }
  }

  return conflicts;
};

/**
 * 충돌 없는 최적 조합 생성
 * @param {Array} schedules - 시간표 배열
 * @param {number} maxCombinations - 최대 조합 개수
 * @returns {Array} - 최적 조합들의 배열
 */
export const generateOptimalCombinations = (schedules, maxCombinations = 5) => {
  if (!schedules || schedules.length === 0) return [];

  // 스케줄 제한 제거 - 모든 스케줄 처리
  const limitedSchedules = schedules;

  // 모든 가능한 조합 생성
  const allCombinations = [];
  let iterationCount = 0;
  const MAX_ITERATIONS = 10000; // 무한 루프 방지

  // 재귀적으로 조합 생성
  const generateCombos = (current, remaining, index) => {
    iterationCount++;

    // 무한 루프 방지
    if (iterationCount > MAX_ITERATIONS) {
      return;
    }

    // 이미 충분한 조합을 찾았으면 중단
    if (allCombinations.length >= maxCombinations * 10) {
      return;
    }

    // 현재 조합에 충돌이 있는지 확인
    const conflicts = detectConflicts(current);

    // 충돌이 없으면 저장
    if (conflicts.length === 0 && current.length > 0) {
      allCombinations.push([...current]);
    }

    // 더 많은 스케줄 추가 시도
    for (let i = index; i < remaining.length; i++) {
      const newSchedule = remaining[i];
      const testCombination = [...current, newSchedule];

      // 이 스케줄을 추가했을 때 충돌 확인
      const testConflicts = detectConflicts(testCombination);

      if (testConflicts.length === 0) {
        generateCombos(testCombination, remaining, i + 1);
      }
    }
  };

  generateCombos([], limitedSchedules, 0);

  // 중복 제거: 같은 스케줄 ID 조합인지 확인
  const uniqueCombinations = [];
  const seenSignatures = new Set();

  for (const combo of allCombinations) {
    // 조합의 ID들을 정렬해서 시그니처 생성
    const signature = combo
      .map(s => `${s.title}_${s.startTime}_${s.days?.join('')}`)
      .sort()
      .join('|');

    if (!seenSignatures.has(signature)) {
      seenSignatures.add(signature);
      uniqueCombinations.push(combo);
    }
  }

  // 조합들을 스케줄 개수 기준으로 정렬 (많은 것부터)
  uniqueCombinations.sort((a, b) => b.length - a.length);

  // 상위 N개 반환
  return uniqueCombinations.slice(0, maxCombinations);
};

/**
 * 주간 시간표 데이터를 보기 좋은 형태로 변환
 * @param {Array} schedules - 시간표 배열
 * @returns {Object} - 요일별로 그룹화된 시간표
 */
export const formatWeeklySchedule = (schedules) => {
  const weeklySchedule = {
    MON: [],
    TUE: [],
    WED: [],
    THU: [],
    FRI: [],
    SAT: [],
    SUN: []
  };

  // 안전 장치: schedules가 없거나 배열이 아니면 빈 객체 반환
  if (!schedules || !Array.isArray(schedules)) {
    return weeklySchedule;
  }

  schedules.forEach(schedule => {
    if (schedule.days) {
      // days가 배열이 아니면 배열로 변환
      const daysArray = Array.isArray(schedule.days) ? schedule.days : [schedule.days];

      daysArray.forEach(day => {
        if (weeklySchedule[day]) {
          weeklySchedule[day].push(schedule);
        }
      });
    }
  });

  // 각 요일의 시간표를 시간순으로 정렬
  Object.keys(weeklySchedule).forEach(day => {
    weeklySchedule[day].sort((a, b) => {
      const timeA = parseTime(a.startTime);
      const timeB = parseTime(b.startTime);
      if (!timeA || !timeB) return 0;
      return (timeA.hour * 60 + timeA.minute) - (timeB.hour * 60 + timeB.minute);
    });
  });

  return weeklySchedule;
};

/**
 * 시간표를 텍스트로 요약
 * @param {Array} schedules - 시간표 배열
 * @returns {string} - 시간표 요약 텍스트
 */
export const summarizeSchedule = (schedules) => {
  if (!schedules || schedules.length === 0) {
    return '시간표가 없습니다.';
  }

  const summary = schedules.map(schedule => {
    const daysStr = schedule.days ? schedule.days.join(', ') : '요일 미정';
    const timeStr = schedule.startTime && schedule.endTime
      ? `${schedule.startTime} - ${schedule.endTime}`
      : '시간 미정';

    return `• ${schedule.title || '수업'}: ${daysStr} ${timeStr}`;
  }).join('\n');

  return summary;
};

/**
 * 이미지에서 OCR 수행 (Vision API 사용)
 * 이 함수는 백엔드 API를 호출하여 실제 OCR 처리를 수행합니다
 * @param {File} imageFile - 이미지 파일
 * @returns {Promise<string>} - 추출된 텍스트
 */
export const performOCR = async (imageFile) => {
  const formData = new FormData();
  formData.append('image', imageFile);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

  try {
    const response = await fetch(`${API_BASE_URL}/api/ocr/extract`, {
      method: 'POST',
      body: formData,
      headers: {
        'x-auth-token': localStorage.getItem('token')
      }
    });

    if (!response.ok) {
      throw new Error('OCR 처리 실패');
    }

    const data = await response.json();
    return data.text || '';
  } catch (error) {
    throw error;
  }
};

/**
 * 여러 이미지에서 구조화된 시간표 데이터 추출 (백엔드 API 사용)
 * @param {Array<File>} imageFiles - 이미지 파일 배열
 * @param {string} birthdate - 사용자 생년월일
 * @param {Function} progressCallback - 진행률 콜백 (10-50 범위)
 * @param {boolean} skipDuplicateCheck - 중복 체크 건너뛰기
 * @returns {Promise<Array>} - 구조화된 시간표 배열
 */
export const analyzeScheduleImages = async (imageFiles, birthdate, progressCallback, skipDuplicateCheck = false, clearSession = true) => {
  const formData = new FormData();

  imageFiles.forEach((file) => {
    formData.append('images', file);
  });

  if (birthdate) {
    formData.append('birthdate', birthdate);
  }

  if (skipDuplicateCheck) {
    formData.append('skipDuplicateCheck', 'true');
  } else {
  }

  // ⭐ 새로운 업로드 세션 시작 (이전 이미지 기록 초기화)
  if (clearSession) {
    formData.append('clearSession', 'true');
  }

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

  let progressInterval = null;

  try {
    if (progressCallback) progressCallback(15);

    // 진행률 시뮬레이션 (서버 응답 대기 중)
    let currentProgress = 15;
    progressInterval = setInterval(() => {
      if (currentProgress < 80) {
        currentProgress += 5;
        if (progressCallback) progressCallback(currentProgress);
      }
    }, 2000); // 2초마다 5%씩 증가

    // 타임아웃 설정 (180초 = 3분)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000);

    const response = await fetch(`${API_BASE_URL}/api/ocr/analyze-schedule`, {
      method: 'POST',
      body: formData,
      headers: {
        'x-auth-token': localStorage.getItem('token')
      },
      signal: controller.signal
    });

    clearInterval(progressInterval); // 진행률 시뮬레이션 중지
    progressInterval = null;
    clearTimeout(timeoutId);

    if (progressCallback) progressCallback(85);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`시간표 분석 실패: ${response.status}`);
    }

    if (progressCallback) progressCallback(90);

    // JSON 파싱도 타임아웃 추가
    const parseTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('JSON 파싱 타임아웃')), 10000)
    );

    const data = await Promise.race([
      response.json(),
      parseTimeout
    ]);

    if (progressCallback) progressCallback(95);
    return data; // 전체 데이터 반환 (allSchedules, schedulesByImage 포함)
  } catch (error) {
    // 에러 발생 시에도 진행률 시뮬레이션 중지
    if (progressInterval) {
      clearInterval(progressInterval);
    }

    if (error.name === 'AbortError') {
      throw new Error('이미지 분석 시간이 너무 오래 걸립니다 (3분 초과). 이미지 개수를 줄이거나 이미지 크기를 줄여주세요.');
    }
    throw error;
  }
};

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

  // ⭐ 최적화된 스케줄 우선 사용
  const rawSchedules = apiResponse.optimizedSchedules || apiResponse.allSchedules || [];
  const schedulesByImage = apiResponse.schedulesByImage || [];
  const baseSchedules = apiResponse.baseSchedules || [];
  const overallTitle = apiResponse.overallTitle || '업로드된 시간표';

  // ⭐ gradeLevel이 null인 경우 imageTitle/overallTitle에서 추론
  const inferGradeLevel = (title) => {
    if (!title) return null;
    const titleLower = title.toLowerCase();

    // 초등학교 키워드
    if (titleLower.includes('초등') || titleLower.includes('초')) {
      return '초등부';
    }
    // 중학교 키워드
    if (titleLower.includes('중등') || titleLower.includes('중학') ||
        titleLower.match(/\d+학년.*3반/) || titleLower.includes('미리중')) {
      return '중등부';
    }
    // 고등학교 키워드
    if (titleLower.includes('고등') || titleLower.includes('고')) {
      return '고등부';
    }
    return null;
  };

  // gradeLevel 보정
  rawSchedules.forEach(schedule => {
    if (!schedule.gradeLevel || schedule.gradeLevel === 'null') {
      const inferredGrade = inferGradeLevel(schedule.imageTitle || overallTitle);
      if (inferredGrade) {
        schedule.gradeLevel = inferredGrade; }
    }
  });

  if (progressCallback) progressCallback(96);

  // ⭐ 최적화된 스케줄이면 추가 처리 없이 바로 사용
  if (apiResponse.optimizedSchedules) {

    // 충돌 감지 (참고용)
    const conflicts = detectConflicts(rawSchedules);

    // 요일만 한글 → 영문 변환
    const schedulesWithEnglishDays = rawSchedules.map(schedule => {
      let days = schedule.days;
      if (days && Array.isArray(days)) {
        const dayMap = {
          '월': 'MON', '화': 'TUE', '수': 'WED', '목': 'THU',
          '금': 'FRI', '토': 'SAT', '일': 'SUN'
        };
        days = days.map(day => dayMap[day] || day);
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

  // 병합된 시간대를 분리하는 함수
  const splitMergedTimeSlots = (schedule) => {
    if (!schedule.startTime || !schedule.endTime) return [schedule];

    const [startHour, startMin] = schedule.startTime.split(':').map(Number);
    const [endHour, endMin] = schedule.endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const totalMinutes = endMinutes - startMinutes;

    // 70분 이상이면 여러 시간대로 분리
    if (totalMinutes >= 70) {
      const slots = [];
      let currentStart = startMinutes;

      // 일반적인 시간표 패턴을 고려한 분리
      // 50분 수업 또는 60분 수업 기준
      while (currentStart < endMinutes) {
        let slotDuration = 50; // 기본 50분

        // 남은 시간이 70분 이상이면 50분 또는 60분 단위로
        const remainingMinutes = endMinutes - currentStart;
        if (remainingMinutes >= 70) {
          slotDuration = 50;
        } else {
          // 남은 시간을 그대로 사용
          slotDuration = remainingMinutes;
        }

        const slotEnd = Math.min(currentStart + slotDuration, endMinutes);
        const slotStartHour = Math.floor(currentStart / 60);
        const slotStartMin = currentStart % 60;
        const slotEndHour = Math.floor(slotEnd / 60);
        const slotEndMin = slotEnd % 60;

        const newSlot = {
          ...schedule,
          startTime: `${String(slotStartHour).padStart(2, '0')}:${String(slotStartMin).padStart(2, '0')}`,
          endTime: `${String(slotEndHour).padStart(2, '0')}:${String(slotEndMin).padStart(2, '0')}`,
          duration: slotEnd - currentStart
        };

        slots.push(newSlot);
        currentStart = slotEnd;
      }

      return slots;
    }

    return [schedule];
  };

  // 요일을 영문 코드로 변환
  let processedSchedules = rawSchedules.flatMap(schedule => {
    // 먼저 시간대 분리
    const splitSchedules = splitMergedTimeSlots(schedule);

    return splitSchedules.map(splitSchedule => {
      let days = null;

      // 1. splitSchedule.days가 있으면 그것을 사용 (null이 아니고 배열이며 길이가 0보다 큼)
      if (splitSchedule.days && Array.isArray(splitSchedule.days) && splitSchedule.days.length > 0) {
        days = splitSchedule.days.map(day => {
          const dayMap = {
            '월': 'MON', '화': 'TUE', '수': 'WED', '목': 'THU',
            '금': 'FRI', '토': 'SAT', '일': 'SUN'
          };
          return dayMap[day] || day;
        });
      } else {
        // 2. days가 null이거나 비어있으면 description이나 title에서 요일 정보 추출 시도
        const textToSearch = (splitSchedule.description || '') + ' ' + (splitSchedule.title || '');
        const extractedDays = extractDaysFromText(textToSearch);

        if (extractedDays && extractedDays.length > 0) {
          days = extractedDays;
        } else {
          // 3. 그래도 없으면 "주 5회"처럼 횟수만 있는 경우 기본값 설정
          if (textToSearch.includes('주 5회') || textToSearch.includes('주5회')) {
            days = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
          } else if (textToSearch.includes('주 3회') || textToSearch.includes('주3회')) {
            days = ['MON', 'WED', 'FRI'];
          } else if (textToSearch.includes('주 2회') || textToSearch.includes('주2회')) {
            days = ['TUE', 'THU'];
          } else {
            // 요일 정보가 전혀 없으면 일단 null로 유지
            days = null;
          }
        }
      }

      // 학년부 정보 변환
      let detectedGradeLevel = gradeLevel;
      if (splitSchedule.gradeLevel) {
        const gradeLevelMap = {
          '초등부': GRADE_LEVELS.ELEMENTARY,
          '중등부': GRADE_LEVELS.MIDDLE,
          '고등부': GRADE_LEVELS.HIGH
        };
        detectedGradeLevel = gradeLevelMap[splitSchedule.gradeLevel] || gradeLevel;
      }

      return {
        ...splitSchedule,
        days: days,
        gradeLevel: detectedGradeLevel,
        source: 'ocr'
      };
    });
  });

  // 수업 시간이 없는 경우 추론
  const schedulesWithDuration = processedSchedules.map((schedule, index) =>
    inferClassDuration(schedule, schedule.gradeLevel, index)
  );

  // 나이 필터링 제거 - 모든 스케줄 사용

  // 겹치는 시간 블록 분할
  const splitOverlappingBlocks = (schedules) => {
    const timeToMinutes = (time) => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };

    const minutesToTime = (minutes) => {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    // 모든 시간 경계점 수집
    const allBoundaries = new Set();
    schedules.forEach(s => {
      if (s.days && s.startTime && s.endTime) {
        s.days.forEach(day => {
          allBoundaries.add(`${day}:${timeToMinutes(s.startTime)}`);
          allBoundaries.add(`${day}:${timeToMinutes(s.endTime)}`);
        });
      }
    });

    // 각 스케줄을 경계점에서 분할
    const splitSchedules = [];
    schedules.forEach(schedule => {
      if (!schedule.days || !schedule.startTime || !schedule.endTime) {
        splitSchedules.push(schedule);
        return;
      }

      const startMin = timeToMinutes(schedule.startTime);
      const endMin = timeToMinutes(schedule.endTime);

      schedule.days.forEach(day => {
        // 이 요일의 모든 경계점 찾기
        const dayBoundaries = Array.from(allBoundaries)
          .filter(b => b.startsWith(`${day}:`))
          .map(b => parseInt(b.split(':')[1]))
          .filter(b => b > startMin && b < endMin)
          .sort((a, b) => a - b);

        // 경계점으로 분할
        let currentStart = startMin;
        const boundaries = [startMin, ...dayBoundaries, endMin];

        for (let i = 0; i < boundaries.length - 1; i++) {
          const segmentStart = boundaries[i];
          const segmentEnd = boundaries[i + 1];

          splitSchedules.push({
            ...schedule,
            days: [day],
            startTime: minutesToTime(segmentStart),
            endTime: minutesToTime(segmentEnd),
            duration: segmentEnd - segmentStart
          });
        }
      });
    });

    return splitSchedules;
  };

  const schedulesWithSplit = splitOverlappingBlocks(schedulesWithDuration);

  if (progressCallback) progressCallback(80);

  // 충돌 감지 (참고용)
  const conflicts = detectConflicts(schedulesWithSplit);

  // 최적 조합 생성 건너뛰기 - 모든 스케줄 그대로 사용
  const optimalCombinations = [schedulesWithSplit];

  if (progressCallback) progressCallback(90);

  // 월요일 15:00 시간대 확인
  const mon15 = schedulesWithSplit.filter(s =>
    s.days?.includes('MON') && s.startTime === '15:00'
  );

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
    schedulesByImage: schedulesByImage, // 이미지별 정보 추가
    baseSchedules: baseSchedules, // 기본 베이스 스케줄 추가
    overallTitle: overallTitle // 전체 제목 추가
  };
};
