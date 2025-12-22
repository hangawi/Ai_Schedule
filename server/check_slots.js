/**
 * ===================================================================================================
 * check_slots.js - 최근 배정된 슬롯 내역 확인 스크립트
 * ===================================================================================================
 *
 * 📍 위치: 백엔드 > server > check_slots.js
 * 🎯 주요 기능:
 *    - 데이터베이스에서 가장 최근에 업데이트된 방(Room)을 찾아 현재 배정된 타임슬롯들의 최신 내역을 조회.
 *    - 슬롯의 날짜, 요일, 시간대, 배정된 사용자 이메일, 과목명(subject) 등 상세 정보를 콘솔에 출력.
 *    - 배정 시간(assignedAt) 기준 내림차순 정렬을 통해 가장 최근에 수행된 배정 결과 10건을 가독성 있게 보고.
 *
 * 🔗 연결된 파일:
 *    - server/models/room.js - 방 및 타임슬롯 데이터 조회를 위해 참조.
 *    - server/models/user.js - 슬롯에 배정된 사용자 정보를 populate 하기 위해 사용.
 *
 * ✏️ 수정 가이드:
 *    - 특정 방을 지정해서 확인하고 싶다면 Room.findOne의 쿼리 조건을 ID 기반으로 변경.
 *    - 출력할 슬롯의 개수를 조정하려면 slice(0, 10) 부분의 숫자 수정.
 *
 * 📝 참고사항:
 *    - 이 스크립트는 배정 알고리즘이나 수동 조율 작업이 DB에 정상적으로 반영되었는지 빠르게 검증하기 위한 디버깅 도구임.
 *
 * ===================================================================================================
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Room = require('./models/room');
const User = require('./models/User');

/**
 * checkSlots
 * @description 데이터베이스에 연결하여 최근 슬롯 데이터를 조회하고 포맷팅하여 출력하는 메인 함수입니다.
 */
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
