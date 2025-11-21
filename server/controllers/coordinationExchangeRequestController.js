const Room = require('../models/Room');

// Helper: 시간 계산 함수들
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
 * Find alternative slot for user B when they accept exchange
 */
async function findAlternativeSlotForUser(room, userId, requiredHours, excludeDate, slotsToIgnore = []) {
   console.log(`\n🔍 ========== Finding alternative slot for user ${userId} ==========`);
   console.log(`📋 Required: ${requiredHours}h, Excluding date: ${excludeDate}`);
   console.log(`📦 Slots to ignore (${slotsToIgnore.length}):`, slotsToIgnore.map(s => ({
      day: s.day,
      date: new Date(s.date).toISOString().split('T')[0],
      time: `${s.startTime}-${s.endTime}`,
      user: s.user
   })));

   // Get user's member data
   const memberData = room.members.find(m =>
      (m.user._id || m.user).toString() === userId.toString()
   );

   if (!memberData || !memberData.user.defaultSchedule) {
      console.log('❌ No member data or default schedule found');
      return null;
   }

   const userSchedule = memberData.user.defaultSchedule;
   const excludeDateStr = new Date(excludeDate).toISOString().split('T')[0];

   // 🔧 방장의 선호시간도 가져오기
   const ownerSchedule = room.owner?.defaultSchedule || [];
   console.log(`👑 Owner schedule:`, ownerSchedule.map(s => ({
      day: s.dayOfWeek,
      time: `${s.startTime}-${s.endTime}`,
      priority: s.priority
   })));

   console.log(`📅 User schedule:`, userSchedule.map(s => ({
      day: s.dayOfWeek,
      time: `${s.startTime}-${s.endTime}`,
      priority: s.priority
   })));

   // Log all current time slots in the room
   console.log(`\n📊 Current room timeSlots (total: ${room.timeSlots.length}):`);
   const groupedSlots = {};
   room.timeSlots.forEach(slot => {
      const dateKey = new Date(slot.date).toISOString().split('T')[0];
      if (!groupedSlots[dateKey]) groupedSlots[dateKey] = [];
      const slotUserId = (slot.user._id || slot.user).toString();
      const slotUserName = slot.user?.firstName || 'Unknown';
      groupedSlots[dateKey].push({
         time: `${slot.startTime}-${slot.endTime}`,
         user: `${slotUserName} (${slotUserId.substring(0, 8)}...)`,
         day: slot.day
      });
   });
   Object.keys(groupedSlots).sort().forEach(date => {
      console.log(`   ${date}:`, groupedSlots[date]);
   });

   // Get current week's Monday
   const now = new Date();
   const day = now.getUTCDay();
   const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1);
   const monday = new Date(now);
   monday.setUTCDate(diff);
   monday.setUTCHours(0, 0, 0, 0);

   // Check each day of the week
   const dayMap = { 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday' };
   const requiredSlots = Math.ceil(requiredHours * 2); // 30분 단위

   // 시간적으로 가까운 순서로 요일 체크 (선호시간만 포함)
   const excludedDate = new Date(excludeDate);

   // 사용자의 선호시간 요일들만 추출 (우선순위 2 이상)
   const preferredDays = [...new Set(userSchedule
      .filter(s => s.priority >= 2)
      .map(s => s.dayOfWeek)
   )].sort((a, b) => a - b);

   // 현재 날짜 기준으로 선호 요일들을 가까운 순서로 정렬
   const daysToCheck = [];
   const today = new Date();
   const currentDayOfWeek = today.getUTCDay() === 0 ? 7 : today.getUTCDay();

   // 이번 주와 다음 주의 선호 요일들을 수집
   const candidates = [];
   for (const dayOfWeek of preferredDays) {
      // 이번 주
      let daysUntil = dayOfWeek - currentDayOfWeek;
      if (daysUntil >= 0) {
         candidates.push({ dayOfWeek, daysUntil });
      }
      // 다음 주
      candidates.push({ dayOfWeek, daysUntil: daysUntil + 7 });
   }

   // 가까운 순서대로 정렬하고 요일만 추출
   candidates.sort((a, b) => a.daysUntil - b.daysUntil);
   for (const candidate of candidates) {
      if (!daysToCheck.includes(candidate.dayOfWeek)) {
         daysToCheck.push(candidate.dayOfWeek);
      }
   }

   console.log(`📅 선호시간 요일들을 시간적으로 가까운 순서로 체크:`, daysToCheck.map(d => dayMap[d]));
   console.log(`📅 선호 요일 숫자:`, daysToCheck);
   console.log(`📅 현재 요일: ${currentDayOfWeek} (${dayMap[currentDayOfWeek]})`);

   for (const dayOfWeek of daysToCheck) {
      console.log(`\n➡️  Checking ${dayMap[dayOfWeek]} (dayOfWeek=${dayOfWeek})...`);
      const dayPreferences = userSchedule.filter(s =>
         s.dayOfWeek === dayOfWeek && s.priority >= 2
      );

      if (dayPreferences.length === 0) continue;

      // Calculate date for this day
      const targetDate = new Date(monday);
      targetDate.setUTCDate(monday.getUTCDate() + dayOfWeek - 1);
      const targetDateStr = targetDate.toISOString().split('T')[0];

      // 🔧 방장의 해당 요일 선호시간 확인
      const ownerDayPreferences = ownerSchedule.filter(s => {
         // specificDate가 있으면 그 날짜에만 적용
         if (s.specificDate) {
            return s.specificDate === targetDateStr;
         }
         return s.dayOfWeek === dayOfWeek;
      });

      if (ownerDayPreferences.length === 0) {
         console.log(`   ⚠️ 방장의 ${dayMap[dayOfWeek]} 선호시간 없음 - 스킵`);
         continue;
      }

      console.log(`   👑 방장의 ${dayMap[dayOfWeek]} 선호시간:`, ownerDayPreferences.map(s => `${s.startTime}-${s.endTime}`));

      // Merge continuous time blocks (including overlapping and nearby blocks)
      const sortedPrefs = dayPreferences.sort((a, b) =>
         a.startTime.localeCompare(b.startTime)
      );

      const mergedBlocks = [];
      for (const pref of sortedPrefs) {
         if (mergedBlocks.length === 0) {
            mergedBlocks.push({ startTime: pref.startTime, endTime: pref.endTime });
         } else {
            const lastBlock = mergedBlocks[mergedBlocks.length - 1];

            // Calculate time difference between last block end and current pref start
            const [lastH, lastM] = lastBlock.endTime.split(':').map(Number);
            const [prefH, prefM] = pref.startTime.split(':').map(Number);
            const [prefEndH, prefEndM] = pref.endTime.split(':').map(Number);

            const lastBlockEndMinutes = lastH * 60 + lastM;
            const prefStartMinutes = prefH * 60 + prefM;
            const prefEndMinutes = prefEndH * 60 + prefEndM;
            const gapMinutes = prefStartMinutes - lastBlockEndMinutes;

            // Merge if blocks are connected, overlapping, or within 30 minutes of each other
            if (gapMinutes <= 30) {
               // Extend the last block to include this preference
               const [currentEndH, currentEndM] = lastBlock.endTime.split(':').map(Number);
               const currentEndMinutes = currentEndH * 60 + currentEndM;

               if (prefEndMinutes > currentEndMinutes) {
                  lastBlock.endTime = pref.endTime;
               }
            } else {
               mergedBlocks.push({ startTime: pref.startTime, endTime: pref.endTime });
            }
         }
      }

      console.log(`   📊 ${dayMap[dayOfWeek]} merged blocks:`, mergedBlocks);

      // 🔧 방장의 선호시간과 겹치는 블록만 필터링
      const ownerFilteredBlocks = [];
      for (const block of mergedBlocks) {
         const [blockStartH, blockStartM] = block.startTime.split(':').map(Number);
         const [blockEndH, blockEndM] = block.endTime.split(':').map(Number);
         const blockStartMin = blockStartH * 60 + blockStartM;
         const blockEndMin = blockEndH * 60 + blockEndM;

         for (const ownerPref of ownerDayPreferences) {
            const [ownerStartH, ownerStartM] = ownerPref.startTime.split(':').map(Number);
            const [ownerEndH, ownerEndM] = ownerPref.endTime.split(':').map(Number);
            const ownerStartMin = ownerStartH * 60 + ownerStartM;
            const ownerEndMin = ownerEndH * 60 + ownerEndM;

            // 겹치는 구간 계산
            const overlapStart = Math.max(blockStartMin, ownerStartMin);
            const overlapEnd = Math.min(blockEndMin, ownerEndMin);

            if (overlapStart < overlapEnd) {
               const overlapStartTime = `${Math.floor(overlapStart / 60).toString().padStart(2, '0')}:${(overlapStart % 60).toString().padStart(2, '0')}`;
               const overlapEndTime = `${Math.floor(overlapEnd / 60).toString().padStart(2, '0')}:${(overlapEnd % 60).toString().padStart(2, '0')}`;
               ownerFilteredBlocks.push({ startTime: overlapStartTime, endTime: overlapEndTime });
            }
         }
      }

      console.log(`   👑 방장 시간과 겹치는 블록:`, ownerFilteredBlocks);

      if (ownerFilteredBlocks.length === 0) {
         console.log(`   ⚠️ 방장의 선호시간과 겹치는 시간 없음 - 스킵`);
         continue;
      }

      // Check each merged block (방장 시간과 겹치는 것만)
      for (const block of ownerFilteredBlocks) {
         console.log(`   🔎 Checking block ${block.startTime}-${block.endTime}...`);
         const blockHours = getHoursDifference(block.startTime, block.endTime);

         if (blockHours < requiredHours) {
            console.log(`  ⏭️ Block ${block.startTime}-${block.endTime} too small (${blockHours}h < ${requiredHours}h)`);
            continue;
         }

         // Check if this block is already occupied
         const [startH, startM] = block.startTime.split(':').map(Number);
         const [endH, endM] = block.endTime.split(':').map(Number);
         const startMinutes = startH * 60 + startM;
         const endMinutes = endH * 60 + endM;

         let isOccupied = false;
         console.log(`   ⏰ Checking 30-min slots from ${block.startTime} to ${addHours(block.startTime, requiredHours)}...`);
         for (let currentMinutes = startMinutes; currentMinutes < endMinutes; currentMinutes += 30) {
            const slotStart = `${Math.floor(currentMinutes/60).toString().padStart(2,'0')}:${(currentMinutes%60).toString().padStart(2,'0')}`;
            const slotEnd = addHours(slotStart, 0.5);

            const occupied = room.timeSlots.some(slot => {
               const slotDate = new Date(slot.date).toISOString().split('T')[0];
               const isMatchingSlot = slotDate === targetDateStr &&
                      slot.startTime === slotStart &&
                      slot.endTime === slotEnd;

               if (!isMatchingSlot) return false;

               // Get the user ID of this slot
               const slotUserId = (slot.user._id || slot.user).toString();
               const slotUserName = slot.user?.firstName || 'Unknown';

               // Check if this slot is one of the slots being freed by requester
               const isBeingFreed = slotsToIgnore.some(ignoreSlot => {
                  const ignoreDate = new Date(ignoreSlot.date).toISOString().split('T')[0];
                  const ignoreUserId = (ignoreSlot.user._id || ignoreSlot.user)?.toString();
                  const match = ignoreDate === slotDate &&
                         ignoreSlot.startTime === slot.startTime &&
                         ignoreSlot.endTime === slot.endTime &&
                         ignoreUserId === slotUserId; // 사용자도 일치해야 함
                  return match;
               });

               if (!isBeingFreed) {
                  console.log(`      ⚠️  Slot ${slotStart}-${slotEnd} is OCCUPIED by ${slotUserName} (${slotUserId.substring(0, 8)}...)`);
               } else {
                  console.log(`      ✓ Slot ${slotStart}-${slotEnd} will be freed (ignoring)`);
               }

               return !isBeingFreed; // Only consider occupied if NOT being freed
            });

            if (occupied) {
               console.log(`      ❌ Block is occupied at ${slotStart}-${slotEnd}`);
               isOccupied = true;
               break;
            } else {
               console.log(`      ✓ Slot ${slotStart}-${slotEnd} is available`);
            }
         }

         if (!isOccupied) {
            // Found a suitable slot!
            const endTime = addHours(block.startTime, requiredHours);
            console.log(`\n✅ ========== FOUND ALTERNATIVE SLOT ==========`);
            console.log(`📅 Day: ${dayMap[dayOfWeek]} (${targetDateStr})`);
            console.log(`⏰ Time: ${block.startTime}-${endTime}`);
            console.log(`⏱️  Duration: ${requiredHours}h`);
            console.log(`✅ ============================================\n`);

            return {
               day: dayMap[dayOfWeek],
               dayOfWeek,
               date: targetDate,
               startTime: block.startTime,
               endTime: endTime,
               requiredHours
            };
         } else {
            console.log(`   ❌ Block ${block.startTime}-${block.endTime} is occupied, skipping...`);
         }
      }
   }

   console.log(`\n❌ ========== NO ALTERNATIVE SLOT FOUND ==========`);
   console.log(`📋 Checked all preferred days:`, daysToCheck.map(d => dayMap[d]));
   console.log(`⚠️  All slots in preferred times are occupied or too small`);
   console.log(`❌ ================================================\n`);
   return null;
}

/**
 * Create exchange request (A → B)
 * POST /api/coordination/rooms/:roomId/exchange-requests
 */
exports.createExchangeRequest = async (req, res) => {
   try {
      const { roomId } = req.params;
      const { targetUserId, targetDay, targetTime, requesterSlotIds } = req.body;

      console.log('🔔 Creating exchange request:', {
         roomId,
         requesterId: req.user.id,
         targetUserId,
         targetDay,
         targetTime,
         requesterSlotIds
      });

      const room = await Room.findById(roomId)
         .populate('members.user', 'firstName lastName email defaultSchedule')
         .populate('timeSlots.user', '_id firstName lastName email')
         .populate('requests.requester', 'firstName lastName email')
         .populate('requests.targetUser', 'firstName lastName email');

      if (!room) {
         return res.status(404).json({ success: false, message: '방을 찾을 수 없습니다.' });
      }

      // Verify requester is a member
      const requesterMember = room.members.find(m =>
         (m.user._id || m.user).toString() === req.user.id.toString()
      );
      if (!requesterMember) {
         return res.status(403).json({ success: false, message: '방 멤버만 요청할 수 있습니다.' });
      }

      // Verify target user is a member
      const targetMember = room.members.find(m =>
         (m.user._id || m.user).toString() === targetUserId.toString()
      );
      if (!targetMember) {
         return res.status(404).json({ success: false, message: '대상 사용자를 찾을 수 없습니다.' });
      }

      // Get requester's slots
      const requesterSlots = room.timeSlots.filter(slot =>
         requesterSlotIds.includes(slot._id.toString())
      );

      if (requesterSlots.length === 0) {
         return res.status(400).json({ success: false, message: '이동할 슬롯을 찾을 수 없습니다.' });
      }

      // Get target slot (B's slot)
      const dayMap = {
         '월요일': 'monday',
         '화요일': 'tuesday',
         '수요일': 'wednesday',
         '목요일': 'thursday',
         '금요일': 'friday'
      };
      const targetDayEnglish = dayMap[targetDay];

      const now = new Date();
      const day = now.getUTCDay();
      const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now);
      monday.setUTCDate(diff);
      monday.setUTCHours(0, 0, 0, 0);

      const dayNumbers = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5 };
      const targetDayNumber = dayNumbers[targetDayEnglish];
      const targetDate = new Date(monday);
      targetDate.setUTCDate(monday.getUTCDate() + targetDayNumber - 1);
      const targetDateStr = targetDate.toISOString().split('T')[0];

      const targetSlot = room.timeSlots.find(slot => {
         const slotDate = new Date(slot.date).toISOString().split('T')[0];
         const slotUserId = (slot.user._id || slot.user).toString();
         return slotDate === targetDateStr &&
                slotUserId === targetUserId.toString() &&
                (!targetTime || slot.startTime === targetTime);
      });

      if (!targetSlot) {
         return res.status(404).json({
            success: false,
            message: '대상 슬롯을 찾을 수 없습니다.'
         });
      }

      // Create exchange request
      const exchangeRequest = {
         requester: req.user.id,
         type: 'exchange_request',
         targetUser: targetUserId,
         requesterSlots: requesterSlots.map(s => ({
            day: s.day,
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            subject: s.subject,
            user: s.user._id || s.user
         })),
         targetSlot: {
            day: targetSlot.day,
            date: targetSlot.date,
            startTime: targetSlot.startTime,
            endTime: targetSlot.endTime,
            subject: targetSlot.subject,
            user: targetSlot.user._id || targetSlot.user
         },
         desiredDay: targetDay,
         desiredTime: targetTime,
         message: `${requesterMember.user.firstName}님이 ${targetDay}${targetTime ? ` ${targetTime}` : ''}로 시간 변경을 요청했습니다.`,
         status: 'pending',
         createdAt: new Date()
      };

      room.requests.push(exchangeRequest);
      await room.save();

      // Populate the request
      await room.populate('requests.requester', 'firstName lastName email');
      await room.populate('requests.targetUser', 'firstName lastName email');

      const createdRequest = room.requests[room.requests.length - 1];

      console.log('✅ Exchange request created:', createdRequest._id);

      res.json({
         success: true,
         message: `${targetMember.user.firstName}님에게 요청을 전송했습니다.`,
         request: createdRequest
      });

   } catch (error) {
      console.error('Create exchange request error:', error);
      res.status(500).json({
         success: false,
         message: '서버 오류가 발생했습니다.',
         details: error.message
      });
   }
};

/**
 * Respond to exchange request (B's response)
 * POST /api/coordination/rooms/:roomId/exchange-requests/:requestId/respond
 */
exports.respondToExchangeRequest = async (req, res) => {
   try {
      const { roomId, requestId } = req.params;
      const { action } = req.body; // 'accept' or 'reject'

      console.log('💬 Responding to exchange request:', {
         roomId,
         requestId,
         responderId: req.user.id,
         action
      });

      const room = await Room.findById(roomId)
         .populate('owner', 'firstName lastName email defaultSchedule')
         .populate('members.user', 'firstName lastName email defaultSchedule')
         .populate('timeSlots.user', '_id firstName lastName email')
         .populate('requests.requester', 'firstName lastName email')
         .populate('requests.targetUser', 'firstName lastName email');

      if (!room) {
         return res.status(404).json({ success: false, message: '방을 찾을 수 없습니다.' });
      }

      const request = room.requests.id(requestId);
      if (!request) {
         return res.status(404).json({ success: false, message: '요청을 찾을 수 없습니다.' });
      }

      // Verify responder is the target user
      const targetUserId = (request.targetUser._id || request.targetUser).toString();
      if (targetUserId !== req.user.id.toString()) {
         return res.status(403).json({
            success: false,
            message: '이 요청에 응답할 권한이 없습니다.'
         });
      }

      if (request.status !== 'pending') {
         return res.status(400).json({
            success: false,
            message: '이미 처리된 요청입니다.'
         });
      }

      if (action === 'reject') {
         // Simple rejection
         request.status = 'rejected';
         request.respondedAt = new Date();
         request.respondedBy = req.user.id;
         request.response = '거절되었습니다.';

         await room.save();

         console.log('❌ Exchange request rejected');

         return res.json({
            success: true,
            message: '요청을 거절했습니다.',
            request
         });
      }

      if (action === 'accept') {
         console.log('✅ Processing exchange acceptance...');
         console.log('📋 Request data:', {
            requestId: request._id,
            requester: request.requester,
            targetUser: request.targetUser,
            targetSlot: request.targetSlot,
            requesterSlots: request.requesterSlots
         });

         // Calculate required hours from requester's slots
         const requesterSlots = request.requesterSlots;
         const firstSlot = requesterSlots[0];
         const lastSlot = requesterSlots[requesterSlots.length - 1];
         const requiredHours = getHoursDifference(firstSlot.startTime, lastSlot.endTime);

         console.log(`⏱️ Required hours: ${requiredHours}h (${requesterSlots.length} slots)`);

         // Find alternative slot for A (target user), ignoring B's slots that will be freed
         const targetSlotDate = request.targetSlot.date;
         const alternativeSlot = await findAlternativeSlotForUser(
            room,
            targetUserId,
            requiredHours,
            targetSlotDate,
            requesterSlots  // B's slots that will be freed
         );

         if (!alternativeSlot) {
            return res.status(400).json({
               success: false,
               message: '대체 가능한 시간을 찾을 수 없습니다. 다른 요일에 가능한 시간이 없습니다.'
            });
         }

         console.log('🔄 Executing exchange...');
         console.log('📊 Before exchange - Total timeSlots:', room.timeSlots.length);

         // Step 1: Remove requester's current slots (B's slots)
         console.log('🗑️ Attempting to remove requester slots by matching date/time/user:');
         console.log('   Requester slots to remove:', requesterSlots.map(s => ({
            day: s.day,
            date: s.date,
            time: `${s.startTime}-${s.endTime}`,
            user: s.user
         })));
         const beforeLength = room.timeSlots.length;

         for (const reqSlot of requesterSlots) {
            const index = room.timeSlots.findIndex(slot => {
               const slotDate = new Date(slot.date).toISOString().split('T')[0];
               const reqDate = new Date(reqSlot.date).toISOString().split('T')[0];
               const slotUserId = (slot.user._id || slot.user).toString();
               const reqUserId = (reqSlot.user._id || reqSlot.user).toString();
               return slotDate === reqDate &&
                      slot.startTime === reqSlot.startTime &&
                      slot.endTime === reqSlot.endTime &&
                      slotUserId === reqUserId;
            });
            if (index !== -1) {
               console.log(`  ✓ Removing slot at index ${index}: ${reqSlot.day} ${reqSlot.startTime}-${reqSlot.endTime}`);
               room.timeSlots.splice(index, 1);
            } else {
               console.log(`  ⚠️ Slot not found: ${reqSlot.day} ${reqSlot.startTime}-${reqSlot.endTime}`);
            }
         }

         console.log(`🗑️ Removed ${beforeLength - room.timeSlots.length} requester slots (expected ${requesterSlots.length})`);

         // Step 2: Remove A's target slots (same number as B is giving up)
         console.log(`🗑️ Removing A's slots: ${requesterSlots.length} slots starting from ${request.targetSlot.day} ${request.targetSlot.startTime}`);

         let removedTargetCount = 0;
         for (let i = 0; i < requesterSlots.length; i++) {
            const currentStartTime = addHours(request.targetSlot.startTime, i * 0.5);
            const currentEndTime = addHours(currentStartTime, 0.5);

            const index = room.timeSlots.findIndex(slot => {
               const slotDate = new Date(slot.date).toISOString().split('T')[0];
               const targetDate = new Date(request.targetSlot.date).toISOString().split('T')[0];
               const slotUserId = (slot.user._id || slot.user).toString();
               const targetUserId = (request.targetSlot.user._id || request.targetSlot.user).toString();
               return slotDate === targetDate &&
                      slot.startTime === currentStartTime &&
                      slot.endTime === currentEndTime &&
                      slotUserId === targetUserId;
            });

            if (index !== -1) {
               console.log(`  ✓ Removing A's slot at index ${index}: ${request.targetSlot.day} ${currentStartTime}-${currentEndTime}`);
               room.timeSlots.splice(index, 1);
               removedTargetCount++;
            } else {
               console.log(`  ⚠️ A's slot not found: ${request.targetSlot.day} ${currentStartTime}-${currentEndTime}`);
            }
         }

         console.log(`🗑️ Removed ${removedTargetCount} of A's slots (expected ${requesterSlots.length})`);

         // Step 3: Move A (targetUser) to alternative slot
         const alternativeSlots = [];
         let currentTime = alternativeSlot.startTime;

         for (let i = 0; i < requesterSlots.length; i++) {
            const slotEnd = addHours(currentTime, 0.5);
            alternativeSlots.push({
               user: targetUserId,
               date: alternativeSlot.date,
               startTime: currentTime,
               endTime: slotEnd,
               day: alternativeSlot.day,
               subject: '교환 결과',
               status: 'confirmed',
               assignedBy: req.user.id,
               assignedAt: new Date()
            });
            currentTime = slotEnd;
         }

         room.timeSlots.push(...alternativeSlots);
         console.log(`➕ Added ${alternativeSlots.length} slots for A (targetUser) at ${alternativeSlot.day} ${alternativeSlot.startTime}`);
         console.log('  Alternative slots:', alternativeSlots.map(s => `${s.day} ${s.startTime}-${s.endTime}`));

         // Step 4: Move B (requester) to target slot (A's original position)
         const requesterId = (request.requester._id || request.requester).toString();
         console.log(`➕ Creating ${requesterSlots.length} slots for B (requester) at target location...`);
         const newRequesterSlots = [];
         let requesterCurrentTime = request.targetSlot.startTime;

         for (let i = 0; i < requesterSlots.length; i++) {
            const slotEnd = addHours(requesterCurrentTime, 0.5);
            newRequesterSlots.push({
               user: requesterId,
               date: request.targetSlot.date,
               startTime: requesterCurrentTime,
               endTime: slotEnd,
               day: request.targetSlot.day,
               subject: '교환 결과',
               status: 'confirmed',
               assignedBy: req.user.id,
               assignedAt: new Date()
            });
            requesterCurrentTime = slotEnd;
         }

         room.timeSlots.push(...newRequesterSlots);
         console.log(`➕ Added ${newRequesterSlots.length} slots for B (requester) at ${request.targetSlot.day} ${request.targetSlot.startTime}`);
         console.log('  New requester slots:', newRequesterSlots.map(s => `${s.day} ${s.startTime}-${s.endTime}`));

         // Step 5: Update request status
         request.status = 'approved';
         request.respondedAt = new Date();
         request.respondedBy = req.user.id;
         request.response = `수락되었습니다. ${alternativeSlot.day} ${alternativeSlot.startTime}로 이동합니다.`;

         console.log('📊 After exchange - Total timeSlots:', room.timeSlots.length);
         console.log('💾 Saving room changes...');

         room.markModified('timeSlots');
         await room.save();
         await room.populate('timeSlots.user', '_id firstName lastName email');

         console.log('✅ Exchange completed successfully!');
         console.log('📊 Final timeSlots count:', room.timeSlots.length);

         return res.json({
            success: true,
            message: `요청을 수락했습니다. 당신은 ${alternativeSlot.day} ${alternativeSlot.startTime}로 이동합니다.`,
            request,
            alternativeSlot: {
               day: alternativeSlot.day,
               startTime: alternativeSlot.startTime,
               endTime: alternativeSlot.endTime
            }
         });
      }

   } catch (error) {
      console.error('Respond to exchange request error:', error);
      res.status(500).json({
         success: false,
         message: '서버 오류가 발생했습니다.',
         details: error.message
      });
   }
};

/**
 * Get pending exchange requests for user
 * GET /api/coordination/exchange-requests/pending
 */
exports.getPendingExchangeRequests = async (req, res) => {
   try {
      const userId = req.user.id;

      const rooms = await Room.find({
         'members.user': userId,
         'requests.type': 'exchange_request',
         'requests.status': 'pending'
      })
      .populate('requests.requester', 'firstName lastName email')
      .populate('requests.targetUser', 'firstName lastName email');

      const pendingRequests = [];

      for (const room of rooms) {
         const userRequests = room.requests.filter(req =>
            req.type === 'exchange_request' &&
            req.status === 'pending' &&
            (req.targetUser._id || req.targetUser).toString() === userId
         );

         for (const request of userRequests) {
            pendingRequests.push({
               ...request.toObject(),
               roomId: room._id,
               roomName: room.name
            });
         }
      }

      res.json({
         success: true,
         requests: pendingRequests,
         count: pendingRequests.length
      });

   } catch (error) {
      console.error('Get pending exchange requests error:', error);
      res.status(500).json({
         success: false,
         message: '서버 오류가 발생했습니다.',
         details: error.message
      });
   }
};

module.exports = {
   createExchangeRequest: exports.createExchangeRequest,
   respondToExchangeRequest: exports.respondToExchangeRequest,
   getPendingExchangeRequests: exports.getPendingExchangeRequests
};
