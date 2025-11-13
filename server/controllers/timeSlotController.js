const Room = require('../models/room');

// @desc    Submit time slots for a room
  // @route   POST /api/coordination/rooms/:roomId/timeslots
  // @access  Private
  exports.submitTimeSlots = async (req, res) => {
     try {
        const room = await Room.findById(req.params.roomId);

        if (!room) {
           return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
        }

        if (!room.isMember(req.user.id) && !room.isOwner(req.user.id)) {
           return res.status(403).json({ msg: '이 방에 접근할 권한이 없습니다.' });
        }

        const { slots } = req.body;

        // 사용자가 제출한 새 슬롯만 추가합니다. (기존 슬롯은 그대로 둡니다)
        if (Array.isArray(slots)) {
          slots.forEach(slot => {
             // 이미 해당 시간대에 슬롯이 있는지 확인
             const existingSlot = room.timeSlots.find(s =>
                  s.user.toString() === req.user.id &&
                  s.day === slot.day &&
                  s.startTime === slot.startTime
             );

             // 없을 경우에만 새로 추가
             if (!existingSlot) {
                 room.timeSlots.push({
                    user: req.user.id,
                    date: slot.date,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    day: slot.day,
                    priority: slot.priority || 3,
                    subject: slot.subject || '제출된 시간',
                    status: 'confirmed',
                 });
             }
          });
        }

        await room.save();
        await room.populate('timeSlots.user', '_id firstName lastName email');

        res.json(room);
     } catch (error) {
        res.status(500).json({ msg: 'Server error' });
     }
  };

// @desc    Remove a specific time slot
// @route   DELETE /api/coordination/rooms/:roomId/timeslots
// @access  Private
exports.removeTimeSlot = async (req, res) => {
   try {
      const room = await Room.findById(req.params.roomId);

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      // Remove the specific slot
      const { day, startTime, endTime } = req.body;

      room.timeSlots = room.timeSlots.filter(slot => {
         const slotUserId = slot.user?._id || slot.user;
         const isUserSlot = slotUserId?.toString() === req.user.id.toString();
         const isTargetSlot = slot.day === day && slot.startTime === startTime && slot.endTime === endTime;

         return !(isUserSlot && isTargetSlot);
      });

      await room.save();
      await room.populate('timeSlots.user', '_id firstName lastName email');

      res.json(room);
   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};

// @desc    Assign time slot to a member (Owner only)
// @route   POST /api/coordination/rooms/:roomId/assign
// @access  Private (Owner only)
exports.assignTimeSlot = async (req, res) => {
   try {
      const room = await Room.findById(req.params.roomId);

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      if (!room.isOwner(req.user.id)) {
         return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
      }

      const { day, startTime, endTime, userId } = req.body;

      // Check if the target user is a member
      const isMember = room.members.some(member =>
         (member.user._id || member.user).toString() === userId
      );

      if (!isMember) {
         return res.status(400).json({ msg: '해당 사용자는 이 방의 멤버가 아닙니다.' });
      }

      // Remove any existing assignment for this slot
      room.timeSlots = room.timeSlots.filter(slot =>
         !(slot.day === day && slot.startTime === startTime && slot.endTime === endTime && slot.assignedBy)
      );

      // Add the new assignment
      room.timeSlots.push({
         user: userId,
         date: new Date(), // This should be calculated based on day and current week
         startTime,
         endTime,
         day,
         priority: 3,
         subject: '수동 배정',
         status: 'confirmed',
         assignedBy: req.user.id,
         assignedAt: new Date(),
      });

      await room.save();
      await room.populate('timeSlots.user', '_id firstName lastName email');

      res.json(room);
   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};

// @desc    Find common slots among members
// @route   GET /api/coordination/rooms/:roomId/common-slots
// @access  Private (Owner only)
exports.findCommonSlots = async (req, res) => {
   try {
      const room = await Room.findById(req.params.roomId)
         .populate('members.user', 'firstName lastName email')
         .populate('timeSlots.user', '_id firstName lastName email');

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      if (!room.isOwner(req.user.id)) {
         return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
      }

      // Group time slots by day and time
      const slotGroups = {};

      room.timeSlots.forEach(slot => {
         const key = `${slot.day}-${slot.startTime}`;
         if (!slotGroups[key]) {
            slotGroups[key] = {
               day: slot.day,
               startTime: slot.startTime,
               endTime: slot.endTime,
               members: []
            };
         }
         slotGroups[key].members.push({
            id: slot.user._id,
            name: `${slot.user.firstName} ${slot.user.lastName}`,
            email: slot.user.email
         });
      });

      // Find slots with multiple members (common slots)
      const commonSlots = Object.values(slotGroups)
         .filter(group => group.members.length > 1)
         .sort((a, b) => {
            const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
            const dayDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
            if (dayDiff !== 0) return dayDiff;
            return a.startTime.localeCompare(b.startTime);
         });

      const result = {
         totalSlots: Object.keys(slotGroups).length,
         commonSlots: commonSlots,
         conflictCount: commonSlots.length
      };

      res.json(result);
   } catch (error) {
      res.status(500).json({ msg: 'Server error while finding common slots' });
   }
};

// @desc    Reset all member carryover times
// @route   POST /api/coordination/reset-carryover/:roomId
// @access  Private (Owner only)
exports.resetCarryOverTimes = async (req, res) => {
   try {
      const { roomId } = req.params;
      const room = await Room.findById(roomId);

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      if (!room.isOwner(req.user.id)) {
         return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
      }

      let resetCount = 0;

      // Reset carryOver for all members
      room.members.forEach(member => {
         if (member.carryOver > 0) {
            const prevCarry = member.carryOver;
            member.carryOver = 0;
            resetCount++;

            if (!member.carryOverHistory) member.carryOverHistory = [];
            member.carryOverHistory.push({
               week: new Date(),
               amount: prevCarry,
               reason: 'manual_reset',
               timestamp: new Date(),
            });
         }
      });

      await room.save();

      // Return updated room with populated fields
      const updatedRoom = await Room.findById(roomId)
         .populate('owner', 'firstName lastName email')
         .populate('members.user', 'firstName lastName email');
      res.json({
         resetCount,
         message: `${resetCount}명의 멤버 이월시간이 초기화되었습니다.`,
         room: updatedRoom,
      });
   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};

// @desc    Reset all member completed times
// @route   POST /api/coordination/reset-completed/:roomId
// @access  Private (Owner only)
exports.resetCompletedTimes = async (req, res) => {
   try {
      const { roomId } = req.params;
      const room = await Room.findById(roomId);

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      if (!room.isOwner(req.user.id)) {
         return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
      }

      let resetCount = 0;

      // Reset completed times only
      room.members.forEach((member, index) => {

         // totalProgressTime 초기화 (이월시간은 제외)
         if (member.totalProgressTime > 0) {
            const prevValue = member.totalProgressTime;
            member.totalProgressTime = 0;
            resetCount++;

            if (!member.progressHistory) member.progressHistory = [];
            member.progressHistory.push({
               date: new Date(),
               action: 'reset',
               previousValue: prevValue,
            });
         }
      });

      await room.save();

      // Return updated room with populated fields
      const updatedRoom = await Room.findById(roomId)
         .populate('owner', 'firstName lastName email')
         .populate('members.user', 'firstName lastName email');

      res.json({
         resetCount,
         message: `${resetCount}명의 멤버 완료시간이 초기화되었습니다.`,
         room: updatedRoom,
      });
   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};

// @desc    Reset carryover times for all members in a room
// @route   POST /api/coordination/reset-carryover/:roomId
// @access  Private (Owner only)
exports.resetCarryOverTimes = async (req, res) => {
   try {

      const { roomId } = req.params;
      const room = await Room.findById(roomId);

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      if (!room.isOwner(req.user.id)) {
         return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
      }

      let resetCount = 0;

      // Reset carryover times only
      room.members.forEach((member, index) => {

         // carryOver 초기화 (완료시간은 제외)
         if (member.carryOver > 0) {
            const prevValue = member.carryOver;
            member.carryOver = 0;
            resetCount++;

            if (!member.carryOverHistory) member.carryOverHistory = [];
            member.carryOverHistory.push({
               week: new Date(),
               amount: -prevValue,
               reason: 'admin_reset',
               timestamp: new Date()
            });
         }
      });

      await room.save();

      // Return updated room with populated fields
      const updatedRoom = await Room.findById(roomId)
         .populate('owner', 'firstName lastName email')
         .populate('members.user', 'firstName lastName email');

      res.json({
         resetCount,
         message: `${resetCount}명의 멤버 이월시간이 초기화되었습니다.`,
         room: updatedRoom,
      });
   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};

// @desc    Clear a specific member's carry-over history and reset carry-over time
// @route   DELETE /api/coordination/rooms/:roomId/members/:memberId/carry-over-history
// @access  Private (Owner only)
exports.clearCarryOverHistory = async (req, res) => {
   try {
      const { roomId, memberId } = req.params;

      const room = await Room.findById(roomId);

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      if (!room.isOwner(req.user.id)) {
         return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
      }

      const memberIndex = room.members.findIndex(m => (m.user._id || m.user).toString() === memberId);

      if (memberIndex === -1) {
         return res.status(404).json({ msg: '해당 멤버를 찾을 수 없습니다.' });
      }

      room.members[memberIndex].carryOver = 0;
      room.members[memberIndex].carryOverHistory = [];

      await room.save();

      const updatedRoom = await Room.findById(roomId)
         .populate('owner', 'firstName lastName email')
         .populate('members.user', 'firstName lastName email');

      res.json(updatedRoom);

   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};

// @desc    Reset both completed and carryover times for all members
// @route   POST /api/coordination/rooms/:roomId/reset-all-stats
// @access  Private (Owner only)
exports.resetAllMemberStats = async (req, res) => {
   try {
      const { roomId } = req.params;
      const room = await Room.findById(roomId);

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      if (!room.isOwner(req.user.id)) {
         return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
      }

      let resetCount = 0;

      room.members.forEach(member => {
         let updated = false;
         // Reset totalProgressTime
         if (member.totalProgressTime > 0) {
            member.totalProgressTime = 0;
            if (!member.progressHistory) member.progressHistory = [];
            member.progressHistory.push({ date: new Date(), action: 'reset' });
            updated = true;
         }

         // Reset carryOver
         if (member.carryOver > 0) {
            const prevCarry = member.carryOver;
            member.carryOver = 0;
            if (!member.carryOverHistory) member.carryOverHistory = [];
            member.carryOverHistory.push({ week: new Date(), amount: -prevCarry, reason: 'admin_reset', timestamp: new Date() });
            updated = true;
         }

         if (updated) {
            resetCount++;
         }
      });

      await room.save();

      const updatedRoom = await Room.findById(roomId)
         .populate('owner', 'firstName lastName email')
         .populate('members.user', 'firstName lastName email');

      res.json({
         resetCount,
         message: `${resetCount}명의 멤버의 완료시간과 이월시간이 초기화되었습니다.`,
         room: updatedRoom,
      });

   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};

// @desc    Clear all members' carry-over history and reset carry-over time
// @route   DELETE /api/coordination/rooms/:roomId/all-carry-over-history
// @access  Private (Owner only)
exports.clearAllCarryOverHistories = async (req, res) => {
   try {
      const { roomId } = req.params;

      const room = await Room.findById(roomId);

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      if (!room.isOwner(req.user.id)) {
         return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
      }

      room.members.forEach(member => {
         member.carryOver = 0;
         member.carryOverHistory = [];
      });

      await room.save();

      const updatedRoom = await Room.findById(roomId)
         .populate('owner', 'firstName lastName email')
         .populate('members.user', 'firstName lastName email');

      res.json({
         msg: '모든 멤버의 이월시간 내역이 성공적으로 삭제되었습니다.',
         room: updatedRoom
      });

   } catch (error) {
      res.status(500).json({ msg: 'Server error' });
   }
};