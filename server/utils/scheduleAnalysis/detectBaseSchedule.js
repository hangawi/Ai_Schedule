/**
 * 기본 베이스 시간표 감지 (학교 시간표 자동 인식)
 *
 * 기준:
 * 1. 평일 (월~금) 오전 시간대 (08:00-16:00)
 * 2. 일반적인 학교 과목명 (국어, 영어, 수학, 과학, 사회 등)
 * 3. 연속적인 시간표 패턴
 */

/**
 * ===================================================================================================
 * detectBaseSchedule.js - 학교 기본 시간표 자동 인식 서비스
 * ===================================================================================================
 *
 * 📍 위치: 백엔드 > server/utils > scheduleAnalysis > detectBaseSchedule.js
 * 🎯 주요 기능:
 *    - 추출된 다수의 시간표 중 어떤 것이 '학교 정규 시간표'인지 자동으로 감지.
 *    - 과목명(국어, 수학 등)과 시간대(08:00~16:00) 데이터를 결합하여 학교 수업 여부 판별.
 *    - 이미지 내의 학교 수업 비중(Ratio)이 일정 수준(70%) 이상일 경우 해당 이미지를 기본 베이스(Base)로 규정.
 *    - 기본 베이스 일정과 선택형 학원 일정을 구분하여 반환함으로써 최적화 로직의 기초 데이터 제공.
 *
 * 🔗 연결된 파일:
 *    - server/controllers/ocrController.js - 이미지 분석 후 학교 시간표를 분리하기 위해 호출.
 *
 * ✏️ 수정 가이드:
 *    - 학교 과목 리스트를 확장하려면 SCHOOL_SUBJECTS 배열에 새로운 키워드 추가.
 *    - 학교 시간의 범위를 조정하려면 SCHOOL_TIME_RANGE 설정값 수정.
 *    - 베이스 시간표 판단 임계치를 조정하려면 detectBaseScheduleFromImages 내의 schoolRatio 조건 수정.
 *
 * 📝 참고사항:
 *    - 기본 베이스로 판별된 일정은 최적화 시 '삭제 불가능한 필수 세트'로 취급될 확률이 높음.
 *
 * ===================================================================================================
 */

const SCHOOL_SUBJECTS = [
  '국어', '영어', '수학', '과학', '사회', '도덕', '음악', '미술', '체육',
  '기술', '가정', '한문', '한국사', '역사', '지리', '생물', '화학', '물리',
  '점심시간', '조회', '종례', '자습'
];

const SCHOOL_TIME_RANGE = {
  startHour: 8,
  endHour: 16
};

/**
 * isSchoolSchedule
 * @description 단일 일정 객체가 학교 정규 수업의 특성(과목명, 시간대)을 가졌는지 확인합니다.
 * @param {Object} schedule - 검사할 일정 객체.
 * @returns {boolean} 학교 수업으로 판단되면 true, 아니면 false.
 */
function isSchoolSchedule(schedule) {
  // 1. 과목명 확인
  const isSchoolSubject = SCHOOL_SUBJECTS.some(subject =>
    schedule.title.includes(subject)
  );

  // 2. 시간대 확인 (08:00 - 16:00)
  if (schedule.startTime) {
    const startHour = parseInt(schedule.startTime.split(':')[0]);
    const isSchoolTime = startHour >= SCHOOL_TIME_RANGE.startHour &&
                         startHour < SCHOOL_TIME_RANGE.endHour;

    if (isSchoolSubject && isSchoolTime) {
      return true;
    }
  }

  return false;
}

/**
 * detectBaseScheduleFromImages
 * @description 이미지 그룹별로 학교 수업의 비중을 계산하여 어떤 이미지가 기본 시간표 베이스인지 판별합니다.
 * @param {Array} schedulesByImage - 이미지별로 분류된 일정 데이터 배열.
 * @returns {Array} 각 이미지의 베이스 여부 분석 결과가 포함된 리스트.
 */
function detectBaseScheduleFromImages(schedulesByImage) {
  const results = schedulesByImage.map((imageData, index) => {
    const schedules = imageData.schedules || [];

    // 학교 스케줄 개수 카운트
    const schoolCount = schedules.filter(isSchoolSchedule).length;
    const totalCount = schedules.length;
    const schoolRatio = totalCount > 0 ? schoolCount / totalCount : 0;

    // 70% 이상이 학교 과목이면 기본 베이스로 판단
    const isBase = schoolRatio >= 0.7;

    return {
      imageIndex: index,
      fileName: imageData.fileName,
      isBaseSchedule: isBase,
      schoolCount,
      totalCount,
      schoolRatio: Math.round(schoolRatio * 100),
      schedules: schedules.map(s => ({
        ...s,
        isSchoolSubject: isSchoolSchedule(s)
      }))
    };
  });
  return results;
}

/**
 * extractBaseSchedules
 * @description 분석 결과에서 학교 기본 시간표에 해당하는 일정들만 모두 모아 반환합니다.
 */
function extractBaseSchedules(analysisResults) {
  const baseSchedules = [];

  analysisResults.forEach(result => {
    if (result.isBaseSchedule) {
      baseSchedules.push(...result.schedules);
    }
  });
  return baseSchedules;
}

/**
 * extractOptionalSchedules
 * @description 분석 결과에서 기본 시간표를 제외한 나머지(학원, 취미 등) 일정들만 반환합니다.
 */
function extractOptionalSchedules(analysisResults) {
  const optionalSchedules = [];

  analysisResults.forEach(result => {
    if (!result.isBaseSchedule) {
      optionalSchedules.push(...result.schedules);
    }
  });
  return optionalSchedules;
}

module.exports = {
  isSchoolSchedule,
  detectBaseScheduleFromImages,
  extractBaseSchedules,
  extractOptionalSchedules
};
