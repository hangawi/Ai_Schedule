const jwt = require('jsonwebtoken');
const config = require('config');

// JWT 토큰 생성
const generateToken = (payload, expiresIn = '24h') => {
  try {
    const secret = config.get('jwtSecret');
    
    if (!secret) {
      throw new Error('JWT_SECRET이 설정되지 않았습니다.');
    }

    // payload가 이미 { user: { id: ... } } 구조라면 그대로 사용
    // 단순히 userId만 전달된 경우 올바른 구조로 변환
    let tokenPayload;
    if (typeof payload === 'string') {
      // 단순 userId인 경우
      tokenPayload = {
        user: {
          id: payload
        }
      };
    } else if (payload && payload.user && payload.user.id) {
      // 이미 올바른 구조인 경우
      tokenPayload = payload;
    } else {
      throw new Error('유효하지 않은 payload 구조입니다.');
    }
    
    const token = jwt.sign(tokenPayload, secret, { expiresIn });
    
    return token;
  } catch (error) {
    throw error;
  }
};

// JWT 토큰 검증
const verifyToken = (token) => {
  try {
    const secret = config.get('jwtSecret');
    
    if (!secret) {
      throw new Error('JWT_SECRET이 설정되지 않았습니다.');
    }

    if (!token) {
      throw new Error('토큰이 제공되지 않았습니다.');
    }
    
    const decoded = jwt.verify(token, secret);
    
    // 페이로드 구조 검증
    if (!decoded.user || !decoded.user.id) {
      throw new Error('토큰에 유효한 사용자 정보가 없습니다.');
    }
    
    return decoded;
  } catch (error) {

    // JWT 에러 타입별 메시지 개선
    if (error.name === 'JsonWebTokenError') {
      throw new Error('유효하지 않은 토큰 형식입니다.');
    } else if (error.name === 'TokenExpiredError') {
      throw new Error('토큰이 만료되었습니다.');
    } else if (error.name === 'NotBeforeError') {
      throw new Error('토큰이 아직 활성화되지 않았습니다.');
    } else {
      throw error;
    }
  }
};

// JWT 토큰 디코딩 (검증 없이)
const decodeToken = (token) => {
  try {
    if (!token) {
      throw new Error('토큰이 제공되지 않았습니다.');
    }

    const decoded = jwt.decode(token, { complete: true });
    
    return decoded;
  } catch (error) {
    throw error;
  }
};

// 토큰에서 사용자 ID 추출 (유틸리티 함수)
const extractUserId = (token) => {
  try {
    const decoded = verifyToken(token);
    return decoded.user.id;
  } catch (error) {
    throw error;
  }
};

// 토큰 만료 시간 확인
const getTokenExpiration = (token) => {
  try {
    const decoded = decodeToken(token);
    if (decoded && decoded.payload && decoded.payload.exp) {
      return new Date(decoded.payload.exp * 1000);
    }
    return null;
  } catch (error) {
    return null;
  }
};

// 토큰이 곧 만료되는지 확인 (분 단위)
const isTokenExpiringSoon = (token, minutesThreshold = 30) => {
  try {
    const expirationDate = getTokenExpiration(token);
    if (!expirationDate) return false;
    
    const now = new Date();
    const timeUntilExpiry = expirationDate.getTime() - now.getTime();
    const minutesUntilExpiry = timeUntilExpiry / (1000 * 60);
    
    return minutesUntilExpiry <= minutesThreshold;
  } catch (error) {
    return false;
  }
};

module.exports = {
  generateToken,
  verifyToken,
  decodeToken,
  extractUserId,
  getTokenExpiration,
  isTokenExpiringSoon
};