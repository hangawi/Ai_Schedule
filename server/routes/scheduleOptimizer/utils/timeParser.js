const { DAY_NAME_TO_CODE } = require('../constants/dayMappings');

/**
 * 시간 텍스트 파싱 (예: "6시", "오후 6시" → "18:00")
 */
function parseTimeText(text) {
  const timeMatch = text.match(/(\d{1,2})시/);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1]);
    if (text.includes('오후') || text.includes('저녁')) {
      if (hour < 12) hour += 12;
    }
    return `${hour.toString().padStart(2, '0')}:00`;
  }
  return null;
}

/**
 * 요일명 파싱 (한글 → 영어 코드)
 */
function parseDayName(text) {
  for (const [key, value] of Object.entries(DAY_NAME_TO_CODE)) {
    if (text.includes(key)) {
      return value;
    }
  }
  return null;
}

module.exports = {
  parseTimeText,
  parseDayName
};
