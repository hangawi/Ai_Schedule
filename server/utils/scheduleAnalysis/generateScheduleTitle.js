/**
 * 이미지별 시간표 제목 자동 생성
 *
 * 예:
 * - 학교 과목들 → "학교 시간표"
 * - 학원 수업들 → "○○ 학원 시간표"
 * - 혼합 → "학교 + 학원 시간표"
 */

/**
 * ===================================================================================================
 * generateScheduleTitle.js - 이미지별 시간표 제목 자동 생성 서비스
 * ===================================================================================================
 *
 * 📍 위치: 백엔드 > server/utils > scheduleAnalysis > generateScheduleTitle.js
 * 🎯 주요 기능:
 *    - 추출된 일정 데이터를 분석하여 각 이미지의 특성에 맞는 적절한 제목(예: "KPOP 댄스 학원", "학교 시간표")을 자동 생성.
 *    - 학원(KPOP, 태권도, 피아노 등) 및 학교 관련 핵심 키워드 리스트를 기반으로 일정의 카테고리를 분류.
 *    - AI가 추출한 원본 제목이 있을 경우 이를 우선적으로 사용하며, 없을 경우 키워드 비중을 분석하여 제목을 추론.
 *    - 여러 장의 이미지가 업로드된 경우, 각 이미지의 제목을 결합하여 전체 통합 제목(Overall Title)을 생성.
 *    - 유효한 일정이 없는 빈 이미지를 필터링하여 분석 결과의 품질 유지.
 *
 * 🔗 연결된 파일:
 *    - server/controllers/ocrController.js - 이미지 분석 결과를 클라이언트에 전달하기 전 제목 생성을 위해 호출.
 *
 * ✏️ 수정 가이드:
 *    - 새로운 학원 유형을 추가하려면 ACADEMY_KEYWORDS 배열에 관련 용어 추가.
 *    - 제목 추론 알고리즘(비중 기준 등)을 변경하려면 generateImageTitle 내의 ratio 비교 로직 수정.
 *
 * 📝 참고사항:
 *    - 이 서비스는 사용자에게 분석 결과가 어떤 출처(학원명 등)로부터 왔는지 직관적으로 보여주기 위한 용도로 사용됨.
 *
 * ===================================================================================================
 */

const ACADEMY_KEYWORDS = [
  'KPOP', '힙합', '댄스', '팝핀', '왁킹', '걸스', '걸리쉬',
  '전문반', '공연반', '주니어', '키즈', '수학학원', '영어학원',
  '태권도', '피아노', '미술', '바이올린', '축구', '농구'
];

const SCHOOL_KEYWORDS = [
  '국어', '영어', '수학', '과학', '사회', '도덕', '음악', '미술', '체육',
  '기술', '가정', '한문', '한국사', '역사', '지리', '점심시간'
];

/**
 * extractAcademyType
 * @description 일정 제목들에서 학원의 종류(댄스, 태권도 등)를 특정하여 대표 키워드를 추출합니다.
 */
function extractAcademyType(schedules) {
  const allTitles = schedules.map(s => s.title).join(' ');

  // KPOP 관련
  if (allTitles.includes('KPOP') || allTitles.includes('힙합') || allTitles.includes('댄스')) {
    return 'KPOP 댄스';
  }

  // 태권도
  if (allTitles.includes('태권도')) {
    return '태권도';
  }

  // 학원 키워드 매칭
  for (const keyword of ACADEMY_KEYWORDS) {
    if (allTitles.includes(keyword)) {
      return keyword;
    }
  }

  return '학원';
}

/**
 * generateImageTitle
 * @description 단일 이미지의 일정 데이터와 AI 추출 제목을 바탕으로 최종적인 이미지 제목을 생성합니다.
 * @param {Array} schedules - 해당 이미지의 일정 배열.
 * @param {string|null} [extractedTitle=null] - AI가 사전에 파싱한 이미지 제목.
 * @returns {string} 생성된 제목 문자열.
 */
function generateImageTitle(schedules, extractedTitle = null) {
  // AI가 추출한 제목이 있으면 우선 사용
  if (extractedTitle && extractedTitle.trim()) {
    return extractedTitle.trim();
  }

  // 제목이 없으면 기존 키워드 기반 추론
  if (!schedules || schedules.length === 0) {
    return '빈 시간표';
  }

  let schoolCount = 0;
  let academyCount = 0;

  schedules.forEach(schedule => {
    const title = schedule.title;

    // 학교 과목 체크
    if (SCHOOL_KEYWORDS.some(keyword => title.includes(keyword))) {
      schoolCount++;
    }
    // 학원 수업 체크
    else if (ACADEMY_KEYWORDS.some(keyword => title.includes(keyword))) {
      academyCount++;
    }
    // 기본적으로 학원으로 분류
    else {
      academyCount++;
    }
  });

  const schoolRatio = schoolCount / schedules.length;
  const academyRatio = academyCount / schedules.length;

  // 70% 이상이 학교 과목
  if (schoolRatio >= 0.7) {
    return '학교 시간표';
  }

  // 70% 이상이 학원 수업
  if (academyRatio >= 0.7) {
    const academyType = extractAcademyType(schedules);
    return `${academyType} 학원`;
  }

  // 혼합
  return '학교 + 학원';
}

/**
 * generateOverallTitle
 * @description 여러 이미지들의 제목을 중복 없이 결합하여 전체 분석 결과의 대표 제목을 생성합니다.
 */
function generateOverallTitle(schedulesByImage) {
  if (!schedulesByImage || schedulesByImage.length === 0) {
    return '업로드된 시간표';
  }

  const titles = schedulesByImage.map(imageData =>
    generateImageTitle(imageData.schedules, imageData.imageTitle)
  );

  // 중복 제거
  const uniqueTitles = [...new Set(titles)];

  // 하나만 있으면 그대로
  if (uniqueTitles.length === 1) {
    return uniqueTitles[0];
  }

  // 여러 개면 합치기
  return uniqueTitles.join(' + ');
}

/**
 * generateTitlesForImages
 * @description 모든 이미지 데이터에 대해 개별 제목을 생성하고 빈 데이터를 필터링한 최종 결과를 반환합니다.
 */
function generateTitlesForImages(schedulesByImage) {
  const results = schedulesByImage
    .map((imageData, index) => {
      // AI 추출 제목을 우선 사용, 없으면 키워드 기반 추론
      const title = generateImageTitle(imageData.schedules, imageData.imageTitle);
      return {
        ...imageData,
        title: title // 이미지별 제목
      };
    })
    // ⭐ 빈 스케줄 이미지 필터링 (인덱스 오류 방지)
    .filter(imageData => {
      if (!imageData.schedules || imageData.schedules.length === 0) {
        return false;
      }
      return true;
    });

  const overallTitle = generateOverallTitle(results);

  return {
    schedulesByImage: results,
    overallTitle
  };
}

module.exports = {
  generateImageTitle,
  generateOverallTitle,
  generateTitlesForImages
};
