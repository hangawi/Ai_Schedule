const Room = require('../models/room');
const User = require('../models/user');
const ActivityLog = require('../models/ActivityLog');
const schedulingAlgorithm = require('../services/schedulingAlgorithm');
const dynamicTravelTimeCalculator = require('../services/dynamicTravelTimeCalculator');
const { isTimeInBlockedRange } = require('../services/schedulingAlgorithm/validators/prohibitedTimeValidator');

// 시간을 분으로 변환하는 유틸리티 함수
const timeToMinutes = (timeString) => {
  if (!timeString) return 0;
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
};

// @desc    Run auto-schedule algorithm for the room
// @route   POST /api/coordination/rooms/:roomId/auto-schedule
// @access  Private (Room Owner only)
exports.runAutoSchedule = async (req, res) => {
   try {
      const { roomId } = req.params;
      const { 
      minHoursPerWeek = 3, 
      numWeeks = 4, 
      currentWeek, 
      assignmentMode,
      transportMode = 'normal',           // 추가: 대중교통 모드 (기본값: normal)
      minClassDurationMinutes = 60        // 추가: 최소 수업시간 (기본값: 60분)
   } = req.body;
      
      const validModes = ['normal', 'first_come_first_served', 'from_today'];
      const mode = assignmentMode && validModes.includes(assignmentMode)
        ? assignmentMode
        : 'normal';

      const startDate = currentWeek ? new Date(currentWeek) : new Date();
      
      console.log('🔍 ===== [서버] 자동배정 요청 받음 =====');
      console.log('📥 받은 파라미터:', { 
         minHoursPerWeek, 
         numWeeks, 
         currentWeek: currentWeek ? currentWeek : 'undefined', 
         assignmentMode: mode,
         transportMode,              // 추가
         minClassDurationMinutes     // 추가
      });
      console.log('📅 계산된 startDate:', startDate.toISOString().split('T')[0]);
      console.log('🔍 ===================================\n');

      const room = await Room.findById(roomId)
        .populate('owner', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes priority')
        .populate('members.user', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes priority');

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      if (!room.isOwner(req.user.id)) {
         return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
      }

// Clear previous auto-generated slots before running new schedule
      // 단, 협의로 배정된 슬롯(subject에 '협의'가 포함된 것)은 보존
      // 🔒 확정된 슬롯도 보존 (중복 방지)
      room.timeSlots = room.timeSlots.filter(slot => {
         // assignedBy가 없으면 수동 배정 → 유지
         if (!slot.assignedBy) return true;
         
         // 🔒 개인 일정으로 확정된 슬롯 → 유지
         if (slot.confirmedToPersonalCalendar) return true;
         
         // 협의로 배정된 슬롯 → 유지
         if (slot.subject && (slot.subject.includes('협의') || slot.subject === '자동 배정')) {
            // '협의 결과', '협의 결과 (대체시간)', '협의 결과 (시간선택)' 등은 유지
            if (slot.subject.includes('협의')) return true;
            // '자동 배정'은 삭제
            if (slot.subject === '자동 배정') return false;
         }
         // 기타 assignedBy가 있는 슬롯 → 삭제
         return false;
      });

      // ✨ 이동시간 모드 관련 데이터 초기화 (자동배정은 항상 새로 시작)
      room.originalTimeSlots = [];
      room.travelTimeSlots = [];
      console.log('🔄 [자동배정 시작] originalTimeSlots와 travelTimeSlots 초기화');

      if (minHoursPerWeek < 0.167 || minHoursPerWeek > 10) {
         return res.status(400).json({ msg: '주당 최소 할당 시간은 10분-10시간 사이여야 합니다.' });
      }
      
      // Save settings to room
      room.settings.minHoursPerWeek = minHoursPerWeek;
      room.settings.assignmentMode = mode;

      await room.save();

      const membersOnly = room.members.filter(m => {
         const memberId = m.user._id ? m.user._id.toString() : m.user.toString();
         const ownerId = room.owner._id ? room.owner._id.toString() : room.owner.toString();
         return memberId !== ownerId;
      });



      const memberIds = membersOnly.map(m => {
        const memberId = m.user._id ? m.user._id.toString() : m.user.toString();
        return memberId;
      });

      // 개인 시간표가 있는지 확인 (defaultSchedule 또는 scheduleExceptions 중 하나라도 있으면 OK)
      let membersWithDefaultSchedule = 0;
      for (const member of membersOnly) {
        const hasDefaultSchedule = member.user.defaultSchedule && member.user.defaultSchedule.length > 0;
        const hasScheduleExceptions = member.user.scheduleExceptions && member.user.scheduleExceptions.length > 0;
        if (hasDefaultSchedule || hasScheduleExceptions) {
          membersWithDefaultSchedule++;
        }
      }

      // 방장 선호시간 확인 (defaultSchedule 또는 scheduleExceptions 중 하나라도 있으면 OK)
      const ownerHasDefaultSchedule = room.owner?.defaultSchedule && room.owner.defaultSchedule.length > 0;
      const ownerHasScheduleExceptions = room.owner?.scheduleExceptions && room.owner.scheduleExceptions.length > 0;

      if (!room.owner || (!ownerHasDefaultSchedule && !ownerHasScheduleExceptions)) {
        const ownerName = `${room.owner?.firstName || ''} ${room.owner?.lastName || ''}`.trim() || '방장';
        return res.status(400).json({
          msg: `방장(${ownerName})이 선호시간표를 설정하지 않았습니다. 내프로필에서 선호시간표를 설정해주세요.`
        });
      }

      const membersWithoutDefaultSchedule = [];
      for (const member of membersOnly) {
        const hasDefaultSchedule = member.user?.defaultSchedule && member.user.defaultSchedule.length > 0;
        const hasScheduleExceptions = member.user?.scheduleExceptions && member.user.scheduleExceptions.length > 0;

        if (!member.user || (!hasDefaultSchedule && !hasScheduleExceptions)) {
          const userName = member.user?.name || `${member.user?.firstName || ''} ${member.user?.lastName || ''}`.trim() || '알 수 없음';
          membersWithoutDefaultSchedule.push(userName);
        }
      }
      if (membersWithoutDefaultSchedule.length > 0) {
        return res.status(400).json({
          msg: `다음 멤버들이 선호시간표를 설정하지 않았습니다: ${membersWithoutDefaultSchedule.join(', ')}. 각 멤버는 내프로필에서 선호시간표를 설정해야 합니다.`
        });
      }

      // 방 설정의 금지 시간(점심시간 등) 적용
      const ownerBlockedTimes = room.settings.blockedTimes || [];

      const existingCarryOvers = [];
      for (const member of room.members) {
        if (member.carryOver > 0) {
          existingCarryOvers.push({
            memberId: member.user._id.toString(),
            neededHours: member.carryOver,
            priority: member.priority || 3,
            week: startDate
          });
        }
      }

      // 🔒 이미 위에서 확정된 슬롯을 제외하고 필터링했으므로
      // 여기서는 추가 삭제 없이 바로 자동배정 진행

      // 개인 시간표 기반 자동배정으로 변경
      const result = await schedulingAlgorithm.runAutoSchedule(
         membersOnly,
         room.owner,
         room.timeSlots, // 💡 협의로 배정된 기존 슬롯 전달 (이미 충족된 멤버 제외용)
         {
            assignmentMode: mode,
            minHoursPerWeek,
            numWeeks,
            currentWeek,
            roomSettings: {
               ...room.settings,
               ownerBlockedTimes: ownerBlockedTimes
            },
            transportMode,              // 추가: 이동수단 모드 전달
            minClassDurationMinutes     // 추가: 최소 수업 시간 전달
         },
         existingCarryOvers,
      );

      const twoWeeksAgo = new Date(startDate);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const oneWeekAgo = new Date(startDate);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const conflictSuggestions = [];

      for (const member of room.members) {
        const memberUser = await User.findById(member.user);
        if (member.carryOver > 0) { // They have a carry-over from last week
            const history = member.carryOverHistory || [];

            const hasConsecutiveCarryOver = history.some(h =>
                new Date(h.week).getTime() >= twoWeeksAgo.getTime() &&
                new Date(h.week).getTime() < oneWeekAgo.getTime() &&
                h.amount > 0
            );

            if (hasConsecutiveCarryOver) {
                const memberName = memberUser.name || `${memberUser.firstName} ${memberUser.lastName}`;
                conflictSuggestions.push({
                    title: '장기 이월 멤버 발생',
                    content: `멤버 '${memberName}'의 시간이 2주 이상 연속으로 이월되었습니다. 최소 할당 시간을 줄이거나, 멤버의 참여 가능 시간을 늘리거나, 직접 시간을 할당하여 문제를 해결해야 합니다.`
                });
            }
        }
      }

      // 중복 삭제 방지 - 이미 위에서 삭제했으므로 주석 처리
      // room.timeSlots = room.timeSlots.filter(slot => !slot.assignedBy);



      // 중복 방지를 위한 Set 생성
      const addedSlots = new Set();

      Object.values(result.assignments).forEach(assignment => {

         if (assignment.slots && assignment.slots.length > 0) {
            assignment.slots.forEach((slot, idx) => {
               // 필수 필드 검증
               if (!slot.day || !slot.startTime || !slot.endTime || !slot.date) {
                  return; // 이 슬롯은 건너뛰기
               }

               // 중복 체크를 위한 유니크 키 생성
               const slotKey = `${assignment.memberId}-${slot.day}-${slot.startTime}-${slot.endTime}-${new Date(slot.date).toISOString().split('T')[0]}`;

               if (!addedSlots.has(slotKey)) {
                  const dateStr = new Date(slot.date).toLocaleDateString('ko-KR');

                  const newSlot = {
                     user: assignment.memberId,
                     date: slot.date,
                     startTime: slot.startTime,
                     endTime: slot.endTime,
                     day: slot.day,
                     priority: 3,
                     subject: '자동 배정',
                     assignedBy: req.user.id || req.user._id || 'auto-scheduler',
                     assignedAt: new Date(),
                     status: 'confirmed',
                  };

                  room.timeSlots.push(newSlot);
                  addedSlots.add(slotKey);
               } else {
               }
            });
         }
      });

      const autoAssignedCount = room.timeSlots.filter(slot => slot.assignedBy).length;
      const totalSlotCount = room.timeSlots.length;

      // 다른 방법으로 자동 배정 슬롯 찾기
      const autoSlotsBySubject = room.timeSlots.filter(slot => slot.subject === '자동 배정');

      // 디버깅을 위해 실제 저장된 슬롯들 확인
      const recentlyAdded = room.timeSlots.filter(slot => slot.assignedBy || slot.subject === '자동 배정');

      // Negotiations feature removed

      for (const member of room.members) {
        const memberId = member.user._id.toString();
        const assignment = result.assignments[memberId];

        if (assignment && assignment.assignedHours >= minHoursPerWeek * 2) {
          if (member.carryOver > 0) {
            member.carryOverHistory.push({
              week: startDate,
              amount: -member.carryOver,
              reason: 'resolved_by_auto_schedule',
              timestamp: new Date()
            });
            member.carryOver = 0;
          }
        }
      }

      // 이월시간 처리 개선
      if (result.carryOverAssignments && result.carryOverAssignments.length > 0) {

         for (const carryOver of result.carryOverAssignments) {
            const memberIndex = room.members.findIndex(m =>
               m.user.toString() === carryOver.memberId
            );

            if (memberIndex !== -1) {
               const member = room.members[memberIndex];
               const previousCarryOver = member.carryOver || 0;
               member.carryOver = (member.carryOver || 0) + carryOver.neededHours;

               if (carryOver.neededHours > 0) {
                 // 이월 히스토리 업데이트
                 if (!member.carryOverHistory) {
                   member.carryOverHistory = [];
                 }

                 member.carryOverHistory.push({
                    week: carryOver.week || startDate,
                    amount: carryOver.neededHours,
                    reason: 'unassigned_from_auto_schedule',
                    timestamp: new Date(),
                    priority: carryOver.priority || 3
                 });

                 // 2주 이상 연속 이월 체크
                 const recentCarryOvers = member.carryOverHistory.filter(h => {
                   const historyDate = new Date(h.week);
                   const twoWeeksAgo = new Date(startDate);
                   twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
                   return historyDate >= twoWeeksAgo && h.amount > 0;
                 });

                 if (recentCarryOvers.length >= 2) {
                   // 강제 협의 또는 관리자 개입 플래그 설정
                   member.needsIntervention = true;
                   member.interventionReason = 'consecutive_carryover';
                 }
               }
            }
         }
      }

      // 우선도에 따른 다음 주 우선 배정 정보 업데이트
      Object.values(result.assignments).forEach(assignment => {
        if (assignment.carryOver && assignment.carryOver > 0) {
          const memberIndex = room.members.findIndex(m =>
            m.user.toString() === assignment.memberId
          );

          if (memberIndex !== -1) {
            const member = room.members[memberIndex];
            // 다음 주 우선 배정을 위한 우선도 임시 상승
            if (!member.tempPriorityBoost) {
              member.tempPriorityBoost = assignment.carryOver; // 이월 시간만큼 우선도 부스트
            }
          }
        }
      });

      // 💡 저장 전 최종 슬롯 통계 로그
      console.log('\n📊 ===== [서버] 최종 배정 결과 =====');
      console.log('총 슬롯 수:', room.timeSlots.length);
      
      if (room.timeSlots.length > 0) {
        const dates = room.timeSlots.map(slot => new Date(slot.date).toISOString().split('T')[0]).sort();
        const uniqueDates = [...new Set(dates)];
        console.log('날짜 범위:', uniqueDates[0], '~', uniqueDates[uniqueDates.length - 1]);
        console.log('총 배정일 수:', uniqueDates.length);
        
        // 월별 통계
        const monthCount = {};
        uniqueDates.forEach(date => {
          const month = date.substring(0, 7);
          monthCount[month] = (monthCount[month] || 0) + 1;
        });
        console.log('월별 배정일 수:', monthCount);
      }
      console.log('🔍 ===================================\n');

      // 자동 확정 타이머 설정 (1분 후 - 실험용, 프로덕션에서는 48시간)
      const autoConfirmDelay = 1 * 60 * 1000; // 1분 = 60,000ms
      room.autoConfirmAt = new Date(Date.now() + autoConfirmDelay);

      // ✨ 자동배정은 항상 normal 모드로 실행 (이동시간은 별도로 "적용" 버튼으로 처리)
      console.log('🚨 [저장 전] transportMode:', transportMode);
      console.log('🚨 [저장 전] room.timeSlots 개수:', room.timeSlots?.length || 0);
      console.log('🚨 [저장 전] room.originalTimeSlots 개수:', room.originalTimeSlots?.length || 0);
      
      room.currentTravelMode = 'normal';
      room.confirmedTravelMode = null;
      room.travelTimeSlots = [];
      
      console.log('🚨 [설정 후] room.currentTravelMode:', room.currentTravelMode);

      await room.save();
      
      console.log('🚨 [저장 후] room.timeSlots 개수:', room.timeSlots?.length || 0);
      console.log('🚨 [저장 후] room.originalTimeSlots 개수:', room.originalTimeSlots?.length || 0);

      // 활동 로그 기록
      try {
         const ownerUser = await User.findById(req.user.id);
         const ownerName = ownerUser ? `${ownerUser.firstName} ${ownerUser.lastName}` : 'Unknown';
         await ActivityLog.logActivity(
            roomId,
            req.user.id,
            ownerName,
            'auto_assign',
            `자동배정 실행 완료 (주당 ${minHoursPerWeek}시간, ${membersOnly.length}명 배정)`
         );
      } catch (logError) {
         console.error('Activity log error:', logError);
      }

      const freshRoom = await Room.findById(roomId)
         .populate('owner', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes address addressDetail addressLat addressLng')
         .populate('members.user', 'firstName lastName email defaultSchedule address addressDetail addressLat addressLng')
         .populate('timeSlots.user', '_id firstName lastName email')
         .populate('requests.requester', 'firstName lastName email')
         .populate('requests.targetUser', 'firstName lastName email')
         .lean();

      console.log('🚨 [응답 전] freshRoom.timeSlots 개수:', freshRoom.timeSlots?.length || 0);
      console.log('🚨 [응답 전] freshRoom.originalTimeSlots 개수:', freshRoom.originalTimeSlots?.length || 0);
      console.log('🚨 [응답 전] freshRoom.currentTravelMode:', freshRoom.currentTravelMode);

      if (freshRoom.timeSlots.length > 0) {
         freshRoom.timeSlots.slice(0, 5).forEach((slot, idx) => {
            const userName = slot.user?.name || slot.user?.firstName || '이름없음';
            const userId = slot.user?._id || slot.user;
            const dateStr = new Date(slot.date).toLocaleDateString('ko-KR');
         });
      }
      res.json({
         room: freshRoom,
         unassignedMembersInfo: result.unassignedMembersInfo,
         conflictSuggestions: conflictSuggestions,
         assignmentMode: mode,
      });
   } catch (error) {

      if (error.message.includes('defaultSchedule')) {
         res.status(400).json({ msg: '선호시간표 데이터에 오류가 있습니다. 모든 멤버가 내프로필에서 선호시간표를 설정했는지 확인해주세요.' });
      } else if (error.message.includes('timeSlots')) {
         res.status(400).json({ msg: '시간표 데이터에 오류가 있습니다. 멤버들이 선호시간표를 설정했는지 확인해주세요.' });
      } else if (error.message.includes('member')) {
         res.status(400).json({ msg: '멤버 데이터에 오류가 있습니다. 방 설정을 확인해주세요.' });
      } else if (error.message.includes('settings')) {
         res.status(400).json({ msg: '방 설정에 오류가 있습니다. 시간 설정을 확인해주세요.' });
      } else if (error.message.includes('priority')) {
         res.status(400).json({ msg: '우선순위 설정에 오류가 있습니다. 멤버 우선순위를 확인해주세요.' });
      } else {
         res.status(500).json({ msg: `자동 배정 실행 중 오류가 발생했습니다: ${error.message}` });
      }
   }
};

// @desc    Delete all time slots in a room
// @route   DELETE /api/coordination/rooms/:roomId/timeslots
// @access  Private (Room Owner only)
exports.deleteAllTimeSlots = exports.deleteAllTimeSlots = async (req, res) => {
   try {
      const { roomId } = req.params;
      const room = await Room.findById(roomId)
        .populate('owner', 'personalTimes')
        .populate('members.user', 'personalTimes');

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      if (!room.isOwner(req.user.id)) {
         return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
      }

      // Clear the timeSlots array
      room.timeSlots = [];

      // 자동 확정 타이머 해제 (전체 비우기)
      room.autoConfirmAt = null;

      // 확정된 이동수단 모드 초기화
      room.confirmedTravelMode = null;
      room.confirmedAt = null;

      // Also clear non-pending requests as they are linked to slots
      room.requests = room.requests.filter(r => r.status === 'pending');

      await room.save();

      // 확정된 개인일정 삭제 + 선호시간 복구
      const updatePromises = [];

      // 조원들의 personalTimes에서 해당 방 관련 항목 삭제 + 선호시간 복구
      for (const member of room.members) {
        const memberUser = await User.findById(member.user._id || member.user);
        if (memberUser) {
          // personalTimes에서 해당 방 관련 항목 삭제
          if (memberUser.personalTimes) {
            memberUser.personalTimes = memberUser.personalTimes.filter(pt =>
              !pt.title || !pt.title.includes(room.name)
            );
          }

          // 백업된 선호시간 복구
          if (memberUser.deletedPreferencesByRoom) {
            const backup = memberUser.deletedPreferencesByRoom.find(
              item => item.roomId.toString() === roomId.toString()
            );

            if (backup && backup.deletedTimes && backup.deletedTimes.length > 0) {
              // defaultSchedule 초기화 (없으면)
              if (!memberUser.defaultSchedule) {
                memberUser.defaultSchedule = [];
              }

              // 백업된 선호시간을 defaultSchedule에 다시 추가
              backup.deletedTimes.forEach(deletedTime => {
                // 중복 체크 (같은 dayOfWeek, startTime, endTime)
                const isDuplicate = memberUser.defaultSchedule.some(schedule =>
                  schedule.dayOfWeek === deletedTime.dayOfWeek &&
                  schedule.startTime === deletedTime.startTime &&
                  schedule.endTime === deletedTime.endTime &&
                  schedule.specificDate === deletedTime.specificDate
                );

                if (!isDuplicate) {
                  memberUser.defaultSchedule.push(deletedTime);
                }
              });

              // 백업 삭제 (복구 완료)
              memberUser.deletedPreferencesByRoom = memberUser.deletedPreferencesByRoom.filter(
                item => item.roomId.toString() !== roomId.toString()
              );
            }
          }

          updatePromises.push(memberUser.save());
        }
      }

      // 방장의 personalTimes에서 해당 방 관련 항목 삭제 + 선호시간 복구
      const owner = await User.findById(room.owner._id || room.owner);
      if (owner) {
        // personalTimes에서 해당 방 관련 항목 삭제
        if (owner.personalTimes) {
          owner.personalTimes = owner.personalTimes.filter(pt =>
            !pt.title || !pt.title.includes(room.name)
          );
        }

        // 백업된 선호시간 복구
        if (owner.deletedPreferencesByRoom) {
          const backup = owner.deletedPreferencesByRoom.find(
            item => item.roomId.toString() === roomId.toString()
          );

          if (backup && backup.deletedTimes && backup.deletedTimes.length > 0) {
            // defaultSchedule 초기화 (없으면)
            if (!owner.defaultSchedule) {
              owner.defaultSchedule = [];
            }

            // 백업된 선호시간을 defaultSchedule에 다시 추가
            backup.deletedTimes.forEach(deletedTime => {
              // 중복 체크 (같은 dayOfWeek, startTime, endTime)
              const isDuplicate = owner.defaultSchedule.some(schedule =>
                schedule.dayOfWeek === deletedTime.dayOfWeek &&
                schedule.startTime === deletedTime.startTime &&
                schedule.endTime === deletedTime.endTime &&
                schedule.specificDate === deletedTime.specificDate
              );

              if (!isDuplicate) {
                owner.defaultSchedule.push(deletedTime);
              }
            });

            // 백업 삭제 (복구 완료)
            owner.deletedPreferencesByRoom = owner.deletedPreferencesByRoom.filter(
              item => item.roomId.toString() !== roomId.toString()
            );
          }
        }

        updatePromises.push(owner.save());
      }

      await Promise.all(updatePromises);

      const updatedRoom = await Room.findById(room._id)
         .populate('owner', 'firstName lastName email address addressLat addressLng')
         .populate('members.user', 'firstName lastName email address addressLat addressLng')
         .populate('timeSlots.user', '_id firstName lastName email');

      res.json(updatedRoom);

   } catch (error) {
      console.error('Error deleting all time slots:', error);
      res.status(500).json({ msg: 'Server error' });
   }
};

// @desc    자동배정된 시간을 각 조원과 방장의 개인일정으로 확정
// @route   POST /api/coordination/rooms/:roomId/confirm-schedule
// @access  Private (Room Owner only)
exports.confirmSchedule = exports.confirmSchedule = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { travelMode } = req.body; // 클라이언트에서 전달받은 이동수단 모드

    // 1. 방 조회 (populate members)
    const room = await Room.findById(roomId)
      .populate('owner', 'firstName lastName email personalTimes defaultSchedule scheduleExceptions')
      .populate('members.user', '_id firstName lastName email personalTimes defaultSchedule scheduleExceptions');
    
    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }
    
    // 2. 방장 권한 확인
    if (!room.isOwner(req.user.id)) {
      return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
    }

    // 2.5. 중복 확정 방지
    if (room.confirmedAt) {
      console.log('⚠️ [confirmSchedule] 이미 확정된 스케줄입니다');
      return res.status(400).json({ msg: '이미 확정된 스케줄입니다.' });
    }

    // 3. 자동배정된 슬롯 필터링 (assignedBy가 있고 status가 'confirmed'인 것)
    const autoAssignedSlots = room.timeSlots.filter(slot =>
      slot.assignedBy && slot.status === 'confirmed'
    );

    console.log(`📋 [confirmSchedule] Room 상태:`, {
      timeSlots개수: room.timeSlots?.length || 0,
      travelTimeSlots개수: room.travelTimeSlots?.length || 0,
      confirmedTravelMode: room.confirmedTravelMode,
      currentTravelMode: room.currentTravelMode
    });
    console.log(`📊 [confirmSchedule] 확정할 슬롯: ${autoAssignedSlots.length}개`);
    console.log(`📊 [confirmSchedule] 이동시간 조정된 슬롯: ${autoAssignedSlots.filter(s => s.adjustedForTravelTime).length}개`);
    console.log(`📊 [confirmSchedule] 첫 3개 슬롯:`, autoAssignedSlots.slice(0, 3).map(s => ({
      user: s.user.toString().substring(0, 8),
      subject: s.subject,
      startTime: s.startTime,
      endTime: s.endTime,
      adjustedForTravelTime: s.adjustedForTravelTime,
      originalStartTime: s.originalStartTime
    })));

    if (autoAssignedSlots.length === 0) {
      return res.status(400).json({ msg: '확정할 자동배정 시간이 없습니다.' });
    }
    
    // 헬퍼 함수: 시간 문자열을 분 단위로 변환 (예: "09:30" -> 570)
    const timeToMinutes = (timeStr) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    // 헬퍼 함수: 분을 시간 문자열로 변환 (예: 570 -> "09:30")
    const minutesToTime = (minutes) => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    };
    
    // 헬퍼 함수: 연속된 슬롯 병합
    const mergeConsecutiveSlots = (slots) => {
      if (slots.length === 0) return [];

      // 시간순으로 정렬
      slots.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

      const merged = [];
      // Mongoose 문서의 속성을 명시적으로 복사
      let current = {
        startTime: slots[0].startTime,
        endTime: slots[0].endTime
      };

      for (let i = 1; i < slots.length; i++) {
        const slot = slots[i];

        // 현재 슬롯의 끝 시간과 다음 슬롯의 시작 시간이 연속되는지 확인
        if (current.endTime === slot.startTime) {
          // 연속되면 병합 (끝 시간만 업데이트)
          current.endTime = slot.endTime;
        } else {
          // 연속되지 않으면 현재 블록을 결과에 추가하고 새 블록 시작
          merged.push(current);
          current = {
            startTime: slot.startTime,
            endTime: slot.endTime
          };
        }
      }

      // 마지막 블록 추가
      merged.push(current);

      return merged;
    };
    
    // 4. 조원별, 날짜별로 그룹화 후 병합
    const slotsByUserAndDate = {};
    autoAssignedSlots.forEach(slot => {
      const userId = slot.user.toString();
      const dateStr = slot.date.toISOString().split('T')[0];
      const key = `${userId}_${dateStr}`;
      
      if (!slotsByUserAndDate[key]) {
        slotsByUserAndDate[key] = {
          userId,
          date: slot.date,
          day: slot.day,
          slots: []
        };
      }
      slotsByUserAndDate[key].slots.push(slot);
    });
    
    // 각 그룹의 슬롯을 병합
    const mergedSlotsByUser = {};
    for (const [key, group] of Object.entries(slotsByUserAndDate)) {
      const mergedSlots = mergeConsecutiveSlots(group.slots);
      
      if (!mergedSlotsByUser[group.userId]) {
        mergedSlotsByUser[group.userId] = [];
      }
      
      mergedSlots.forEach(slot => {
        mergedSlotsByUser[group.userId].push({
          startTime: slot.startTime,
          endTime: slot.endTime,
          date: group.date,
          day: group.day
        });
      });
    }
    
    // 헬퍼 함수: day 문자열을 숫자로 변환
    const getDayOfWeekNumber = (day) => {
      const dayMap = {
        'monday': 1,
        'tuesday': 2,
        'wednesday': 3,
        'thursday': 4,
        'friday': 5,
        'saturday': 6,
        'sunday': 7
      };
      return dayMap[day] || 1;
    };
    
    // 헬퍼 함수: 선호시간에서 배정된 부분만 제거하고 나머지는 분할하여 유지 + 백업
    const removePreferenceTimes = (user, slots, roomId) => {
      const deletedTimes = [];
      const newDefaultSchedule = [];

      // 1. 슬롯을 날짜별로 그룹화하고 개별 시간 범위 저장 (병합하지 않음)
      const assignedRangesByDate = {};

      slots.forEach(slot => {
        const dateStr = slot.date.toISOString().split('T')[0];
        const dayOfWeek = getDayOfWeekNumber(slot.day);

        if (!assignedRangesByDate[dateStr]) {
          assignedRangesByDate[dateStr] = {
            dateStr,
            dayOfWeek,
            ranges: [] // 개별 범위들을 배열로 저장
          };
        }

        assignedRangesByDate[dateStr].ranges.push({
          start: timeToMinutes(slot.startTime),
          end: timeToMinutes(slot.endTime)
        });
      });

      // 2. 각 선호시간을 확인하고 배정 범위와 겹치면 분할
      if (user.defaultSchedule) {
        user.defaultSchedule.forEach(schedule => {
          const scheduleDayOfWeek = schedule.dayOfWeek === 0 ? 7 : schedule.dayOfWeek;

          // 이 선호시간과 겹치는 배정 범위들 찾기
          const prefStart = timeToMinutes(schedule.startTime);
          const prefEnd = timeToMinutes(schedule.endTime);
          const scheduleDayOfWeekForMatch = schedule.dayOfWeek === 0 ? 7 : schedule.dayOfWeek;
          
          let matchingDateRanges = null;
          
          for (const [dateStr, dateData] of Object.entries(assignedRangesByDate)) {
            const matches = schedule.specificDate
              ? schedule.specificDate === dateStr
              : scheduleDayOfWeekForMatch === dateData.dayOfWeek;

            if (matches) {
              matchingDateRanges = dateData;
              break;
            }
          }

          if (!matchingDateRanges) {
            // 배정과 겹치지 않으면 그대로 유지
            newDefaultSchedule.push(schedule);
          } else {
            // 배정 범위들과 겹침 확인 및 분할 처리
            let currentSegments = [{ start: prefStart, end: prefEnd }];
            
            // 각 배정 범위에 대해 겹치는 부분 제거
            for (const assignedRange of matchingDateRanges.ranges) {
              const newSegments = [];
              
              for (const segment of currentSegments) {
                const overlapStart = Math.max(segment.start, assignedRange.start);
                const overlapEnd = Math.min(segment.end, assignedRange.end);
                
                if (overlapStart < overlapEnd) {
                  // 실제로 겹침 - 백업에 추가
                  deletedTimes.push({
                    dayOfWeek: schedule.dayOfWeek,
                    startTime: minutesToTime(overlapStart),
                    endTime: minutesToTime(overlapEnd),
                    priority: schedule.priority,
                    specificDate: schedule.specificDate
                  });
                  
                  // 세그먼트 분할
                  if (segment.start < assignedRange.start) {
                    newSegments.push({ start: segment.start, end: assignedRange.start });
                  }
                  if (segment.end > assignedRange.end) {
                    newSegments.push({ start: assignedRange.end, end: segment.end });
                  }
                } else {
                  // 겹치지 않으면 그대로 유지
                  newSegments.push(segment);
                }
              }
              
              currentSegments = newSegments;
            }
            
            // 남은 세그먼트들을 새 선호시간으로 추가
            for (const segment of currentSegments) {
              newDefaultSchedule.push({
                dayOfWeek: schedule.dayOfWeek,
                startTime: minutesToTime(segment.start),
                endTime: minutesToTime(segment.end),
                priority: schedule.priority,
                specificDate: schedule.specificDate
              });
            }
          }
        });

        // 분할된 새 선호시간으로 교체
        user.defaultSchedule = newDefaultSchedule;
      }

      // scheduleExceptions에서 해당 날짜 삭제 (기존 로직 유지)
      if (user.scheduleExceptions) {
        slots.forEach(slot => {
          const dateStr = slot.date.toISOString().split('T')[0];
          user.scheduleExceptions = user.scheduleExceptions.filter(exception => {
            if (exception.specificDate) {
              return exception.specificDate !== dateStr;
            }
            return true;
          });
        });
      }

      // 백업된 삭제 시간을 user.deletedPreferencesByRoom에 저장
      if (deletedTimes.length > 0) {
        if (!user.deletedPreferencesByRoom) {
          user.deletedPreferencesByRoom = [];
        }

        // 기존에 이 방에 대한 백업이 있으면 제거 (새로 덮어쓰기)
        user.deletedPreferencesByRoom = user.deletedPreferencesByRoom.filter(
          item => item.roomId.toString() !== roomId.toString()
        );

        // 새 백업 추가
        user.deletedPreferencesByRoom.push({
          roomId: roomId,
          deletedTimes: deletedTimes,
          deletedAt: new Date()
        });
      }
    };
    
    // 5. 각 조원의 personalTimes에 추가 + 선호시간 삭제
    // User 객체를 Map으로 관리하여 중복 저장 방지 (VersionError 해결)
    const userMap = new Map();
    const ownerName = `${room.owner.firstName || ''} ${room.owner.lastName || ''}`.trim() || '방장';
    
    // 5-1. 조원들 처리
    console.log('🔥🔥🔥 [confirmSchedule] ===== 조원 personalTimes 추가 시작 =====');
    for (const [userId, mergedSlots] of Object.entries(mergedSlotsByUser)) {
      console.log(`📝 [조원 처리] userId: ${userId}, mergedSlots: ${mergedSlots.length}개`);
      let user = userMap.get(userId);
      if (!user) {
        user = await User.findById(userId);
        if (!user) continue;
        userMap.set(userId, user);
      }
      
      // personalTimes 배열이 없으면 초기화
      if (!user.personalTimes) {
        user.personalTimes = [];
      }
      
      // 선호시간 삭제 (원본 슬롯 사용) + 백업
      const originalSlots = autoAssignedSlots.filter(s => s.user.toString() === userId);
      removePreferenceTimes(user, originalSlots, roomId);
      
      // 다음 ID 계산
      const maxId = user.personalTimes.reduce((max, pt) => Math.max(max, pt.id || 0), 0);
      let nextId = maxId + 1;
      
      // 병합된 각 슬롯을 personalTimes로 변환
      mergedSlots.forEach(slot => {
        const dayOfWeek = getDayOfWeekNumber(slot.day);
        const dateStr = slot.date.toISOString().split('T')[0];
        
        // 중복 체크 (같은 날짜, 같은 시간)
        const isDuplicate = user.personalTimes.some(pt => 
          pt.specificDate === dateStr &&
          pt.startTime === slot.startTime &&
          pt.endTime === slot.endTime
        );
        
        if (!isDuplicate) {
          console.log(`   ✅ [조원 추가] ${slot.startTime}-${slot.endTime} (${dateStr})`);
          // 조원: 수업시간만 저장 (이동시간 제외)
          user.personalTimes.push({
            id: nextId++,
            title: `${room.name} - ${ownerName}`,
            type: 'personal',  // ✅ 'personal'로 변경
            startTime: slot.originalStartTime || slot.startTime,  // 원본 시간 사용
            endTime: slot.originalEndTime || slot.endTime,
            days: [dayOfWeek],
            isRecurring: false,
            specificDate: dateStr,
            color: '#10B981' // 초록색
          });
        }
      });
    }
    
    // 5-2. 방장 처리
    console.log('🔥🔥🔥 [confirmSchedule] ===== 방장 personalTimes 추가 시작 =====');
    const ownerId = (room.owner._id || room.owner).toString();
    console.log(`📝 [방장 처리] ownerId: ${ownerId}`);
    let owner = userMap.get(ownerId);
    if (!owner) {
      owner = await User.findById(ownerId);
      if (owner) {
        userMap.set(ownerId, owner);
      }
    }
    
    if (owner) {
      if (!owner.personalTimes) {
        owner.personalTimes = [];
      }
      
      // 방장의 선호시간 삭제 + 백업 (수업 슬롯 + 이동시간 슬롯 모두 고려)
      const ownerSlotsForDeletion = [...autoAssignedSlots];
      
      // 이동시간 슬롯도 포함하여 선호시간 삭제
      if (room.travelTimeSlots && room.travelTimeSlots.length > 0) {
        console.log(`   📌 [방장 선호시간 삭제] 이동시간 슬롯 ${room.travelTimeSlots.length}개 추가`);
        ownerSlotsForDeletion.push(...room.travelTimeSlots);
      }
      
      removePreferenceTimes(owner, ownerSlotsForDeletion, roomId);
      
      const maxId = owner.personalTimes.reduce((max, pt) => Math.max(max, pt.id || 0), 0);
      let nextId = maxId + 1;
      
      // 각 조원별로 병합된 슬롯을 방장의 개인일정으로 추가
      for (const [userId, mergedSlots] of Object.entries(mergedSlotsByUser)) {
        // 해당 조원 정보 찾기
        const memberUser = room.members.find(m => 
          m.user._id?.toString() === userId || 
          m.user.toString() === userId
        );
        
        if (!memberUser) continue;
        
        const memberName = `${memberUser.user.firstName || ''} ${memberUser.user.lastName || ''}`.trim() || '조원';
        
        mergedSlots.forEach(slot => {
          const dayOfWeek = getDayOfWeekNumber(slot.day);
          const dateStr = slot.date.toISOString().split('T')[0];
          
          console.log(`   🔍 [방장 수업 추가 준비] ${memberName}:`, {
            원본시간: `${slot.originalStartTime || '없음'}-${slot.originalEndTime || '없음'}`,
            조정시간: `${slot.startTime}-${slot.endTime}`,
            날짜: dateStr,
            조정여부: slot.adjustedForTravelTime
          });
          
          // 중복 체크 (같은 날짜, 같은 시간, 같은 조원)
          const isDuplicate = owner.personalTimes.some(pt => 
            pt.specificDate === dateStr &&
            pt.startTime === slot.startTime &&
            pt.endTime === slot.endTime &&
            pt.title.includes(memberName)
          );
          
          if (!isDuplicate) {
            // 방장: 이동시간 포함하여 저장 (slot.startTime은 이미 이동시간 포함된 시간)
            owner.personalTimes.push({
              id: nextId++,
              title: `${room.name} - ${memberName}`,
              type: 'personal',  // ✅ 'personal'로 변경
              startTime: slot.startTime,  // 이동시간 포함
              endTime: slot.endTime,
              days: [dayOfWeek],
              isRecurring: false,
              specificDate: dateStr,
              color: '#3B82F6' // 파란색 (방장 수업 시간)
            });
          }
        });
      }
      
      // 방장의 이동시간 슬롯 추가 (travel mode only)
      console.log(`🔍 [디버깅] room.travelTimeSlots 상태:`, {
        존재여부: !!room.travelTimeSlots,
        개수: room.travelTimeSlots?.length || 0,
        샘플: room.travelTimeSlots?.slice(0, 2)
      });
      
      if (room.travelTimeSlots && room.travelTimeSlots.length > 0) {
        console.log(`   [방장 이동시간 추가] ${room.travelTimeSlots.length}개`);
        
        room.travelTimeSlots.forEach(travelSlot => {
          const dayOfWeek = getDayOfWeekNumber(travelSlot.day);
          const dateStr = travelSlot.date.toISOString().split('T')[0];
          
          // 중복 체크
          const isDuplicate = owner.personalTimes.some(pt =>
            pt.specificDate === dateStr &&
            pt.startTime === travelSlot.startTime &&
            pt.endTime === travelSlot.endTime &&
            pt.title.includes('이동시간')
          );
          
          if (!isDuplicate) {
            console.log(`   ✅ [이동시간 추가] ${travelSlot.startTime}-${travelSlot.endTime} (${dateStr})`);
            owner.personalTimes.push({
              id: nextId++,
              title: `${room.name} - 이동시간`,
              type: 'personal',  // ✅ 'personal'로 변경하여 개인시간으로 저장
              startTime: travelSlot.startTime,
              endTime: travelSlot.endTime,
              days: [dayOfWeek],
              isRecurring: false,
              specificDate: dateStr,
              color: '#FFA500' // Orange color for travel time
            });
          } else {
            console.log(`   ⚠️ [중복 스킵] ${travelSlot.startTime}-${travelSlot.endTime} (${dateStr})`);
          }
        });
      }
    }
    
    // 5-3. 모든 사용자 한 번에 저장 (각 사용자는 한 번만 저장됨) with retry logic
    console.log('🔥🔥🔥 [confirmSchedule] ===== 사용자 저장 시작 =====');
    console.log(`📊 [사용자 저장] 총 ${userMap.size}명 저장 예정`);
    
    const saveUserWithRetry = async (user, maxRetries = 3) => {
      let currentUser = user;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await currentUser.save();
          console.log(`   ✅ [사용자 저장 성공] userId: ${user._id}, personalTimes: ${currentUser.personalTimes?.length}개`);
          return; // 성공
        } catch (error) {
          if (error.name === 'VersionError' && attempt < maxRetries) {
            console.log(`⚠️ VersionError for user ${user._id}, retrying (${attempt}/${maxRetries})...`);
            
            // 최신 버전 다시 조회
            const freshUser = await User.findById(user._id);
            if (!freshUser) {
              throw new Error(`User ${user._id} not found during retry`);
            }
            
            // 변경사항 재적용
            freshUser.personalTimes = user.personalTimes;
            freshUser.defaultSchedule = user.defaultSchedule;
            if (user.deletedPreferencesByRoom) {
              freshUser.deletedPreferencesByRoom = user.deletedPreferencesByRoom;
            }
            
            currentUser = freshUser;
            // 잠시 대기 후 재시도 (동시성 충돌 완화)
            await new Promise(resolve => setTimeout(resolve, 100 * attempt));
          } else {
            throw error;
          }
        }
      }
    };
    
    const updatePromises = Array.from(userMap.values()).map(user => saveUserWithRetry(user));
    await Promise.all(updatePromises);
    console.log('✅✅✅ [confirmSchedule] ===== 모든 사용자 저장 완료! =====');

    // 자동 확정 타이머 해제 (수동 확정 완료) with retry logic
    room.autoConfirmAt = null;
    
    let roomSaved = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await room.save();
        roomSaved = true;
        break;
      } catch (error) {
        if (error.name === 'VersionError' && attempt < 3) {
          console.log(`⚠️ VersionError for room ${roomId}, retrying (${attempt}/3)...`);
          // 최신 버전 다시 조회
          const freshRoom = await Room.findById(roomId);
          if (freshRoom) {
            freshRoom.autoConfirmAt = null;
            room = freshRoom;
          }
          await new Promise(resolve => setTimeout(resolve, 100 * attempt));
        } else {
          throw error;
        }
      }
    }
    
    if (!roomSaved) {
      throw new Error('Failed to save room after multiple retries');
    }

    // 6-1. 확정된 슬롯 표시 (자동배정 시 중복 방지)
    autoAssignedSlots.forEach(slot => {
      slot.confirmedToPersonalCalendar = true; // 확정됨 표시
    });

    // 6-2. 확정된 이동수단 모드 저장 및 confirmedAt 설정
    room.confirmedAt = new Date(); // ⚠️ 항상 설정하여 중복 확정 방지
    if (travelMode) {
      room.confirmedTravelMode = travelMode;
      console.log(`✅ [확정] 이동수단 모드 저장: ${travelMode}`);

      // 일반 모드로 확정하는 경우, 이동시간 슬롯 제거
      if (travelMode === 'normal') {
        const beforeCount = room.timeSlots.length;
        room.timeSlots = room.timeSlots.filter(slot => !slot.isTravel);
        room.travelTimeSlots = [];
        const afterCount = room.timeSlots.length;
        console.log(`🔄 [confirmSchedule] 일반 모드 확정: 이동시간 슬롯 ${beforeCount - afterCount}개 제거`);
      }
    }
    await room.save();

    // 7. 활동 로그 기록
    await ActivityLog.logActivity(
      roomId,
      req.user.id,
      `${req.user.firstName} ${req.user.lastName}`,
      'confirm_schedule',
      `자동배정 시간 확정 완료 (${autoAssignedSlots.length}개 슬롯 → ${Object.values(mergedSlotsByUser).reduce((sum, slots) => sum + slots.length, 0)}개 병합, 조원 ${Object.keys(mergedSlotsByUser).length}명 + 방장)`
    );
    
    // 8. Socket.io로 실시간 알림 전송
    console.log('🔥🔥🔥 [confirmSchedule] ===== Socket.io 이벤트 전송 시작 =====');
    if (global.io) {
      global.io.to(`room-${roomId}`).emit('schedule-confirmed', {
        roomId: roomId,
        message: '자동배정 시간이 확정되었습니다.',
        timestamp: new Date()
      });
      console.log(`📡 [수동확정] Socket 이벤트 전송: room-${roomId}`);
    }
    
    // 9. 성공 응답
    console.log('🔥🔥🔥 [confirmSchedule] ===== 성공 응답 전송 =====');
    res.json({
      msg: '배정 시간이 각 조원과 방장의 개인일정으로 확정되었습니다.',
      confirmedSlotsCount: autoAssignedSlots.length,
      mergedSlotsCount: Object.values(mergedSlotsByUser).reduce((sum, slots) => sum + slots.length, 0),
      affectedMembersCount: Object.keys(mergedSlotsByUser).length,
      confirmedTravelMode: travelMode || 'normal' // 확정된 이동수단 모드
    });
    
  } catch (error) {
    console.error('Error confirming schedule:', error);
    res.status(500).json({ msg: `확정 처리 중 오류가 발생했습니다: ${error.message}` });
  }
};

/**
 * 시간대 생성 헬퍼 함수
 * @param {number} startHour - 시작 시간 (0-23)
 * @param {number} endHour - 종료 시간 (1-24)
 * @param {number} intervalMinutes - 간격 (분)
 * @returns {Array} 생성된 시간 슬롯 배열 [{ startTime: "09:00", endTime: "09:30" }, ...]
 */
function generateTimeSlots(startHour, endHour, intervalMinutes = 30) {
  const slots = [];
  const startMinutes = startHour * 60;
  const endMinutes = endHour * 60;

  for (let minutes = startMinutes; minutes < endMinutes; minutes += intervalMinutes) {
    const startTime = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    const nextMinutes = minutes + intervalMinutes;
    const endTime = `${String(Math.floor(nextMinutes / 60)).padStart(2, '0')}:${String(nextMinutes % 60).padStart(2, '0')}`;

    slots.push({ startTime, endTime });
  }

  return slots;
}

/**
 * 조원이 선택 가능한 시간대 조회
 * @desc    조원이 특정 날짜에 선택할 수 있는 시간대를 반환 (이동시간 고려)
 * @route   GET /api/coordination/rooms/:roomId/available-slots
 * @access  Private (Room Members)
 * @query   {string} date - 조회할 날짜 (YYYY-MM-DD)
 * @query   {string} memberLocation - 조원의 위치 정보 (JSON string)
 */
exports.getAvailableSlots = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { date, memberLocation } = req.query;

    // 1. 필수 파라미터 검증
    if (!date) {
      return res.status(400).json({ msg: '날짜를 지정해주세요.' });
    }

    if (!memberLocation) {
      return res.status(400).json({ msg: '위치 정보를 지정해주세요.' });
    }

    // 2. 방 정보 조회
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    // 3. 멤버 권한 확인
    if (!room.isMember(req.user.id)) {
      return res.status(403).json({ msg: '이 방의 멤버만 조회할 수 있습니다.' });
    }

    // 4. 위치 정보 파싱
    let location;
    try {
      location = JSON.parse(memberLocation);
    } catch (error) {
      return res.status(400).json({ msg: '위치 정보 형식이 올바르지 않습니다.' });
    }

    // 5. 모든 가능한 시간대 생성
    const allPossibleSlots = generateTimeSlots(
      room.settings.startHour || 9,
      room.settings.endHour || 18,
      30 // 30분 간격
    );

    // 6. 각 시간대별 배치 가능 여부 검증
    const availabilityResults = [];

    for (const slot of allPossibleSlots) {
      const validation = await dynamicTravelTimeCalculator.validateNewSlotPlacement(
        roomId,
        new Date(date),
        slot.startTime,
        slot.endTime,
        location
      );

      availabilityResults.push({
        startTime: slot.startTime,
        endTime: slot.endTime,
        available: validation.valid
        // ❌ 주의: reason이나 details는 반환하지 않음 (방장의 이동시간 정보 보호)
      });
    }

    // 7. 응답 반환
    // 조원은 확정된 이동시간 모드만 볼 수 있음
    const isOwner = room.owner._id.toString() === req.user.id.toString();
    const travelModeForMember = isOwner
      ? (room.currentTravelMode || 'normal')
      : (room.confirmedAt ? (room.confirmedTravelMode || room.currentTravelMode || 'normal') : 'normal');

    res.json({
      date,
      slots: availabilityResults,
      travelMode: travelModeForMember,
      message: '시간대별 배치 가능 여부를 조회했습니다.'
    });

  } catch (error) {
    console.error('❌ 가능한 시간대 조회 실패:', error);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.', error: error.message });
  }
};

/**
 * 이동수단 선택 시 자동 확정 타이머 시작
 * @desc    방장이 이동수단을 선택하면 자동 확정 타이머를 시작
 * @route   POST /api/coordination/rooms/:roomId/start-confirmation-timer
 * @access  Private (Room Owner only)
 */
exports.startConfirmationTimer = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { travelMode } = req.body;

    // 1. 방 정보 조회
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    // 2. 방장 권한 확인
    if (!room.isOwner(req.user.id)) {
      return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
    }

    // 3. 자동배정이 실행되었는지 확인
    if (!room.timeSlots || room.timeSlots.length === 0) {
      return res.status(400).json({ msg: '자동배정을 먼저 실행해주세요.' });
    }

    // 4. 이미 확정되었는지 확인
    if (room.confirmedAt) {
      return res.status(400).json({ msg: '이미 확정된 스케줄입니다.' });
    }

    // 5. 타이머 초기화 여부 확인
    let isTimerReset = false;
    if (room.autoConfirmAt && new Date(room.autoConfirmAt) > new Date()) {
      console.log(`🔄 [타이머 초기화] 기존: ${room.autoConfirmAt}, 새 모드: ${travelMode}`);
      isTimerReset = true;
    }

    // 6. 타이머 설정 (테스트: 1분, 실제: 48시간)
    const confirmTime = new Date();
    confirmTime.setMinutes(confirmTime.getMinutes() + 1);  // 테스트용: 1분
    // confirmTime.setHours(confirmTime.getHours() + 48);  // 실제용: 48시간

    room.autoConfirmAt = confirmTime;

    // 7. 선택된 이동수단 임시 저장 (확정 전까지는 변경 가능)
    room.currentTravelMode = travelMode;  // 임시 모드 (조원들이 볼 수 있음)
    room.confirmedTravelMode = null;       // 아직 확정 안됨

    await room.save();

    console.log(`⏰ [타이머 ${isTimerReset ? '재시작' : '시작'}] 방 ${roomId}: ${confirmTime.toISOString()}, 이동수단: ${travelMode}`);

    // 8. Socket.io로 실시간 알림 전송
    if (global.io) {
      global.io.to(`room-${roomId}`).emit('timer-started', {
        roomId: roomId,
        autoConfirmAt: confirmTime,
        travelMode: travelMode,
        isReset: isTimerReset,
        message: isTimerReset ? '타이머가 초기화되었습니다.' : '자동 확정 타이머가 시작되었습니다.',
        timestamp: new Date()
      });
    }

    res.json({
      msg: isTimerReset ? '타이머가 초기화되었습니다.' : '자동 확정 타이머가 시작되었습니다.',
      autoConfirmAt: confirmTime,
      travelMode: travelMode,
      minutesRemaining: 1,  // 테스트용: 1분
      isReset: isTimerReset
    });

  } catch (error) {
    console.error('❌ 타이머 시작 실패:', error);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.', error: error.message });
  }
};

/**
 * @route   POST /api/coordination/rooms/:roomId/apply-travel-mode
 * @desc    이동시간 포함 스케줄을 서버에 저장
 * @access  Private (Room Owner Only)
 */
exports.applyTravelMode = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { travelMode, enhancedSchedule } = req.body;

    console.log(`📌 [applyTravelMode] 시작 - 방: ${roomId}, 모드: ${travelMode}`);

    // 1. 방 조회
    const room = await Room.findById(roomId).populate('members', 'name email').populate('owner', 'name email');
    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    // 2. 방장 권한 확인
    if (!room.owner._id.equals(req.user.id)) {
      return res.status(403).json({ msg: '방장만 이동시간 모드를 변경할 수 있습니다.' });
    }

    // 2-1. 이미 확정된 스케줄인지 확인
    if (room.confirmedAt) {
      return res.status(400).json({
        msg: '이미 확정된 스케줄입니다. 확정 이후에는 이동시간 모드를 변경할 수 없습니다.',
        confirmedAt: room.confirmedAt
      });
    }

    // 3. enhancedSchedule 검증 (객체 형태로 변경)
    const receivedTimeSlots = enhancedSchedule?.timeSlots || (Array.isArray(enhancedSchedule) ? enhancedSchedule : null);
    const receivedTravelSlots = enhancedSchedule?.travelSlots || [];
    
    console.log(`🔥🔥🔥 [applyTravelMode] 수신된 데이터 확인:`);
    console.log(`   - travelMode: ${travelMode}`);
    console.log(`   - timeSlots: ${receivedTimeSlots?.length}개`);
    console.log(`   - travelSlots: ${receivedTravelSlots?.length}개`);
    
    if (!receivedTimeSlots || !Array.isArray(receivedTimeSlots)) {
      return res.status(400).json({ 
        msg: 'enhancedSchedule.timeSlots이 필요합니다.',
        received: typeof enhancedSchedule,
        hasTimeSlots: !!enhancedSchedule?.timeSlots
      });
    }

    console.log(`✅ [applyTravelMode] 수신 데이터:`, {
      timeSlots개수: receivedTimeSlots.length,
      travelSlots개수: receivedTravelSlots.length
    });
    console.log(`📋 [디버깅] receivedTimeSlots 첫 3개:`, receivedTimeSlots.slice(0, 3).map(e => ({
      user: e.user?._id?.toString() || e.user?.toString() || e.user,
      date: e.date instanceof Date ? e.date.toISOString().split('T')[0] : e.date,
      subject: e.subject,
      startTime: e.startTime,
      endTime: e.endTime,
      originalStartTime: e.originalStartTime,
      isTravel: e.isTravel
    })));
    console.log(`📋 [디버깅] room.timeSlots 첫 3개:`, room.timeSlots.slice(0, 3).map(s => ({
      user: s.user?._id?.toString() || s.user?.toString(),
      date: s.date.toISOString().split('T')[0],
      subject: s.subject,
      startTime: s.startTime,
      endTime: s.endTime,
      originalStartTime: s.originalStartTime
    })));

    // 4. timeSlots 업데이트
    if (travelMode === 'normal') {
      // 🔄 일반 모드로 복원: originalTimeSlots이 있으면 복원
      if (room.originalTimeSlots && room.originalTimeSlots.length > 0) {
        console.log(`   [복원] originalTimeSlots → timeSlots (${room.originalTimeSlots.length}개)`);
        room.timeSlots = room.originalTimeSlots;
        room.originalTimeSlots = [];
      }
      // ✅ 이동시간 슬롯도 비우기 (일반 모드는 이동시간 없음)
      room.travelTimeSlots = [];
      console.log(`   [복원] travelTimeSlots 비움`);
    } else {
      // 🚗 이동시간 모드: enhancedSchedule로 완전 교체

      // 원본 저장 (첫 적용 시에만)
      if (!room.originalTimeSlots || room.originalTimeSlots.length === 0) {
        room.originalTimeSlots = JSON.parse(JSON.stringify(room.timeSlots));
        console.log(`   [원본 저장] ${room.originalTimeSlots.length}개 슬롯 백업`);
      }

      // ✨ receivedTimeSlots와 receivedTravelSlots는 이미 위에서 정의됨
      console.log(`   [수신 데이터] timeSlots: ${receivedTimeSlots.length}개, travelSlots: ${receivedTravelSlots.length}개`);

      // ✨ 병합된 이동시간 슬롯을 travelTimeSlots에 저장 (10분 단위 아님!)
      room.travelTimeSlots = receivedTravelSlots.map(e => {
        const dateObj = e.date instanceof Date ? e.date : new Date(e.date);
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayOfWeek = dayNames[dateObj.getDay()];  // Date 객체에서 요일 추출
        
        // 사용자 ID 추출 (e.user 또는 room.owner)
        const userId = e.user?._id || e.user || room.owner._id;
        
        // ✅ 조원 색상 가져오기
        let userColor = e.color;  // 클라이언트에서 계산한 색상이 있으면 사용
        if (!userColor) {
          // 없으면 room.members에서 찾기
          userColor = room.getUserColor(userId);
        }
        
        return {
          user: userId,
          date: dateObj,
          day: e.day || dayOfWeek,  // day 필드가 있으면 사용, 없으면 계산
          startTime: e.startTime,
          endTime: e.endTime,
          subject: '이동시간',
          type: 'travel',
          color: userColor,                  // ✅ 색상
          from: e.from,                      // ✅ 출발지
          to: e.to,                          // ✅ 도착지
          travelMode: e.travelMode || travelMode,  // ✅ 이동수단
          travelInfo: e.travelInfo           // ✅ 거리/시간 정보
        };
      });
      console.log(`   [이동시간 저장] ${room.travelTimeSlots.length}개 슬롯 (병합됨, 10분 단위 아님)`);

      // ⚠️ Phase 3: 수업시간 슬롯만 저장 (이동시간 제외)
      // 이동시간 슬롯은 제외하고, 순수 수업시간만 저장
      room.timeSlots = receivedTimeSlots
        .filter(e => !e.isTravel && e.subject !== '이동시간')
        .map((e, idx) => {
          // 클라이언트에서 계산된 순수 수업 시간을 그대로 사용
          const pureStartTime = e.startTime; 

          const newSlot = {
            user: e.user._id || e.user,
            date: e.date instanceof Date ? e.date : new Date(e.date),
            day: e.day,
            startTime: pureStartTime,  // ✅ 순수 수업시간 (이동시간 제외)
            endTime: e.endTime,
            subject: e.subject || '자동 배정',
            assignedBy: room.owner._id,
            status: 'confirmed',
            // 🆕 클라이언트에서 넘겨준 메타데이터 보존
            adjustedForTravelTime: e.adjustedForTravelTime || false,
            originalStartTime: e.originalStartTime,
            originalEndTime: e.originalEndTime,
            actualStartTime: e.actualStartTime,  // 이동시간 포함 시작
            travelTimeBefore: e.travelTimeBefore // 이동시간(분)
          };

          if (idx < 5) {
            console.log(`   [적용 ${idx}] ${e.subject}: ${pureStartTime}-${e.endTime} (이동전 시작: ${e.actualStartTime || '없음'})`);
          }

          return newSlot;
        });

      console.log(`   ✅ timeSlots 교체 완료: ${room.timeSlots.length}개 (이동시간 슬롯 제외)`);
    }

    // 4-1. 🔒 금지시간 검증 (Step 4)
    if (travelMode !== 'normal') {
      const blockedTimes = room.settings?.blockedTimes || [];

      if (blockedTimes.length > 0) {
        console.log('🔒 [금지시간 검증] 시작...');
        let violationCount = 0;

        room.timeSlots.forEach((slot, idx) => {
          if (slot.adjustedForTravelTime) {
            const blockedTime = isTimeInBlockedRange(slot.startTime, slot.endTime, blockedTimes);

            if (blockedTime) {
              violationCount++;
              console.log(`   ⚠️ [침범 감지 ${idx}] ${slot.subject} (${slot.startTime}-${slot.endTime})이(가) ${blockedTime.name || '금지 시간'}(${blockedTime.startTime}-${blockedTime.endTime})과 겹침`);

              // 금지시간 이후로 이동 (자동 보정)
              const blockedEndMinutes = timeToMinutes(blockedTime.endTime);
              const slotDuration = timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime);
              const newStartMinutes = blockedEndMinutes;
              const newEndMinutes = blockedEndMinutes + slotDuration;

              const minutesToTime = (minutes) => {
                const hours = Math.floor(minutes / 60);
                const mins = minutes % 60;
                return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
              };

              const correctedStart = minutesToTime(newStartMinutes);
              const correctedEnd = minutesToTime(newEndMinutes);

              console.log(`   🔧 [자동 보정] ${slot.startTime}-${slot.endTime} → ${correctedStart}-${correctedEnd}`);

              slot.startTime = correctedStart;
              slot.endTime = correctedEnd;
            }
          }
        });

        if (violationCount > 0) {
          console.log(`⚠️ [금지시간 검증] 총 ${violationCount}개 침범 감지 및 자동 보정 완료`);
        } else {
          console.log(`✅ [금지시간 검증] 침범 없음`);
        }
      }
    }

    // 5. currentTravelMode 설정
    room.currentTravelMode = travelMode;
    
    // Retry logic for VersionError
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await room.save();
        break; // 성공하면 루프 종료
      } catch (error) {
        if (error.name === 'VersionError' && attempt < maxRetries) {
          console.log(`⚠️ VersionError 발생, 재시도 중 (${attempt}/${maxRetries})...`);
          // 최신 버전 다시 조회
          const freshRoom = await Room.findById(room._id);
          if (freshRoom) {
            // 변경사항 다시 적용
            freshRoom.timeSlots = room.timeSlots;
            freshRoom.originalTimeSlots = room.originalTimeSlots;
            freshRoom.travelTimeSlots = room.travelTimeSlots;
            freshRoom.currentTravelMode = room.currentTravelMode;
            room = freshRoom;
          }
        } else {
          throw error; // 재시도 횟수 초과 또는 다른 에러
        }
      }
    }

    console.log(`✅ [applyTravelMode] 완료 - ${travelMode} 모드 적용`);
    console.log(`📋 [저장 완료] travelTimeSlots: ${room.travelTimeSlots?.length || 0}개 저장됨`);

    // 🔍 디버깅: 저장된 timeSlots 검증
    console.log('📊 [저장 후 검증] 첫 5개 슬롯:');
    room.timeSlots.slice(0, 5).forEach((slot, idx) => {
      console.log(`  [${idx}] ${slot.subject}:`, {
        user: slot.user._id || slot.user,
        date: slot.date,
        originalStart: slot.originalStartTime,
        adjustedStart: slot.startTime,
        originalEnd: slot.originalEndTime,
        adjustedEnd: slot.endTime,
        isAdjusted: slot.adjustedForTravelTime || false
      });
    });

    // 6. Socket.io로 모든 사용자에게 알림
    const io = req.app.get('io');
    if (io) {
      io.to(`room-${roomId}`).emit('travelModeChanged', {
        roomId: room._id.toString(),
        travelMode: travelMode,
        timeSlots: room.timeSlots,
        currentTravelMode: room.currentTravelMode
      });
      console.log(`📢 [Socket.io] travelModeChanged 이벤트 전송: 방 ${roomId}, 모드: ${travelMode}`);
    }

    res.json({
      success: true,
      travelMode: travelMode,
      timeSlotsCount: room.timeSlots.length
    });

  } catch (error) {
    console.error('❌ [applyTravelMode] 실패:', error);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.', error: error.message });
  }
};

/**
 * @desc    이동시간 모드 확정 (조원들에게 표시)
 * @route   POST /api/coordination/rooms/:roomId/confirm-travel-mode
 * @access  Private (Room Owner only)
 */
exports.confirmTravelMode = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { travelMode } = req.body; // 클라이언트에서 확정할 모드를 명시적으로 전달받음

    console.log(`📌 [confirmTravelMode] 시작 - 방: ${roomId}, 모드: ${travelMode}`);

    // 1. 방 조회
    const room = await Room.findById(roomId).populate('members.user', 'name email').populate('owner', 'name email');
    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    // 2. 방장 권한 확인
    if (!room.owner._id.equals(req.user.id)) {
      return res.status(403).json({ msg: '방장만 이동시간 모드를 확정할 수 있습니다.' });
    }

    // 3. 전달받은 travelMode를 confirmedTravelMode로 설정
    // ⚠️ 주의: confirmedAt은 confirmSchedule에서만 설정해야 함!
    // confirmTravelMode는 이동 모드만 확정하는 것이지, 스케줄을 확정하는 것이 아님
    const previousConfirmedMode = room.confirmedTravelMode;
    room.confirmedTravelMode = travelMode;
    room.currentTravelMode = travelMode; // currentTravelMode도 동기화
    // room.confirmedAt은 여기서 설정하지 않음!

    await room.save();

    console.log(`✅ [confirmTravelMode] ${previousConfirmedMode || 'null'} → ${room.confirmedTravelMode} 확정 완료`);

    // 4. Socket.io로 모든 사용자에게 알림 (조원들이 화면 업데이트)
    const io = req.app.get('io');
    if (io) {
      io.to(`room-${roomId}`).emit('travelModeConfirmed', {
        roomId: room._id.toString(),
        confirmedTravelMode: room.confirmedTravelMode,
        timeSlots: room.timeSlots
      });
      console.log(`📢 [Socket.io] travelModeConfirmed 이벤트 전송: ${room.confirmedTravelMode}`);
    }

    res.json({
      success: true,
      confirmedTravelMode: room.confirmedTravelMode
    });

  } catch (error) {
    console.error('❌ [confirmTravelMode] 실패:', error);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.', error: error.message });
  }
};
