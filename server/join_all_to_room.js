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

// 방 참가 함수
async function joinRoomWithFirebaseToken(firebaseToken, inviteCode, email) {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/coordination/rooms/${inviteCode}/join`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${firebaseToken}`
        }
      }
    );
    
    console.log(`✅ 방 참가 성공: ${email}`);
    return response.data;
  } catch (error) {
    if (error.response) {
      const msg = error.response.data.msg || JSON.stringify(error.response.data);
      
      // 이미 멤버인 경우는 에러로 취급하지 않음
      if (msg.includes('이미 멤버입니다') || msg.includes('already a member')) {
        console.log(`ℹ️  이미 참가 중: ${email}`);
        return { alreadyMember: true };
      }
      
      console.error(`❌ 방 참가 실패: ${email} - ${msg}`);
    } else {
      console.error(`❌ 방 참가 실패: ${email} - ${error.message}`);
    }
    return null;
  }
}

// Firebase 커스텀 토큰 생성 및 ID 토큰 획득
async function getFirebaseIdToken(email) {
  try {
    // 1. MongoDB에서 사용자 찾기
    const user = await User.findOne({ email });
    
    if (!user || !user.firebaseUid) {
      console.error(`❌ 사용자를 찾을 수 없습니다: ${email}`);
      return null;
    }
    
    // 2. Firebase Custom Token 생성
    const customToken = await firebaseAuth.createCustomToken(user.firebaseUid);
    
    // 3. Custom Token을 사용하여 ID Token 획득
    // Firebase REST API를 사용
    const response = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.FIREBASE_API_KEY}`,
      {
        token: customToken,
        returnSecureToken: true
      }
    );
    
    return response.data.idToken;
  } catch (error) {
    console.error(`❌ Firebase 토큰 생성 실패: ${email} -`, error.message);
    return null;
  }
}

// 메인 실행 함수
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
