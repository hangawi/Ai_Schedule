const mongoose = require('mongoose');
const User = require('./models/User');

async function investigateDatabase() {
  try {
    await mongoose.connect('mongodb+srv://user1:IhCgaO0HBVUQOvqb@cluster0.iqnytlx.mongodb.net/');

    const user = await User.findOne({ email: '2@naver.com' });
    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('=== Current defaultSchedule entries ===');
    console.log('Total entries:', user.defaultSchedule.length);

    // Group by dayOfWeek
    const grouped = {};
    user.defaultSchedule.forEach((entry, idx) => {
      const day = entry.dayOfWeek;
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push({
        index: idx,
        startTime: entry.startTime,
        endTime: entry.endTime,
        priority: entry.priority,
        specificDate: entry.specificDate
      });
    });

    console.log('\nGrouped by dayOfWeek:');
    Object.keys(grouped).sort((a, b) => a - b).forEach(day => {
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      console.log(`\n${dayNames[day]}요일 (dayOfWeek: ${day}) - ${grouped[day].length} entries`);

      // Show first 5 entries for each day
      grouped[day].slice(0, 5).forEach(entry => {
        console.log(`  ${entry.startTime}-${entry.endTime} (priority: ${entry.priority}, specificDate: ${entry.specificDate || 'none'})`);
      });

      if (grouped[day].length > 5) {
        console.log(`  ... and ${grouped[day].length - 5} more entries`);
      }
    });

    // Check for suspicious patterns (16:50-17:00 mentioned by user)
    console.log('\n=== Checking for 16:50-17:00 pattern ===');
    const suspicious = user.defaultSchedule.filter(entry =>
      entry.startTime === '16:50' && entry.endTime === '17:00'
    );
    console.log('Found', suspicious.length, 'entries with 16:50-17:00');

    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    mongoose.connection.close();
  }
}

investigateDatabase();
