/**
 * ===================================================================================================
 * add_preference_time_to_users.js - 대량의 사용자에게 선호 시간표 데이터를 일괄 추가하는 스크립트
 * ===================================================================================================
 *
 * 📍 위치: 백엔드 > server > add_preference_time_to_users.js
 * 🎯 주요 기능:
 *    - 테스트 및 시뮬레이션을 위해 특정 범위의 사용자(2@naver.com ~ 100@naver.com)들에게 일괄적으로 가용 시간(defaultSchedule)을 설정.
 *    - 지정된 특정 날짜 범위(예: 2025년 12월 1일~5일)에 대해 00:00부터 23:59까지 하루 종일 가용한 상태로 데이터를 생성.
 *    - 중복 추가 방지 로직을 포함하여 이미 설정된 날짜의 데이터는 건너뜀.
 *    - 모든 작업 완료 후 각 사용자별 처리 내역과 전체 성공/스킵 통계 출력.
 *
 * 🔗 연결된 파일:
 *    - server/models/user.js - 사용자 문서 구조 및 defaultSchedule 스키마 참조.
 *    - server/config/db.js - 데이터베이스 연결을 위해 사용.
 *
 * ✏️ 수정 가이드:
 *    - 적용할 날짜 범위를 변경하려면 상단의 dates 배열 수정.
 *    - 배정될 시간대나 우선순위를 변경하려면 main 함수 내의 push 객체 값 수정.
 *
 * 📝 참고사항:
 *    - 이 스크립트를 통해 추가된 데이터는 각 사용자의 '내프로필' 탭에서 시각적으로 확인 가능함.
 *
 * ===================================================================================================
 */

const mongoose = require('mongoose');
const User = require('./models/user');
const connectDB = require('./config/db');
require('dotenv').config();

// 2025년 12월 1일~5일 날짜 및 요일 정보
const dates = [
  { date: '2025-12-01', dayOfWeek: 1, dayName: '월요일' }, // Monday
  { date: '2025-12-02', dayOfWeek: 2, dayName: '화요일' }, // Tuesday
  { date: '2025-12-03', dayOfWeek: 3, dayName: '수요일' }, // Wednesday
  { date: '2025-12-04', dayOfWeek: 4, dayName: '목요일' }, // Thursday
  { date: '2025-12-05', dayOfWeek: 5, dayName: '금요일' }  // Friday
];

/**
 * main
 * @description 스크립트의 메인 실행 함수로, 대상 사용자들을 순회하며 각 날짜별 선호 시간 데이터를 생성 및 저장합니다.
 */
async function main() {
  console.log('🚀 사용자들에게 선호시간(defaultSchedule) 추가 시작\n');
  console.log(`📋 작업 내용:`);
  console.log(`   - 2@naver.com ~ 100@naver.com 회원 (99명)`);
  console.log(`   - 2025년 12월 1일(월) ~ 5일(금)`);
  console.log(`   - 시간: 00:00 ~ 23:59 (하루 종일)`);
  console.log(`   - 우선순위: 3 (높음)`);
  console.log('');
  
  // MongoDB 연결
  await connectDB();
  
  let totalAdded = 0;
  let totalSkipped = 0;
  let totalUsers = 0;
  
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
      
      totalUsers++;
      let addedCount = 0;
      let skippedCount = 0;
      
      // defaultSchedule이 없으면 빈 배열로 초기화
      if (!user.defaultSchedule) {
        user.defaultSchedule = [];
      }
      
      // 각 날짜에 대해 선호시간 추가
      for (const { date, dayOfWeek, dayName } of dates) {
        // 이미 해당 날짜에 시간이 있는지 확인
        const existingSlot = user.defaultSchedule.find(s =>
          s.specificDate === date &&
          s.startTime === '00:00' &&
          s.endTime === '23:59'
        );
        
        if (existingSlot) {
          skippedCount++;
          continue;
        }
        
        // 새 선호시간 추가
        user.defaultSchedule.push({
          dayOfWeek: dayOfWeek,
          startTime: '00:00',
          endTime: '23:59',
          priority: 3, // 높은 우선순위
          specificDate: date
        });
        
        addedCount++;
      }
      
      // 변경사항이 있으면 저장
      if (addedCount > 0) {
        await user.save();
        console.log(`   ✅ 추가됨: ${addedCount}개 선호시간`);
      }
      
      if (skippedCount > 0) {
        console.log(`   ℹ️  스킵됨: ${skippedCount}개 (이미 존재)`);
      }
      
      totalAdded += addedCount;
      totalSkipped += skippedCount;
      
    } catch (error) {
      console.error(`   ❌ 오류 발생: ${email} -`, error.message);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 최종 결과:');
  console.log(`   👥 처리된 사용자: ${totalUsers}명`);
  console.log(`   ✅ 추가된 선호시간: ${totalAdded}개`);
  console.log(`   ℹ️  스킵된 선호시간: ${totalSkipped}개`);
  console.log(`   📅 날짜당 사용자: ${totalAdded / 5}명 (5일 기준)`);
  console.log('='.repeat(50));
  
  console.log('\n🎉 작업 완료! 이제 프로필 탭에서 선호시간을 확인할 수 있습니다.');
  process.exit(0);
}

// 실행
main().catch(error => {
  console.error('❌ 오류 발생:', error);
  process.exit(1);
});
