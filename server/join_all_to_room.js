/**
 * ===================================================================================================
 * join_all_to_room.js - 다수 사용자의 방 가입 자동화 스크립트 (Firebase 인증 연동)
 * ===================================================================================================
 *
 * 📍 위치: 백엔드 > server > join_all_to_room.js
 * 🎯 주요 기능:
 *    - 대규모 인원 테스트를 위해 여러 사용자(2@naver.com ~ 100@naver.com)들을 자동으로 특정 방에 입장시킴.
 *    - Firebase Admin SDK를 사용하여 각 사용자의 Custom Token을 생성하고, 이를 다시 ID Token으로 교환하여 인증 확보.
 *    - 획득한 인증 토큰을 Authorization 헤더에 실어 방 가입 API(/api/coordination/rooms/join) 호출.
 *    - 이미 가입된 사용자에 대한 예외 처리 및 API 호출 지연(200ms)을 통한 안정적인 대량 처리 지원.
 *    - 최종 작업 통계(성공, 기가입, 실패)를 상세히 보고.
 *
 * 🔗 연결된 파일:
 *    - server/config/firebaseAdmin.js - Firebase 토큰 생성을 위한 auth 인스턴스 참조.
 *    - server/routes/coordination.js - 방 가입 API 엔드포인트 참조.
 *    - server/models/user.js - 사용자 정보(firebaseUid) 조회를 위해 사용.
 *
 * ✏️ 수정 가이드:
 *    - 가입 대상 방을 변경하려면 ROOM_INVITE_CODE 상수 수정.
 *    - 사용자 이메일 범위를 조정하려면 main 함수의 루프 조건 수정.
 *    - API 서버 주소를 변경하려면 BASE_URL 수정.
 *
 * 📝 참고사항:
 *    - 이 스크립트는 실제 Firebase 인증 체계를 우회하지 않고 정식 토큰을 발급받아 테스트를 진행함.
 *    - FIREBASE_API_KEY 환경변수가 설정되어 있어야 ID Token 교환이 가능함.
 *
 * ===================================================================================================
 */

const axios = require('axios');
const admin = require('firebase-admin');
const User = require('./models/user');
const connectDB = require('./config/db');
require('dotenv').config();

// Firebase Admin 초기화는 이미 되어있다고 가정
const { auth: firebaseAuth } = require('./config/firebaseAdmin');

// 서버 URL 설정
const BASE_URL = 'http://localhost:5000';
const ROOM_INVITE_CODE = 'M8M02Z';

/**
 * joinRoomWithFirebaseToken
 * @description 획득한 Firebase ID 토큰을 사용하여 방 가입 API를 호출합니다.
 * @param {string} firebaseToken - 유효한 사용자 ID 토큰.
 * @param {string} inviteCode - 방 초대 코드.
 * @param {string} email - 로깅용 사용자 이메일.
 * @returns {Promise<Object|null>} 가입 결과 데이터 또는 에러 정보.
 */
async function joinRoomWithFirebaseToken(firebaseToken, inviteCode, email) {
  try {
    const response = await axios.post(
      `\$\s*\{\s*BASE_URL\s*\}\s*/api/coordination/rooms/\$\s*\{\s*inviteCode\s*\}\s*/join`,
      {},
      {
        headers: {
          'Authorization': `Bearer \$\s*\{\s*firebaseToken\s*\}\s*`
        }
      }
    );
    
    console.log(`✅ 방 참가 성공: \$\s*\{\s*email\s*\}\s*`);
    return response.data;
  } catch (error) {
    if (error.response) {
      const msg = error.response.data.msg || JSON.stringify(error.response.data);
      
      // 이미 멤버인 경우는 에러로 취급하지 않음
      if (msg.includes('이미 멤버입니다') || msg.includes('already a member')) {
        console.log(`ℹ️  이미 참가 중: \$\s*\{\s*email\s*\}\s*`);
        return { alreadyMember: true };
      }
      
      console.error(`❌ 방 참가 실패: \$\s*\{\s*email\s*\}\s* - \$\s*\{\s*msg\s*\}\s*`);
    } else {
      console.error(`❌ 방 참가 실패: \$\s*\{\s*email\s*\}\s* - \$\s*\{\s*error\.message\s*\}\s*`);
    }
    return null;
  }
}

/**
 * getFirebaseIdToken
 * @description 특정 이메일의 사용자에 대해 Firebase Custom Token을 생성하고 이를 다시 ID Token으로 교환하여 반환합니다.
 * @param {string} email - 대상 사용자 이메일.
 * @returns {Promise<string|null>} 획득한 ID 토큰 문자열 또는 실패 시 null.
 */
async function getFirebaseIdToken(email) {
  try {
    // 1. MongoDB에서 사용자 찾기
    const user = await User.findOne({ email });
    
    if (!user || !user.firebaseUid) {
      console.error(`❌ 사용자를 찾을 수 없습니다: \$\s*\{\s*email\s*\}\s*`);
      return null;
    }
    
    // 2. Firebase Custom Token 생성
    const customToken = await firebaseAuth.createCustomToken(user.firebaseUid);
    
    // 3. Custom Token을 사용하여 ID Token 획득
    // Firebase REST API를 사용
    const response = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=\$\s*\{\s*process\.env\.FIREBASE_API_KEY\s*\}\s*`,
      {
        token: customToken,
        returnSecureToken: true
      }
    );
    
    return response.data.idToken;
  } catch (error) {
    console.error(`❌ Firebase 토큰 생성 실패: \$\s*\{\s*email\s*\}\s* -`, error.message);
    return null;
  }
}

/**
 * main
 * @description 스크립트 메인 루프로, 사용자들을 순회하며 토큰 발급 및 방 가입 프로세스를 자동 실행합니다.
 */
async function main() {
  console.log('🚀 M8M02Z 방 자동 참가 시작\n');
  console.log(`📋 작업 내용:`);
  console.log(`   - 2@naver.com ~ 100@naver.com 회원을 ${ROOM_INVITE_CODE} 방에 입장 (99명)`);
  console.log('');
  
  // MongoDB 연결
  await connectDB();
  
  let successCount = 0;
  let alreadyMemberCount = 0;
  let failCount = 0;
  
  // 2번부터 100번까지 방 참가
  for (let i = 2; i <= 100; i++) {
    const email = `${i}@naver.com`;
    
    console.log(`\n[${i-1}/99] ${email} 처리 중...`);
    
    // 1. Firebase ID 토큰 획득
    const idToken = await getFirebaseIdToken(email);
    
    if (!idToken) {
      console.error(`   ⚠️  토큰 획득 실패, 스킵합니다.`);
      failCount++;
      continue;
    }
    
    // 2. 방 참가
    const result = await joinRoomWithFirebaseToken(idToken, ROOM_INVITE_CODE, email);
    
    if (result) {
      if (result.alreadyMember) {
        alreadyMemberCount++;
      } else {
        successCount++;
      }
    } else {
      failCount++;
    }
    
    // API 호출 제한을 피하기 위해 약간의 지연
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 최종 결과:');
  console.log(`   ✅ 성공: ${successCount}명`);
  console.log(`   ℹ️  이미 참가 중: ${alreadyMemberCount}명`);
  console.log(`   ❌ 실패: ${failCount}명`);
  console.log(`   📝 전체: ${successCount + alreadyMemberCount + failCount}/99명`);
  console.log('='.repeat(50));
  
  console.log('\n🎉 작업 완료!');
  process.exit(0);
}

// 실행
main().catch(error => {
  console.error('❌ 오류 발생:', error);
  process.exit(1);
});
