/**
 * ===================================================================================================
 * add_members_to_room_direct.js - 특정 방에 다수의 사용자를 직접 추가하는 관리 도구 스크립트
 * ===================================================================================================
 *
 * 📍 위치: 백엔드 > server > add_members_to_room_direct.js
 * 🎯 주요 기능:
 *    - 지정된 초대 코드(ROOM_INVITE_CODE)를 가진 방을 탐색하여 대량의 사용자를 멤버로 일괄 등록.
 *    - 이메일 패턴(예: 2@naver.com ~ 100@naver.com)을 기반으로 DB에서 사용자를 찾아 멤버 리스트에 추가.
 *    - 이미 멤버인 경우 중복 추가를 방지하며, 성공/실패 내역을 실시간으로 콘솔에 출력.
 *    - 모든 작업 완료 후 최종 통계 데이터(성공, 중복, 실패 수) 보고.
 *
 * 🔗 연결된 파일:
 *    - server/models/room.js, server/models/user.js - 방 및 사용자 데이터 조작을 위해 참조.
 *    - server/config/db.js - 데이터베이스 연결을 위해 사용.
 *
 * ✏️ 수정 가이드:
 *    - 추가 대상 방을 변경하려면 ROOM_INVITE_CODE 상수 수정.
 *    - 추가할 사용자 범위나 이메일 패턴을 변경하려면 main 함수 내의 for 루프 및 email 변수 생성 로직 수정.
 *
 * 📝 참고사항:
 *    - 이 파일은 개발 및 테스트 환경에서 대규모 인원 시뮬레이션을 위해 사용되는 독립형 CLI 스크립트임.
 *
 * ===================================================================================================
 */

const mongoose = require('mongoose');
const Room = require('./models/room');
const User = require('./models/user');
const connectDB = require('./config/db');
require('dotenv').config();

const ROOM_INVITE_CODE = 'M8M02Z';

/**
 * main
 * @description 스크립트의 메인 실행 함수로, DB 연결부터 사용자 탐색, 방 멤버 추가 및 저장까지의 전체 프로세스를 관리합니다.
 */
async function main() {
  console.log('🚀 M8M02Z 방에 회원 직접 추가 시작\n');
  console.log(`📋 작업 내용:`);
  console.log(`   - 2@naver.com ~ 100@naver.com 회원을 ${ROOM_INVITE_CODE} 방에 직접 추가 (99명)`);
  console.log('');
  
  // MongoDB 연결
  await connectDB();
  
  // 방 찾기
  const room = await Room.findOne({ inviteCode: ROOM_INVITE_CODE });
  
  if (!room) {
    console.error(`❌ 방을 찾을 수 없습니다: ${ROOM_INVITE_CODE}`);
    process.exit(1);
  }
  
  console.log(`✅ 방 찾기 성공: ${room.name} (ID: ${room._id})`);
  console.log(`   현재 멤버 수: ${room.members.length}명\n`);
  
  let successCount = 0;
  let alreadyMemberCount = 0;
  let failCount = 0;
  
  // 2번부터 100번까지 방 참가
  for (let i = 2; i <= 100; i++) {
    const email = `${i}@naver.com`;
    
    console.log(`[${i-1}/99] ${email} 처리 중...`);
    
    try {
      // 1. 사용자 찾기
      const user = await User.findOne({ email });
      
      if (!user) {
        console.error(`   ❌ 사용자를 찾을 수 없습니다: ${email}`);
        failCount++;
        continue;
      }
      
      // 2. 이미 멤버인지 확인
      const isMember = room.members.some(m => m.user.toString() === user._id.toString());
      
      if (isMember) {
        console.log(`   ℹ️  이미 참가 중: ${email}`);
        alreadyMemberCount++;
        continue;
      }
      
      // 3. 멤버 추가
      room.members.push({
        user: user._id,
        joinedAt: new Date(),
        role: 'member',
        completedMinutes: 0,
        carryOverMinutes: 0
      });
      
      console.log(`   ✅ 추가 성공: ${email}`);
      successCount++;
      
    } catch (error) {
      console.error(`   ❌ 오류 발생: ${email} -`, error.message);
      failCount++;
    }
  }
  
  // 4. 방 저장
  console.log('\n💾 방 정보 저장 중...');
  await room.save();
  console.log('✅ 저장 완료!\n');
  
  console.log('='.repeat(50));
  console.log('📊 최종 결과:');
  console.log(`   ✅ 성공: ${successCount}명`);
  console.log(`   ℹ️  이미 참가 중: ${alreadyMemberCount}명`);
  console.log(`   ❌ 실패: ${failCount}명`);
  console.log(`   📝 전체: ${successCount + alreadyMemberCount + failCount}/99명`);
  console.log(`   🏠 현재 방 멤버 수: ${room.members.length}명`);
  console.log('='.repeat(50));
  
  console.log('\n🎉 작업 완료!');
  process.exit(0);
}

// 실행
main().catch(error => {
  console.error('❌ 오류 발생:', error);
  process.exit(1);
});
