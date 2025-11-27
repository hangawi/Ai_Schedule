const { GENERIC_SCHEDULE_TERMS } = require('../constants/keywords');

/**
 * 커스텀 일정 서비스
 */

/**
 * 제목이 구체적인지 판단
 */
function isSpecificTitle(title) {
  const titleLower = title.toLowerCase();
  return !GENERIC_SCHEDULE_TERMS.some(term => titleLower.includes(term));
}

/**
 * 새로 추가된 일정에 대한 범례 생성
 */
function createCustomSchedulesForNewItems(newItems, schedulesByImage, existingCustomSchedules) {
  if (!newItems || newItems.length === 0) {
    return [];
  }

  // 기존 타이틀-인덱스 매핑
  const existingTitleToIndex = new Map();

  if (schedulesByImage && Array.isArray(schedulesByImage)) {
    schedulesByImage.forEach((img, idx) => {
      if (img.schedules && Array.isArray(img.schedules)) {
        img.schedules.forEach(s => {
          if (s.title && !existingTitleToIndex.has(s.title)) {
            existingTitleToIndex.set(s.title, idx);
          }
        });
      }
    });
  }

  if (existingCustomSchedules && Array.isArray(existingCustomSchedules)) {
    existingCustomSchedules.forEach(custom => {
      if (custom.title && !existingTitleToIndex.has(custom.title)) {
        existingTitleToIndex.set(custom.title, custom.sourceImageIndex);
      }
    });
  }

  // 새로운 타이틀들
  const newTitles = new Set();
  newItems.forEach(item => {
    if (item.title && !existingTitleToIndex.has(item.title)) {
      newTitles.add(item.title);
    }
  });

  if (newTitles.size === 0) {
    // 기존 과목이지만 sourceImageIndex 할당
    newItems.forEach(item => {
      if (item.title && existingTitleToIndex.has(item.title)) {
        item.sourceImageIndex = existingTitleToIndex.get(item.title);
      }
    });
    return [];
  }

  const customSchedules = [];
  const existingImageCount = schedulesByImage ? schedulesByImage.length : 0;
  let newImageIndex = existingImageCount;

  // 기존 커스텀 일정 중 최대 인덱스 찾기
  if (existingCustomSchedules && existingCustomSchedules.length > 0) {
    const maxCustomIndex = Math.max(...existingCustomSchedules.map(c => c.sourceImageIndex));
    newImageIndex = Math.max(newImageIndex, maxCustomIndex + 1);
  }

  const titleToNewIndex = new Map();
  const hasGeneric = Array.from(newTitles).some(title => !isSpecificTitle(title));
  let genericIndex = null;

  // "기타" 일정이 있으면 인덱스 9999 할당
  if (hasGeneric) {
    genericIndex = 9999;
    customSchedules.push({
      fileName: `커스텀 일정 (기타)`,
      sourceImageIndex: 9999,
      title: '기타',
      isCustom: true,
      isGeneric: true
    });
  }

  Array.from(newTitles).forEach(title => {
    const isSpecific = isSpecificTitle(title);

    if (!isSpecific) {
      titleToNewIndex.set(title, 9999);
    } else {
      customSchedules.push({
        fileName: `커스텀 일정 ${newImageIndex + 1}`,
        sourceImageIndex: newImageIndex,
        title: title,
        isCustom: true
      });
      titleToNewIndex.set(title, newImageIndex);
      newImageIndex++;
    }
  });

  // 새로 추가된 일정에 sourceImageIndex 할당
  newItems.forEach(item => {
    if (item.title) {
      if (titleToNewIndex.has(item.title)) {
        item.sourceImageIndex = titleToNewIndex.get(item.title);
      } else if (existingTitleToIndex.has(item.title)) {
        item.sourceImageIndex = existingTitleToIndex.get(item.title);
      }
    }
  });

  return customSchedules;
}

module.exports = {
  isSpecificTitle,
  createCustomSchedulesForNewItems
};
