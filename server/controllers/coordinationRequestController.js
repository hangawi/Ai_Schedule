const Room = require('../models/room');
const User = require('../models/user');
const ActivityLog = require('../models/ActivityLog');

// 체인 요청용 헬퍼 함수들 import
const { findChainCandidates } = require('./coordinationExchangeRequestController');

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
           .populate('owner', 'firstName lastName email defaultSchedule')
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
              console.log('🔍 [DEBUG] Entered time_request/time_change block');
              // For time_request, transfer the timeslot from target user to requester
              if (targetUser) {
                 console.log('🔍 [DEBUG] targetUser exists:', targetUser._id || targetUser);
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

                 // 💾 C의 원래 슬롯을 맨 처음에 저장 (모든 경로에서 실행되도록)
                 const requesterOriginalSlots = [];
                 if (request.requesterSlots && request.requesterSlots.length > 0) {
                    // exchange_request인 경우 requesterSlots 사용
                    requesterOriginalSlots.push(...request.requesterSlots);
                 } else {
                    // time_request/time_change인 경우 현재 슬롯에서 찾기
                    const requesterSlots = room.timeSlots.filter(slot => {
                       const slotUserId = slot.user._id || slot.user;
                       return slotUserId.toString() === requester._id.toString();
                    });
                    requesterSlots.forEach(slot => {
                       requesterOriginalSlots.push({
                          user: requester._id,
                          date: slot.date,
                          startTime: slot.startTime,
                          endTime: slot.endTime,
                          day: slot.day,
                          subject: slot.subject || '자동 배정',
                          status: 'confirmed'
                       });
                    });
                 }
                 console.log(`💾 [EARLY] Saved ${requesterOriginalSlots.length} requester's original slots for potential restoration`);

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

                       // ★ 변경: B의 빈 시간을 먼저 확인하고, 있는 경우에만 슬롯 수정
                       // 없으면 바로 chain request 생성으로 이동

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

                       // Calculate total duration of removed slots (in minutes)
                       const totalDuration = overlappingSlots.reduce((sum, slot) => {
                          const start = toMinutes(slot.startTime);
                          const end = toMinutes(slot.endTime);
                          return sum + (end - start);
                       }, 0);

                       // ★ 먼저 B의 빈 시간 찾기 (슬롯 삭제 전에!)
                       console.log(`🔍 Checking if B has empty time BEFORE modifying any slots...`);

                       // Get target user's preferred schedule
                       const targetUserSchedule = targetUser.defaultSchedule || [];

                       // 🔍 디버그: targetUserSchedule 원본 데이터 출력
                       console.log(`🔍 targetUser: ${targetUser.firstName} ${targetUser.lastName}`);
                       console.log(`🔍 targetUserSchedule 길이: ${targetUserSchedule.length}`);
                       console.log(`🔍 targetUserSchedule 원본:`, JSON.stringify(targetUserSchedule.slice(0, 5)));

                       let bestCandidate = null;

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
                          // 🔧 같은 주(7일 이내)의 선호시간만 사용
                          const scheduleByDay = {};
                          const seenBlocks = new Set(); // 중복 방지용
                          const requestDateStr = originalDate.toISOString().split('T')[0];
                          const requestDateMs = originalDate.getTime();

                          console.log(`🔍 요청 날짜: ${requestDateStr}`);

                          targetUserSchedule.forEach(s => {
                             // specificDate가 있으면 같은 주(7일 이내)인지 체크
                             if (s.specificDate) {
                                const specificDateMs = new Date(s.specificDate).getTime();
                                const daysDiff = Math.abs(specificDateMs - requestDateMs) / (1000 * 60 * 60 * 24);
                                if (daysDiff > 7) {
                                   return; // 7일 초과면 스킵
                                }
                             }

                             // dayOfWeek + startTime + endTime 조합으로 중복 체크
                             const blockKey = `${s.dayOfWeek}-${s.startTime}-${s.endTime}`;
                             if (seenBlocks.has(blockKey)) return; // 중복 스킵
                             seenBlocks.add(blockKey);

                             if (!scheduleByDay[s.dayOfWeek]) scheduleByDay[s.dayOfWeek] = [];
                             scheduleByDay[s.dayOfWeek].push({
                                start: toMinutes(s.startTime),
                                end: toMinutes(s.endTime)
                             });
                          });

                          console.log(`🔍 같은 주 블록 개수: ${seenBlocks.size}`);
                          console.log(`🔍 요일별 스케줄 (숫자): ${Object.keys(scheduleByDay).join(', ')}`); // 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토

                          // Merge overlapping/adjacent blocks for each day
                          Object.keys(scheduleByDay).forEach(day => {
                             const daySlots = scheduleByDay[day].sort((a, b) => a.start - b.start);
                             const merged = [];
                             daySlots.forEach(slot => {
                                if (merged.length === 0 || slot.start > merged[merged.length - 1].end) {
                                   merged.push({ ...slot });
                                } else {
                                   merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, slot.end);
                                }
                             });
                             scheduleByDay[day] = merged;
                          });

                          // Calculate Monday of the week
                          const dayOfWeek = originalDate.getUTCDay();
                          const monday = new Date(originalDate);
                          monday.setUTCDate(originalDate.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));

                          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

                          // Generate candidates
                          const candidates = [];

                          // Same day preference - search around original time
                          if (scheduleByDay[originalDayOfWeek]) {
                             scheduleByDay[originalDayOfWeek].forEach(block => {
                                // Find available slots within this block
                                for (let start = block.start; start + totalDuration <= block.end; start += 30) {
                                   // Skip if overlaps with the overlapping slot area
                                   if (start < requestEnd && start + totalDuration > requestStart) continue;

                                   const distance = Math.abs(start - originalStartMinutes);
                                   candidates.push({
                                      dayOfWeek: originalDayOfWeek,
                                      date: originalDate,
                                      startMinutes: start,
                                      distance
                                   });
                                }
                             });
                          }

                          // Other days in the week
                          Object.keys(scheduleByDay).forEach(dayNum => {
                             const day = parseInt(dayNum);
                             if (day === originalDayOfWeek) return; // Already processed

                             scheduleByDay[day].forEach(block => {
                                for (let start = block.start; start + totalDuration <= block.end; start += 30) {
                                   const targetDate = new Date(monday);
                                   targetDate.setUTCDate(monday.getUTCDate() + day - 1);

                                   candidates.push({
                                      dayOfWeek: day,
                                      date: targetDate,
                                      startMinutes: start,
                                      distance: 24 * 60 * Math.abs(day - originalDayOfWeek) + Math.abs(start - originalStartMinutes)
                                   });
                                }
                             });
                          });

                          // Sort candidates by distance
                          candidates.sort((a, b) => a.distance - b.distance);
                          console.log(`🔍 Generated ${candidates.length} candidates for B's relocation`);

                          // Check each candidate for conflicts
                          for (const candidate of candidates) {
                             const newStartMinutes = candidate.startMinutes;
                             const newEndMinutes = newStartMinutes + totalDuration;
                             const newDateStr = candidate.date.toISOString().split('T')[0];

                             console.log(`   🔍 Checking: ${dayNames[candidate.dayOfWeek]} ${toTimeString(newStartMinutes)}-${toTimeString(newEndMinutes)} (${newDateStr})`);

                             // ★ 멤버끼리 교환할 때는 방장 스케줄 검증 안 함 (각자의 선호 시간만 확인)
                             // 방장 스케줄은 자동 배정 시에만 사용

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
                                console.log(`   ✅ No conflict and in owner's schedule! Selected this candidate.`);
                                bestCandidate = candidate;
                                break;
                             } else {
                                console.log(`   ❌ Has conflict, trying next candidate...`);
                             }
                          }
                       }

                       // ★ bestCandidate 결과에 따라 분기
                       if (bestCandidate) {
                          // B에게 빈 시간이 있는 경우 - 일반 교환 진행
                          console.log(`✅ B has empty time - Proceeding with normal slot exchange`);

                          // 🆕 C의 기존 슬롯(requesterSlots) 삭제
                          console.log(`🗑️ Removing ${request.requesterSlots.length} requester's original slots`);
                          if (request.requesterSlots && request.requesterSlots.length > 0) {
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
                                   console.log(`   ❌ Removed C's slot: ${reqSlot.startTime}-${reqSlot.endTime}`);
                                }
                             });
                             room.markModified('timeSlots');
                          }

                          // 모든 겹치는 슬롯 제거 (B의 슬롯)
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

                          // C에게 요청한 시간 슬롯 추가 (B의 자리)
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

                          // B를 빈 시간으로 이동
                          const newStartMinutes = bestCandidate.startMinutes;
                          const newEndMinutes = newStartMinutes + totalDuration;

                          // Create 30-minute slots (시스템은 30분 단위 슬롯을 기대함)
                          const numSlots = Math.ceil(totalDuration / 30);
                          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
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

                          // Log activity
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

                          console.log('✅ Normal slot exchange completed - B has empty time');

                       } else {
                          // ★ B에게 빈 시간이 없는 경우 - 연쇄 요청 생성 (슬롯 수정 없이!)
                          console.log(`⚠️ B has NO empty time - Starting chain request WITHOUT modifying any slots`);

                          // C의 원래 슬롯 저장 (chain 실패 시 필요 없지만, 데이터 일관성을 위해)
                          const requesterOriginalSlots = [];
                          if (request.requesterSlots && request.requesterSlots.length > 0) {
                             requesterOriginalSlots.push(...request.requesterSlots);
                          } else {
                             // exchange_request가 아닌 경우, 현재 슬롯에서 C의 슬롯 찾기
                             const requesterSlots = room.timeSlots.filter(slot => {
                                const slotUserId = slot.user._id || slot.user;
                                return slotUserId.toString() === requester._id.toString();
                             });
                             requesterSlots.forEach(slot => {
                                requesterOriginalSlots.push({
                                   user: requester._id,
                                   date: slot.date,
                                   startTime: slot.startTime,
                                   endTime: slot.endTime,
                                   day: slot.day,
                                   subject: slot.subject || '자동 배정',
                                   status: 'confirmed'
                                });
                             });
                          }
                          console.log(`💾 Saved ${requesterOriginalSlots.length} requester's original slots in chainData`);

                          // B의 슬롯도 저장 (chain 성공 시 삭제해야 함)
                          const intermediateOriginalSlots = overlappingSlots.map(slot => ({
                             user: targetUser._id,
                             date: slot.date,
                             startTime: slot.startTime,
                             endTime: slot.endTime,
                             day: slot.day,
                             subject: slot.subject || '자동 배정',
                             status: 'confirmed'
                          }));
                          console.log(`💾 Saved ${intermediateOriginalSlots.length} intermediate user's (B) original slots`);

                          // B의 선호시간을 차지한 사람들 찾기 (연쇄 조정 후보)
                          const excludeUsers = [requester._id.toString()]; // 원본 요청자 제외
                          const chainCandidates = findChainCandidates(room, targetUser._id.toString(), excludeUsers);

                          if (chainCandidates.length > 0) {
                             // 자동으로 첫 번째 후보에게 연쇄 요청 생성
                             const firstCandidate = chainCandidates[0];
                             console.log(`📋 Chain candidate found: ${firstCandidate.userName} - Creating automatic chain request`);

                             const candidateUserId = firstCandidate.userId;
                             const candidateSlot = firstCandidate.slot;

                             // A가 가진 슬롯의 전체 시간 계산 (30분 단위 슬롯들을 병합)
                             const candidateAllSlots = room.timeSlots.filter(s =>
                                (s.user._id || s.user).toString() === candidateUserId &&
                                new Date(s.date).toISOString().split('T')[0] === new Date(candidateSlot.date).toISOString().split('T')[0] &&
                                s.day === candidateSlot.day
                             ).sort((a, b) => {
                                const [ah, am] = a.startTime.split(':').map(Number);
                                const [bh, bm] = b.startTime.split(':').map(Number);
                                return (ah * 60 + am) - (bh * 60 + bm);
                             });

                             const dayMapKorean = {
                                'monday': '월요일',
                                'tuesday': '화요일',
                                'wednesday': '수요일',
                                'thursday': '목요일',
                                'friday': '금요일'
                             };

                             const candidateStartTime = candidateAllSlots[0].startTime;
                             const candidateEndTime = candidateAllSlots[candidateAllSlots.length - 1].endTime;

                             // A에게 새로운 연쇄 요청 생성
                             room.requests.push({
                                requester: targetUser._id, // B가 요청자
                                targetUser: candidateUserId, // A가 대상
                                type: 'chain_request',
                                timeSlot: {
                                   day: candidateSlot.day,
                                   date: candidateSlot.date,
                                   startTime: candidateStartTime,
                                   endTime: candidateEndTime
                                },
                                message: `${targetUser.firstName || 'B'}님이 일정 조정을 위해 ${dayMapKorean[candidateSlot.day] || candidateSlot.day} ${candidateStartTime}-${candidateEndTime} 자리를 요청합니다. 남아있는 빈 시간으로 이동해주실 수 있나요?`,
                                status: 'pending',
                                createdAt: new Date(),
                                chainData: {
                                   originalRequester: requester._id, // C
                                   originalRequest: request._id,
                                   intermediateUser: targetUser._id, // B
                                   intermediateSlot: timeSlot, // B의 원래 자리 (C가 원하는 자리)
                                   requesterOriginalSlots: requesterOriginalSlots, // C의 원래 슬롯들
                                   intermediateOriginalSlots: intermediateOriginalSlots // B의 원래 슬롯들
                                }
                             });

                             console.log(`🔍 [DEBUG] ChainData created with:`, {
                                requesterOriginalSlots: requesterOriginalSlots.length,
                                intermediateOriginalSlots: intermediateOriginalSlots.length
                             });

                             // 원래 요청(C → B)은 'waiting_for_chain' 상태로 변경
                             request.status = 'waiting_for_chain';
                             request.response = `${targetUser.firstName}님에게 이동할 빈 시간이 없어, ${firstCandidate.userName}님에게 연쇄 요청을 보냈습니다.`;

                             console.log(`📋 Chain request created: ${targetUser.firstName} → ${firstCandidate.userName}`);
                             console.log(`📋 Original request (C → B) status: waiting_for_chain`);
                             console.log(`✅ NO slots were modified - waiting for A's approval`);
                          } else {
                             // 연쇄 조정 후보가 없는 경우 - 요청 실패 처리
                             console.log(`❌ No chain candidates found - exchange cannot proceed`);
                             request.status = 'rejected';
                             request.response = '대체 가능한 시간을 찾을 수 없고, 연쇄 조정할 후보도 없어 조정이 불가능합니다.';
                             console.log(`✅ No slots were modified`);
                          }
                       }

                       room.markModified('timeSlots');
                       room.markModified('requests');

                       // ★ End of if(overlappingSlots.length > 0) block
                    } else {
                       // No overlapping slots found - this shouldn't happen but handle gracefully
                       console.log('⚠️ No overlapping slots found');
                       request.status = 'approved';
                       request.respondedAt = new Date();
                       request.respondedBy = req.user.id;
                       room.markModified('requests');
                    }
                 }
              }
           } else if (type === 'chain_request') {
              // 🆕 연쇄 요청 처리 (D가 승인할 때 - B → D)
              console.log('🔗 Processing chain_request approval (D approving B\'s request)...');

              // 헬퍼 함수들
              const toMinutes = (timeStr) => {
                 const [h, m] = timeStr.split(':').map(Number);
                 return h * 60 + m;
              };

              const toTimeString = (minutes) => {
                 const h = Math.floor(minutes / 60);
                 const m = minutes % 60;
                 return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
              };

              const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

              const chainData = request.chainData;
              if (!chainData) {
                 console.log('❌ No chainData found in chain_request');
              } else {
                 const originalRequesterId = chainData.originalRequester.toString(); // C
                 const intermediateUserId = chainData.intermediateUser.toString(); // B
                 const chainUserId = (targetUser._id || targetUser).toString(); // D

              console.log(`📋 Chain participants: C=${originalRequesterId.slice(-6)}, B=${intermediateUserId.slice(-6)}, D=${chainUserId.slice(-6)}`);

              // D의 현재 슬롯들 (C가 원하는 시간대, 즉 B → D로 전달된 요청)
              const dSlotDay = timeSlot.day;
              const dSlotDate = timeSlot.date; // chain_request 생성 시 포함된 날짜
              const dSlotStartTime = timeSlot.startTime;
              const dSlotEndTime = timeSlot.endTime;

              // D의 모든 연속 슬롯 찾기 (시간 범위 내의 모든 슬롯)
              const dSlotsToRemove = room.timeSlots.filter(slot => {
                 const slotUserId = (slot.user._id || slot.user).toString();
                 if (slotUserId !== chainUserId) return false;
                 if (slot.day !== dSlotDay) return false;

                 // 날짜 체크 (같은 날짜의 슬롯만)
                 if (dSlotDate && slot.date) {
                    const slotDateStr = new Date(slot.date).toISOString().split('T')[0];
                    const targetDateStr = new Date(dSlotDate).toISOString().split('T')[0];
                    if (slotDateStr !== targetDateStr) return false;
                 }

                 // 시간 범위 겹침 체크
                 const slotStart = toMinutes(slot.startTime);
                 const slotEnd = toMinutes(slot.endTime);
                 const requestStart = toMinutes(dSlotStartTime);
                 const requestEnd = toMinutes(dSlotEndTime);

                 return slotStart < requestEnd && requestStart < slotEnd;
              });

              if (dSlotsToRemove.length === 0) {
                 console.log('❌ D has no slots to exchange');
                 request.status = 'rejected';
                 request.response = 'D의 슬롯을 찾을 수 없습니다.';
                 room.markModified('requests');
              } else {
                 console.log(`📋 D has ${dSlotsToRemove.length} slots to exchange`);

                 // 필요한 시간 계산 (D가 이동해야 할 시간)
                 const requiredDuration = toMinutes(dSlotEndTime) - toMinutes(dSlotStartTime); // minutes

                 // D의 빈 시간 찾기 (선호시간 중)
                 const dUserMember = room.members.find(m =>
                    (m.user._id || m.user).toString() === chainUserId
                 );
                 const dUserData = dUserMember?.user || targetUser;
                 const dUserSchedule = dUserData?.defaultSchedule || [];
                 const ownerSchedule = room.owner?.defaultSchedule || [];

                 console.log(`🔍 D's schedule entries: ${dUserSchedule.length}`);

                 // 요일별 스케줄 그룹화 및 병합
                 const scheduleByDay = {};
                 const seenBlocks = new Set();
                 const requestDateMs = new Date(dSlotDate).getTime();

                 dUserSchedule.forEach(s => {
                    // 같은 주 (7일 이내)인지 체크
                    if (s.specificDate) {
                       const specificDateMs = new Date(s.specificDate).getTime();
                       const daysDiff = Math.abs(specificDateMs - requestDateMs) / (1000 * 60 * 60 * 24);
                       if (daysDiff > 7) return;
                    }

                    const blockKey = `${s.dayOfWeek}-${s.startTime}-${s.endTime}`;
                    if (seenBlocks.has(blockKey)) return;
                    seenBlocks.add(blockKey);

                    if (!scheduleByDay[s.dayOfWeek]) scheduleByDay[s.dayOfWeek] = [];
                    scheduleByDay[s.dayOfWeek].push({
                       start: toMinutes(s.startTime),
                       end: toMinutes(s.endTime)
                    });
                 });

                 // 병합 및 정렬
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

                 // 후보 찾기
                 const candidates = [];
                 const dDayOfWeek = dayNames.indexOf(dSlotDay.toLowerCase());

                 // 같은 날 먼저 체크
                 if (scheduleByDay[dDayOfWeek]) {
                    scheduleByDay[dDayOfWeek].forEach(block => {
                       const requestStart = toMinutes(dSlotStartTime);
                       const requestEnd = toMinutes(dSlotEndTime);

                       // 요청 시간 전
                       if (block.start < requestStart) {
                          const availableEnd = Math.min(block.end, requestStart);
                          if (availableEnd - block.start >= requiredDuration) {
                             candidates.push({
                                dayOfWeek: dDayOfWeek,
                                date: new Date(dSlotDate),
                                startMinutes: block.start,
                                distance: block.start
                             });
                          }
                       }

                       // 요청 시간 후
                       if (block.end > requestEnd) {
                          const availableStart = Math.max(block.start, requestEnd);
                          if (block.end - availableStart >= requiredDuration) {
                             candidates.push({
                                dayOfWeek: dDayOfWeek,
                                date: new Date(dSlotDate),
                                startMinutes: availableStart,
                                distance: availableStart
                             });
                          }
                       }
                    });
                 }

                 // 다른 날 체크 (7일 이내)
                 Object.keys(scheduleByDay).forEach(scheduleDayStr => {
                    const scheduleDay = parseInt(scheduleDayStr);
                    if (scheduleDay === dDayOfWeek) return;

                    let daysUntil = (scheduleDay - dDayOfWeek + 7) % 7;
                    if (daysUntil === 0) daysUntil = 7;

                    if (daysUntil <= 7) {
                       const checkDate = new Date(dSlotDate);
                       checkDate.setUTCDate(checkDate.getUTCDate() + daysUntil);

                       scheduleByDay[scheduleDay].forEach(block => {
                          if (block.end - block.start >= requiredDuration) {
                             const distance = daysUntil * 1440 + block.start;
                             candidates.push({
                                dayOfWeek: scheduleDay,
                                date: checkDate,
                                startMinutes: block.start,
                                distance: distance
                             });
                          }
                       });
                    }
                 });

                 candidates.sort((a, b) => a.distance - b.distance);
                 console.log(`📊 Found ${candidates.length} candidates for D`);
                 console.log(`👑 Owner schedule entries: ${ownerSchedule.length}`);
                 if (ownerSchedule.length > 0) {
                    console.log(`👑 Owner schedule sample:`, ownerSchedule.slice(0, 3).map(os => ({
                       dayOfWeek: os.dayOfWeek,
                       day: dayNames[os.dayOfWeek],
                       startTime: os.startTime,
                       endTime: os.endTime
                    })));
                 }

                 // 가장 가까운 빈 시간 찾기
                 let bestCandidate = null;
                 for (const candidate of candidates) {
                    const candidateDateStr = candidate.date.toISOString().split('T')[0];
                    const candidateDay = dayNames[candidate.dayOfWeek];
                    const candidateStart = toTimeString(candidate.startMinutes);
                    const candidateEnd = toTimeString(candidate.startMinutes + requiredDuration);

                    console.log(`🔍 Checking candidate: ${candidateDay} ${candidateStart}-${candidateEnd}`);

                    // D의 기존 슬롯과 겹치는지 확인
                    const hasConflict = room.timeSlots.some(slot => {
                       if ((slot.user._id || slot.user).toString() !== chainUserId) return false;
                       if (new Date(slot.date).toISOString().split('T')[0] !== candidateDateStr) return false;
                       if (slot.day !== candidateDay) return false;

                       const slotStart = toMinutes(slot.startTime);
                       const slotEnd = toMinutes(slot.endTime);
                       const candStart = candidate.startMinutes;
                       const candEnd = candidate.startMinutes + requiredDuration;

                       return slotStart < candEnd && candStart < slotEnd;
                    });

                    // 방장 허용 시간과 겹치는지 확인 (방장 스케줄 = 허용된 시간)
                    // 방장 스케줄이 10분 단위로 쪼개져 있으므로, 겹침(overlap)으로 확인
                    const isInOwnerSchedule = ownerSchedule.some(os => {
                       if (os.dayOfWeek !== candidate.dayOfWeek) return false;

                       const osStart = toMinutes(os.startTime);
                       const osEnd = toMinutes(os.endTime);
                       const candStart = candidate.startMinutes;
                       const candEnd = candidate.startMinutes + requiredDuration;

                       // 겹침 확인: 후보 시간이 방장 스케줄과 겹치면 허용
                       const overlaps = candStart < osEnd && candEnd > osStart;
                       return overlaps;
                    });

                    if (!hasConflict && isInOwnerSchedule) {
                       console.log(`   ✅ Candidate accepted! No conflict and overlaps with owner schedule.`);
                       bestCandidate = candidate;
                       break;
                    } else {
                       console.log(`   ❌ Candidate rejected: hasConflict=${hasConflict}, isInOwnerSchedule=${isInOwnerSchedule}`);
                    }
                 }

                 if (bestCandidate) {
                    console.log(`✅ Found best candidate for D: ${dayNames[bestCandidate.dayOfWeek]} ${toTimeString(bestCandidate.startMinutes)}`);

                    // 0. ★ 먼저 C와 B의 원래 슬롯들 제거
                    // C의 원래 슬롯 제거
                    if (chainData.requesterOriginalSlots && chainData.requesterOriginalSlots.length > 0) {
                       console.log(`🗑️ Removing ${chainData.requesterOriginalSlots.length} original slots from C`);
                       chainData.requesterOriginalSlots.forEach(reqSlot => {
                          const reqDateStr = reqSlot.date ? new Date(reqSlot.date).toISOString().split('T')[0] : null;
                          const index = room.timeSlots.findIndex(slot => {
                             const slotUserId = slot.user._id || slot.user;
                             if (slotUserId.toString() !== originalRequesterId.toString()) return false;
                             if (slot.startTime !== reqSlot.startTime) return false;
                             if (slot.endTime !== reqSlot.endTime) return false;
                             if (!slot.date || !reqDateStr) return false;
                             const slotDateStr = new Date(slot.date).toISOString().split('T')[0];
                             return slotDateStr === reqDateStr;
                          });
                          if (index !== -1) {
                             room.timeSlots.splice(index, 1);
                             console.log(`   ❌ Removed C's original slot: ${reqSlot.day} ${reqSlot.startTime}-${reqSlot.endTime}`);
                          }
                       });
                    }

                    // B의 원래 슬롯 제거
                    if (chainData.intermediateOriginalSlots && chainData.intermediateOriginalSlots.length > 0) {
                       console.log(`🗑️ Removing ${chainData.intermediateOriginalSlots.length} original slots from B`);
                       chainData.intermediateOriginalSlots.forEach(intSlot => {
                          const intDateStr = intSlot.date ? new Date(intSlot.date).toISOString().split('T')[0] : null;
                          const index = room.timeSlots.findIndex(slot => {
                             const slotUserId = slot.user._id || slot.user;
                             if (slotUserId.toString() !== intermediateUserId.toString()) return false;
                             if (slot.startTime !== intSlot.startTime) return false;
                             if (slot.endTime !== intSlot.endTime) return false;
                             if (!slot.date || !intDateStr) return false;
                             const slotDateStr = new Date(slot.date).toISOString().split('T')[0];
                             return slotDateStr === intDateStr;
                          });
                          if (index !== -1) {
                             room.timeSlots.splice(index, 1);
                             console.log(`   ❌ Removed B's original slot: ${intSlot.day} ${intSlot.startTime}-${intSlot.endTime}`);
                          }
                       });
                    }

                    // 1. D의 기존 슬롯 제거
                    console.log(`🗑️ Removing ${dSlotsToRemove.length} slots from D`);
                    dSlotsToRemove.forEach(slot => {
                       const index = room.timeSlots.findIndex(s => s._id && slot._id && s._id.equals(slot._id));
                       if (index !== -1) {
                          room.timeSlots.splice(index, 1);
                          console.log(`   ❌ Removed D's slot: ${new Date(slot.date).toISOString().split('T')[0]} ${slot.startTime}-${slot.endTime}`);
                       }
                    });

                    // 2. D를 새 시간으로 이동
                    room.timeSlots.push({
                       user: chainUserId,
                       date: bestCandidate.date,
                       startTime: toTimeString(bestCandidate.startMinutes),
                       endTime: toTimeString(bestCandidate.startMinutes + requiredDuration),
                       day: dayNames[bestCandidate.dayOfWeek],
                       subject: '연쇄 조정 결과',
                       status: 'confirmed',
                       assignedBy: req.user.id,
                       assignedAt: new Date()
                    });
                    console.log(`➕ Moved D to new slot: ${dayNames[bestCandidate.dayOfWeek]} ${toTimeString(bestCandidate.startMinutes)}-${toTimeString(bestCandidate.startMinutes + requiredDuration)}`);

                    // 3. B를 D의 원래 자리로 이동
                    room.timeSlots.push({
                       user: intermediateUserId,
                       date: dSlotDate,
                       startTime: dSlotStartTime,
                       endTime: dSlotEndTime,
                       day: dSlotDay,
                       subject: '연쇄 조정 결과',
                       status: 'confirmed',
                       assignedBy: req.user.id,
                       assignedAt: new Date()
                    });
                    console.log(`➕ Moved B to D's old slot: ${dSlotDay} ${dSlotStartTime}-${dSlotEndTime}`);

                    // 4. C를 B의 원래 자리로 이동 (intermediateSlot)
                    const bOriginalSlot = chainData.intermediateSlot;
                    room.timeSlots.push({
                       user: originalRequesterId,
                       date: bOriginalSlot.date || dSlotDate,
                       startTime: bOriginalSlot.startTime,
                       endTime: bOriginalSlot.endTime,
                       day: bOriginalSlot.day,
                       subject: '연쇄 조정 결과',
                       status: 'confirmed',
                       assignedBy: req.user.id,
                       assignedAt: new Date()
                    });
                    console.log(`➕ Moved C to B's old slot: ${bOriginalSlot.day} ${bOriginalSlot.startTime}-${bOriginalSlot.endTime}`);

                    // 5. 원본 요청 (C → B) 완료 처리
                    const originalRequest = room.requests.id(chainData.originalRequest);
                    if (originalRequest) {
                       originalRequest.status = 'approved';
                       originalRequest.respondedAt = new Date();
                       originalRequest.respondedBy = req.user.id;
                       originalRequest.response = `연쇄 조정 완료 - D가 승인`;
                       console.log(`✅ Original request (C → B) marked as approved`);
                    } else {
                       console.log(`⚠️ Original request not found: ${chainData.originalRequest}`);
                    }

                    console.log('✅ Chain request completed successfully! C → B → D exchange done.');
                 } else {
                    // D도 빈 시간이 없는 경우 - 실패 처리
                    console.log('❌ No alternative slot found for D');
                    request.status = 'rejected';
                    request.response = 'D가 이동할 빈 시간이 없어 조정이 실패했습니다.';

                    // 원본 요청도 실패 처리
                    const originalRequest = room.requests.id(chainData.originalRequest);
                    if (originalRequest) {
                       originalRequest.status = 'rejected';
                       originalRequest.response = '연쇄 조정 실패 - D가 이동할 빈 시간 없음';
                    }

                    // ★ 슬롯 복원 불필요: chain 생성 시 아무것도 삭제하지 않았기 때문
                    console.log(`ℹ️ No slot restoration needed - slots were never modified`);
                 }

                 room.markModified('timeSlots');
                 room.markModified('requests');
              }
              }
           }

           console.log('📊 After processing - Total timeSlots:', room.timeSlots.length);
           console.log('📊 Request status before save:', request.status);
           console.log('💾 Saving room changes...');
           try {
              await room.save();
              console.log('✅ Room saved successfully!');
           } catch (saveError) {
              console.error('❌ Room save error:', saveError);
              throw saveError;
           }
        } else if (action === 'rejected') {
           // 거절 시에도 DB에 저장
           console.log('❌ Action is REJECTED - saving status...');
           room.markModified('requests');
           try {
              await room.save();
              console.log('✅ Room saved successfully (rejected)!');
           } catch (saveError) {
              console.error('❌ Room save error:', saveError);
              throw saveError;
           }
        }

        // 🆕 waiting_for_chain 상태인 경우 바로 응답 반환 (activity log 생략)
        if (request.status === 'waiting_for_chain') {
           console.log('📋 Returning early for waiting_for_chain status - chain request has been created');
           const updatedRoom = await Room.findById(room._id)
              .populate('requests.requester', 'firstName lastName email')
              .populate('requests.targetUser', 'firstName lastName email')
              .populate('timeSlots.user', '_id firstName lastName email')
              .populate('members.user', 'firstName lastName email');
           return res.json(updatedRoom);
        }

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
           // ★ chain_request 거절 시 원본 요청도 실패 처리
           if (request.type === 'chain_request' && request.chainData) {
              const chainData = request.chainData;

              // 원본 요청도 실패 처리
              const originalRequest = room.requests.id(chainData.originalRequest);
              if (originalRequest) {
                 originalRequest.status = 'rejected';
                 originalRequest.response = '연쇄 조정 거절됨';
                 console.log(`❌ Original request also marked as rejected`);
              }

              // ★ 슬롯 복원 불필요: chain 생성 시 아무것도 삭제하지 않았기 때문
              console.log(`ℹ️ No slot restoration needed - slots were never modified`);
              
              room.markModified('requests');
              await room.save();
           }

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
        console.error('❌ handleRequest error:', error);
        console.error('❌ Error stack:', error.stack);
        res.status(500).json({ msg: 'Server error', error: error.message });
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

// @desc    Handle chain confirmation (C가 연쇄 조정 진행/취소 결정)
// @route   POST /api/coordination/requests/:requestId/chain-confirm
// @access  Private (Requester only)
exports.handleChainConfirmation = async (req, res) => {
   try {
      const { requestId } = req.params;
      const { action } = req.body; // 'proceed' or 'cancel'

      console.log('🔗 ========== CHAIN CONFIRMATION ==========');
      console.log('📋 Request ID:', requestId);
      console.log('📋 Action:', action);
      console.log('👤 User ID:', req.user.id);

      if (!['proceed', 'cancel'].includes(action)) {
         return res.status(400).json({ msg: '유효하지 않은 액션입니다. proceed 또는 cancel만 허용됩니다.' });
      }

      const room = await Room.findOne({ 'requests._id': requestId })
         .populate('owner', 'firstName lastName email defaultSchedule')
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

      // 요청자만 연쇄 조정 확인 가능
      const requesterId = request.requester._id ? request.requester._id.toString() : request.requester.toString();
      if (requesterId !== req.user.id) {
         return res.status(403).json({ msg: '이 요청의 연쇄 조정을 확인할 권한이 없습니다.' });
      }

      if (request.status !== 'needs_chain_confirmation') {
         return res.status(400).json({ msg: '연쇄 조정 확인이 필요한 요청이 아닙니다.' });
      }

      if (!request.chainData) {
         return res.status(400).json({ msg: '연쇄 조정 데이터가 없습니다.' });
      }

      if (action === 'cancel') {
         // 취소: 요청 상태를 cancelled로 변경
         request.status = 'cancelled';
         request.response = '요청자가 연쇄 조정을 취소했습니다.';
         request.respondedAt = new Date();

         await room.save();
         console.log('❌ Chain exchange cancelled by requester');

         return res.json({
            success: true,
            msg: '연쇄 조정이 취소되었습니다.',
            room: await Room.findById(room._id)
               .populate('requests.requester', 'firstName lastName email')
               .populate('requests.targetUser', 'firstName lastName email')
               .populate('timeSlots.user', '_id firstName lastName email')
         });
      }

      // action === 'proceed': 연쇄 조정 진행
      console.log('✅ Proceeding with chain exchange');

      const { firstCandidate, intermediateUser, intermediateSlot, candidateUsers } = request.chainData;
      const targetUser = await User.findById(intermediateUser);

      // 연쇄 요청 생성
      const chainRequest = {
         requester: intermediateUser, // B가 요청자
         type: 'chain_exchange_request',
         targetUser: firstCandidate.userId, // 연쇄 조정 대상
         requesterSlots: request.requesterSlots || [],
         targetSlot: firstCandidate.slot,
         timeSlot: {
            day: firstCandidate.slot.day,
            date: firstCandidate.slot.date,
            startTime: firstCandidate.slot.startTime,
            endTime: firstCandidate.slot.endTime
         },
         message: `${targetUser.firstName}님이 일정 조정을 위해 ${firstCandidate.slot.day} ${firstCandidate.slot.startTime} 자리를 요청합니다. 남아있는 빈 시간으로 이동해주실 수 있나요?`,
         chainData: {
            originalRequestId: request._id,
            originalRequester: request.requester._id || request.requester,
            intermediateUser: intermediateUser,
            chainUser: firstCandidate.userId,
            intermediateSlot: intermediateSlot,
            chainSlot: firstCandidate.slot,
            rejectedUsers: [],
            candidateUsers: candidateUsers || []
         },
         status: 'pending',
         createdAt: new Date()
      };

      room.requests.push(chainRequest);

      // 원본 요청 상태 업데이트
      request.status = 'pending';
      request.response = `연쇄 조정 진행 중 - ${firstCandidate.userName}님에게 요청 전송됨`;

      await room.save();
      console.log(`✅ Chain exchange request created, waiting for ${firstCandidate.userName}'s response`);

      const updatedRoom = await Room.findById(room._id)
         .populate('requests.requester', 'firstName lastName email')
         .populate('requests.targetUser', 'firstName lastName email')
         .populate('timeSlots.user', '_id firstName lastName email')
         .populate('members.user', 'firstName lastName email');

      res.json({
         success: true,
         msg: `연쇄 조정이 시작되었습니다. ${firstCandidate.userName}님에게 요청이 전송되었습니다.`,
         room: updatedRoom
      });
   } catch (error) {
      console.error('Chain confirmation error:', error);
      res.status(500).json({ success: false, msg: 'Server error' });
   }
};
