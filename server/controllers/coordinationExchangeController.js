const Room = require('../models/Room');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper functions for time calculations
function addHours(timeStr, hours) {
   const [h, m] = timeStr.split(':').map(Number);
   const totalMinutes = h * 60 + m + (hours * 60);
   const newH = Math.floor(totalMinutes / 60) % 24;
   const newM = totalMinutes % 60;
   return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

function getHoursDifference(startTime, endTime) {
   const [sh, sm] = startTime.split(':').map(Number);
   const [eh, em] = endTime.split(':').map(Number);
   return ((eh * 60 + em) - (sh * 60 + sm)) / 60;
}

/**
 * Parse natural language exchange request using Gemini
 * POST /api/coordination/rooms/:roomId/parse-exchange-request
 */
exports.parseExchangeRequest = async (req, res) => {
   try {
      const { roomId } = req.params;
      const { message } = req.body;

      if (!message || !message.trim()) {
         return res.status(400).json({ error: '메시지를 입력해주세요.' });
      }

      // Verify room exists and user is a member
      const room = await Room.findById(roomId);
      if (!room) {
         return res.status(404).json({ error: '방을 찾을 수 없습니다.' });
      }

      const isMember = room.members.some(m =>
         (m.user._id || m.user).toString() === req.user.id.toString()
      );
      if (!isMember) {
         return res.status(403).json({ error: '방 멤버만 이 기능을 사용할 수 있습니다.' });
      }

      // Use Gemini to parse the natural language request
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

      const prompt = `
다음 메시지의 의도를 파악해주세요.

메시지: "${message}"

다음 JSON 형식으로 응답해주세요:
{
  "type": "응답 타입 (time_change, confirm, reject 중 하나)",
  "targetDay": "요일 (type이 time_change일 때만, 예: 월요일, 화요일, 수요일, 목요일, 금요일)",
  "targetTime": "시간 (HH:00 형식, 예: 14:00. 시간이 명시되지 않았으면 null. type이 time_change일 때만)"
}

**응답 타입 판단 규칙:**
1. **time_change**: 시간 변경 요청 (예: "수요일로 바꿔줘", "목요일 2시로")
2. **confirm**: 긍정/확인 응답
   - 한국어: "네", "예", "응", "어", "웅", "ㅇㅇ", "ㅇ", "그래", "좋아", "오케이", "ok", "yes", "y"
   - 조정 의사 표현: "조정해줘", "바꿔줘", "변경해줘"
3. **reject**: 부정/거절 응답
   - 한국어: "아니", "아니요", "아뇨", "싫어", "안돼", "안할래", "no", "n", "nope", "취소"

**time_change 타입일 때 규칙:**
1. 요일만 언급된 경우 targetTime은 null
2. 요일과 시간이 모두 언급된 경우 둘 다 추출
3. 시간은 24시간 형식으로 변환 (예: "오후 2시" -> "14:00", "2시" -> "14:00")

**예시:**
- "수요일로 바꿔줘" -> {"type": "time_change", "targetDay": "수요일", "targetTime": null}
- "수요일 2시로 바꿔줘" -> {"type": "time_change", "targetDay": "수요일", "targetTime": "14:00"}
- "네" -> {"type": "confirm", "targetDay": null, "targetTime": null}
- "ㅇㅇ" -> {"type": "confirm", "targetDay": null, "targetTime": null}
- "어" -> {"type": "confirm", "targetDay": null, "targetTime": null}
- "웅" -> {"type": "confirm", "targetDay": null, "targetTime": null}
- "아니" -> {"type": "reject", "targetDay": null, "targetTime": null}
- "취소" -> {"type": "reject", "targetDay": null, "targetTime": null}

JSON만 반환하고 다른 텍스트는 포함하지 마세요.
`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      // Parse JSON response
      let parsed;
      try {
         // Remove markdown code blocks if present
         const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
         parsed = JSON.parse(jsonText);
      } catch (parseError) {
         console.error('Failed to parse Gemini response:', text);
         return res.status(500).json({
            error: '요청을 이해하지 못했습니다. 다시 시도해주세요.',
            debug: text
         });
      }

      // Validate parsed data based on type
      if (!parsed.type) {
         return res.status(400).json({
            error: '메시지 타입을 파악할 수 없습니다.'
         });
      }

      // Validate time_change type
      if (parsed.type === 'time_change') {
         const validDays = ['월요일', '화요일', '수요일', '목요일', '금요일'];
         if (!parsed.targetDay || !validDays.includes(parsed.targetDay)) {
            return res.status(400).json({
               error: '요일을 명확히 말씀해주세요. (월요일~금요일)'
            });
         }

         // Validate time format if provided
         if (parsed.targetTime) {
            const timeRegex = /^([0-1][0-9]|2[0-3]):00$/;
            if (!timeRegex.test(parsed.targetTime)) {
               return res.status(400).json({
                  error: '시간 형식이 올바르지 않습니다. (예: 14:00)'
               });
            }
         }
      }

      res.json({ parsed });

   } catch (error) {
      console.error('Parse exchange request error:', error);
      res.status(500).json({
         error: '서버 오류가 발생했습니다.',
         details: error.message
      });
   }
};

/**
 * Execute smart exchange with validation
 * POST /api/coordination/rooms/:roomId/smart-exchange
 */
exports.smartExchange = async (req, res) => {
   try {
      const { roomId } = req.params;
      const { targetDay, targetTime } = req.body;

      console.log('🚀 ========== SMART EXCHANGE REQUEST ==========');
      console.log('📝 Request params:', { roomId, targetDay, targetTime });
      console.log('👤 Requester user ID:', req.user.id);

      // Verify room exists
      const room = await Room.findById(roomId)
         .populate('owner', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes')
         .populate('members.user', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes')
         .populate('timeSlots.user', '_id firstName lastName email');

      if (!room) {
         return res.status(404).json({ success: false, message: '방을 찾을 수 없습니다.' });
      }

      // Verify user is a member
      const memberData = room.members.find(m =>
         (m.user._id || m.user).toString() === req.user.id.toString()
      );
      if (!memberData) {
         return res.status(403).json({ success: false, message: '방 멤버만 이 기능을 사용할 수 있습니다.' });
      }

      // Map day names to English
      const dayMap = {
         '월요일': 'monday',
         '화요일': 'tuesday',
         '수요일': 'wednesday',
         '목요일': 'thursday',
         '금요일': 'friday'
      };

      const targetDayEnglish = dayMap[targetDay];
      if (!targetDayEnglish) {
         return res.status(400).json({ success: false, message: '유효하지 않은 요일입니다.' });
      }

      // 🧠 Phase 4: Smart validation logic

      // Get current week's Monday
      const now = new Date();
      const day = now.getUTCDay();
      const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now);
      monday.setUTCDate(diff);
      monday.setUTCHours(0, 0, 0, 0);

      // Calculate target date
      const dayNumbers = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5 };
      const targetDayNumber = dayNumbers[targetDayEnglish];
      const targetDate = new Date(monday);
      targetDate.setUTCDate(monday.getUTCDate() + targetDayNumber - 1);

      // Find ALL requester's current assignments (including exchanged slots)
      const requesterCurrentSlots = room.timeSlots.filter(slot => {
         const slotUserId = (slot.user._id || slot.user).toString();
         const isUserSlot = slotUserId === req.user.id.toString();
         // Accept both '자동 배정' and '교환 결과'
         const isValidSubject = slot.subject === '자동 배정' || slot.subject === '교환 결과';
         return isUserSlot && isValidSubject;
      });

      if (requesterCurrentSlots.length === 0) {
         return res.status(400).json({
            success: false,
            message: '현재 배정된 시간이 없습니다. 먼저 자동 배정을 받으세요.'
         });
      }

      console.log(`📋 Found ${requesterCurrentSlots.length} slots for user:`, requesterCurrentSlots.map(s => ({
         day: s.day,
         date: s.date,
         time: `${s.startTime}-${s.endTime}`
      })));

      // Group slots by date to find continuous blocks
      const slotsByDate = {};
      requesterCurrentSlots.forEach(slot => {
         const dateKey = new Date(slot.date).toISOString().split('T')[0];
         if (!slotsByDate[dateKey]) {
            slotsByDate[dateKey] = [];
         }
         slotsByDate[dateKey].push(slot);
      });

      // Sort each date's slots by start time and find continuous blocks
      const continuousBlocks = [];
      Object.entries(slotsByDate).forEach(([dateKey, slots]) => {
         // Sort by start time
         slots.sort((a, b) => {
            const [aH, aM] = a.startTime.split(':').map(Number);
            const [bH, bM] = b.startTime.split(':').map(Number);
            return (aH * 60 + aM) - (bH * 60 + bM);
         });

         // Find continuous blocks
         let currentBlock = [slots[0]];
         for (let i = 1; i < slots.length; i++) {
            const prev = currentBlock[currentBlock.length - 1];
            const curr = slots[i];

            // Check if current slot continues from previous
            if (prev.endTime === curr.startTime) {
               currentBlock.push(curr);
            } else {
               // Save current block and start new one
               continuousBlocks.push([...currentBlock]);
               currentBlock = [curr];
            }
         }
         continuousBlocks.push(currentBlock);
      });

      console.log(`📦 Found ${continuousBlocks.length} continuous blocks:`, continuousBlocks.map(block => ({
         day: block[0].day,
         date: block[0].date,
         time: `${block[0].startTime}-${block[block.length - 1].endTime}`,
         slotCount: block.length
      })));

      // Select block to move
      // Strategy: Select block from THIS WEEK that is NOT on target day
      let selectedBlock;

      // Calculate this week's date range (Monday to Sunday)
      const thisWeekMonday = new Date(monday);
      const thisWeekSunday = new Date(monday);
      thisWeekSunday.setUTCDate(thisWeekMonday.getUTCDate() + 6);

      // console.log(`📅 This week range: ${thisWeekMonday.toISOString().split('T')[0]} to ${thisWeekSunday.toISOString().split('T')[0]}`);

      // Filter blocks that are in THIS WEEK
      const thisWeekBlocks = continuousBlocks.filter(block => {
         const blockDate = new Date(block[0].date);
         return blockDate >= thisWeekMonday && blockDate <= thisWeekSunday;
      });

      // console.log(`🔍 Block selection - Target day: ${targetDayEnglish}`);
      // console.log(`   Total blocks: ${continuousBlocks.length}`);
      // console.log(`   This week blocks: ${thisWeekBlocks.length}`);

      // From this week's blocks, prefer blocks NOT on target day
      const thisWeekBlocksNotOnTargetDay = thisWeekBlocks.filter(block => block[0].day !== targetDayEnglish);
      const thisWeekBlocksOnTargetDay = thisWeekBlocks.filter(block => block[0].day === targetDayEnglish);

      // console.log(`   This week blocks NOT on ${targetDayEnglish}: ${thisWeekBlocksNotOnTargetDay.length}`);
      // console.log(`   This week blocks ON ${targetDayEnglish}: ${thisWeekBlocksOnTargetDay.length}`);

      if (thisWeekBlocksNotOnTargetDay.length > 0) {
         // Move block from other day to target day (within this week)
         selectedBlock = thisWeekBlocksNotOnTargetDay[0];
         // console.log(`✅ Selected THIS WEEK block from OTHER day: ${selectedBlock[0].day} ${selectedBlock[0].startTime}-${selectedBlock[selectedBlock.length - 1].endTime} (date: ${selectedBlock[0].date}) → ${targetDayEnglish}`);
      } else if (thisWeekBlocksOnTargetDay.length > 0) {
         // Only blocks on target day exist in this week - change time within same day
         selectedBlock = thisWeekBlocksOnTargetDay[0];
         // console.log(`✅ Selected THIS WEEK block on SAME day: ${selectedBlock[0].day} ${selectedBlock[0].startTime}-${selectedBlock[selectedBlock.length - 1].endTime} (date: ${selectedBlock[0].date}) (changing time within ${targetDayEnglish})`);
      } else {
         // No blocks in this week - fallback to any block
         // console.log(`⚠️ No blocks found in this week, selecting from all blocks`);
         const blocksNotOnTargetDay = continuousBlocks.filter(block => block[0].day !== targetDayEnglish);
         if (blocksNotOnTargetDay.length > 0) {
            selectedBlock = blocksNotOnTargetDay[0];
         } else {
            selectedBlock = continuousBlocks[0];
         }
         // console.log(`⚠️ Fallback: selecting block from ${selectedBlock[0].date}`);
      }

      // console.log(`   Total blocks available: ${continuousBlocks.length}`);

      const requesterCurrentSlot = selectedBlock[0]; // For compatibility with existing code
      const allSlotsInBlock = selectedBlock;

      // 🔒 Check if target time is within MEMBER's preferred schedule (from User.defaultSchedule)
      const calculateTotalHours = (startTime, endTime) => {
         return getHoursDifference(startTime, endTime);
      };

      const blockStartTime = allSlotsInBlock[0].startTime;
      const blockEndTime = allSlotsInBlock[allSlotsInBlock.length - 1].endTime;
      const totalHours = calculateTotalHours(blockStartTime, blockEndTime);

      // Calculate all time slots that will be needed
      const newStartTime = targetTime || blockStartTime;
      const newEndTime = addHours(newStartTime, totalHours);

      // 🔒 STEP 1: Check OWNER's preferred schedule first
      const ownerUser = room.owner;
      const ownerDefaultSchedule = ownerUser.defaultSchedule || [];

      // Map day to dayOfWeek number (1=Monday, 2=Tuesday, ..., 5=Friday)
      const dayOfWeekMap = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5 };
      const targetDayOfWeek = dayOfWeekMap[targetDayEnglish];

      console.log(`🎯 Target day: ${targetDayEnglish} (dayOfWeek: ${targetDayOfWeek})`);

      // Find owner's schedule for target day
      const ownerTargetDaySchedules = ownerDefaultSchedule.filter(s => s.dayOfWeek === targetDayOfWeek);

      // console.log(`👑 Owner schedules for ${targetDay}:`, JSON.stringify(ownerTargetDaySchedules, null, 2));

      if (ownerTargetDaySchedules.length === 0) {
         return res.status(400).json({
            success: false,
            message: `${targetDay}는 방장의 선호 시간이 아닙니다. 방장이 설정한 선호 요일로만 변경할 수 있습니다.`
         });
      }

      // 🔒 STEP 2: Check MEMBER's preferred schedule
      const requesterUser = memberData.user;
      const requesterDefaultSchedule = requesterUser.defaultSchedule || [];

      // console.log('👤 Requester info:', {
      //    id: requesterUser._id,
      //    email: requesterUser.email,
      //    name: `${requesterUser.firstName} ${requesterUser.lastName}`
      // });
      // console.log('🔍 Requester FULL defaultSchedule (all days):', JSON.stringify(requesterDefaultSchedule.map(s => ({
      //    dayOfWeek: s.dayOfWeek,
      //    day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][s.dayOfWeek],
      //    startTime: s.startTime,
      //    endTime: s.endTime
      // })), null, 2));

      // Find requester's schedule for target day
      const memberTargetDaySchedules = requesterDefaultSchedule.filter(s => s.dayOfWeek === targetDayOfWeek);

      // console.log(`📅 Member schedules for ${targetDay}:`, JSON.stringify(memberTargetDaySchedules, null, 2));

      if (memberTargetDaySchedules.length === 0) {
         return res.status(400).json({
            success: false,
            message: `${targetDay}는 당신의 선호 시간이 아닙니다. 본인이 설정한 선호 요일로만 변경할 수 있습니다.`
         });
      }

      // 🔒 STEP 3: Merge and find overlapping time ranges (OWNER ∩ MEMBER)

      // Helper function to merge continuous slots
      const mergeSlots = (schedules) => {
         const sorted = [...schedules].sort((a, b) => {
            const [aH, aM] = a.startTime.split(':').map(Number);
            const [bH, bM] = b.startTime.split(':').map(Number);
            return (aH * 60 + aM) - (bH * 60 + bM);
         });

         const merged = [];
         let current = null;

         for (const schedule of sorted) {
            const [startH, startM] = schedule.startTime.split(':').map(Number);
            const [endH, endM] = schedule.endTime.split(':').map(Number);
            const startMinutes = startH * 60 + startM;
            const endMinutes = endH * 60 + endM;

            if (!current) {
               current = { startMinutes, endMinutes, startTime: schedule.startTime, endTime: schedule.endTime };
            } else {
               if (startMinutes <= current.endMinutes) {
                  current.endMinutes = Math.max(current.endMinutes, endMinutes);
                  current.endTime = schedule.endTime;
               } else {
                  merged.push({ ...current });
                  current = { startMinutes, endMinutes, startTime: schedule.startTime, endTime: schedule.endTime };
               }
            }
         }
         if (current) merged.push(current);
         return merged;
      };

      const ownerMergedRanges = mergeSlots(ownerTargetDaySchedules);
      const memberMergedRanges = mergeSlots(memberTargetDaySchedules);

      // console.log(`👑 Owner merged ranges for ${targetDay}:`, ownerMergedRanges.map(r => `${r.startTime}-${r.endTime}`));
      // console.log(`📊 Member merged ranges for ${targetDay}:`, memberMergedRanges.map(r => `${r.startTime}-${r.endTime}`));

      // Find intersection (overlapping ranges)
      const overlappingRanges = [];
      for (const ownerRange of ownerMergedRanges) {
         for (const memberRange of memberMergedRanges) {
            const overlapStart = Math.max(ownerRange.startMinutes, memberRange.startMinutes);
            const overlapEnd = Math.min(ownerRange.endMinutes, memberRange.endMinutes);

            if (overlapStart < overlapEnd) {
               // Convert back to time strings
               const startH = Math.floor(overlapStart / 60);
               const startM = overlapStart % 60;
               const endH = Math.floor(overlapEnd / 60);
               const endM = overlapEnd % 60;
               overlappingRanges.push({
                  startMinutes: overlapStart,
                  endMinutes: overlapEnd,
                  startTime: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
                  endTime: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
               });
            }
         }
      }

      // console.log(`🤝 Overlapping ranges (Owner ∩ Member):`, overlappingRanges.map(r => `${r.startTime}-${r.endTime}`));

      if (overlappingRanges.length === 0) {
         return res.status(400).json({
            success: false,
            message: `${targetDay}에 방장과 당신의 선호 시간이 겹치지 않습니다. 겹치는 시간대로만 변경할 수 있습니다.`
         });
      }

      // 🔧 If targetTime is not specified and moving to different day, use first overlap range start time
      let finalNewStartTime = newStartTime;
      let finalNewEndTime = newEndTime;

      if (!targetTime && selectedBlock[0].day !== targetDayEnglish) {
         // Moving to different day without specific time → use first overlap range start
         const firstOverlapStart = overlappingRanges[0].startTime;
         finalNewStartTime = firstOverlapStart;
         finalNewEndTime = addHours(firstOverlapStart, totalHours);
         console.log(`⚙️ No target time specified, using first overlap start: ${finalNewStartTime}`);
      }

      // Check if the entire block fits within any overlapping range
      const [newStartH, newStartM] = finalNewStartTime.split(':').map(Number);
      const [newEndH, newEndM] = finalNewEndTime.split(':').map(Number);
      const newStartMinutes = newStartH * 60 + newStartM;
      const newEndMinutes = newEndH * 60 + newEndM;

      // console.log(`🕐 New time range: ${finalNewStartTime}-${finalNewEndTime} (${newStartMinutes}-${newEndMinutes} minutes)`);

      let isWithinOverlap = false;
      for (const range of overlappingRanges) {
         // console.log(`  📋 Checking overlap range: ${range.startTime}-${range.endTime} (${range.startMinutes}-${range.endMinutes} minutes)`);
         // console.log(`     ${newStartMinutes} >= ${range.startMinutes} && ${newEndMinutes} <= ${range.endMinutes} = ${newStartMinutes >= range.startMinutes && newEndMinutes <= range.endMinutes}`);

         if (newStartMinutes >= range.startMinutes && newEndMinutes <= range.endMinutes) {
            isWithinOverlap = true;
            // console.log(`  ✅ Match found in overlapping range!`);
            break;
         }
      }

      if (!isWithinOverlap) {
         // Create a more helpful error message
         const availableRanges = overlappingRanges.map(r => `${r.startTime}-${r.endTime}`).join(', ');
         return res.status(400).json({
            success: false,
            message: `${targetDay} ${newStartTime}-${newEndTime}는 사용할 수 없습니다. 방장과 겹치는 가능한 시간: ${availableRanges}`
         });
      }

      console.log('✅ Target time is within overlapping preferred schedule (Owner ∩ Member)');

      // Check if target slot exists and who occupies it
      const targetSlots = room.timeSlots.filter(slot => {
         const slotDate = new Date(slot.date);
         return slotDate.toISOString().split('T')[0] === targetDate.toISOString().split('T')[0] &&
                (!targetTime || slot.startTime === targetTime);
      });

      const occupiedSlot = targetSlots.find(slot =>
         (slot.user._id || slot.user).toString() !== req.user.id.toString()
      );

      // Case 1: Target slot is empty → Immediate swap
      if (!occupiedSlot) {
         console.log('🔧 Current block:', {
            startTime: blockStartTime,
            endTime: blockEndTime,
            totalSlots: allSlotsInBlock.length,
            totalHours: totalHours,
            date: allSlotsInBlock[0].date
         });

         console.log('📅 New times:', { startTime: newStartTime, endTime: newEndTime, totalHours });

         // Check if already at target position (same day and same time)
         const currentBlockDate = new Date(allSlotsInBlock[0].date);
         const isSameDay = currentBlockDate.toISOString().split('T')[0] === targetDate.toISOString().split('T')[0];
         const isSameTime = blockStartTime === newStartTime && blockEndTime === newEndTime;

         if (isSameDay && isSameTime) {
            console.log('⚠️ Already at target position. No changes needed.');
            return res.json({
               success: true,
               message: `이미 ${targetDay} ${newStartTime}-${newEndTime}에 배정되어 있습니다.`,
               immediateSwap: true,
               targetDay,
               targetTime: newStartTime
            });
         }

         // Remove ALL slots in the block
         const slotIdsToRemove = allSlotsInBlock.map(slot => slot._id.toString());
         console.log(`🗑️ Attempting to remove ${slotIdsToRemove.length} slots:`, slotIdsToRemove);
         console.log(`📊 Total timeSlots before removal: ${room.timeSlots.length}`);

         const beforeLength = room.timeSlots.length;

         // Use Mongoose array methods to ensure changes are tracked
         for (const slotId of slotIdsToRemove) {
            const index = room.timeSlots.findIndex(slot => slot._id.toString() === slotId);
            if (index !== -1) {
               room.timeSlots.splice(index, 1);
            }
         }

         const afterLength = room.timeSlots.length;

         console.log(`🗑️ Removed ${beforeLength - afterLength} slots (expected ${slotIdsToRemove.length})`);
         console.log(`📊 Total timeSlots after removal: ${afterLength}`);

         // Create new continuous slots at target time (same 30-min intervals)
         const newSlots = [];
         let currentTime = finalNewStartTime;

         for (let i = 0; i < allSlotsInBlock.length; i++) {
            const slotEndTime = addHours(currentTime, 0.5); // 30 minutes
            newSlots.push({
               user: req.user.id,
               date: targetDate,
               startTime: currentTime,
               endTime: slotEndTime,
               day: targetDayEnglish,
               priority: allSlotsInBlock[i].priority || 3,
               subject: '자동 배정',
               assignedBy: room.owner._id,
               assignedAt: new Date(),
               status: 'confirmed'
            });
            currentTime = slotEndTime;
         }

         room.timeSlots.push(...newSlots);
         console.log(`✅ Created ${newSlots.length} new slots at ${finalNewStartTime}-${finalNewEndTime}`);

         await room.save();
         await room.populate('timeSlots.user', '_id firstName lastName email');

         return res.json({
            success: true,
            message: `${targetDay} ${finalNewStartTime}-${finalNewEndTime}로 즉시 변경되었습니다!`,
            immediateSwap: true,
            targetDay,
            targetTime: finalNewStartTime
         });
      }

      // Case 2: Target slot is occupied → Create exchange request
      console.log('🔔 Target slot is occupied, creating exchange request...');

      const occupiedUserId = (occupiedSlot.user._id || occupiedSlot.user).toString();
      const requesterSlotIds = allSlotsInBlock.map(s => s._id.toString());

      // Create exchange request
      const exchangeRequest = {
         requester: req.user.id,
         type: 'exchange_request',
         targetUser: occupiedUserId,
         requesterSlots: allSlotsInBlock.map(s => ({
            day: s.day,
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            subject: s.subject,
            user: req.user.id
         })),
         targetSlot: {
            day: occupiedSlot.day,
            date: occupiedSlot.date,
            startTime: occupiedSlot.startTime,
            endTime: occupiedSlot.endTime,
            subject: occupiedSlot.subject,
            user: occupiedUserId
         },
         desiredDay: targetDay,
         desiredTime: finalNewStartTime,
         message: `${memberData.user.firstName}님이 ${targetDay} ${finalNewStartTime}로 시간 변경을 요청했습니다.`,
         status: 'pending',
         createdAt: new Date()
      };

      room.requests.push(exchangeRequest);
      await room.save();

      await room.populate('requests.requester', 'firstName lastName email');
      await room.populate('requests.targetUser', 'firstName lastName email');

      const createdRequest = room.requests[room.requests.length - 1];

      console.log('✅ Exchange request created:', createdRequest._id);

      res.json({
         success: true,
         message: `${targetDay} ${finalNewStartTime}는 ${occupiedSlot.user.firstName}님이 사용 중입니다. 조정 요청을 전송했습니다.`,
         immediateSwap: false,
         needsApproval: true,
         targetDay,
         targetTime: finalNewStartTime,
         occupiedBy: occupiedSlot.user.firstName + ' ' + occupiedSlot.user.lastName,
         requestId: createdRequest._id
      });

   } catch (error) {
      console.error('Smart exchange error:', error);
      res.status(500).json({
         success: false,
         message: '서버 오류가 발생했습니다.',
         details: error.message
      });
   }
};
