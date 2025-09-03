const jwt = require('jsonwebtoken');
// const config = require('config'); // config 모듈 주석 처리

module.exports = function (req, res, next) {
  console.log('=== 인증 미들웨어 시작 ===');
  console.log('요청 URL:', req.originalUrl);
  console.log('요청 메서드:', req.method);
  
  // 헤더에서 토큰 가져오기
  const token = req.header('x-auth-token');
  
  console.log('토큰 확인:');
  console.log('- x-auth-token 헤더:', token ? `존재 (길이: ${token.length})` : '없음');
  
  // Authorization 헤더도 확인 (선택사항)
  const authHeader = req.header('authorization');
  if (authHeader) {
    console.log('- authorization 헤더:', authHeader.substring(0, 20) + '...');
  }

  // 토큰이 없으면 인증 실패
  if (!token) {
    console.log('❌ 토큰 없음 - 인증 거부');
    return res.status(401).json({ 
      success: false,
      msg: 'No token, authorization denied',
      debug: {
        headers: {
          'x-auth-token': 'missing',
          'authorization': authHeader ? 'exists' : 'missing'
        }
      }
    });
  }

  try {
    console.log('🔐 토큰 검증 시도...');
    console.log('토큰 미리보기:', token.substring(0, 30) + '...');
    
    // config에서 JWT 시크릿 가져오기
    const secret = process.env.JWT_SECRET; // config.get('jwtSecret') 대신 process.env.JWT_SECRET 사용
    console.log('🔑 JWT 시크릿 키 존재:', secret ? '✅' : '❌');
    
    if (!secret) {
      console.error('❌ JWT 시크릿 키가 설정되지 않았습니다.');
      return res.status(500).json({ 
        success: false,
        msg: 'Server configuration error',
        debug: 'JWT_SECRET not configured'
      });
    }
    
    // JWT 토큰 검증
    const decoded = jwt.verify(token, secret);
    
    // req.user에 사용자 정보 설정
    req.user = decoded.user;
    
    console.log('✅ 인증 성공');
    console.log('인증된 사용자 정보:', {
      id: req.user.id,
      tokenIat: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : 'N/A',
      tokenExp: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : 'N/A'
    });
    
    // req.user가 제대로 설정되었는지 확인
    if (!req.user || !req.user.id) {
      console.log('❌ req.user가 제대로 설정되지 않음');
      throw new Error('User information not found in token');
    } else {
      console.log('✅ req.user 정상 설정됨');
      const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  const token = req.header('x-auth-token');

  if (!token) {
    return res.status(401).json({
      success: false,
      msg: 'No token, authorization denied',
      debug: {
        headers: {
          'x-auth-token': 'missing',
          'authorization': req.header('authorization') ? 'exists' : 'missing'
        }
      }
    });
  }

  try {
    const secret = process.env.JWT_SECRET;
    
    if (!secret) {
      console.error('❌ JWT 시크릿 키가 설정되지 않았습니다.');
      return res.status(500).json({
        success: false,
        msg: 'Server configuration error',
        debug: 'JWT_SECRET not configured'
      });
    }
    
    const decoded = jwt.verify(token, secret);
    req.user = decoded.user;
    next();
  } catch (err) {
    console.error('❌ 토큰 검증 실패');
    console.error('에러 타입:', err.name);
    console.error('에러 메시지:', err.message);
    
    let errorMsg = 'Token is not valid';
    let errorCode = 'INVALID_TOKEN';
    
    if (err.name === 'JsonWebTokenError') {
      errorMsg = '유효하지 않은 토큰 형식입니다.';
      errorCode = 'MALFORMED_TOKEN';
    } else if (err.name === 'TokenExpiredError') {
      errorMsg = '토큰이 만료되었습니다.';
      errorCode = 'TOKEN_EXPIRED';
    } else if (err.name === 'NotBeforeError') {
      errorMsg = '토큰이 아직 활성화되지 않았습니다.';
      errorCode = 'TOKEN_NOT_ACTIVE';
    }
    
    return res.status(401).json({
      success: false,
      msg: errorMsg,
      error: errorCode,
      debug: {
        errorType: err.name,
        tokenLength: token ? token.length : 0,
        tokenStart: token ? token.substring(0, 10) + '...' : 'N/A',
        hasSecret: !!secret
      }
    });
  }
};
      console.log('req.user 타입:', typeof req.user);
      console.log('req.user.id:', req.user.id);
    }
    
    console.log('=== 인증 미들웨어 완료 ===');
    
    next();
  } catch (err) {
    console.error('❌ 토큰 검증 실패');
    console.error('에러 타입:', err.name);
    console.error('에러 메시지:', err.message);
    
    let errorMsg = 'Token is not valid';
    let errorCode = 'INVALID_TOKEN';
    
    if (err.name === 'JsonWebTokenError') {
      errorMsg = '유효하지 않은 토큰 형식입니다.';
      errorCode = 'MALFORMED_TOKEN';
    } else if (err.name === 'TokenExpiredError') {
      errorMsg = '토큰이 만료되었습니다.';
      errorCode = 'TOKEN_EXPIRED';
    } else if (err.name === 'NotBeforeError') {
      errorMsg = '토큰이 아직 활성화되지 않았습니다.';
      errorCode = 'TOKEN_NOT_ACTIVE';
    }
    
    return res.status(401).json({ 
      success: false,
      msg: errorMsg,
      error: errorCode,
      debug: {
        errorType: err.name,
        tokenLength: token ? token.length : 0,
        tokenStart: token ? token.substring(0, 10) + '...' : 'N/A',
        hasSecret: !!secret
      }
    });
  }
};