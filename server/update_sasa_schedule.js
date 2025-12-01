const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const User = require('./models/user');
    const user = await User.findOne({ firstName: '사사', lastName: '사사' });

    if (!user) {
      console.log('❌ 사사 사용자를 찾을 수 없습니다.');
      process.exit(1);
    }

    console.log('=== 사사 선호시간 업데이트 ===');
    console.log('기존 defaultSchedule 개수:', user.defaultSchedule?.length || 0);

    // 날짜 매핑
    // 2025-11-25 (화) → 2025-12-03 (화)
    // 2025-11-26 (수) → 2025-12-04 (수)
    const dateMapping = {
      '2025-11-25': '2025-12-03',
      '2025-11-26': '2025-12-04'
    };

    // defaultSchedule 업데이트
    let updatedCount = 0;
    user.defaultSchedule = user.defaultSchedule.map(schedule => {
      if (schedule.specificDate && dateMapping[schedule.specificDate]) {
        console.log(`  ${schedule.specificDate} → ${dateMapping[schedule.specificDate]}: ${schedule.startTime}-${schedule.endTime}`);
        schedule.specificDate = dateMapping[schedule.specificDate];
        updatedCount++;
      }
      return schedule;
    });

    console.log(`\n✅ ${updatedCount}개 항목 업데이트 완료`);
    console.log('새 defaultSchedule 개수:', user.defaultSchedule.length);

    // 저장
    await user.save();
    console.log('✅ 데이터베이스에 저장 완료');

    // 확인
    console.log('\n=== 업데이트 결과 확인 ===');
    const byDate = {};
    user.defaultSchedule.forEach(s => {
      const date = s.specificDate || '반복일정';
      if (!byDate[date]) byDate[date] = 0;
      byDate[date]++;
    });

    Object.keys(byDate).sort().forEach(date => {
      console.log(`  ${date}: ${byDate[date]}개`);
    });

    mongoose.connection.close();
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
