const { DAY_CODE_TO_SHORT } = require('../constants/dayMappings');

/**
 * 삭제율 검증
 */
function validateDeletionRate(currentSchedule, parsedSchedule) {
  const deletionRate = (currentSchedule.length - parsedSchedule.length) / currentSchedule.length;
  return deletionRate;
}

/**
 * 과도한 삭제 체크 (80% 이상)
 */
function isExcessiveDeletion(deletionRate, action) {
  return deletionRate > 0.8 && action !== 'delete';
}

/**
 * 실제 삭제된 항목 찾기
 */
function findDeletedItems(currentSchedule, parsedSchedule) {
  return currentSchedule.filter(original =>
    !parsedSchedule.some(kept =>
      kept.title === original.title &&
      kept.startTime === original.startTime &&
      JSON.stringify(kept.days) === JSON.stringify(original.days)
    )
  );
}

/**
 * [유지됨] 섹션에서 항목 추출
 */
function extractMaintainedItems(lastAiResponse) {
  if (!lastAiResponse || !lastAiResponse.includes('[유지됨')) {
    return [];
  }

  const maintainSections = lastAiResponse.match(/\[유지됨[^\]]*\]([\s\S]*?)(?=\[|삭제해드릴까요\?|$)/g);
  if (!maintainSections) {
    return [];
  }

  const shouldBeMaintained = [];

  maintainSections.forEach(section => {
    const itemMatches = section.match(/•\s*([가-힣a-zA-Z0-9\s&]+?)\s*\((\d{2}:\d{2})-(\d{2}:\d{2})\)/g);
    if (itemMatches) {
      itemMatches.forEach(match => {
        const titleMatch = match.match(/•\s*([가-힣a-zA-Z0-9\s&]+?)\s*\(/);
        if (titleMatch) {
          shouldBeMaintained.push(titleMatch[1].trim());
        }
      });
    }
  });

  return shouldBeMaintained;
}

/**
 * 잘못 삭제된 항목 찾기 ([유지됨]에 있는데 삭제된 것)
 */
function findWronglyDeleted(deletedItems, shouldBeMaintained) {
  return deletedItems.filter(item =>
    shouldBeMaintained.some(maintainTitle =>
      item.title.includes(maintainTitle) || maintainTitle.includes(item.title)
    )
  );
}

/**
 * 삭제 목록 포맷팅
 */
function formatDeletionList(items) {
  return items.map(item => {
    const daysStr = Array.isArray(item.days) ? item.days.join(',') : item.days;
    const dayDisplay = daysStr.split(',').map(d => DAY_CODE_TO_SHORT[d] || d).join(',');
    return `• ${item.title} (${dayDisplay} ${item.startTime}-${item.endTime})`;
  }).join('\n');
}

module.exports = {
  validateDeletionRate,
  isExcessiveDeletion,
  findDeletedItems,
  extractMaintainedItems,
  findWronglyDeleted,
  formatDeletionList
};
