const mongoose = require('mongoose');
const User = require('./models/User');

async function cleanupDatabase() {
  try {
    await mongoose.connect('mongodb+srv://user1:IhCgaO0HBVUQOvqb@cluster0.iqnytlx.mongodb.net/');

    const user = await User.findOne({ email: '2@naver.com' });
    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('BEFORE cleanup:');
    console.log('Total entries:', user.defaultSchedule.length);

    // Count entries with specificDate
    const withSpecificDate = user.defaultSchedule.filter(e => e.specificDate);
    console.log('Entries with specificDate:', withSpecificDate.length);

    // Keep only entries WITHOUT specificDate (weekly recurring preferences)
    const originalLength = user.defaultSchedule.length;
    user.defaultSchedule = user.defaultSchedule.filter(entry => !entry.specificDate);

    console.log('\nAFTER cleanup:');
    console.log('Total entries:', user.defaultSchedule.length);
    console.log('Removed entries:', originalLength - user.defaultSchedule.length);

    // Show remaining entries
    console.log('\nRemaining entries:');
    const grouped = {};
    user.defaultSchedule.forEach(entry => {
      const day = entry.dayOfWeek;
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push({
        startTime: entry.startTime,
        endTime: entry.endTime,
        priority: entry.priority
      });
    });

    Object.keys(grouped).sort((a, b) => a - b).forEach(day => {
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      console.log(`\n${dayNames[day]}요일 (dayOfWeek: ${day}):`);
      grouped[day].forEach(entry => {
        console.log(`  ${entry.startTime}-${entry.endTime} (priority: ${entry.priority})`);
      });
    });

    // Save changes
    await user.save();
    console.log('\n✅ Database cleaned successfully!');

    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    mongoose.connection.close();
  }
}

cleanupDatabase();
