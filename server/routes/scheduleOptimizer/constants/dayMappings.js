// 요일 관련 상수 정의

const DAY_NAME_TO_CODE = {
  '월': 'MON', '월요일': 'MON',
  '화': 'TUE', '화요일': 'TUE',
  '수': 'WED', '수요일': 'WED',
  '목': 'THU', '목요일': 'THU',
  '금': 'FRI', '금요일': 'FRI',
  '토': 'SAT', '토요일': 'SAT',
  '일': 'SUN', '일요일': 'SUN'
};

const DAY_CODE_TO_NAME = {
  'MON': '월요일',
  'TUE': '화요일',
  'WED': '수요일',
  'THU': '목요일',
  'FRI': '금요일',
  'SAT': '토요일',
  'SUN': '일요일'
};

const DAY_CODE_TO_SHORT = {
  'MON': '월',
  'TUE': '화',
  'WED': '수',
  'THU': '목',
  'FRI': '금',
  'SAT': '토',
  'SUN': '일'
};

module.exports = {
  DAY_NAME_TO_CODE,
  DAY_CODE_TO_NAME,
  DAY_CODE_TO_SHORT
};
