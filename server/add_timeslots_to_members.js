const mongoose = require('mongoose');
const Room = require('./models/room');
const User = require('./models/user');
const connectDB = require('./config/db');
require('dotenv').config();

const ROOM_INVITE_CODE = 'M8M02Z';

// 2025년 12월 1일~5일 날짜 및 요일 정보
const dates = [
  { date: new Date('2025-12-01'), day: 'monday' },
  { date: new Date('2025-12-02'), day: 'tuesday' },
  { date: new Date('2025-12-03'), day: 'wednesday' },
  { date: new Date('2025-12-04'), day: 'thursday' },
  { date: new Date('2025-12-05'), day: 'friday' }
];

// 메인 실행 함수
async function main() {
  console.log('🚀 M8M02Z 방 멤버들에게 선호시간 추가 시작\n');
  console.log(`📋 작업 내용:`);
  console.log(`   - 2@naver.com ~ 100@naver.com 회원 (99명)`);
  console.log(`   - 2025년 12월 1일(월) ~ 5일(금)`);
  console.log(`   - 시간: 00:00 ~ 24:00 (하루 종일)`);
  console.log('');
  
  // MongoDB 연결
  await connectDB();
  
  // 방 찾기
  const room = await Room.findById('692810016d7555c47ed45994'); // M8M02Z 방 ID
  
  if (!room) {
    console.error(`❌ 방을 찾을 수 없습니다`);
    process.exit(1);
  }
  
  console.log(`✅ 방 찾기 성공: ${room.name}`);
  console.log(`   현재 TimeSlot 개수: ${room.timeSlots.length}개\n`);
  
  let totalAdded = 0;
  let totalSkipped = 0;
  
  // 2번부터 100번까지 처리
  for (let i = 2; i <= 100; i++) {
    const email = `${i}@naver.com`;
    
    console.log(`[${i-1}/99] ${email} 처리 중...`);
    
    try {
      // 사용자 찾기
      const user = await User.findOne({ email });
      
      if (!user) {
        console.error(`   ❌ 사용자를 찾을 수 없습니다: ${email}`);
        continue;
      }
      
      let addedCount = 0;
      let skippedCount = 0;
      
      // 각 날짜에 대해 TimeSlot 추가
      for (const { date, day } of dates) {
        // 이미 해당 날짜/시간에 슬롯이 있는지 확인
        const existingSlot = room.timeSlots.find(s =>
          s.user.toString() === user._id.toString() &&
          s.day === day &&
          s.date.toISOString().split('T')[0] === date.toISOString().split('T')[0] &&
          s.startTime === '00:00' &&
          s.endTime === '24:00'
        );
        
        if (existingSlot) {
          skippedCount++;
          continue;
        }
        
        // 새 TimeSlot 추가
        room.timeSlots.push({
          user: user._id,
          date: date,
          day: day,
          startTime: '00:00',
          endTime: '24:00',
          subject: '선호시간',
          priority: 3,
          status: 'confirmed'
        });
        
        addedCount++;
      }
      
      totalAdded += addedCount;
      totalSkipped += skippedCount;
      
      if (addedCount > 0) {
        console.log(`   ✅ 추가됨: ${addedCount}개 슬롯`);
      }
      if (skippedCount > 0) {
        console.log(`   ℹ️  스킵됨: ${skippedCount}개 슬롯 (이미 존재)`);
      }
      
    } catch (error) {
      console.error(`   ❌ 오류 발생: ${email} -`, error.message);
    }
  }
  
  // 방 저장
  console.log('\n💾 방 정보 저장 중...');
  await room.save();
  console.log('✅ 저장 완료!\n');
  
  console.log('='.repeat(50));
  console.log('📊 최종 결과:');
  console.log(`   ✅ 추가된 TimeSlot: ${totalAdded}개`);
  console.log(`   ℹ️  스킵된 TimeSlot: ${totalSkipped}개`);
  console.log(`   📝 전체 TimeSlot 개수: ${room.timeSlots.length}개`);
  console.log('='.repeat(50));
  
  console.log('\n🎉 작업 완료!');
  process.exit(0);
}

// 실행
main().catch(error => {
  console.error('❌ 오류 발생:', error);
  process.exit(1);
});
