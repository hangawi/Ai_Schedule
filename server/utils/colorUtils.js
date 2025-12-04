// 방장과 겹치지 않는 고유 색상 배열
const MEMBER_COLORS = [
  '#16A085', // 터콰이즈
  '#2980B9', // 베이직 블루
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
  
  // 모든 기본 색상이 사용된 경우 랜덤 색상 생성 (300명 대응)
  let randomColor;
  let attempts = 0;
  const maxAttempts = 200; // 시도 횟수 증가
  
  do {
    // HSL 기반 랜덤 색상 생성 (채도와 명도를 적절히 조정)
    const hue = Math.floor(Math.random() * 360); // 0-360
    const saturation = 40 + Math.floor(Math.random() * 40); // 40-80%
    const lightness = 35 + Math.floor(Math.random() * 25); // 35-60%
    
    // HSL을 HEX로 변환
    randomColor = hslToHex(hue, saturation, lightness);
    
    attempts++;
    
    // 이미 사용된 색상이거나 방장 색상과 같으면 다시 생성
    if (randomColor === OWNER_COLOR || usedColors.has(randomColor)) {
      continue;
    }
    
    // 중복되지 않는 색상을 찾으면 반환
    return randomColor;
  } while (attempts < maxAttempts);
  
  // 최대 시도 횟수 초과 시 더 넓은 범위에서 색상 생성 (폴백)
  // 이 경우는 거의 발생하지 않지만, 안전장치로 추가
  for (let i = 0; i < 100; i++) {
    const hue = Math.floor(Math.random() * 360);
    const saturation = 20 + Math.floor(Math.random() * 70); // 20-90% (더 넓은 범위)
    const lightness = 25 + Math.floor(Math.random() * 50); // 25-75% (더 넓은 범위)
    
    randomColor = hslToHex(hue, saturation, lightness);
    
    if (randomColor !== OWNER_COLOR && !usedColors.has(randomColor)) {
      return randomColor;
    }
  }
  
  // 정말 최악의 경우: timestamp 기반으로 고유 색상 생성
  const timestamp = Date.now();
  const uniqueHue = timestamp % 360;
  const uniqueSat = 50 + (timestamp % 30);
  const uniqueLight = 40 + (timestamp % 20);
  
  return hslToHex(uniqueHue, uniqueSat, uniqueLight);
};

// HSL을 HEX로 변환하는 헬퍼 함수
const hslToHex = (h, s, l) => {
  s /= 100;
  l /= 100;
  
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  
  let r = 0, g = 0, b = 0;
  
  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }
  
  const toHex = (val) => {
    const hex = Math.round((val + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};

module.exports = {
  MEMBER_COLORS,
  OWNER_COLOR,
  getAvailableColor
};