/**
 * 이미지별 시간표 제목 자동 생성
 *
 * 예:
 * - 학교 과목들 → "학교 시간표"
 * - 학원 수업들 → "○○ 학원 시간표"
 * - 혼합 → "학교 + 학원 시간표"
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
 * 수업명에서 학원 키워드 추출
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
 * 단일 이미지의 시간표 제목 생성
 */
function generateImageTitle(schedules) {
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
 * 전체 시간표의 통합 제목 생성
 */
function generateOverallTitle(schedulesByImage) {
  if (!schedulesByImage || schedulesByImage.length === 0) {
    return '업로드된 시간표';
  }

  const titles = schedulesByImage.map(imageData =>
    generateImageTitle(imageData.schedules)
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
 * 이미지별 제목 생성 (전체)
 */
function generateTitlesForImages(schedulesByImage) {
  const results = schedulesByImage.map((imageData, index) => {
    const title = generateImageTitle(imageData.schedules);

    console.log(`📝 이미지 ${index + 1} (${imageData.fileName}): "${title}"`);

    return {
      ...imageData,
      title: title // 이미지별 제목
    };
  });

  const overallTitle = generateOverallTitle(schedulesByImage);
  console.log(`📋 전체 제목: "${overallTitle}"`);

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
