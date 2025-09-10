// 방장과 겹치지 않는 고유 색상 배열
const MEMBER_COLORS = [
  '#16A085', // 터콰이즈
  '#2980B9', // 베이직 블루
  '#8E44AD', // 자주색
  '#F39C12', // 오렌지
  '#27AE60', // 에메랄드 
  '#E67E22', // 캐럿
  '#9B59B6', // 아메티스트
  '#34495E', // 웻 아스팔트
  '#1ABC9C', // 그린 씨
  '#3498DB', // 피터 리버
  '#F1C40F', // 선플라워
  '#95A5A6', // 콘크리트
  '#E91E63', // 핑크
  '#FF5722', // 딥 오렌지
  '#607D8B', // 블루 그레이
  '#795548', // 브라운
  '#009688', // 틸
  '#673AB7', // 딥 퍼플
  '#FF9800', // 앰버
  '#4CAF50'  // 그린
];

const OWNER_COLOR = '#DC2626'; // 방장 전용 색상

// 사용하지 않는 색상 중에서 하나를 선택하는 함수
const getAvailableColor = (existingColors) => {
  const usedColors = new Set(existingColors.filter(color => color !== OWNER_COLOR));
  const availableColors = MEMBER_COLORS.filter(color => !usedColors.has(color));
  
  if (availableColors.length > 0) {
    return availableColors[0]; // 첫 번째 사용 가능한 색상 반환
  }
  
  // 모든 색상이 사용된 경우 무작위로 선택
  return MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)];
};

module.exports = {
  MEMBER_COLORS,
  OWNER_COLOR,
  getAvailableColor
};