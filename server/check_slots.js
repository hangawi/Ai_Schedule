const mongoose = require('mongoose');
const User = require('./models/User');
const Room = require('./models/Room');

async function checkSlots() {
  try {
    await mongoose.connect('mongodb+srv://user1:IhCgaO0HBVUQOvqb@cluster0.iqnytlx.mongodb.net/');

    // Find all rooms
    const rooms = await Room.find()
      .populate('members.user', 'email firstName lastName')
      .populate('timeSlots.user', 'email firstName lastName');

    console.log(`Found ${rooms.length} rooms\n`);

    for (const room of rooms) {
      console.log(`\n========== Room: ${room.name} ==========`);
      console.log(`Room ID: ${room._id}`);
      console.log(`Total timeSlots: ${room.timeSlots.length}`);

      // Filter slots for user 2@naver.com
      const user2Slots = room.timeSlots.filter(slot => {
        const userEmail = slot.user?.email;
        return userEmail === '2@naver.com';
      });

      console.log(`\nSlots for 2@naver.com: ${user2Slots.length}`);

      if (user2Slots.length > 0) {
        // Group by day
        const byDay = {};
        user2Slots.forEach(slot => {
          const day = slot.day;
          if (!byDay[day]) byDay[day] = [];
          byDay[day].push({
            date: slot.date.toISOString().split('T')[0],
            time: `${slot.startTime}-${slot.endTime}`,
            subject: slot.subject,
            id: slot._id.toString().substring(0, 8)
          });
        });

        Object.keys(byDay).sort().forEach(day => {
          console.log(`\n${day}:`);
          byDay[day].forEach(slot => {
            console.log(`  ${slot.date} ${slot.time} (${slot.subject}) [${slot.id}]`);
          });
        });
      }
    }

    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    mongoose.connection.close();
  }
}

checkSlots();
