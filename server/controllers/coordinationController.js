const mongoose = require('mongoose');
const Room = require('../models/room');
const User = require('../models/user');
const { OWNER_COLOR, getAvailableColor } = require('../utils/colorUtils');

// @desc    Create a new coordination room
// @route   POST /api/coordination/rooms
// @access  Private
exports.createRoom = async (req, res) => {
  try {
    const { name, description, maxMembers, settings } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ msg: '방 이름은 필수입니다.' });
    }

    // Generate unique invite code
    let inviteCode;
    let codeExists = true;
    while (codeExists) {
      inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const existingRoom = await Room.findOne({ inviteCode });
      if (!existingRoom) codeExists = false;
    }
    
    const room = new Room({
      name: name.trim(),
      description: description?.trim() || '',
      owner: req.user.id,
      inviteCode,
      maxMembers: maxMembers || 10,
      settings: settings || {}
    });

    await room.save();
    await room.populate('owner', 'firstName lastName email');
    await room.populate('members.user', 'firstName lastName email');

    res.status(201).json(room);
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Update room details (owner only)
// @route   PUT /api/coordination/rooms/:roomId
// @access  Private
exports.updateRoom = async (req, res) => {
  try {
    const { name, description, maxMembers, settings } = req.body;
    
    const room = await Room.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    // Check if user is owner
    if (!room.isOwner(req.user.id)) {
      return res.status(403).json({ msg: '방장만 수정할 수 있습니다.' });
    }

    // Update room fields
    if (name && name.trim()) room.name = name.trim();
    if (description !== undefined) room.description = description.trim();
    if (maxMembers && maxMembers >= 2 && maxMembers <= 20) {
      // Check if current members exceed new limit
      if (room.members.length > maxMembers) {
        return res.status(400).json({ msg: `현재 멤버 수(${room.members.length}명)보다 적게 설정할 수 없습니다.` });
      }
      room.maxMembers = maxMembers;
    }
    if (settings) room.settings = { ...room.settings, ...settings };

    await room.save();
    await room.populate('owner', 'firstName lastName email');
    await room.populate('members.user', 'firstName lastName email');

    res.json(room);
  } catch (error) {
    console.error('Error updating room:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Delete room (owner only)
// @route   DELETE /api/coordination/rooms/:roomId
// @access  Private
exports.deleteRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    // Check if user is owner
    if (!room.isOwner(req.user.id)) {
      return res.status(403).json({ msg: '방장만 삭제할 수 있습니다.' });
    }

    await Room.findByIdAndDelete(req.params.roomId);
    res.json({ msg: '방이 삭제되었습니다.' });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Join a coordination room
// @route   POST /api/coordination/rooms/:inviteCode/join
// @access  Private
exports.joinRoom = async (req, res) => {
  try {
    const room = await Room.findOne({ inviteCode: req.params.inviteCode.toUpperCase() });
    if (!room) {
      return res.status(404).json({ msg: '초대 코드가 유효하지 않습니다.' });
    }

    // Check if user is the room owner
    if (room.isOwner(req.user.id)) {
      const populatedRoom = await Room.findById(room._id)
        .populate('owner', 'firstName lastName email')
        .populate('members.user', 'firstName lastName email');
      return res.json(populatedRoom);
    }

    // Data cleanup and deduplication
    const existingEntries = room.members.filter(m => m.user && m.user.toString() === req.user.id);
    if (existingEntries.length > 1) {
      room.members = room.members.filter(m => !m.user || m.user.toString() !== req.user.id);
      const existingColors = room.members.map(m => m.color);
      const newColor = getAvailableColor(existingColors);
      room.members.push({ user: req.user.id, color: newColor });
      await room.save();
    }

    // Check room capacity
    if (room.members.length >= room.maxMembers) {
      const isAlreadyMember = room.isMember(req.user.id);
      if (!isAlreadyMember) {
        return res.status(400).json({ msg: '방이 가득 찼습니다.' });
      }
    }

    // Get existing colors before adding new member
    const existingColors = room.members.map(m => m.color);
    const newColor = getAvailableColor(existingColors);
    
    // Add user to members array if not already in it
    const updatedRoom = await Room.findOneAndUpdate(
      { 
        _id: room._id, 
        'members.user': { $ne: req.user.id }
      },
      { 
        $push: { members: { user: req.user.id, color: newColor } }
      },
      { new: true }
    )
    .populate('owner', 'firstName lastName email')
    .populate('members.user', 'firstName lastName email');

    if (updatedRoom) {
      return res.json(updatedRoom);
    }

    // User is already a member, return current room state
    const currentRoom = await Room.findById(room._id)
      .populate('owner', 'firstName lastName email')
      .populate('members.user', 'firstName lastName email');
    res.json(currentRoom);
  } catch (error) {
    console.error('Error joining room:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Get room details
// @route   GET /api/coordination/rooms/:roomId
// @access  Private
exports.getRoomDetails = async (req, res) => {
  try {
    let room = await Room.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    // Check if user is a member or owner
    if (!room.isOwner(req.user.id) && !room.isMember(req.user.id)) {
      return res.status(403).json({ msg: '이 방에 접근할 권한이 없습니다.' });
    }

    // Fix owner color to ensure it's different from members
    const ownerMember = room.members.find(member => 
      member.user?.toString() === room.owner?._id?.toString() || 
      member.user?.toString() === room.owner?.toString()
    );
    
    if (ownerMember && ownerMember.color !== OWNER_COLOR) {
      ownerMember.color = OWNER_COLOR;
    }
    
    await room.save();
    
    // Populate all necessary fields
    await room.populate('owner', 'firstName lastName email');
    await room.populate('members.user', 'firstName lastName email');
    await room.populate('timeSlots.user', 'firstName lastName email');
    await room.populate('requests.requester', 'firstName lastName email');

    res.json(room);
  } catch (error) {
    console.error('Error fetching room details:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Submit time slots for a room
// @route   POST /api/coordination/rooms/:roomId/slots
// @access  Private
exports.submitTimeSlots = async (req, res) => {
  try {
    const { slots } = req.body;
    const room = await Room.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    if (!room.isMember(req.user.id) && !room.isOwner(req.user.id)) {
      return res.status(403).json({ msg: '이 방의 멤버가 아닙니다.' });
    }

    // Handle slot removal if slots array is empty
    if (!slots || slots.length === 0) {
      room.timeSlots = room.timeSlots.filter(slot => slot.user.toString() !== req.user.id);
    } else {
      // Add new slots (only if they don't already exist for this user)
      slots.forEach(slot => {
        const existingSlot = room.timeSlots.find(existing => 
          existing.user.toString() === req.user.id &&
          existing.day === slot.day &&
          existing.startTime === slot.startTime &&
          existing.endTime === slot.endTime
        );
        if (!existingSlot) {
          const newSlot = {
            _id: new mongoose.Types.ObjectId(),
            ...slot,
            user: req.user.id,
            status: 'confirmed'
          };
          room.timeSlots.push(newSlot);
        }
      });
    }

    await room.save();
    await room.populate('timeSlots.user', 'firstName lastName email');
    res.json(room);
  } catch (error) {
    console.error('Error submitting time slots:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Remove a specific time slot
// @route   POST /api/coordination/rooms/:roomId/slots/remove
// @access  Private
exports.removeTimeSlot = async (req, res) => {
  try {
    const { day, startTime, endTime } = req.body;
    const room = await Room.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    // Remove the specific slot
    room.timeSlots = room.timeSlots.filter(slot => 
      !(slot.user.toString() === req.user.id &&
        slot.day === day &&
        slot.startTime === startTime &&
        slot.endTime === endTime)
    );

    await room.save();
    res.json({ msg: '시간표가 제거되었습니다.' });
  } catch (error) {
    console.error('Error removing time slot:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Get my rooms
// @route   GET /api/coordination/my-rooms
// @access  Private
exports.getMyRooms = async (req, res) => {
  try {
    const newOwnedRooms = await Room.find({ owner: req.user.id })
      .populate('owner', 'firstName lastName email')
      .populate('members.user', 'firstName lastName email')
      .sort({ createdAt: -1 });
      
    const newJoinedRooms = await Room.find({
      'members.user': req.user.id,
      owner: { $ne: req.user.id }
    })
      .populate('owner', 'firstName lastName email')
      .populate('members.user', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json({
      owned: newOwnedRooms,
      joined: newJoinedRooms
    });
  } catch (error) {
    console.error('Error fetching my rooms:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Assign time slot to user (owner only)
// @route   POST /api/coordination/rooms/:roomId/assign
// @access  Private
exports.assignTimeSlot = async (req, res) => {
  try {
    const { day, startTime, endTime, userId } = req.body;
    const room = await Room.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    if (!room.isOwner(req.user.id)) {
      return res.status(403).json({ msg: '방장만 시간을 배정할 수 있습니다.' });
    }

    // Remove existing assignment for this slot
    room.timeSlots = room.timeSlots.filter(slot => 
      !(slot.day === day && slot.startTime === startTime && slot.endTime === endTime)
    );

    // Add new assignment
    room.timeSlots.push({
      _id: new mongoose.Types.ObjectId(),
      day,
      startTime,
      endTime,
      subject: '배정된 시간',
      user: userId,
      status: 'assigned'
    });

    await room.save();
    await room.populate('timeSlots.user', 'firstName lastName email');
    res.json(room);
  } catch (error) {
    console.error('Error assigning time slot:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Create request
// @route   POST /api/coordination/requests
// @access  Private
exports.createRequest = async (req, res) => {
  try {
    const { roomId, type, timeSlot, targetUserId, message } = req.body;
    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    const newRequest = {
      _id: new mongoose.Types.ObjectId(),
      requester: req.user.id,
      type,
      timeSlot,
      targetUserId,
      message,
      status: 'pending'
    };

    if (type === 'slot_swap') {
      newRequest.targetSlot = req.body.targetSlot; // Assuming targetSlot is sent in req.body
    }

    room.requests.push(newRequest);
    await room.save();
    await room.populate('requests.requester', 'firstName lastName email');
    res.json(room);
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Handle request (approve/reject)
// @route   POST /api/coordination/requests/:requestId/:action
// @access  Private
exports.handleRequest = async (req, res) => {
  try {
    const { requestId, action } = req.params;
    const room = await Room.findOne({ 'requests._id': requestId });

    if (!room) {
      return res.status(404).json({ msg: '요청을 찾을 수 없습니다.' });
    }

    const request = room.requests.id(requestId);
    if (!request) {
      return res.status(404).json({ msg: '요청을 찾을 수 없습니다.' });
    }

    if (action === 'approved') {
      request.status = 'approved';
      // Handle the request based on type
      if (request.type === 'time_request') {
        // Add the requested time slot
        room.timeSlots.push({
          _id: new mongoose.Types.ObjectId(),
          ...request.timeSlot,
          user: request.requester,
          status: 'confirmed'
        });
      } else if (request.type === 'slot_swap') {
        const requesterSlot = request.timeSlot; // Slot requester wants to give
        const targetSlot = request.targetSlot;   // Slot target user wants to give

        // Find the actual time slots in the room's timeSlots array
        const roomRequesterSlot = room.timeSlots.find(slot =>
          slot.day === requesterSlot.day &&
          slot.startTime === requesterSlot.startTime &&
          slot.endTime === requesterSlot.endTime &&
          slot.user.toString() === request.requester.toString() // Ensure it's the requester's slot
        );

        const roomTargetSlot = room.timeSlots.find(slot =>
          slot.day === targetSlot.day &&
          slot.startTime === targetSlot.startTime &&
          slot.endTime === targetSlot.endTime &&
          slot.user.toString() === request.targetUserId.toString() // Ensure it's the target user's slot
        );

        if (roomRequesterSlot && roomTargetSlot) {
          // Perform the swap
          roomRequesterSlot.user = request.targetUserId; // Requester's slot now belongs to target
          roomTargetSlot.user = request.requester;       // Target's slot now belongs to requester

          // Optionally update status to confirmed/assigned
          roomRequesterSlot.status = 'assigned';
          roomTargetSlot.status = 'assigned';
        } else {
          // Handle case where one or both slots are not found (e.g., already taken or removed)
          console.warn('One or both slots for swap not found in room.timeSlots');
          // Maybe set request status to 'failed' or 'invalid'
          request.status = 'failed'; // Or 'invalid'
        }
      }
    } else if (action === 'rejected') {
      request.status = 'rejected';
    }

    await room.save();
    res.json({ msg: `요청이 ${action === 'approved' ? '승인' : '거절'}되었습니다.` });
  } catch (error) {
    console.error('Error handling request:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

