/**
 * 특정 사용자의 최근 슬롯 확인 스크립트
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Room = require('./models/room');
const User = require('./models/User');

async function checkSlots() {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/ai-scheduling';
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB 연결 성공\n');

    // 가장 최근 방 찾기
    const room = await Room.findOne()
      .sort({ updatedAt: -1 })
      .populate('timeSlots.user', 'email firstName lastName');

    if (!room) {
      console.log('❌ 방을 찾을 수 없습니다.');
      process.exit(0);
    }

    console.log(`📋 방 이름: ${room.name}`);
    console.log(`📅 마지막 업데이트: ${room.updatedAt}\n`);

    // 최근 5개 슬롯 출력
    const recentSlots = room.timeSlots
      .sort((a, b) => new Date(b.assignedAt || b.createdAt) - new Date(a.assignedAt || a.createdAt))
      .slice(0, 10);

    console.log('🕐 최근 슬롯 10개:\n');
    recentSlots.forEach((slot, index) => {
      const date = new Date(slot.date);
      const dateStr = date.toISOString().split('T')[0];
      const dayMap = {
        monday: '월요일',
        tuesday: '화요일',
        wednesday: '수요일',
        thursday: '목요일',
        friday: '금요일'
      };
      const dayKo = dayMap[slot.day] || slot.day;
      const userEmail = slot.user?.email || 'Unknown';

      console.log(`${index + 1}. ${dateStr} (${dayKo}) ${slot.startTime}-${slot.endTime}`);
      console.log(`   사용자: ${userEmail}`);
      console.log(`   subject: ${slot.subject}`);
      console.log(`   배정 시간: ${slot.assignedAt ? new Date(slot.assignedAt).toLocaleString('ko-KR') : 'N/A'}\n`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ 오류:', error);
    process.exit(1);
  }
}

checkSlots();
