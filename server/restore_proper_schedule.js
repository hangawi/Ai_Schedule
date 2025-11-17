const mongoose = require('mongoose');
const User = require('./models/User');

async function restoreProperSchedule() {
  try {
    await mongoose.connect('mongodb+srv://user1:IhCgaO0HBVUQOvqb@cluster0.iqnytlx.mongodb.net/');

    const user = await User.findOne({ email: '2@naver.com' });
    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('Current defaultSchedule entries:', user.defaultSchedule.length);

    // Add proper weekly recurring preferences
    // 월요일 (dayOfWeek: 1) - 09:00-12:00, 13:00-17:00
    // 수요일 (dayOfWeek: 3) - 09:00-12:00, 13:00-17:00
    user.defaultSchedule = [
      // 월요일
      { dayOfWeek: 1, startTime: '09:00', endTime: '12:00', priority: 3 },
      { dayOfWeek: 1, startTime: '13:00', endTime: '17:00', priority: 3 },
      // 수요일
      { dayOfWeek: 3, startTime: '09:00', endTime: '12:00', priority: 3 },
      { dayOfWeek: 3, startTime: '13:00', endTime: '17:00', priority: 3 }
    ];

    await user.save();

    console.log('\n✅ Restored proper weekly schedule:');
    console.log('월요일: 09:00-12:00, 13:00-17:00');
    console.log('수요일: 09:00-12:00, 13:00-17:00');
    console.log('Total entries:', user.defaultSchedule.length);

    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    mongoose.connection.close();
  }
}

restoreProperSchedule();
