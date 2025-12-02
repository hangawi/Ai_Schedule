const mongoose = require('mongoose');
const Room = require('./models/room');
const User = require('./models/user');
const connectDB = require('./config/db');
require('dotenv').config();

const ROOM_INVITE_CODE = 'M8M02Z';

// 메인 실행 함수
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
