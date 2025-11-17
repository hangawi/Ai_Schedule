const Room = require('../models/Room');
const User = require('../models/User');

// @desc    Remove a member from a room (owner only)
// @route   DELETE /api/coordination/rooms/:roomId/members/:memberId
// @access  Private (Room Owner only)
exports.removeMember = async (req, res) => {
  try {
    const { roomId, memberId } = req.params;

    // 1. Find the room
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    // 2. Validate owner
    if (room.owner.toString() !== req.user.id) {
      return res.status(403).json({ msg: '방장만 조원을 제거할 수 있습니다.' });
    }

    // 3. Prevent owner from removing themselves
    if (room.owner.toString() === memberId) {
      return res.status(400).json({ msg: '방장은 자신을 제거할 수 없습니다.' });
    }

    // 4. Check if member exists in the room
    const initialMemberCount = room.members.length;
    room.members = room.members.filter(member => member.user.toString() !== memberId);

    if (room.members.length === initialMemberCount) {
      return res.status(404).json({ msg: '해당 조원을 찾을 수 없습니다.' });
    }

    // 5. Remove all timeSlots associated with the removed member
    room.timeSlots = room.timeSlots.filter(slot => slot.userId?.toString() !== memberId && slot.user?.toString() !== memberId);

    // 6. Remove all requests associated with the removed member (as requester or target)
    room.requests = room.requests.filter(request =>
      request.requester?.toString() !== memberId &&
      request.targetUser?.toString() !== memberId
    );

    // 7. Get member info for notification
    const removedUser = await User.findById(memberId);

    // 8. Save room
    await room.save();
    await room.populate('owner', 'firstName lastName email');
    await room.populate('members.user', 'firstName lastName email');

    res.json({
      msg: '조원이 성공적으로 제거되었습니다.',
      room,
      removedMember: {
        name: removedUser?.name || `${removedUser?.firstName || ''} ${removedUser?.lastName || ''}`.trim(),
        email: removedUser?.email,
        id: memberId
      }
    });

  } catch (error) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Leave a coordination room (member self-exit)
// @route   DELETE /api/coordination/rooms/:roomId/leave
// @access  Private
exports.leaveRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    // 1. Find the room
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    // 2. Check if user is the owner
    if (room.owner.toString() === userId) {
      return res.status(400).json({
        msg: '방장은 방을 나갈 수 없습니다. 방을 삭제하거나 다른 조원에게 방장을 위임하세요.'
      });
    }

    // 3. Check if user is a member
    const initialMemberCount = room.members.length;
    room.members = room.members.filter(member => member.user.toString() !== userId);

    if (room.members.length === initialMemberCount) {
      return res.status(404).json({ msg: '이 방의 조원이 아닙니다.' });
    }

    // 4. Remove all timeSlots associated with the leaving user
    room.timeSlots = room.timeSlots.filter(slot =>
      slot.userId?.toString() !== userId && slot.user?.toString() !== userId
    );

    // 5. Remove all requests associated with the leaving user
    room.requests = room.requests.filter(request =>
      request.requester?.toString() !== userId &&
      request.targetUser?.toString() !== userId
    );

    // 6. Save room
    await room.save();
    await room.populate('owner', 'firstName lastName email');
    await room.populate('members.user', 'firstName lastName email');

    res.json({
      msg: '방에서 성공적으로 나갔습니다.',
      success: true,
      room
    });

  } catch (error) {
    console.error('Leave room error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Get count of pending exchange requests for the user
// @route   GET /api/coordination/exchange-requests-count
// @access  Private
exports.getExchangeRequestsCount = async (req, res) => {
   try {
      const userId = req.user.id;

      const rooms = await Room.find({
         $or: [{ owner: userId }, { 'members.user': userId }],
      });

      let count = 0;
      rooms.forEach(room => {
         room.requests.forEach(request => {
            if (
               request.status === 'pending' &&
               request.type === 'slot_swap' &&
               request.targetUser &&
               request.targetUser.toString() === userId
            ) {
               count++;
            }
         });
      });

      res.json({ success: true, count });
   } catch (error) {
      res.status(500).json({ success: false, msg: 'Server error' });
   }
};
