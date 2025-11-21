const Room = require('../models/Room');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');

// @desc    Create a new request (slot_release, slot_swap, time_request, time_change)
// @route   POST /api/coordination/requests
// @access  Private
exports.createRequest = async (req, res) => {
   try {
      const { roomId, type, targetUserId, targetSlot, timeSlot, message } = req.body;

      if (!roomId || !type || !timeSlot) {
         return res.status(400).json({ msg: '필수 필드가 누락되었습니다.' });
      }

      const room = await Room.findById(roomId);

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      // 방장은 시간표 교환요청을 할 수 없음
      if (room.owner.toString() === req.user.id) {
         return res.status(403).json({ msg: '방장은 시간표 교환요청을 할 수 없습니다.' });
      }

      const hasDuplicateRequest = room.requests.some(
         request =>
            request.requester.toString() === req.user.id &&
            request.status === 'pending' &&
            request.timeSlot.day === timeSlot.day &&
            request.timeSlot.startTime === timeSlot.startTime &&
            request.timeSlot.endTime === timeSlot.endTime &&
            ((type === 'slot_swap' || type === 'time_request') ? request.targetUser?.toString() === targetUserId : true),
      );

      if (hasDuplicateRequest) {
         return res.status(400).json({ msg: '동일한 요청이 이미 존재합니다.', duplicateRequest: true });
      }

      const requestData = {
         requester: req.user.id,
         type,
         timeSlot,
         message: message || '',
         status: 'pending',
         createdAt: new Date(),
      };

      if ((type === 'slot_swap' || type === 'time_request') && targetUserId) {
         requestData.targetUser = targetUserId;
         if (targetSlot) {
            requestData.targetSlot = targetSlot;
         }
      }

      room.requests.push(requestData);
      await room.save();

      const populatedRoom = await Room.findById(roomId)
         .populate('requests.requester', 'firstName lastName email')
         .populate('requests.targetUser', 'firstName lastName email');

      res.json(populatedRoom);
   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};


  // @desc    Handle a request (approve/reject)
  // @route   POST /api/coordination/requests/:requestId/:action
  // @access  Private
  exports.handleRequest = async (req, res) => {
     try {
        const { requestId, action } = req.params;
        const { message } = req.body;

        console.log('🎯 ========== HANDLE REQUEST ==========');
        console.log('📋 Request ID:', requestId);
        console.log('📋 Action:', action);
        console.log('👤 User ID:', req.user.id);

        if (!['approved', 'rejected'].includes(action)) {
           return res.status(400).json({ msg: '유효하지 않은 액션입니다. approved 또는 rejected만 허용됩니다.' });
        }

        const room = await Room.findOne({ 'requests._id': requestId })
           .populate('requests.requester', 'firstName lastName email')
           .populate('requests.targetUser', 'firstName lastName email defaultSchedule')
           .populate('timeSlots.user', '_id firstName lastName email')
           .populate('members.user', 'firstName lastName email defaultSchedule');

        if (!room) {
           return res.status(404).json({ msg: '요청을 찾을 수 없습니다.' });
        }

        const request = room.requests.id(requestId);
        if (!request) {
           return res.status(404).json({ msg: '요청을 찾을 수 없습니다.' });
        }

        // --- FINAL BUG FIX (AGAIN) ---
        const isOwner = room.isOwner(req.user.id);
        let isTargetUser = false;
        if (request.targetUser) {
          // Handle both populated object and plain ObjectId string
          const targetId = request.targetUser._id ? request.targetUser._id.toString() : request.targetUser.toString();
          if (targetId === req.user.id) {
            isTargetUser = true;
          }
        }
        // --- FINAL BUG FIX END ---

        if (!isOwner && !isTargetUser) {
           return res.status(403).json({ msg: '이 요청을 처리할 권한이 없습니다.' });
        }

        if (request.status !== 'pending') {
           return res.status(400).json({ msg: '이미 처리된 요청입니다.' });
        }

        const now = new Date();
        request.status = action;
        request.respondedAt = now;
        request.respondedBy = req.user.id;
        request.response = message || '';

        console.log('📊 Before processing - Total timeSlots:', room.timeSlots.length);

        if (action === 'approved') {
           console.log('✅ Action is APPROVED - processing request...');
           // Support both timeSlot (new) and targetSlot (old) fields for backward compatibility
         const { type, timeSlot: ts, targetSlot, targetUser, requester } = request;
         const timeSlot = (ts && Object.keys(ts).length > 0) ? ts : targetSlot;
           console.log('📋 Request type:', type);
           console.log('📋 TimeSlot:', JSON.stringify(timeSlot), ts ? '(from timeSlot)' : '(from targetSlot fallback)');
         console.log('📋 TimeSlot.date:', timeSlot?.date ? new Date(timeSlot.date).toISOString() : 'undefined');
           console.log('📋 Requester:', requester._id || requester);

           if (type === 'slot_release') {
              // Remove the slot from the requester
              room.timeSlots = room.timeSlots.filter(slot => {
                 const slotUserId = slot.user._id || slot.user;
                 return !(
                    slotUserId.toString() === requester._id.toString() &&
                    slot.day === timeSlot.day &&
                    slot.startTime === timeSlot.startTime
                 );
              });
              room.markModified('timeSlots');
           } else if (type === 'slot_swap' && targetUser) {
              const targetSlotIndex = room.timeSlots.findIndex(slot =>
                  slot.user &&
                  slot.user._id.toString() === targetUser._id.toString() &&
                  slot.day === timeSlot.day &&
                  slot.startTime === timeSlot.startTime
              );

              if (targetSlotIndex !== -1) {
                  room.timeSlots[targetSlotIndex].user = requester._id;
                  room.markModified('timeSlots');
              }
           } else if (type === 'time_request' || type === 'time_change') {
              // For time_request, transfer the timeslot from target user to requester
              if (targetUser) {
                 // 시간 범위 겹침 체크 헬퍼 함수
                 const timeRangesOverlap = (start1, end1, start2, end2) => {
                    const toMinutes = (timeStr) => {
                       const [h, m] = timeStr.split(':').map(Number);
                       return h * 60 + m;
                    };
                    const s1 = toMinutes(start1);
                    const e1 = toMinutes(end1);
                    const s2 = toMinutes(start2);
                    const e2 = toMinutes(end2);
                    return s1 < e2 && s2 < e1;
                 };

                 // 중복 방지: 요청자에게 이미 겹치는 슬롯이 있는지 확인
                 const requesterHasSlot = room.timeSlots.some(slot => {
                    const slotUserId = slot.user._id || slot.user;

                    // 유저가 다르면 false
                    if (slotUserId.toString() !== requester._id.toString()) return false;

                    // 요일이 다르면 false
                    if (slot.day !== timeSlot.day) return false;

                    // 날짜 비교 (요청에 date가 있는 경우)
                    if (timeSlot.date && slot.date) {
                       const slotDateStr = new Date(slot.date).toISOString().split('T')[0];
                       const requestDateStr = new Date(timeSlot.date).toISOString().split('T')[0];
                       if (slotDateStr !== requestDateStr) return false;
                    }

                    // 시간 범위 겹침 체크
                    return timeRangesOverlap(
                       slot.startTime,
                       slot.endTime,
                       timeSlot.startTime,
                       timeSlot.endTime
                    );
                 });

                 if (requesterHasSlot) {
                    // 중복이므로 아무것도 하지 않음 (요청 상태는 approved로 변경됨)
                 } else {
                    // 시간 범위 겹침 체크 헬퍼 함수
                    const timeRangesOverlap = (start1, end1, start2, end2) => {
                       // "HH:MM" 형식을 분으로 변환
                       const toMinutes = (timeStr) => {
                          const [h, m] = timeStr.split(':').map(Number);
                          return h * 60 + m;
                       };
                       const s1 = toMinutes(start1);
                       const e1 = toMinutes(end1);
                       const s2 = toMinutes(start2);
                       const e2 = toMinutes(end2);

                       // 겹침: s1 < e2 && s2 < e1
                       // 포함 또는 부분 겹침도 모두 포함
                       return s1 < e2 && s2 < e1;
                    };

                    // 디버깅: 전체 슬롯 상태 확인
                    console.log(`📊 Total slots in room: ${room.timeSlots.length}`);
                    console.log(`📊 Target user ID: ${targetUser._id}`);
                    console.log(`📊 Looking for day: ${timeSlot.day}, time: ${timeSlot.startTime}-${timeSlot.endTime}`);
                    
                    // 요청 시간에 겹치는 모든 타겟 슬롯 찾기 (복수 개 가능)
                    const overlappingSlots = room.timeSlots.filter(slot => {
                       const slotUserId = slot.user._id || slot.user;

                       // 유저 매칭
                       if (slotUserId.toString() !== targetUser._id.toString()) return false;

                       // 요일 매칭
                       if (slot.day !== timeSlot.day) return false;

                       // 날짜 비교 (필수 - date가 없으면 매칭 실패)
                       if (!slot.date) return false;
                       
                       // timeSlot.date가 없으면 desiredDay를 사용해서 날짜 계산
                       let requestDate = timeSlot.date;
                       if (!requestDate && request.desiredDay) {
                          console.log(`   📅 Calculating date from desiredDay: ${request.desiredDay}`);
                          // desiredDay에서 날짜 계산 (이번주 기준)
                          const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                          const targetDayIndex = daysOfWeek.indexOf(request.desiredDay.toLowerCase());
                          if (targetDayIndex !== -1) {
                             const today = new Date();
                             const currentDay = today.getDay();
                             const diff = targetDayIndex - currentDay;
                             requestDate = new Date(today);
                             requestDate.setDate(today.getDate() + diff);
                          }
                       }
                       
                       if (!requestDate) {
                          console.log('⚠️ No date available for matching - skipping slot');
                          return false;
                       }
                       
                       // 디버깅: 날짜 계산 결과
                       const slotDateStr = new Date(slot.date).toISOString().split('T')[0];
                       const requestDateStr = new Date(requestDate).toISOString().split('T')[0];
                       console.log(`   🔍 Comparing: slot ${slotDateStr} vs request ${requestDateStr} (user: ${slotUserId.toString().slice(-6)})`);
                       
                       if (slotDateStr !== requestDateStr) return false;

                       // 시간 범위 겹침 체크
                       return timeRangesOverlap(
                          slot.startTime,
                          slot.endTime,
                          timeSlot.startTime,
                          timeSlot.endTime
                       );
                    });

                    console.log(`📊 Found ${overlappingSlots.length} overlapping slots from target user`);
                    if (overlappingSlots.length > 0) {
                       console.log(`   Overlapping slots:`, overlappingSlots.map(s => ({
                          date: new Date(s.date).toISOString().split('T')[0],
                          time: `${s.startTime}-${s.endTime}`,
                          id: s._id.toString().slice(-6)
                       })));
                       
                       // 🆕 A의 기존 슬롯(requesterSlots) 삭제
                       if (request.requesterSlots && request.requesterSlots.length > 0) {
                          console.log(`🗑️ Removing ${request.requesterSlots.length} requester's original slots`);
                          request.requesterSlots.forEach(reqSlot => {
                             const reqDateStr = reqSlot.date ? new Date(reqSlot.date).toISOString().split('T')[0] : null;
                             const index = room.timeSlots.findIndex(slot => {
                                const slotUserId = slot.user._id || slot.user;
                                if (slotUserId.toString() !== requester._id.toString()) return false;
                                if (slot.startTime !== reqSlot.startTime) return false;
                                if (slot.endTime !== reqSlot.endTime) return false;
                                // 날짜 비교 (필수)
                                if (!slot.date) return false;
                                if (reqDateStr) {
                                   const slotDateStr = new Date(slot.date).toISOString().split('T')[0];
                                   if (slotDateStr !== reqDateStr) return false;
                                } else {
                                   // reqDateStr가 없으면 매칭 실패
                                   return false;
                                }
                                return true;
                             });
                             if (index !== -1) {
                                room.timeSlots.splice(index, 1);
                                console.log(`   ❌ Removed: ${reqSlot.startTime}-${reqSlot.endTime}`);
                             }
                          });
                          room.markModified('timeSlots');
                       }

                       // 겹치는 슬롯들을 정렬
                       overlappingSlots.sort((a, b) => {
                          const aTime = a.startTime.split(':').map(Number);
                          const bTime = b.startTime.split(':').map(Number);
                          return (aTime[0] * 60 + aTime[1]) - (bTime[0] * 60 + bTime[1]);
                       });

                       const firstSlot = overlappingSlots[0];
                       const lastSlot = overlappingSlots[overlappingSlots.length - 1];

                       // 시간을 분으로 변환하는 헬퍼 함수
                       const toMinutes = (timeStr) => {
                          const [h, m] = timeStr.split(':').map(Number);
                          return h * 60 + m;
                       };

                       // 분을 시간으로 변환하는 헬퍼 함수
                       const toTimeString = (minutes) => {
                          const h = Math.floor(minutes / 60);
                          const m = minutes % 60;
                          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                       };

                       const requestStart = toMinutes(timeSlot.startTime);
                       const requestEnd = toMinutes(timeSlot.endTime);

                       // 모든 겹치는 슬롯 제거 (B의 슬롯은 나중에 가장 가까운 시간으로 이동됨)
                       console.log(`🗑️ Removing ${overlappingSlots.length} overlapping slots from target user (B)`);
                       overlappingSlots.forEach(slot => {
                          const index = room.timeSlots.findIndex(s => s._id.equals(slot._id));
                          if (index !== -1) {
                             room.timeSlots.splice(index, 1);
                             console.log(`   ❌ Removed B's slot: ${new Date(slot.date).toISOString().split('T')[0]} ${slot.startTime}-${slot.endTime}`);
                          }
                       });
                       room.markModified('timeSlots');
                       
                       console.log(`📊 After removals - Total timeSlots: ${room.timeSlots.length}`);

                       // 요청자에게 요청한 시간 슬롯 추가
                       room.timeSlots.push({
                          user: requester._id,
                          date: firstSlot.date,
                          startTime: timeSlot.startTime,
                          endTime: timeSlot.endTime,
                          day: timeSlot.day,
                          subject: firstSlot.subject || '양보받은 시간',
                          status: 'confirmed',
                          assignedBy: req.user.id
                       });

                       // 🆕 B의 슬롯을 B의 선호시간 중 가장 가까운 시간으로 이동
                       // Calculate total duration of removed slots (in minutes)
                       const totalDuration = overlappingSlots.reduce((sum, slot) => {
                          const start = toMinutes(slot.startTime);
                          const end = toMinutes(slot.endTime);
                          return sum + (end - start);
                       }, 0);

                       // Get target user's preferred schedule
                       const targetUserSchedule = targetUser.defaultSchedule || [];

                       if (targetUserSchedule.length > 0 && totalDuration > 0) {
                          // Helper function to get day of week number
                          const getDayOfWeek = (dayName) => {
                             const days = { 'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6 };
                             return days[dayName.toLowerCase()] || 0;
                          };

                          const originalDayOfWeek = getDayOfWeek(firstSlot.day);
                          const originalDate = new Date(firstSlot.date);
                          const originalStartMinutes = toMinutes(firstSlot.startTime);

                          // Group schedule by day and merge continuous blocks
                          const scheduleByDay = {};
                          targetUserSchedule.forEach(s => {
                             if (!scheduleByDay[s.dayOfWeek]) scheduleByDay[s.dayOfWeek] = [];
                             scheduleByDay[s.dayOfWeek].push({
                                start: toMinutes(s.startTime),
                                end: toMinutes(s.endTime)
                             });
                          });

                          // Merge and sort each day's schedule
                          Object.keys(scheduleByDay).forEach(day => {
                             const slots = scheduleByDay[day].sort((a, b) => a.start - b.start);
                             const merged = [];
                             slots.forEach(slot => {
                                if (merged.length === 0 || slot.start > merged[merged.length - 1].end) {
                                   merged.push({ ...slot });
                                } else {
                                   merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, slot.end);
                                }
                             });
                             scheduleByDay[day] = merged;
                          });

                          // Find candidates: same day first, then other days
                          const candidates = [];

                          // Check same day first
                          if (scheduleByDay[originalDayOfWeek]) {
                             scheduleByDay[originalDayOfWeek].forEach(block => {
                                // Check if this block can fit the duration (excluding the requested time)
                                const requestStart = toMinutes(timeSlot.startTime);
                                const requestEnd = toMinutes(timeSlot.endTime);

                                // Try before the requested time
                                if (block.start < requestStart) {
                                   const availableEnd = Math.min(block.end, requestStart);
                                   if (availableEnd - block.start >= totalDuration) {
                                      candidates.push({
                                         dayOfWeek: originalDayOfWeek,
                                         date: originalDate,
                                         startMinutes: block.start,
                                         distance: Math.abs(block.start - originalStartMinutes)
                                      });
                                   }
                                }

                                // Try after the requested time
                                if (block.end > requestEnd) {
                                   const availableStart = Math.max(block.start, requestEnd);
                                   if (block.end - availableStart >= totalDuration) {
                                      candidates.push({
                                         dayOfWeek: originalDayOfWeek,
                                         date: originalDate,
                                         startMinutes: availableStart,
                                         distance: Math.abs(availableStart - originalStartMinutes)
                                      });
                                   }
                                }
                             });
                          }

                          // Check other days (within 7 days) - iterate through user's schedule days
                          Object.keys(scheduleByDay).forEach(scheduleDayStr => {
                             const scheduleDay = parseInt(scheduleDayStr);

                             // Skip the same day (already checked above)
                             if (scheduleDay === originalDayOfWeek) return;

                             // Calculate days until this day of week
                             let daysUntil = (scheduleDay - originalDayOfWeek + 7) % 7;
                             if (daysUntil === 0) daysUntil = 7; // If same day somehow, go to next week

                             // Only check within 7 days
                             if (daysUntil <= 7) {
                                const checkDate = new Date(originalDate);
                                checkDate.setUTCDate(checkDate.getUTCDate() + daysUntil);

                                scheduleByDay[scheduleDay].forEach(block => {
                                   if (block.end - block.start >= totalDuration) {
                                      candidates.push({
                                         dayOfWeek: scheduleDay,
                                         date: checkDate,
                                         startMinutes: block.start,
                                         distance: daysUntil * 1440 + Math.abs(block.start - originalStartMinutes) // 1440 = minutes in a day
                                      });
                                   }
                                });
                             }
                          });

                          // Sort by distance and pick the closest non-conflicting candidate
                          candidates.sort((a, b) => a.distance - b.distance);

                          console.log(`📊 Found ${candidates.length} candidates for B, checking for conflicts...`);

                          let bestCandidate = null;
                          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

                          // Find first non-conflicting candidate
                          for (const candidate of candidates) {
                             const newStartMinutes = candidate.startMinutes;
                             const newEndMinutes = newStartMinutes + totalDuration;
                             const newDateStr = candidate.date.toISOString().split('T')[0];

                             console.log(`🔍 Checking candidate: ${dayNames[candidate.dayOfWeek]} ${newDateStr} ${toTimeString(newStartMinutes)}-${toTimeString(newEndMinutes)}`);

                             const hasConflict = room.timeSlots.some(slot => {
                                const slotDateStr = new Date(slot.date).toISOString().split('T')[0];
                                if (slotDateStr !== newDateStr) return false;

                                const slotStart = toMinutes(slot.startTime);
                                const slotEnd = toMinutes(slot.endTime);
                                const overlaps = newStartMinutes < slotEnd && newEndMinutes > slotStart;

                                if (overlaps) {
                                   const slotUserId = slot.user._id || slot.user;
                                   const slotUserName = slot.user?.firstName || 'Unknown';
                                   console.log(`   ⚠️  Conflict: overlaps with ${slotUserName}'s slot ${slot.startTime}-${slot.endTime}`);
                                }

                                return overlaps;
                             });

                             if (!hasConflict) {
                                console.log(`   ✅ No conflict! Selected this candidate.`);
                                bestCandidate = candidate;
                                break;
                             } else {
                                console.log(`   ❌ Has conflict, trying next candidate...`);
                             }
                          }

                          if (bestCandidate) {
                             const newStartMinutes = bestCandidate.startMinutes;
                             const newEndMinutes = newStartMinutes + totalDuration;

                             // Create 30-minute slots (시스템은 30분 단위 슬롯을 기대함)
                             const numSlots = Math.ceil(totalDuration / 30);
                             console.log(`📦 Creating ${numSlots} slots (30-min each) from ${toTimeString(newStartMinutes)} to ${toTimeString(newEndMinutes)}`);
                             console.log(`📅 Date: ${bestCandidate.date.toISOString().split('T')[0]}, Day: ${dayNames[bestCandidate.dayOfWeek]}`);

                             for (let i = 0; i < numSlots; i++) {
                                const slotStart = newStartMinutes + (i * 30);
                                const slotEnd = slotStart + 30;
                                room.timeSlots.push({
                                   user: targetUser._id,
                                   date: bestCandidate.date,
                                   startTime: toTimeString(slotStart),
                                   endTime: toTimeString(slotEnd),
                                   day: dayNames[bestCandidate.dayOfWeek],
                                   subject: '자동 재배치',
                                   status: 'confirmed',
                                   assignedBy: req.user.id
                                });
                             }

                             console.log(`✅ B's slot moved to ${dayNames[bestCandidate.dayOfWeek]} ${toTimeString(newStartMinutes)}-${toTimeString(newEndMinutes)} (${numSlots} x 30min slots)`);

                               // Log A's relocation (the approver who gave up their slot)
                               const targetUserName = targetUser.firstName && targetUser.lastName
                                  ? `${targetUser.firstName} ${targetUser.lastName}`
                                  : targetUser.email;
                               const requesterNameForLog = requester.firstName && requester.lastName
                                  ? `${requester.firstName} ${requester.lastName}`
                                  : requester.email;
                               const origMonth = new Date(firstSlot.date).getUTCMonth() + 1;
                               const origDay = new Date(firstSlot.date).getUTCDate();
                               const newMonth = bestCandidate.date.getUTCMonth() + 1;
                               const newDay = bestCandidate.date.getUTCDate();
                               
                               await ActivityLog.logActivity(
                                  room._id,
                                  targetUser._id,
                                  targetUserName,
                                  'slot_swap',
                                  `${targetUserName}님: ${origMonth}월 ${origDay}일 ${firstSlot.startTime}-${lastSlot.endTime} → ${newMonth}월 ${newDay}일 ${toTimeString(newStartMinutes)}-${toTimeString(newEndMinutes)}로 재배치 (${requesterNameForLog}님에게 양보)`,
                                  { 
                                     prevDate: `${origMonth}월 ${origDay}일`, 
                                     prevTime: `${firstSlot.startTime}-${lastSlot.endTime}`,
                                     targetDate: `${newMonth}월 ${newDay}일`, 
                                     targetTime: `${toTimeString(newStartMinutes)}-${toTimeString(newEndMinutes)}`,
                                     yieldedTo: requesterNameForLog
                                  }
                               );
                          } else {
                             console.log(`⚠️ Could not find non-conflicting slot for B`);
                          }
                       }

                    } else {

                       // 타겟 슬롯이 없는 경우 (아직 배정되지 않은 시간) 새 슬롯 생성
                       const calculateDateFromDay = (dayName) => {
                          const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                          const dayIndex = daysOfWeek.indexOf(dayName.toLowerCase());
                          if (dayIndex === -1) return new Date();

                          const currentDate = new Date();
                          const currentDay = currentDate.getDay();
                          const diff = dayIndex - currentDay;
                          const targetDate = new Date(currentDate);
                          targetDate.setDate(currentDate.getDate() + diff);
                          return targetDate;
                       };

                       room.timeSlots.push({
                          user: requester._id,
                          date: timeSlot.date || calculateDateFromDay(timeSlot.day),
                          startTime: timeSlot.startTime,
                          endTime: timeSlot.endTime,
                          day: timeSlot.day,
                          subject: timeSlot.subject || '양보받은 시간',
                          status: 'confirmed',
                          assignedBy: req.user.id
                       });
                    }
                 }
              } else {
                 // If no target user (slot_release type), just add the slot to requester
                 const calculateDateFromDay = (dayName) => {
                    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                    const dayIndex = daysOfWeek.indexOf(dayName.toLowerCase());
                    if (dayIndex === -1) return new Date();

                    const currentDate = new Date();
                    const currentDay = currentDate.getDay();
                    const diff = dayIndex - currentDay;
                    const targetDate = new Date(currentDate);
                    targetDate.setDate(currentDate.getDate() + diff);
                    return targetDate;
                 };

                 room.timeSlots.push({
                    user: requester._id,
                    date: calculateDateFromDay(timeSlot.day),
                    startTime: timeSlot.startTime,
                    endTime: timeSlot.endTime,
                    day: timeSlot.day,
                    subject: timeSlot.subject || '승인된 요청',
                    status: 'confirmed'
                 });
              }
           }
        }

        console.log('📊 After processing - Total timeSlots:', room.timeSlots.length);
        console.log('💾 Saving room changes...');
        await room.save();
        console.log('✅ Room saved successfully!');

        // Log activity - change_approve or change_reject
        const responder = await User.findById(req.user.id);
        const responderName = responder
           ? `${responder.firstName} ${responder.lastName}`
           : 'Unknown';

        const requesterName = request.requester.firstName && request.requester.lastName
           ? `${request.requester.firstName} ${request.requester.lastName}`
           : request.requester.email;

        const timeSlotInfo = request.timeSlot || request.targetSlot;
        let slotDetails = '';
        if (timeSlotInfo) {
           if (timeSlotInfo.date) {
              const slotDate = new Date(timeSlotInfo.date);
              const slotMonth = slotDate.getUTCMonth() + 1;
              const slotDay = slotDate.getUTCDate();
              slotDetails = `${slotMonth}월 ${slotDay}일 ${timeSlotInfo.startTime}-${timeSlotInfo.endTime}`;
           } else {
              slotDetails = `${timeSlotInfo.day} ${timeSlotInfo.startTime}-${timeSlotInfo.endTime}`;
           }
        }

        if (action === 'approved') {
           // Get requester's previous slot info
           let prevSlotDetails = '';
           if (request.requesterSlots && request.requesterSlots.length > 0) {
              const firstReqSlot = request.requesterSlots[0];
              const lastReqSlot = request.requesterSlots[request.requesterSlots.length - 1];
              if (firstReqSlot.date) {
                 const prevDate = new Date(firstReqSlot.date);
                 const prevMonth = prevDate.getUTCMonth() + 1;
                 const prevDay = prevDate.getUTCDate();
                 prevSlotDetails = `${prevMonth}월 ${prevDay}일 ${firstReqSlot.startTime}-${lastReqSlot.endTime}`;
              } else {
                 prevSlotDetails = `${firstReqSlot.day} ${firstReqSlot.startTime}-${lastReqSlot.endTime}`;
              }
           }

           await ActivityLog.logActivity(
              room._id,
              req.user.id,
              responderName,
              'change_approve',
              `${requesterName}님의 요청(${slotDetails})을 승인`,
              { responder: responderName, requester: requesterName, slot: slotDetails }
           );
           // Also log slot_swap for the requester with previous slot info
           const requesterLogDetails = prevSlotDetails 
              ? `${requesterName}님: ${prevSlotDetails} → ${slotDetails}로 변경 완료 (${responderName}님 승인)`
              : `${requesterName}님: ${slotDetails}로 변경 완료 (${responderName}님 승인)`;
           await ActivityLog.logActivity(
              room._id,
              request.requester._id || request.requester,
              requesterName,
              'slot_swap',
              requesterLogDetails,
              { 
                 prevSlot: prevSlotDetails,
                 slot: slotDetails, 
                 type: 'from_request', 
                 approver: responderName 
              }
           );
        } else {
           await ActivityLog.logActivity(
              room._id,
              req.user.id,
              responderName,
              'change_reject',
              `${requesterName}님의 요청(${slotDetails})을 거절`,
              { responder: responderName, requester: requesterName, slot: slotDetails }
           );
        }

        const updatedRoom = await Room.findById(room._id)
           .populate('requests.requester', 'firstName lastName email')
           .populate('requests.targetUser', 'firstName lastName email')
           .populate('timeSlots.user', '_id firstName lastName email')
           .populate('members.user', 'firstName lastName email');

        res.json(updatedRoom);
     } catch (error) {
        res.status(500).json({ msg: 'Server error' });
     }
  };

// @desc    Cancel a request
// @route   DELETE /api/coordination/requests/:requestId
// @access  Private (Requester only)
exports.cancelRequest = async (req, res) => {
   try {
      const { requestId } = req.params;

      const room = await Room.findOne({ 'requests._id': requestId });

      if (!room) {
         return res.status(404).json({ msg: '요청을 찾을 수 없습니다.' });
      }

      const request = room.requests.id(requestId);

      if (!request) {
         return res.status(404).json({ msg: '요청을 찾을 수 없습니다.' });
      }

      const canDelete = request.requester.toString() === req.user.id ||
                       (request.targetUser && request.targetUser.toString() === req.user.id);

      if (!canDelete) {
         return res.status(403).json({ msg: '요청을 삭제할 권한이 없습니다.' });
      }

      if (request.status === 'pending' && request.requester.toString() !== req.user.id) {
         return res.status(403).json({ msg: '대기 중인 요청은 요청자만 취소할 수 있습니다.' });
      }

      if (request.status === 'pending') {
         request.status = 'cancelled';
         request.respondedAt = new Date();
         request.respondedBy = req.user.id;
         request.response = '요청자에 의해 취소됨';
         await room.save();
         res.json({ msg: '요청이 취소되었습니다.' });
      } else {
         room.requests.pull(requestId);
         await room.save();
         res.json({ msg: '요청 내역이 삭제되었습니다.' });
      }
   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};

// @desc    Get all requests sent by the user
// @route   GET /api/coordination/sent-requests
// @access  Private
exports.getSentRequests = async (req, res) => {
   try {
      const userId = req.user.id;

      const rooms = await Room.find({
         $or: [{ owner: userId }, { 'members.user': userId }],
      })
         .populate({
            path: 'requests.requester',
            select: 'firstName lastName email'
         })
         .populate({
            path: 'requests.targetUser',
            select: 'firstName lastName email',
            options: { strictPopulate: false }
         });

      const sentRequests = rooms.flatMap(room =>
         room.requests
           .filter(req => req.requester && req.requester._id.toString() === userId)
           .map(req => ({
             ...req.toObject(),
             roomId: room._id.toString(),
             roomName: room.name
           }))
      );

      res.json({ success: true, requests: sentRequests });
   } catch (error) {
      res.status(500).json({ success: false, msg: 'Server error' });
   }
};

// @desc    Get all requests received by the user
// @route   GET /api/coordination/received-requests
// @access  Private
exports.getReceivedRequests = async (req, res) => {
   try {
      const userId = req.user.id;

      const rooms = await Room.find({
         $or: [{ owner: userId }, { 'members.user': userId }],
      }).populate('requests.requester', 'firstName lastName email');

      const receivedRequests = rooms.flatMap(room => {
         return room.requests.filter(req => {
            const isTarget = req.targetUser && req.targetUser.toString() === userId;
            return isTarget;
         }).map(req => ({ ...req.toObject(), roomId: room._id, roomName: room.name }));
      });

      res.json({ success: true, requests: receivedRequests });
   } catch (error) {
      res.status(500).json({ success: false, msg: 'Server error' });
   }
};
