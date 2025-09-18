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

      const { timeSlots } = req.body;

      // Remove existing time slots for this user
      room.timeSlots = room.timeSlots.filter(slot => {
         const slotUserId = slot.user?._id || slot.user;
         return slotUserId?.toString() !== req.user.id.toString();
      });

      // Add new time slots
      timeSlots.forEach(slot => {
         room.timeSlots.push({
            user: req.user.id,
            date: slot.date,
            startTime: slot.startTime,
            endTime: slot.endTime,
            day: slot.day,
            priority: slot.priority || 3,
            status: 'confirmed',
         });
      });

      await room.save();
      await room.populate('timeSlots.user', 'firstName lastName email');

      res.json(room);
   } catch (error) {
      console.error('Error submitting time slots:', error);
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
      await room.populate('timeSlots.user', 'firstName lastName email');

      res.json(room);
   } catch (error) {
      console.error('Error removing time slot:', error);
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
         status: 'confirmed',
         assignedBy: req.user.id,
         assignedAt: new Date(),
      });

      await room.save();
      await room.populate('timeSlots.user', 'firstName lastName email');

      res.json(room);
   } catch (error) {
      console.error('Error assigning time slot:', error);
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
         .populate('timeSlots.user', 'firstName lastName email');

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
      console.error('Error finding common slots:', error);
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

      console.log(`Reset ${resetCount} member carryover times`);
      res.json({
         resetCount,
         message: `${resetCount}명의 멤버 이월시간이 초기화되었습니다.`,
         room: updatedRoom,
      });
   } catch (error) {
      console.error('Error resetting carryover times:', error);
      res.status(500).json({ msg: 'Server error' });
   }
};

// @desc    Reset all member completed times
// @route   POST /api/coordination/reset-completed/:roomId
// @access  Private (Owner only)
exports.resetCompletedTimes = async (req, res) => {
   try {
      console.log('resetCompletedTimes called with roomId:', req.params.roomId);
      console.log('User ID:', req.user?.id);

      const { roomId } = req.params;
      const room = await Room.findById(roomId);

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      if (!room.isOwner(req.user.id)) {
         return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
      }

      let resetCount = 0;
      console.log('Room members count:', room.members.length);

      // Reset completed times only
      room.members.forEach((member, index) => {
         console.log(
            `Member ${index}: totalProgressTime = ${member.totalProgressTime}`,
         );

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
            console.log(`Reset totalProgressTime for member ${index} from ${prevValue} to 0`);
         }
      });

      await room.save();
      console.log('Room saved successfully');
      console.log('Total members reset:', resetCount);

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
      console.error('Error resetting completed/carryOver times:', error);
      res.status(500).json({ msg: 'Server error' });
   }
};

// @desc    Reset carryover times for all members in a room
// @route   POST /api/coordination/reset-carryover/:roomId
// @access  Private (Owner only)
exports.resetCarryOverTimes = async (req, res) => {
   try {
      console.log('resetCarryOverTimes called with roomId:', req.params.roomId);
      console.log('User ID:', req.user?.id);

      const { roomId } = req.params;
      const room = await Room.findById(roomId);

      if (!room) {
         return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
      }

      if (!room.isOwner(req.user.id)) {
         return res.status(403).json({ msg: '방장만 이 기능을 사용할 수 있습니다.' });
      }

      let resetCount = 0;
      console.log('Room members count:', room.members.length);

      // Reset carryover times only
      room.members.forEach((member, index) => {
         console.log(
            `Member ${index}: carryOver = ${member.carryOver}`,
         );

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
            console.log(`Reset carryOver for member ${index} from ${prevValue} to 0`);
         }
      });

      await room.save();
      console.log('Room saved successfully');
      console.log('Total members reset:', resetCount);

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
      console.error('Error resetting carryover times:', error);
      res.status(500).json({ msg: 'Server error' });
   }
};