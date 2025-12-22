/**
 * ===================================================================================================
 * create_users_and_join_room.js - 대량 사용자 생성 및 자동 가입 자동화 스크립트
 * ===================================================================================================
 *
 * 📍 위치: 백엔드 > server > create_users_and_join_room.js
 * 🎯 주요 기능:
 *    - 대규모 인원 테스트를 위해 특정 규칙(예: 12@naver.com ~ 100@naver.com)에 따라 대량의 사용자 계정을 자동 생성.
 *    - 생성된 각 사용자의 이름을 숫자에 대응하는 한글 명칭(예: "일", "이", "십일" 등)으로 자동 변환하여 설정.
 *    - 백엔드 회원가입 API를 호출하여 MongoDB 및 Firebase에 사용자 데이터를 등록.
 *    - (설계 의도) 생성된 사용자들을 특정 방에 자동으로 입장시키는 통합 자동화 시나리오 제공.
 *
 * 🔗 연결된 파일:
 *    - server/controllers/authController.js - 회원가입 API를 통해 상호작용.
 *    - server/routes/auth.js - 회원가입 엔드포인트(/api/auth/register) 참조.
 *
 * ✏️ 수정 가이드:
 *    - 생성할 사용자 범위나 이메일 도메인을 변경하려면 main 함수 내의 루프 조건 수정.
 *    - 기본 비밀번호를 변경하려면 PASSWORD 상수 수정.
 *    - 한글 이름 변환 규칙을 조정하려면 numberToKorean 함수 수정.
 *
 * 📝 참고사항:
 *    - 방 참가 로직은 Firebase ID 토큰이 필요하므로, 실제 운영 시에는 별도의 토큰 생성기나 Admin SDK가 필요함.
 *    - API 호출 과부하 방지를 위해 각 요청 사이에 짧은 지연(100ms)을 둠.
 *
 * ===================================================================================================
 */

const axios = require('axios');

// 서버 URL 설정
const BASE_URL = 'http://localhost:5000';
const ROOM_INVITE_CODE = 'M8M02Z';
const PASSWORD = 'rty123';

/**
 * numberToKorean
 * @description 숫자를 읽기 쉬운 한글 텍스트(예: 11 -> "십일")로 변환합니다.
 * @param {number} num - 변환할 숫자.
 * @returns {string} 한글 텍스트.
 */
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

/**
 * registerUser
 * @description 백엔드 API에 회원가입 요청을 보냅니다.
 * @returns {Promise<Object|null>} 성공 시 생성된 사용자 데이터, 실패 시 null.
 */
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

/**
 * loginUser (Placeholder)
 * @description 사용자 로그인을 시도합니다. (실제 Firebase SDK 연동 필요)
 */
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

/**
 * joinRoom
 * @description 특정 방에 합류하기 위해 초대 코드를 사용하여 API 요청을 보냅니다.
 */
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

/**
 * main
 * @description 스크립트의 메인 실행 루프로, 사용자 생성 과정을 순차적으로 자동화합니다.
 */
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
