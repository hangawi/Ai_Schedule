const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const User = require('./models/user');
    const user = await User.findOne({ firstName: '사사', lastName: '사사' }).select('firstName lastName defaultSchedule scheduleExceptions');

    if (user) {
      console.log('=== 사사 선호시간 데이터 ===');
      console.log('defaultSchedule 개수:', user.defaultSchedule?.length || 0);

      // 날짜별로 그룹화
      const byDate = {};
      user.defaultSchedule?.forEach(s => {
        const date = s.specificDate || '반복일정';
        if (!byDate[date]) byDate[date] = [];
        byDate[date].push(`${s.startTime}-${s.endTime} (dayOfWeek: ${s.dayOfWeek})`);
      });

      console.log('\n날짜별 선호시간:');
      Object.keys(byDate).sort().forEach(date => {
        console.log(`  ${date}:`);
        byDate[date].forEach(time => console.log(`    - ${time}`));
      });

      console.log('\nscheduleExceptions 개수:', user.scheduleExceptions?.length || 0);

      // 이번 주 범위 계산
      const now = new Date();
      const nowDay = now.getUTCDay();
      const daysToMonday = nowDay === 0 ? 6 : nowDay - 1;

      const thisWeekMonday = new Date(now);
      thisWeekMonday.setUTCDate(now.getUTCDate() - daysToMonday);
      thisWeekMonday.setUTCHours(0, 0, 0, 0);

      const thisWeekSunday = new Date(thisWeekMonday);
      thisWeekSunday.setUTCDate(thisWeekMonday.getUTCDate() + 6);
      thisWeekSunday.setUTCHours(23, 59, 59, 999);

      console.log(`\n이번 주 범위: ${thisWeekMonday.toISOString().split('T')[0]} ~ ${thisWeekSunday.toISOString().split('T')[0]}`);

      // 이번 주 선호시간 필터링
      const thisWeekSchedules = user.defaultSchedule?.filter(s => {
        if (s.specificDate) {
          const scheduleDate = new Date(s.specificDate);
          return scheduleDate >= thisWeekMonday && scheduleDate <= thisWeekSunday;
        }
        return true; // 반복 일정은 항상 포함
      }) || [];

      console.log(`\n이번 주 선호시간 개수: ${thisWeekSchedules.length}`);
      if (thisWeekSchedules.length > 0) {
        thisWeekSchedules.forEach(s => {
          console.log(`  - ${s.specificDate || '반복'}: ${s.startTime}-${s.endTime} (dayOfWeek: ${s.dayOfWeek})`);
        });
      }
    } else {
      console.log('❌ 사사 사용자를 찾을 수 없습니다.');
    }

    mongoose.connection.close();
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
