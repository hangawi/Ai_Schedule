/**
 * ===================================================================================================
 * auth.js - API 요청 인증 및 사용자 정보 처리를 위한 Express 미들웨어
 * ===================================================================================================
 *
 * 📍 위치: 백엔드 > server/middleware/auth.js
 *
 * 🎯 주요 기능:
 *    - 클라이언트 요청의 `Authorization` 헤더에서 Bearer 토큰(Firebase ID Token)을 추출합니다.
 *    - Firebase Admin SDK를 사용하여 토큰의 유효성을 검증하고 디코딩합니다.
 *    - 디코딩된 토큰의 `firebaseUid`를 사용하여 로컬 MongoDB에서 사용자를 조회합니다.
 *    - [Just-In-Time Provisioning] 로컬 DB에 사용자가 없으면 Firebase 토큰 정보로 새 사용자를 자동 생성합니다.
 *    - [하위 호환성] `firebaseUid`로 사용자를 찾지 못할 경우, 이메일로 재조회하고 `firebaseUid`를 업데이트합니다.
 *    - 검증이 완료되면, 조회/생성된 사용자의 정보(MongoDB _id, Firebase uid 등)를 `req.user` 객체에 담아 다음 핸들러로 전달합니다.
 *    - 토큰이 없거나 유효하지 않은 경우 401 Unauthorized 에러를 반환합니다.
 *
 * 🔗 연결된 파일:
 *    - ../config/firebaseAdmin.js - Firebase `auth` 서비스 인스턴스를 가져옵니다.
 *    - ../models/user.js - 사용자 정보를 조회하거나 생성하기 위해 User 모델을 사용합니다.
 *    - 모든 인증이 필요한 API 라우트 파일 (예: ../routes/events.js, ../routes/profile.js 등)
 *
 * ✏️ 수정 가이드:
 *    - 토큰에서 가져와 `req.user`에 추가할 사용자 정보를 변경하려면: `req.user = {...}` 객체 할당 부분을 수정합니다.
 *    - 신규 사용자 자동 생성 시 기본값을 변경하려면: `if (!user)` 블록 안의 `new User({...})` 부분을 수정합니다.
 *
 * 📝 참고사항:
 *    - 이 미들웨어는 API 요청을 처리하는 가장 중요한 첫 관문 중 하나입니다.
 *    - Firebase 인증과 로컬 DB 사용자 정보를 동기화하는 핵심 로직을 포함하고 있습니다.
 *    - 토큰 만료, 형식 오류 등 다양한 인증 실패 케이스에 대한 분기 처리가 구현되어 있습니다.
 *
 * ===================================================================================================
 */

const { auth } = require('../config/firebaseAdmin');

module.exports = async function (req, res, next) {
  // Get token from Authorization header
  const authHeader = req.header('authorization') || req.header('Authorization');

  // Check if authorization header exists
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      msg: 'No token, authorization denied',
      debug: {
        headers: {
          'authorization': authHeader ? 'invalid format' : 'missing'
        }
      }
    });
  }

  // Extract token from "Bearer <token>"
  const idToken = authHeader.split('Bearer ')[1];

  if (!idToken) {
    return res.status(401).json({
      success: false,
      msg: 'No token found in authorization header',
      debug: {
        authHeader: 'Bearer token missing'
      }
    });
  }

  try {
    // Verify Firebase ID token
    const decodedToken = await auth.verifyIdToken(idToken);
    const firebaseUid = decodedToken.uid;

    // Find user in MongoDB by Firebase UID
    const User = require('../models/user');
    let user = await User.findOne({ firebaseUid });

    // If not found by firebaseUid, try by email (backward compatibility)
    if (!user && decodedToken.email) {
      user = await User.findOne({ email: decodedToken.email.toLowerCase() });

      // Update user with Firebase UID
      if (user) {
        try {
          user.firebaseUid = firebaseUid;
          await user.save();
        } catch (updateErr) {
          // Continue with the found user even if update fails
        }
      }
    }

    // If still no user, create new one (for Google login and new registrations)
    if (!user) {
      try {
        // Get full Firebase user info
        const firebaseUserRecord = await auth.getUser(firebaseUid);

        // Parse display name
        const displayName = firebaseUserRecord.displayName || '';
        const nameParts = displayName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const userEmail = (decodedToken.email || firebaseUserRecord.email || '').toLowerCase();

        // Check one more time if user exists by email (race condition prevention)
        const existingUser = await User.findOne({ email: userEmail });
        if (existingUser) {
          // Update existing user with firebaseUid
          existingUser.firebaseUid = firebaseUid;
          await existingUser.save();
          user = existingUser;
        } else {
          // Create new user in MongoDB
          user = new User({
            firebaseUid,
            firstName: firstName || '',
            lastName: lastName || '',
            email: userEmail,
            password: Math.random().toString(36).slice(-8), // Temporary password
            defaultSchedule: [],
            scheduleExceptions: [],
            personalTimes: [],
          });
          await user.save();
        }
      } catch (createErr) {

        // If duplicate key error, try to find and update the existing user
        if (createErr.code === 11000) {
          const existingUser = await User.findOne({ email: decodedToken.email.toLowerCase() });
          if (existingUser) {
            existingUser.firebaseUid = firebaseUid;
            await existingUser.save();
            user = existingUser;
          } else {
            return res.status(500).json({
              success: false,
              msg: 'Failed to create user account',
              debug: {
                firebaseUid,
                email: decodedToken.email,
                error: createErr.message
              }
            });
          }
        } else {
          return res.status(500).json({
            success: false,
            msg: 'Failed to create user account',
            debug: {
              firebaseUid,
              email: decodedToken.email,
              error: createErr.message
            }
          });
        }
      }
    }

    // Set user information in request
    // IMPORTANT: req.user.id must be MongoDB ObjectId for compatibility
    req.user = {
      id: user._id.toString(),  // MongoDB ObjectId as string (same as JWT version)
      uid: firebaseUid,         // Firebase UID for direct Firebase auth checks
      email: user.email,
      firebaseUid: user.firebaseUid,
      _id: user._id  // Keep original ObjectId for reference
    };

    // Validate user information exists
    if (!req.user || !req.user.id) {
      throw new Error('User information not found in token');
    }

    next();
  } catch (err) {
    // Log authentication failure for security monitoring

    let errorMsg = 'Token is not valid';
    let errorCode = 'INVALID_TOKEN';

    if (err.code === 'auth/id-token-expired') {
      errorMsg = '토큰이 만료되었습니다.';
      errorCode = 'TOKEN_EXPIRED';
    } else if (err.code === 'auth/argument-error') {
      errorMsg = '유효하지 않은 토큰 형식입니다.';
      errorCode = 'MALFORMED_TOKEN';
    } else if (err.code === 'auth/id-token-revoked') {
      errorMsg = '토큰이 취소되었습니다.';
      errorCode = 'TOKEN_REVOKED';
    }

    return res.status(401).json({
      success: false,
      msg: errorMsg,
      error: errorCode,
      debug: {
        errorCode: err.code,
        errorMessage: err.message,
        tokenLength: idToken ? idToken.length : 0
      }
    });
  }
};
