const Room = require('../models/room');
const { recalculateMultipleDates } = require('../services/scheduleRecalculator');

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
 * Find chain candidates (C users) who occupy B's preferred time slots
 * 4.txt: B의 선호시간을 차지한 사람들 중 오늘 이후 가장 가까운 날짜에 있는 사람부터 찾기
 */
function findChainCandidates(room, userId, excludeUsers = []) {

   // Get user's member data (B)
   const memberData = room.members.find(m =>
      (m.user._id || m.user).toString() === userId.toString()
   );

   if (!memberData || (!memberData.user.defaultSchedule && !memberData.user.scheduleExceptions)) {
      return [];
   }

   // ✅ Include both defaultSchedule AND scheduleExceptions
   const userSchedule = [
      ...(memberData.user.defaultSchedule || []),
      ...(memberData.user.scheduleExceptions || [])
   ];
   const today = new Date();
   today.setUTCHours(0, 0, 0, 0);

   // Get user's preferred days (priority >= 2)
   const preferredSlots = userSchedule.filter(s => s.priority >= 2);

   // 현재 주의 월요일 계산
   const now = new Date();
   const day = now.getUTCDay();
   const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1);
   const monday = new Date(now);
   monday.setUTCDate(diff);
   monday.setUTCHours(0, 0, 0, 0);

   const dayMap = { 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday' };

   // B의 선호시간을 차지한 사람들 찾기
   const candidates = [];

   for (const pref of preferredSlots) {
      // Calculate date for this preference
      const targetDate = new Date(monday);
      targetDate.setUTCDate(monday.getUTCDate() + pref.dayOfWeek - 1);
      const targetDateStr = targetDate.toISOString().split('T')[0];

      // ★ 이번 주 전체(월~일) 포함 - 날짜 체크 제거

      // 해당 날짜/시간에 배정된 슬롯 찾기
      const occupyingSlots = room.timeSlots.filter(slot => {
         const slotDate = new Date(slot.date).toISOString().split('T')[0];
         const slotUserId = (slot.user._id || slot.user).toString();

         // 자기 자신이거나 제외 대상이면 제외
         if (slotUserId === userId.toString()) return false;
         if (excludeUsers.some(u => u.toString() === slotUserId)) return false;

         // 날짜 일치
         if (slotDate !== targetDateStr) return false;

         // 시간이 겹치는지 확인
         const [prefStartH, prefStartM] = pref.startTime.split(':').map(Number);
         const [prefEndH, prefEndM] = pref.endTime.split(':').map(Number);
         const [slotStartH, slotStartM] = slot.startTime.split(':').map(Number);
         const [slotEndH, slotEndM] = slot.endTime.split(':').map(Number);

         const prefStartMin = prefStartH * 60 + prefStartM;
         const prefEndMin = prefEndH * 60 + prefEndM;
         const slotStartMin = slotStartH * 60 + slotStartM;
         const slotEndMin = slotEndH * 60 + slotEndM;

         // 시간 겹침 확인
         return (slotStartMin < prefEndMin && slotEndMin > prefStartMin);
      });

      for (const slot of occupyingSlots) {
         const slotUserId = (slot.user._id || slot.user).toString();

         // 이미 후보에 있는 사용자인지 확인
         const existingCandidate = candidates.find(c =>
            c.userId === slotUserId &&
            new Date(c.slot.date).toISOString().split('T')[0] === targetDateStr
         );

         if (!existingCandidate) {
            const userName = slot.user?.firstName && slot.user?.lastName
               ? `${slot.user.firstName} ${slot.user.lastName}`
               : slot.user?.firstName || slot.user?.lastName || '알수없음';
            candidates.push({
               userId: slotUserId,
               userName: userName,
               slot: slot,
               date: targetDate,
               daysDiff: Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24))
            });
         }
      }
   }

   // 오늘 이후 가장 가까운 날짜 순으로 정렬
   candidates.sort((a, b) => a.daysDiff - b.daysDiff);
   return candidates;
}

/**
 * Find alternative slot for user B when they accept exchange
 */
async function findAlternativeSlotForUser(room, userId, requiredHours, excludeDate, slotsToIgnore = []) {

   // Get user's member data
   const memberData = room.members.find(m =>
      (m.user._id || m.user).toString() === userId.toString()
   );

   if (!memberData || !memberData.user.defaultSchedule) {
      return null;
   }

   const userSchedule = memberData.user.defaultSchedule;
   const excludeDateStr = new Date(excludeDate).toISOString().split('T')[0];

   // 🔧 방장의 선호시간도 가져오기
   const ownerSchedule = room.owner?.defaultSchedule || [];


   // Log all current time slots in the room
   const groupedSlots = {};
   room.timeSlots.forEach(slot => {
      const dateKey = new Date(slot.date).toISOString().split('T')[0];
      if (!groupedSlots[dateKey]) groupedSlots[dateKey] = [];
      const slotUserId = (slot.user._id || slot.user).toString();
      const slotUserName = slot.user?.firstName && slot.user?.lastName
         ? `${slot.user.firstName} ${slot.user.lastName}`
         : slot.user?.firstName || slot.user?.lastName || '알수없음';
      groupedSlots[dateKey].push({
         time: `${slot.startTime}-${slot.endTime}`,
         user: `${slotUserName} (${slotUserId.substring(0, 8)}...)`,
         day: slot.day
      });
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

   // 사용자의 가능한 모든 요일 추출 (우선순위 무관)
   const preferredDays = [...new Set(userSchedule
      .map(s => s.dayOfWeek)
   )].sort((a, b) => a - b);

   // 🆕 개선: 같은 날짜 내 빈 시간 우선 체크 (불필요한 날짜 이동 방지)
   const daysToCheck = [];
   const today = new Date();
   const currentDayOfWeek = today.getUTCDay() === 0 ? 7 : today.getUTCDay();

   // excludeDate의 요일 계산
   const excludedDayOfWeek = excludedDate.getUTCDay() === 0 ? 7 : excludedDate.getUTCDay();

   // 1순위: excludeDate와 같은 요일을 먼저 체크 (같은 날짜 내 재배정 우선)
   if (preferredDays.includes(excludedDayOfWeek)) {
      daysToCheck.push(excludedDayOfWeek);
   }

   // 2순위: 나머지 선호 요일들을 시간적으로 가까운 순서로 정렬
   const candidates = [];
   for (const dayOfWeek of preferredDays) {
      // 이미 daysToCheck에 있으면 건너뛰기
      if (daysToCheck.includes(dayOfWeek)) continue;

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
   for (const dayOfWeek of daysToCheck) {
      const dayPreferences = userSchedule.filter(s =>
         s.dayOfWeek === dayOfWeek  // 우선순위 필터 제거 - 모든 가능시간 체크
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
         continue;
      }

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


      // 🔧 방장의 선호시간과 겹치는 블록만 필터링
      const ownerFilteredBlocksRaw = [];
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
               ownerFilteredBlocksRaw.push({ startTime: overlapStartTime, endTime: overlapEndTime });
            }
         }
      }

      // 🆕 겹치는 블록들을 다시 병합 (10분 단위로 쪼개진 것을 하나로 합침)
      const ownerFilteredBlocks = [];
      for (const block of ownerFilteredBlocksRaw) {
         if (ownerFilteredBlocks.length === 0) {
            ownerFilteredBlocks.push({ ...block });
         } else {
            const lastBlock = ownerFilteredBlocks[ownerFilteredBlocks.length - 1];
            const [lastH, lastM] = lastBlock.endTime.split(':').map(Number);
            const [currH, currM] = block.startTime.split(':').map(Number);

            const lastEndMinutes = lastH * 60 + lastM;
            const currStartMinutes = currH * 60 + currM;

            // 연속되거나 30분 이내 간격이면 병합
            if (currStartMinutes - lastEndMinutes <= 30) {
               const [blockEndH, blockEndM] = block.endTime.split(':').map(Number);
               const [lastBlockEndH, lastBlockEndM] = lastBlock.endTime.split(':').map(Number);

               if (blockEndH * 60 + blockEndM > lastBlockEndH * 60 + lastBlockEndM) {
                  lastBlock.endTime = block.endTime;
               }
            } else {
               ownerFilteredBlocks.push({ ...block });
            }
         }
      }

      if (ownerFilteredBlocks.length === 0) {
         continue;
      }

      // Check each merged block (방장 시간과 겹치는 것만)
      for (const block of ownerFilteredBlocks) {
         const blockHours = getHoursDifference(block.startTime, block.endTime);

         if (blockHours < requiredHours) {
            continue;
         }

         // Check if this block is already occupied
         const [startH, startM] = block.startTime.split(':').map(Number);
         const [endH, endM] = block.endTime.split(':').map(Number);
         const startMinutes = startH * 60 + startM;
         const endMinutes = endH * 60 + endM;

         let isOccupied = false;
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
               const slotUserName = slot.user?.firstName && slot.user?.lastName
                  ? `${slot.user.firstName} ${slot.user.lastName}`
                  : slot.user?.firstName || slot.user?.lastName || '알수없음';

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

               return !isBeingFreed; // Only consider occupied if NOT being freed
            });
         }

         if (!isOccupied) {
            // Found a suitable slot!
            const endTime = addHours(block.startTime, requiredHours);

            return {
               day: dayMap[dayOfWeek],
               dayOfWeek,
               date: targetDate,
               startTime: block.startTime,
               endTime: endTime,
               requiredHours
            };
         } else {
         }
      }
   }
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


      const room = await Room.findById(roomId)
         .populate('members.user', 'firstName lastName email defaultSchedule scheduleExceptions')
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

      res.json({
         success: true,
         message: `${targetMember.user.firstName}님에게 요청을 전송했습니다.`,
         request: createdRequest
      });

   } catch (error) {
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


      const room = await Room.findById(roomId)
         .populate('owner', 'firstName lastName email defaultSchedule scheduleExceptions')
         .populate('members.user', 'firstName lastName email defaultSchedule scheduleExceptions')
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

         return res.json({
            success: true,
            message: '요청을 거절했습니다.',
            request
         });
      }

      if (action === 'accept') {
      

         // 🎯 Stage 1: Check if direct exchange is possible (mutual preferred time compatibility)

         // Get requester ID (will be used in both Stage 1 and Stage 2)
         const requesterId = (request.requester._id || request.requester).toString();
         const requesterMember = room.members.find(m =>
            (m.user._id || m.user).toString() === requesterId
         );
         const targetMember = room.members.find(m =>
            (m.user._id || m.user).toString() === targetUserId
         );

         if (!requesterMember || !targetMember) {
            return res.status(404).json({
               success: false,
               message: '요청자 또는 대상자를 찾을 수 없습니다.'
            });
         }

         // Get preferred schedules
         const requesterPreferredTimes = requesterMember.user.defaultSchedule || [];
         const targetPreferredTimes = targetMember.user.defaultSchedule || [];

         // Check if target's slot is in requester's preferred times
         const targetSlot = request.targetSlot;
         const targetSlotDay = targetSlot.day;
         const targetSlotStart = targetSlot.startTime;
         const targetSlotEnd = targetSlot.endTime;

         const isTargetSlotInRequesterPreferred = requesterPreferredTimes.some(pref => {
            if (pref.priority < 2) return false; // Only consider preferred times (priority >= 2)
            if (pref.dayOfWeek !== targetSlotDay) return false;
            // Check if target slot time is within preferred time range
            return pref.startTime <= targetSlotStart && pref.endTime >= targetSlotEnd;
         });

         // Get requester's slots (will be used in both Stage 1 and Stage 2)
         const requesterSlots = request.requesterSlots;

         // Check if requester's slots are all in target's preferred times
         const areRequesterSlotsInTargetPreferred = requesterSlots.every(slot => {
            return targetPreferredTimes.some(pref => {
               if (pref.priority < 2) return false;
               if (pref.dayOfWeek !== slot.day) return false;
               return pref.startTime <= slot.startTime && pref.endTime >= slot.endTime;
            });
         });

         // If both conditions are met, execute direct exchange
         if (isTargetSlotInRequesterPreferred && areRequesterSlotsInTargetPreferred) {
            // Step 1: Remove requester's current slots (C's slots)
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
                 room.timeSlots.splice(index, 1);
               }
            }
            // Step 2: Remove target's slots (D's slots)
           
            let removedTargetCount = 0;
            for (let i = 0; i < requesterSlots.length; i++) {
               const currentStartTime = addHours(targetSlot.startTime, i * 0.5);
               const currentEndTime = addHours(currentStartTime, 0.5);

               const index = room.timeSlots.findIndex(slot => {
                  const slotDate = new Date(slot.date).toISOString().split('T')[0];
                  const targetDate = new Date(targetSlot.date).toISOString().split('T')[0];
                  const slotUserId = (slot.user._id || slot.user).toString();
                  const targetUserIdStr = (targetSlot.user._id || targetSlot.user).toString();
                  return slotDate === targetDate &&
                         slot.startTime === currentStartTime &&
                         slot.endTime === currentEndTime &&
                         slotUserId === targetUserIdStr;
               });
            }

            // Step 3: Add requester to target's position (C goes to D's slot)
            const newRequesterSlots = [];
            let requesterCurrentTime = targetSlot.startTime;

            for (let i = 0; i < requesterSlots.length; i++) {
               const slotEnd = addHours(requesterCurrentTime, 0.5);
               newRequesterSlots.push({
                  user: requesterId,
                  date: targetSlot.date,
                  startTime: requesterCurrentTime,
                  endTime: slotEnd,
                  day: targetSlot.day,
                  subject: '교환 결과',
                  status: 'confirmed',
                  assignedBy: req.user.id,
                  assignedAt: new Date()
               });
               requesterCurrentTime = slotEnd;
            }

            room.timeSlots.push(...newRequesterSlots);
            // Step 4: Add target user to requester's position (D goes to C's slots)
            const newTargetSlots = [];

            for (const reqSlot of requesterSlots) {
               newTargetSlots.push({
                  user: targetUserId,
                  date: reqSlot.date,
                  startTime: reqSlot.startTime,
                  endTime: reqSlot.endTime,
                  day: reqSlot.day,
                  subject: '교환 결과',
                  status: 'confirmed',
                  assignedBy: req.user.id,
                  assignedAt: new Date()
               });
            }

            room.timeSlots.push(...newTargetSlots);
            
            // Step 5: Update request status
            request.status = 'approved';
            request.respondedAt = new Date();
            request.respondedBy = req.user.id;
            request.response = `수락되었습니다. 직접 교환이 완료되었습니다.`;

            room.markModified('timeSlots');
            await room.save();
            await room.populate('timeSlots.user', '_id firstName lastName email');

            // 🔄 교환된 슬롯의 날짜에 대해 이동시간 재계산
            const affectedDates = new Set();
            affectedDates.add(new Date(targetSlot.date));
            requesterSlots.forEach(slot => affectedDates.add(new Date(slot.date)));

            await recalculateMultipleDates(roomId, Array.from(affectedDates));
           
            return res.json({
               success: true,
               message: '요청을 수락했습니다. 직접 교환이 완료되었습니다.',
               request,
               exchangeType: 'direct',
               recalculatedDates: Array.from(affectedDates).map(d => d.toISOString().split('T')[0])
            });
         }
         // Calculate required hours from requester's slots (requesterSlots already declared above)
         const firstSlot = requesterSlots[0];
         const lastSlot = requesterSlots[requesterSlots.length - 1];
         const requiredHours = getHoursDifference(firstSlot.startTime, lastSlot.endTime);

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
            // 4.txt: B에게 빈 시간이 없을 때 연쇄 요청 시작
            
            // 원본 요청자(A)를 제외한 채로 연쇄 후보 찾기
            const originalRequesterId = (request.requester._id || request.requester).toString();
            const excludeUsers = [originalRequesterId, targetUserId]; // A와 B 제외

            const chainCandidates = findChainCandidates(room, targetUserId, excludeUsers);

            if (chainCandidates.length === 0) {
               return res.status(400).json({
                  success: false,
                  message: '대체 가능한 시간을 찾을 수 없고, 연쇄 조정할 후보도 없습니다.'
               });
            }

            // 첫 번째 후보에게 연쇄 요청 생성
            const firstCandidate = chainCandidates[0];
            
            const chainRequest = await createChainExchangeRequest(
               room,
               request,
               targetUserId, // B
               firstCandidate,
               chainCandidates
            );

            // 원본 요청 상태를 '대기 중 - 연쇄 조정'으로 업데이트
            request.status = 'pending';
            request.response = `연쇄 조정 진행 중 - ${firstCandidate.userName}님에게 요청 전송됨`;

            await room.save();

            // Populate the chain request
            await room.populate('requests.requester', 'firstName lastName email');
            await room.populate('requests.targetUser', 'firstName lastName email');

            return res.json({
               success: true,
               message: `빈 시간이 없어 ${firstCandidate.userName}님에게 연쇄 조정을 요청했습니다.`,
               chainRequest: chainRequest,
               chainCandidatesCount: chainCandidates.length
            });
         }
         // Step 1: Remove requester's current slots (B's slots)
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
               room.timeSlots.splice(index, 1);
            } else {
            }
         }
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
               room.timeSlots.splice(index, 1);
               removedTargetCount++;
            } else {
               }
         }

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
         
         // Step 4: Move B (requester) to target slot (A's original position)
         // requesterId already declared above
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
         
         // Step 5: Update request status
         request.status = 'approved';
         request.respondedAt = new Date();
         request.respondedBy = req.user.id;
         request.response = `수락되었습니다. ${alternativeSlot.day} ${alternativeSlot.startTime}로 이동합니다.`;

         room.markModified('timeSlots');
         await room.save();
         await room.populate('timeSlots.user', '_id firstName lastName email');

         // 🔄 교환된 슬롯의 날짜에 대해 이동시간 재계산
         const affectedDates = new Set();
         affectedDates.add(new Date(request.targetSlot.date)); // 요청자가 이동한 날짜
         affectedDates.add(new Date(alternativeSlot.date)); // 대상자가 이동한 날짜
         requesterSlots.forEach(slot => affectedDates.add(new Date(slot.date))); // 요청자의 원래 슬롯 날짜들

         await recalculateMultipleDates(roomId, Array.from(affectedDates));
         
         // 📡 Socket.io로 실시간 스케줄 업데이트 알림
         const io = req.app.get('io');
         if (io) {
            // 재계산 후 최신 방 정보 조회
            const updatedRoom = await Room.findById(roomId)
               .populate('timeSlots.user', '_id firstName lastName email');

            io.to(`room-${roomId}`).emit('scheduleUpdated', {
               roomId: roomId,
               message: '교환 승인으로 인해 이동시간이 재계산되었습니다.',
               timeSlots: updatedRoom.timeSlots,
               recalculatedDates: Array.from(affectedDates).map(d => d.toISOString().split('T')[0])
            });
         }

         return res.json({
            success: true,
            message: `요청을 수락했습니다. 당신은 ${alternativeSlot.day} ${alternativeSlot.startTime}로 이동합니다.`,
            request,
            alternativeSlot: {
               day: alternativeSlot.day,
               startTime: alternativeSlot.startTime,
               endTime: alternativeSlot.endTime
            },
            recalculatedDates: Array.from(affectedDates).map(d => d.toISOString().split('T')[0])
         });
      }

   } catch (error) {
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
      res.status(500).json({
         success: false,
         message: '서버 오류가 발생했습니다.',
         details: error.message
      });
   }
};

/**
 * Create chain exchange request (B → C)
 * 4.txt: B가 승인했지만 빈 시간이 없을 때, C에게 연쇄 요청
 */
async function createChainExchangeRequest(room, originalRequest, intermediateUserId, chainCandidate, allCandidates) {
   
   const intermediateUser = room.members.find(m =>
      (m.user._id || m.user).toString() === intermediateUserId.toString()
   );

   const chainUser = room.members.find(m =>
      (m.user._id || m.user).toString() === chainCandidate.userId
   );

   // 원본 요청자 (A)
   const originalRequesterId = (originalRequest.requester._id || originalRequest.requester).toString();

   // C의 슬롯들 찾기 (같은 날짜의 연속된 슬롯들)
   const chainSlotDate = new Date(chainCandidate.slot.date).toISOString().split('T')[0];
   const chainUserSlots = room.timeSlots.filter(slot => {
      const slotDate = new Date(slot.date).toISOString().split('T')[0];
      const slotUserId = (slot.user._id || slot.user).toString();
      return slotDate === chainSlotDate && slotUserId === chainCandidate.userId;
   });

   // 남은 후보들 (현재 후보 제외)
   const remainingCandidates = allCandidates
      .filter(c => c.userId !== chainCandidate.userId)
      .map(c => ({
         user: c.userId,
         slot: {
            day: c.slot.day,
            date: c.slot.date,
            startTime: c.slot.startTime,
            endTime: c.slot.endTime,
            user: c.slot.user
         },
         date: c.date
      }));

   const chainRequest = {
      requester: intermediateUserId, // B가 요청자
      type: 'chain_exchange_request',
      targetUser: chainCandidate.userId, // C가 대상
      requesterSlots: originalRequest.requesterSlots, // A의 원래 슬롯들 (참조용)
      targetSlot: {
         day: chainCandidate.slot.day,
         date: chainCandidate.slot.date,
         startTime: chainCandidate.slot.startTime,
         endTime: chainCandidate.slot.endTime,
         subject: chainCandidate.slot.subject,
         user: chainCandidate.slot.user._id || chainCandidate.slot.user
      },
      message: `[연쇄 요청] ${intermediateUser?.user?.firstName && intermediateUser?.user?.lastName ? `${intermediateUser.user.firstName} ${intermediateUser.user.lastName}` : intermediateUser?.user?.firstName || '알수없음'}님이 다른 멤버에게 자리를 양보하기 위해 회원님의 ${chainCandidate.slot.day} ${chainCandidate.slot.startTime}-${chainCandidate.slot.endTime} 자리가 필요합니다. 회원님은 빈 시간으로 이동하게 됩니다. 수락하시겠습니까?`,
      chainData: {
         originalRequestId: originalRequest._id,
         originalRequester: originalRequesterId, // A
         intermediateUser: intermediateUserId, // B
         chainUser: chainCandidate.userId, // C
         intermediateSlot: originalRequest.targetSlot, // B의 원래 자리 (A가 원하는 자리)
         chainSlot: {
            day: chainCandidate.slot.day,
            date: chainCandidate.slot.date,
            startTime: chainCandidate.slot.startTime,
            endTime: chainCandidate.slot.endTime,
            subject: chainCandidate.slot.subject,
            user: chainCandidate.slot.user._id || chainCandidate.slot.user
         },
         rejectedUsers: [],
         candidateUsers: remainingCandidates
      },
      status: 'pending',
      createdAt: new Date()
   };

   room.requests.push(chainRequest);

   return room.requests[room.requests.length - 1];
}

/**
 * Respond to chain exchange request (C's response)
 * POST /api/coordination/rooms/:roomId/chain-exchange-requests/:requestId/respond
 */
exports.respondToChainExchangeRequest = async (req, res) => {
   try {
      const { roomId, requestId } = req.params;
      const { action } = req.body; // 'accept' or 'reject'


      const room = await Room.findById(roomId)
         .populate('owner', 'firstName lastName email defaultSchedule scheduleExceptions')
         .populate('members.user', 'firstName lastName email defaultSchedule scheduleExceptions')
         .populate('timeSlots.user', '_id firstName lastName email')
         .populate('requests.requester', 'firstName lastName email')
         .populate('requests.targetUser', 'firstName lastName email');

      if (!room) {
         return res.status(404).json({ success: false, message: '방을 찾을 수 없습니다.' });
      }

      const request = room.requests.id(requestId);
      if (!request || request.type !== 'chain_exchange_request') {
         return res.status(404).json({ success: false, message: '연쇄 교환 요청을 찾을 수 없습니다.' });
      }

      // Verify responder is the chain user (C)
      const chainUserId = (request.targetUser._id || request.targetUser).toString();
      if (chainUserId !== req.user.id.toString()) {
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

         // C를 거절 목록에 추가
         if (!request.chainData.rejectedUsers) {
            request.chainData.rejectedUsers = [];
         }
         request.chainData.rejectedUsers.push(req.user.id);

         // 다음 후보 찾기
         const remainingCandidates = request.chainData.candidateUsers || [];

         if (remainingCandidates.length > 0) {
            // 다음 후보에게 요청
            const nextCandidate = remainingCandidates[0];

            // 현재 요청 상태 업데이트
            request.status = 'rejected';
            request.respondedAt = new Date();
            request.respondedBy = req.user.id;
            request.response = '거절됨 - 다음 후보에게 요청 중';

            // 새로운 연쇄 요청 생성
            const intermediateUserMember = room.members.find(m =>
               (m.user._id || m.user).toString() === request.chainData.intermediateUser.toString()
            );
            const intermediateUserName = intermediateUserMember?.user?.firstName && intermediateUserMember?.user?.lastName
               ? `${intermediateUserMember.user.firstName} ${intermediateUserMember.user.lastName}`
               : intermediateUserMember?.user?.firstName || '알수없음';

            const newChainRequest = {
               requester: request.chainData.intermediateUser,
               type: 'chain_exchange_request',
               targetUser: nextCandidate.user,
               requesterSlots: request.requesterSlots,
               targetSlot: nextCandidate.slot,
               message: `[연쇄 요청] ${intermediateUserName}님이 다른 멤버에게 자리를 양보하기 위해 회원님의 ${nextCandidate.slot.day} ${nextCandidate.slot.startTime}-${nextCandidate.slot.endTime} 자리가 필요합니다. 회원님은 빈 시간으로 이동하게 됩니다. 수락하시겠습니까?`,
               chainData: {
                  originalRequestId: request.chainData.originalRequestId,
                  originalRequester: request.chainData.originalRequester,
                  intermediateUser: request.chainData.intermediateUser,
                  chainUser: nextCandidate.user,
                  intermediateSlot: request.chainData.intermediateSlot,
                  chainSlot: nextCandidate.slot,
                  rejectedUsers: [...request.chainData.rejectedUsers],
                  candidateUsers: remainingCandidates.slice(1)
               },
               status: 'pending',
               createdAt: new Date()
            };

            room.requests.push(newChainRequest);
            await room.save();

            return res.json({
               success: true,
               message: '거절되었습니다. 다른 사용자에게 요청을 보내는 중입니다.',
               nextCandidate: nextCandidate.user
            });
         } else {
            // 모든 후보가 거절 - 원본 요청 실패 처리

            request.status = 'rejected';
            request.respondedAt = new Date();
            request.respondedBy = req.user.id;
            request.response = '모든 후보가 거절 - 조정 실패';

            // 원본 요청도 실패 처리
            const originalRequest = room.requests.id(request.chainData.originalRequestId);
            if (originalRequest) {
               originalRequest.status = 'rejected';
               originalRequest.response = '연쇄 조정 실패 - 모든 후보가 거절했습니다.';
            }

            await room.save();

            return res.json({
               success: false,
               message: '모든 후보가 거절하여 조정이 불가능합니다.'
            });
         }
      }

      if (action === 'accept') {

         // C의 빈 시간 찾기
         const chainUserId = req.user.id.toString();
         const requesterSlots = request.requesterSlots;
         const firstSlot = requesterSlots[0];
         const lastSlot = requesterSlots[requesterSlots.length - 1];
         const requiredHours = getHoursDifference(firstSlot.startTime, lastSlot.endTime);

         // C가 이동할 빈 시간 찾기
         const alternativeSlotForC = await findAlternativeSlotForUser(
            room,
            chainUserId,
            requiredHours,
            request.targetSlot.date,
            [] // C의 슬롯이 비워질 것이므로 무시할 슬롯 없음
         );

         if (!alternativeSlotForC) {
            return res.status(400).json({
               success: false,
               message: '이동할 빈 시간이 없습니다. 다른 사용자에게 요청합니다.'
            });
         }

         // === 연쇄 교환 실행 ===
         // 1. C를 빈 시간으로 이동
         // 2. B를 C의 원래 자리로 이동
         // 3. A를 B의 원래 자리로 이동

         const originalRequesterId = request.chainData.originalRequester.toString();
         const intermediateUserId = request.chainData.intermediateUser.toString();

         // Step 1: C의 현재 슬롯 삭제
         const chainSlotDate = new Date(request.chainData.chainSlot.date).toISOString().split('T')[0];
         const cSlotsToRemove = room.timeSlots.filter(slot => {
            const slotDate = new Date(slot.date).toISOString().split('T')[0];
            const slotUserId = (slot.user._id || slot.user).toString();
            return slotDate === chainSlotDate && slotUserId === chainUserId;
         });

         for (const slot of cSlotsToRemove) {
            const index = room.timeSlots.findIndex(s =>
               s._id.toString() === slot._id.toString()
            );
            if (index !== -1) {
               room.timeSlots.splice(index, 1);
            }
         }

         // Step 2: B의 현재 슬롯 삭제 (B의 원래 자리 = A가 원하는 자리)
         const intermediateSlotDate = new Date(request.chainData.intermediateSlot.date).toISOString().split('T')[0];
         const bSlotsToRemove = room.timeSlots.filter(slot => {
            const slotDate = new Date(slot.date).toISOString().split('T')[0];
            const slotUserId = (slot.user._id || slot.user).toString();
            return slotDate === intermediateSlotDate && slotUserId === intermediateUserId;
         });

         for (const slot of bSlotsToRemove) {
            const index = room.timeSlots.findIndex(s =>
               s._id.toString() === slot._id.toString()
            );
            if (index !== -1) {
               room.timeSlots.splice(index, 1);
            }
         }

         // Step 3: A의 현재 슬롯 삭제
         for (const reqSlot of request.requesterSlots) {
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
               room.timeSlots.splice(index, 1);
            }
         }

         // Step 4: C를 빈 시간으로 이동
         const cNewSlots = [];
         let cCurrentTime = alternativeSlotForC.startTime;
         for (let i = 0; i < cSlotsToRemove.length; i++) {
            const slotEnd = addHours(cCurrentTime, 0.5);
            cNewSlots.push({
               user: chainUserId,
               date: alternativeSlotForC.date,
               startTime: cCurrentTime,
               endTime: slotEnd,
               day: alternativeSlotForC.day,
               subject: '연쇄 교환 결과',
               status: 'confirmed',
               assignedBy: req.user.id,
               assignedAt: new Date()
            });
            cCurrentTime = slotEnd;
         }
         room.timeSlots.push(...cNewSlots);
         
         // Step 5: B를 C의 원래 자리로 이동
         const bNewSlots = [];
         let bCurrentTime = request.chainData.chainSlot.startTime;
         for (let i = 0; i < bSlotsToRemove.length; i++) {
            const slotEnd = addHours(bCurrentTime, 0.5);
            bNewSlots.push({
               user: intermediateUserId,
               date: request.chainData.chainSlot.date,
               startTime: bCurrentTime,
               endTime: slotEnd,
               day: request.chainData.chainSlot.day,
               subject: '연쇄 교환 결과',
               status: 'confirmed',
               assignedBy: req.user.id,
               assignedAt: new Date()
            });
            bCurrentTime = slotEnd;
         }
         room.timeSlots.push(...bNewSlots);
         
         // Step 6: A를 B의 원래 자리로 이동
         const aNewSlots = [];
         let aCurrentTime = request.chainData.intermediateSlot.startTime;
         for (let i = 0; i < request.requesterSlots.length; i++) {
            const slotEnd = addHours(aCurrentTime, 0.5);
            aNewSlots.push({
               user: originalRequesterId,
               date: request.chainData.intermediateSlot.date,
               startTime: aCurrentTime,
               endTime: slotEnd,
               day: request.chainData.intermediateSlot.day,
               subject: '연쇄 교환 결과',
               status: 'confirmed',
               assignedBy: req.user.id,
               assignedAt: new Date()
            });
            aCurrentTime = slotEnd;
         }
         room.timeSlots.push(...aNewSlots);
         
         // 요청 상태 업데이트
         request.status = 'approved';
         request.respondedAt = new Date();
         request.respondedBy = req.user.id;
         request.response = `수락됨 - 연쇄 교환 완료`;

         // 원본 요청도 완료 처리
         const originalRequest = room.requests.id(request.chainData.originalRequestId);
         if (originalRequest) {
            originalRequest.status = 'approved';
            originalRequest.respondedAt = new Date();
            originalRequest.response = `연쇄 교환 완료 - C(${chainUserId.substring(0, 8)})가 승인`;
         }

         room.markModified('timeSlots');
         await room.save();
         await room.populate('timeSlots.user', '_id firstName lastName email');

         
         // 🔄 연쇄 교환된 슬롯의 날짜에 대해 이동시간 재계산
         const affectedDates = new Set();
         affectedDates.add(new Date(alternativeSlotForC.date)); // C가 이동한 날짜
         affectedDates.add(new Date(request.chainData.chainSlot.date)); // B가 이동한 날짜
         affectedDates.add(new Date(request.chainData.intermediateSlot.date)); // A가 이동한 날짜
         request.requesterSlots.forEach(slot => affectedDates.add(new Date(slot.date))); // A의 원래 슬롯 날짜들

         await recalculateMultipleDates(roomId, Array.from(affectedDates));
         
         // 📡 Socket.io로 실시간 스케줄 업데이트 알림
         const io = req.app.get('io');
         if (io) {
            // 재계산 후 최신 방 정보 조회
            const updatedRoom = await Room.findById(roomId)
               .populate('timeSlots.user', '_id firstName lastName email');

            io.to(`room-${roomId}`).emit('scheduleUpdated', {
               roomId: roomId,
               message: '연쇄 교환 승인으로 인해 이동시간이 재계산되었습니다.',
               timeSlots: updatedRoom.timeSlots,
               recalculatedDates: Array.from(affectedDates).map(d => d.toISOString().split('T')[0])
            });
         }

         return res.json({
            success: true,
            message: '연쇄 교환이 완료되었습니다.',
            result: {
               c: { newDay: alternativeSlotForC.day, newTime: alternativeSlotForC.startTime },
               b: { newDay: request.chainData.chainSlot.day, newTime: request.chainData.chainSlot.startTime },
               a: { newDay: request.chainData.intermediateSlot.day, newTime: request.chainData.intermediateSlot.startTime }
            }
         });
      }

   } catch (error) {
      res.status(500).json({
         success: false,
         message: '서버 오류가 발생했습니다.',
         details: error.message
      });
   }
};

/**
 * Get pending chain exchange requests for user
 * GET /api/coordination/chain-exchange-requests/pending
 */
exports.getPendingChainExchangeRequests = async (req, res) => {
   try {
      const userId = req.user.id;

      const rooms = await Room.find({
         'members.user': userId,
         'requests.type': 'chain_exchange_request',
         'requests.status': 'pending'
      })
      .populate('requests.requester', 'firstName lastName email')
      .populate('requests.targetUser', 'firstName lastName email');

      const pendingRequests = [];

      for (const room of rooms) {
         const userRequests = room.requests.filter(req =>
            req.type === 'chain_exchange_request' &&
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
   getPendingExchangeRequests: exports.getPendingExchangeRequests,
   respondToChainExchangeRequest: exports.respondToChainExchangeRequest,
   getPendingChainExchangeRequests: exports.getPendingChainExchangeRequests,
   // Helper functions for internal use
   findChainCandidates,
   createChainExchangeRequest
};
