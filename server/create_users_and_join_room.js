const axios = require('axios');

// 서버 URL 설정
const BASE_URL = 'http://localhost:5000';
const ROOM_INVITE_CODE = 'M8M02Z';
const PASSWORD = 'rty123';

// 숫자를 한글로 변환하는 함수
function numberToKorean(num) {
  if (num === 0) return '영';
  if (num === 100) return '백';
  
  const units = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  const tens = ['', '십', '이십', '삼십', '사십', '오십', '육십', '칠십', '팔십', '구십'];
  
  if (num < 10) {
    return units[num];
  }
  
  const tensDigit = Math.floor(num / 10);
  const onesDigit = num % 10;
  
  let result = tens[tensDigit];
  if (onesDigit > 0) {
    result += units[onesDigit];
  }
  
  return result;
}

// 회원가입 함수
async function registerUser(email, firstName, lastName, password) {
  try {
    const response = await axios.post(`${BASE_URL}/api/auth/register`, {
      email,
      firstName,
      lastName,
      password
    });
    
    console.log(`✅ 회원가입 성공: ${email} (${lastName}${firstName})`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(`❌ 회원가입 실패: ${email} - ${error.response.data.msg || error.response.data}`);
    } else {
      console.error(`❌ 회원가입 실패: ${email} - ${error.message}`);
    }
    return null;
  }
}

// Firebase 로그인 함수 (실제로는 Firebase SDK 사용 필요)
async function loginUser(email, password) {
  try {
    // 실제로는 Firebase Authentication을 사용해야 합니다
    // 여기서는 간단히 이메일/비밀번호만 사용
    console.log(`🔑 로그인 시도: ${email}`);
    
    // Firebase에서 토큰을 받아야 하지만, 임시로 진행
    // 실제 구현에서는 Firebase Admin SDK 또는 Client SDK 필요
    return { email };
  } catch (error) {
    console.error(`❌ 로그인 실패: ${email} - ${error.message}`);
    return null;
  }
}

// 방 참가 함수
async function joinRoom(firebaseToken, inviteCode) {
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
    
    console.log(`✅ 방 참가 성공: ${inviteCode}`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(`❌ 방 참가 실패: ${inviteCode} - ${error.response.data.msg || error.response.data}`);
    } else {
      console.error(`❌ 방 참가 실패: ${inviteCode} - ${error.message}`);
    }
    return null;
  }
}

// 메인 실행 함수
async function main() {
  console.log('🚀 회원가입 및 방 참가 자동화 시작\n');
  console.log(`📋 작업 내용:`);
  console.log(`   - 12@naver.com ~ 100@naver.com 회원 생성 (89명)`);
  console.log(`   - 모든 회원을 ${ROOM_INVITE_CODE} 방에 입장`);
  console.log(`   - 비밀번호: ${PASSWORD}\n`);
  
  // 1단계: 12번부터 100번까지 회원 생성
  console.log('=== 1단계: 회원 생성 시작 ===\n');
  
  for (let i = 12; i <= 100; i++) {
    const email = `${i}@naver.com`;
    
    // 번호 - 1을 한글로 변환 (패턴에 맞게)
    const koreanNumber = numberToKorean(i - 1);
    const firstName = koreanNumber; // 이름
    const lastName = '일'; // 성은 모두 "일"
    
    await registerUser(email, firstName, lastName, PASSWORD);
    
    // API 호출 제한을 피하기 위해 약간의 지연
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n✅ 1단계 완료: 회원 생성 완료\n');
  
  // 2단계: 2번부터 100번까지 방 참가는 Firebase 인증 토큰이 필요하므로
  // 별도 스크립트로 분리하거나 Firebase Admin SDK 사용 필요
  console.log('=== 2단계 안내 ===\n');
  console.log('⚠️  방 참가는 Firebase 인증 토큰이 필요합니다.');
  console.log('⚠️  Firebase Admin SDK를 사용하여 각 사용자의 토큰을 생성하거나,');
  console.log('⚠️  클라이언트에서 각 사용자로 로그인 후 방 참가를 진행해야 합니다.\n');
  console.log('📝 join_room.js 스크립트를 별도로 작성하겠습니다.');
  
  console.log('\n🎉 작업 완료!');
}

// 실행
main().catch(console.error);
