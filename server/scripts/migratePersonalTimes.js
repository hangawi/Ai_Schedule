/**
 * ==========================================================
 * 기존 일정 personalTimes 마이그레이션 스크립트 (v2)
 * ==========================================================
 *
 * 목적:
 * 1. personalTimeId가 null인 accepted 유저 → personalTime 새로 생성
 * 2. 기존 personalTimes의 participants, suggestionId, location,
 *    title, startTime, endTime을 ScheduleSuggestion 기준으로 동기화
 *
 * 실행: node server/scripts/migratePersonalTimes.js
 * ==========================================================
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/user');
const ScheduleSuggestion = require('../models/ScheduleSuggestion');

async function migrate() {
  const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/ai-scheduling';

  console.log('🔌 DB 연결 중...');
  await mongoose.connect(mongoURI);
  console.log('✅ DB 연결 완료');

  const suggestions = await ScheduleSuggestion.find({});
  console.log(`📋 총 ${suggestions.length}개의 ScheduleSuggestion 발견\n`);

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const suggestion of suggestions) {
    const acceptedCount = suggestion.memberResponses.filter(
      r => r.status === 'accepted'
    ).length;

    if (acceptedCount === 0) {
      skippedCount++;
      continue;
    }

    console.log(`--- Suggestion ${suggestion._id} | "${suggestion.summary}" | ${suggestion.date} ${suggestion.startTime}~${suggestion.endTime} | location: "${suggestion.location || ''}" | accepted: ${acceptedCount}`);

    let suggestionChanged = false;

    for (const response of suggestion.memberResponses) {
      if (response.status !== 'accepted') continue;

      try {
        const user = await User.findById(response.user);
        if (!user) {
          console.log(`  ⚠️ User ${response.user} not found`);
          continue;
        }

        // Case 1: personalTimeId가 null → personalTime 새로 생성
        if (!response.personalTimeId) {
          let endTime = suggestion.endTime;
          if (endTime === '24:00') endTime = '23:59';

          const newId = user.personalTimes.length > 0
            ? Math.max(...user.personalTimes.map(pt => pt.id)) + 1
            : 1;

          const newPersonalTime = {
            id: newId,
            title: `[약속] ${suggestion.summary}`,
            type: 'event',
            startTime: suggestion.startTime,
            endTime: endTime,
            days: [],
            isRecurring: false,
            specificDate: suggestion.date,
            color: '#3b82f6',
            location: suggestion.location || '',
            roomId: suggestion.room.toString(),
            participants: acceptedCount,
            suggestionId: suggestion._id.toString()
          };

          user.personalTimes.push(newPersonalTime);
          await user.save();

          response.personalTimeId = newId;
          suggestionChanged = true;

          createdCount++;
          console.log(`  🆕 Created personalTime #${newId} for user ${user._id} (was null)`);
          continue;
        }

        // Case 2: personalTimeId가 있음 → 필드 동기화
        const pt = user.personalTimes.find(p => p.id === response.personalTimeId);
        if (!pt) {
          console.log(`  ⚠️ User ${user._id} personalTime #${response.personalTimeId} not found`);
          continue;
        }

        let changed = false;
        const expectedTitle = `[약속] ${suggestion.summary}`;
        let expectedEndTime = suggestion.endTime;
        if (expectedEndTime === '24:00') expectedEndTime = '23:59';

        if (pt.title !== expectedTitle) { pt.title = expectedTitle; changed = true; }
        if (pt.startTime !== suggestion.startTime) { pt.startTime = suggestion.startTime; changed = true; }
        if (pt.endTime !== expectedEndTime) { pt.endTime = expectedEndTime; changed = true; }
        if (pt.specificDate !== suggestion.date) { pt.specificDate = suggestion.date; changed = true; }
        if ((pt.location || '') !== (suggestion.location || '')) { pt.location = suggestion.location || ''; changed = true; }
        if (pt.participants !== acceptedCount) { pt.participants = acceptedCount; changed = true; }
        if (!pt.suggestionId) { pt.suggestionId = suggestion._id.toString(); changed = true; }

        if (changed) {
          await user.save();
          updatedCount++;
          console.log(`  🔄 Updated personalTime #${pt.id} for user ${user._id}`);
        } else {
          console.log(`  ✅ personalTime #${pt.id} for user ${user._id} already OK`);
        }
      } catch (err) {
        console.error(`  ❌ Error for user ${response.user}:`, err.message);
      }
    }

    if (suggestionChanged) {
      await suggestion.save();
    }
  }

  console.log('\n========== 마이그레이션 완료 ==========');
  console.log(`🆕 새로 생성: ${createdCount}건`);
  console.log(`🔄 업데이트: ${updatedCount}건`);
  console.log(`⏭️ 스킵 (수락자 없음): ${skippedCount}건`);
  console.log('======================================');

  await mongoose.disconnect();
  console.log('🔌 DB 연결 해제');
}

migrate().catch(err => {
  console.error('❌ 마이그레이션 실패:', err);
  process.exit(1);
});
