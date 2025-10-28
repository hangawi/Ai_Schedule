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

// 학년부별 기본 수업 시간 (분)
export const DEFAULT_CLASS_DURATION = {
  [GRADE_LEVELS.ELEMENTARY]: 40,  // 초등부 40분
  [GRADE_LEVELS.MIDDLE]: 50,       // 중등부 50분
  [GRADE_LEVELS.HIGH]: 60         // 고등부 60분
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
export const inferClassDuration = (schedule, gradeLevel) => {
  if (!schedule) return schedule;

  // startTime 처리
  let startTime = schedule.startTime;
  const originalStartTime = startTime;

  // 1. startTime에 PM/AM이 포함되어 있으면 24시간 형식으로 변환
  if (startTime) {
    const converted = convertAmPmTo24Hour(startTime);
    if (converted) {
      console.log(`🕐 시간 변환: "${originalStartTime}" → "${converted}"`);
      startTime = converted;
    }
  }

  // 2. startTime이 null이면 description에서 교시 정보나 PM/AM 시간 추출
  if (!startTime && schedule.description) {
    const ampmConverted = convertAmPmTo24Hour(schedule.description);
    const periodConverted = convertPeriodToTime(schedule.description);
    startTime = ampmConverted || periodConverted;
    if (startTime) {
      console.log(`🕐 description에서 시간 추출: "${schedule.description}" → "${startTime}"`);
    }
  }

  // 3. title에서도 시도
  if (!startTime && schedule.title) {
    const converted = convertAmPmTo24Hour(schedule.title);
    if (converted) {
      console.log(`🕐 title에서 시간 추출: "${schedule.title}" → "${converted}"`);
      startTime = converted;
    }
  }

  // 여전히 startTime이 없으면 그대로 반환
  if (!startTime) return schedule;

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

  // 스케줄이 너무 많으면 제한 (성능 이슈 방지)
  const limitedSchedules = schedules.slice(0, 30);
  if (schedules.length > 30) {
    console.warn('⚠️ 시간표가 30개를 초과하여 일부만 처리합니다.');
  }

  // 모든 가능한 조합 생성
  const allCombinations = [];
  let iterationCount = 0;
  const MAX_ITERATIONS = 10000; // 무한 루프 방지

  // 재귀적으로 조합 생성
  const generateCombos = (current, remaining, index) => {
    iterationCount++;

    // 무한 루프 방지
    if (iterationCount > MAX_ITERATIONS) {
      console.warn('⚠️ 조합 생성 반복 횟수 초과. 일부 조합만 반환합니다.');
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

  console.log('🔄 최적 조합 생성 중...');
  generateCombos([], limitedSchedules, 0);
  console.log(`✅ ${allCombinations.length}개의 조합 생성 완료 (${iterationCount}회 반복)`);

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

  schedules.forEach(schedule => {
    if (schedule.days) {
      schedule.days.forEach(day => {
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
    console.error('OCR 에러:', error);
    throw error;
  }
};

/**
 * 여러 이미지에서 구조화된 시간표 데이터 추출 (백엔드 API 사용)
 * @param {Array<File>} imageFiles - 이미지 파일 배열
 * @param {string} birthdate - 사용자 생년월일
 * @returns {Promise<Array>} - 구조화된 시간표 배열
 */
export const analyzeScheduleImages = async (imageFiles, birthdate) => {
  const formData = new FormData();

  imageFiles.forEach((file) => {
    formData.append('images', file);
  });

  if (birthdate) {
    formData.append('birthdate', birthdate);
  }

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

  try {
    console.log('📡 백엔드로 요청 전송 중...');

    // 타임아웃 설정 (60초)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(`${API_BASE_URL}/api/ocr/analyze-schedule`, {
      method: 'POST',
      body: formData,
      headers: {
        'x-auth-token': localStorage.getItem('token')
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    console.log('📥 응답 수신:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 서버 에러:', errorText);
      throw new Error(`시간표 분석 실패: ${response.status}`);
    }

    console.log('🔄 JSON 파싱 중...');

    // JSON 파싱도 타임아웃 추가
    const parseTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('JSON 파싱 타임아웃')), 10000)
    );

    const data = await Promise.race([
      response.json(),
      parseTimeout
    ]);

    console.log('✅ 데이터 파싱 완료:', data);
    return data.allSchedules || [];
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('❌ 요청 타임아웃 (60초 초과)');
      throw new Error('이미지 분석 시간이 너무 오래 걸립니다. 이미지 개수를 줄여주세요.');
    }
    console.error('❌ 시간표 분석 에러:', error);
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
 * @param {string} birthdate - 사용자 생년월일
 * @returns {Promise<Object>} - 추출된 시간표와 메타데이터
 */
export const extractSchedulesFromImages = async (imageFiles, birthdate) => {
  const age = calculateAge(birthdate);
  const gradeLevel = getGradeLevelFromAge(age);

  // 백엔드 API를 사용하여 구조화된 시간표 데이터 가져오기
  const rawSchedules = await analyzeScheduleImages(imageFiles, birthdate);

  // 요일을 영문 코드로 변환
  const processedSchedules = rawSchedules.map(schedule => {
    let days = null;

    // 1. schedule.days가 있으면 그것을 사용 (null이 아니고 배열이며 길이가 0보다 큼)
    if (schedule.days && Array.isArray(schedule.days) && schedule.days.length > 0) {
      days = schedule.days.map(day => {
        const dayMap = {
          '월': 'MON', '화': 'TUE', '수': 'WED', '목': 'THU',
          '금': 'FRI', '토': 'SAT', '일': 'SUN'
        };
        return dayMap[day] || day;
      });
    } else {
      // 2. days가 null이거나 비어있으면 description이나 title에서 요일 정보 추출 시도
      const textToSearch = (schedule.description || '') + ' ' + (schedule.title || '');
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
    if (schedule.gradeLevel) {
      const gradeLevelMap = {
        '초등부': GRADE_LEVELS.ELEMENTARY,
        '중등부': GRADE_LEVELS.MIDDLE,
        '고등부': GRADE_LEVELS.HIGH
      };
      detectedGradeLevel = gradeLevelMap[schedule.gradeLevel] || gradeLevel;
    }

    return {
      ...schedule,
      days: days,
      gradeLevel: detectedGradeLevel,
      source: 'ocr'
    };
  });

  // 수업 시간이 없는 경우 추론
  const schedulesWithDuration = processedSchedules.map(schedule =>
    inferClassDuration(schedule, schedule.gradeLevel)
  );

  // 사용자 나이에 맞는 시간표만 필터링
  const filteredSchedules = filterByGradeLevel(schedulesWithDuration, gradeLevel);

  // 충돌 감지
  const conflicts = detectConflicts(filteredSchedules);

  // 최적 조합 생성
  const optimalCombinations = conflicts.length > 0
    ? generateOptimalCombinations(filteredSchedules, 5)
    : [filteredSchedules];

  return {
    age,
    gradeLevel,
    schedules: filteredSchedules,
    allSchedulesBeforeFilter: schedulesWithDuration, // 필터링 전 전체 스케줄
    conflicts,
    optimalCombinations,
    ocrResults: [],
    hasConflicts: conflicts.length > 0
  };
};
