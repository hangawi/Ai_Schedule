/**
 * 주차 오프셋 관련 상수
 */

// 주차 오프셋 맵
const WEEK_OFFSET_MAP = {
  '-2': '지지난주',
  '-1': '저번주',
  '0': '이번주',
  '1': '다음주',
  '2': '다다음주'
};

// 주차 이름 맵 (역방향)
const WEEK_NAME_TO_OFFSET = {
  '지지난주': -2,
  '저번주': -1,
  '이번주': 0,
  '다음주': 1,
  '다다음주': 2
};

module.exports = {
  WEEK_OFFSET_MAP,
  WEEK_NAME_TO_OFFSET
};
