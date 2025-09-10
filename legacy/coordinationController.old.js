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

    console.log('Creating room with settings:', settings);
    
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
    // Try to find in new Room model first
    let room = await Room.findById(req.params.roomId);

    // If not found, try legacy CoordinationRoom model
    if (!room) {
      const legacyRoom = await CoordinationRoom.findById(req.params.roomId);
      if (legacyRoom) {
        // Check if user is owner of legacy room
        if (legacyRoom.roomMasterId.toString() !== req.user.id) {
          return res.status(403).json({ msg: '방장만 삭제할 수 있습니다.' });
        }
        await CoordinationRoom.findByIdAndDelete(req.params.roomId);
        return res.json({ msg: '방이 삭제되었습니다.' });
      }
    }

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
      return res.json({
        ...populatedRoom.toJSON(),
        message: '방장은 초대 코드 없이 직접 방에 입장할 수 있습니다.'
      });
    }

    // --- Start: Data Cleanup and Deduplication ---
    const initialMemberCount = room.members.length;
    const existingEntries = room.members.filter(m => m.user && m.user.toString() === req.user.id);

    if (existingEntries.length > 1) {
        // If duplicates exist, remove all of them
        room.members = room.members.filter(m => !m.user || m.user.toString() !== req.user.id);
        // Then, add back one single, clean entry with unique color.
        const existingColors = room.members.map(m => m.color);
        const newColor = getAvailableColor(existingColors);
        room.members.push({ user: req.user.id, color: newColor });
        await room.save();
        console.log(`[Data Cleanup] User ${req.user.id} had ${existingEntries.length} entries. Cleaned up to 1.`);
    }
    // --- End: Data Cleanup ---

    // Check room capacity before trying to join
    if (room.members.length >= room.maxMembers) {
        const isAlreadyMember = room.isMember(req.user.id);
        if (!isAlreadyMember) { // Only block if they are not already a member
            return res.status(400).json({ msg: '방이 가득 찼습니다.' });
        }
    }

    // Get existing colors before adding new member
    const existingColors = room.members.map(m => m.color);
    const newColor = getAvailableColor(existingColors);
    
    // Atomically add user to members array if they are not already in it
    const updatedRoom = await Room.findOneAndUpdate(
      { 
        _id: room._id, 
        'members.user': { $ne: req.user.id } // Add only if user is NOT in members array
      },
      { 
        $push: { members: { user: req.user.id, color: newColor } } // Push a new member object with unique color
      },
      { new: true } // Return the updated document
    )
    .populate('owner', 'firstName lastName email')
    .populate('members.user', 'firstName lastName email');

    if (updatedRoom) {
      // If updatedRoom is not null, it means the user was successfully added
      return res.json(updatedRoom);
    } else {
      // If updatedRoom is null, it means the user was already in the members array
      // So, we just fetch the current state of the room and return it
      const currentRoom = await Room.findById(room._id)
        .populate('owner', 'firstName lastName email')
        .populate('members.user', 'firstName lastName email');
      return res.json(currentRoom);
    }

  } catch (error) {
    console.error('Error joining room:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Get room details by ID
// @route   GET /api/coordination/rooms/:roomId
// @access  Private
exports.getRoomDetails = async (req, res) => {
  try {
    console.log("=== Room Access Debug ===");
    console.log(`Room ID: ${req.params.roomId}`);
    console.log(`User ID: ${req.user.id}`);
    
    // Try new Room model first
    let room = await Room.findById(req.params.roomId)
      .populate('owner', 'firstName lastName email')
      .populate('members.user', 'firstName lastName email')
      .populate('timeSlots.user', 'firstName lastName email')
      .populate('requests.requester', 'firstName lastName email');

    let isLegacy = false;
    
    // If not found, try legacy CoordinationRoom model
    if (!room) {
      console.log('Not found in new Room collection, checking legacy...');
      const legacyRoom = await CoordinationRoom.findById(req.params.roomId)
        .populate('roomMasterId', 'firstName lastName email')
        .populate('members', 'firstName lastName email');
        
      if (legacyRoom) {
        isLegacy = true;
        console.log('Found in legacy CoordinationRoom');
        console.log('Legacy room master:', legacyRoom.roomMasterId?._id);
        console.log('Legacy members:', legacyRoom.members?.map(m => m._id));
        
        // Convert legacy room to new format
        room = {
          _id: legacyRoom._id,
          name: legacyRoom.name,
          description: '',
          owner: legacyRoom.roomMasterId ? {
            _id: legacyRoom.roomMasterId._id,
            name: legacyRoom.roomMasterId.name || `${legacyRoom.roomMasterId.firstName} ${legacyRoom.roomMasterId.lastName}`,
            email: legacyRoom.roomMasterId.email
          } : null,
          members: legacyRoom.members.map(member => ({
            user: {
              _id: member._id,
              name: member.name || `${member.firstName} ${member.lastName}`,
              email: member.email
            }
          })),
          inviteCode: legacyRoom.inviteCode,
          maxMembers: legacyRoom.settings?.maxMembers || 10,
          settings: legacyRoom.settings || {},
          timeSlots: [],
          requests: [],
          createdAt: legacyRoom.createdAt,
          updatedAt: legacyRoom.updatedAt,
          isMember: function(userId) {
            return this.owner._id.toString() === userId.toString() || 
                   this.members.some(member => member.user._id.toString() === userId.toString());
          },
          isOwner: function(userId) {
            return this.owner._id.toString() === userId.toString();
          }
        };
      }
    } else {
      console.log('Found in new Room collection');
    }
    
    if (!room) {
      console.log('Room not found in either collection');
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }
    
    console.log(`Room type: ${isLegacy ? 'Legacy' : 'New'}`);
    console.log(`Room name: ${room.name}`);
    console.log(`Owner ID: ${room.owner?._id}`);
    console.log(`Members: ${room.members?.map(m => m.user?._id || m._id)}`);
    
    // Check if user is member of the room
    const isOwner = room.owner?._id?.toString() === req.user.id;
    const isMemberByArray = room.members?.some(member => {
      const memberId = member.user?._id || member._id;
      return memberId?.toString() === req.user.id;
    });
    const isMemberByFunction = room.isMember ? room.isMember(req.user.id) : false;
    
    console.log(`Is owner: ${isOwner}`);
    console.log(`Is member (by array): ${isMemberByArray}`);
    console.log(`Is member (by function): ${isMemberByFunction}`);
    
    const isMember = isOwner || isMemberByArray || isMemberByFunction;
    console.log(`Final access decision: ${isMember}`);
    
    if (!isMember) {
      console.log('ACCESS DENIED');
      return res.status(403).json({ msg: '이 방에 접근할 권한이 없습니다.' });
    }

    console.log('ACCESS GRANTED');
    console.log("=== End Debug ===");
    
    // Clean up old requests without targetUserId
    room.requests = room.requests.filter(req => {
      if (req.type === 'slot_swap' && !req.targetUserId) {
        return false; // Remove swap requests without targetUserId
      }
      return true; // Keep other requests
    });
    
    // Fix owner color to ensure it's different from members
    const ownerMember = room.members.find(member => 
      member.user?.toString() === room.owner?._id?.toString() || 
      member.user?.toString() === room.owner?.toString()
    );
    
    if (ownerMember && ownerMember.color !== OWNER_COLOR) {
      ownerMember.color = OWNER_COLOR; // 방장은 항상 진한 빨간색으로 구분
    }
    
    await room.save();
    
    // Populate all necessary fields before sending response
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

// @desc    Add or update time slots for a user in a room
// @route   POST /api/coordination/rooms/:roomId/slots
// @access  Private
exports.submitTimeSlots = async (req, res) => {
  try {
    console.log("=== TimeSlot Submission Debug ===");
    console.log('Room ID:', req.params.roomId);
    console.log('User ID:', req.user.id);
    console.log('Submitted slots:', req.body.slots);
    
    const { slots } = req.body;
    
    // Try to find in new Room model first
    let room = await Room.findById(req.params.roomId);
    let isLegacy = false;

    // If not found, try legacy CoordinationRoom model
    if (!room) {
      const legacyRoom = await CoordinationRoom.findById(req.params.roomId);
      if (legacyRoom) {
        return res.status(400).json({ msg: '레거시 방은 새 시간표 기능을 지원하지 않습니다. 먼저 마이그레이션을 수행해주세요.' });
      }
    }

    if (!room) {
      console.log('Room not found');
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    console.log('Room found:', room.name);
    console.log('Room owner:', room.owner);
    console.log('Room members:', room.members.map(m => m.user));

    // Check if user is member (same logic as getRoomDetails)
    const isOwner = room.owner?._id?.toString() === req.user.id;
    const isMemberByArray = room.members?.some(member => {
      const memberId = member.user?._id || member._id;
      return memberId?.toString() === req.user.id;
    });
    const isMemberByFunction = room.isMember ? room.isMember(req.user.id) : false;
    
    const isMember = isOwner || isMemberByArray || isMemberByFunction;
    
    console.log('Is owner:', isOwner);
    console.log('Is member (by array):', isMemberByArray);
    console.log('Is member (by function):', isMemberByFunction);
    console.log('Final member check:', isMember);

    if (!isMember) {
      console.log('ACCESS DENIED for timeSlot submission');
      return res.status(403).json({ msg: '이 방의 멤버가 아닙니다.' });
    }

    // Instead of removing existing slots, we'll add new ones (accumulative approach)
    // Only remove if it's an exact duplicate (same day, time, user)
    const beforeCount = room.timeSlots.length;

    // Add new slots (only if they don't already exist for this user)
    if (slots && slots.length > 0) {
      slots.forEach(slot => {
        // Check if this exact slot already exists for this user
        const existingSlot = room.timeSlots.find(existing => 
          existing.user.toString() === req.user.id &&
          existing.day === slot.day &&
          existing.startTime === slot.startTime &&
          existing.endTime === slot.endTime
        );

        if (!existingSlot) {
          // Only add if it doesn't exist
          const newSlot = {
            _id: new mongoose.Types.ObjectId(),
            ...slot,
            user: req.user.id,
            status: 'confirmed'
          };
          
          console.log('Adding new slot:', newSlot);
          room.timeSlots.push(newSlot);
        } else {
          console.log('Slot already exists, skipping:', slot);
        }
      });
    }

    // Handle slot removal if slots array is empty (user wants to clear their selections)
    if (!slots || slots.length === 0) {
      console.log('Empty slots array - clearing all user slots');
      const beforeCount = room.timeSlots.length;
      room.timeSlots = room.timeSlots.filter(slot => slot.user.toString() !== req.user.id);
      const afterCount = room.timeSlots.length;
      console.log(`Cleared ${beforeCount - afterCount} slots for user`);
    }

    // Log timeSlots after adding new ones, before save
    console.log('TimeSlots after adding new (before save):', room.timeSlots.map(s => ({ id: s._id, user: s.user, day: s.day, status: s.status })));

    // Check for conflicts
    room.timeSlots.forEach(slot => {
      const conflicts = room.timeSlots.filter(otherSlot => 
        // Use _id for comparison if available, otherwise compare object references
        (otherSlot._id && slot._id ? otherSlot._id.toString() !== slot._id.toString() : otherSlot !== slot) &&
        otherSlot.day === slot.day &&
        ((slot.startTime >= otherSlot.startTime && slot.startTime < otherSlot.endTime) ||
         (slot.endTime > otherSlot.startTime && slot.endTime <= otherSlot.endTime) ||
         (slot.startTime <= otherSlot.startTime && slot.endTime >= otherSlot.endTime))
      );
      
      if (conflicts.length > 0) {
        slot.status = 'conflict';
        conflicts.forEach(conflict => conflict.status = 'conflict');
      }
    });

    await room.save();

    // Manually populate the user data for the response to ensure it's correct
    const populatedRoom = await Room.findById(room._id)
      .populate('owner', 'firstName lastName email')
      .populate('members.user', 'firstName lastName email')
      .populate('timeSlots.user', 'firstName lastName email')
      .populate('requests.requester', 'firstName lastName email')
      .lean(); // Use .lean() for a plain JS object, which is faster

    console.log('TimeSlots saved and manually populated successfully');

    res.json(populatedRoom);
  } catch (error) {
    console.error('Error submitting time slots:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Remove specific time slot for a user in a room
// @route   DELETE /api/coordination/rooms/:roomId/slots
// @access  Private
exports.removeTimeSlot = async (req, res) => {
  try {
    const { day, startTime, endTime } = req.body;
    
    const room = await Room.findById(req.params.roomId);
    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    // Check if user is member
    const isOwner = room.owner?._id?.toString() === req.user.id;
    const isMember = room.members?.some(member => {
      const memberId = member.user?._id || member._id;
      return memberId?.toString() === req.user.id;
    });
    
    if (!isOwner && !isMember) {
      return res.status(403).json({ msg: '이 방의 멤버가 아닙니다.' });
    }

    // Remove the specific slot
    const beforeCount = room.timeSlots.length;
    room.timeSlots = room.timeSlots.filter(slot => 
      !(slot.user.toString() === req.user.id &&
        slot.day === day &&
        slot.startTime === startTime &&
        slot.endTime === endTime)
    );
    const afterCount = room.timeSlots.length;
    
    console.log(`Removed ${beforeCount - afterCount} specific slots for user`);

    await room.save();

    // Return updated room
    const populatedRoom = await Room.findById(room._id)
      .populate('owner', 'firstName lastName email')
      .populate('members.user', 'firstName lastName email')
      .populate('timeSlots.user', 'firstName lastName email')
      .populate('requests.requester', 'firstName lastName email');

    res.json(populatedRoom);
  } catch (error) {
    console.error('Error removing time slot:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Assign a time slot to a specific user by the room owner
// @route   POST /api/coordination/rooms/:roomId/assign-slot
// @access  Private (Room Owner only)
exports.assignTimeSlot = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { day, startTime, endTime, userId } = req.body;

    // 1. Find the room
    let room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    // 2. Validate owner
    if (!room.isOwner(req.user.id)) {
      return res.status(403).json({ msg: '방장만 시간을 배정할 수 있습니다.' });
    }

    // 3. Validate assigned user (must be a member of the room)
    const assignedMember = room.members.find(member => member.user.toString() === userId);
    if (!assignedMember) {
      return res.status(400).json({ msg: '배정하려는 사용자가 이 방의 멤버가 아닙니다.' });
    }

    // 4. Create new time slot object
    const newAssignedSlot = {
      day,
      startTime,
      endTime,
      user: userId,
      status: 'assigned' // Custom status for owner-assigned slots
    };

    // Optional: Check for existing slots for this user in this time range if needed
    // For simplicity, we'll just add it. More complex logic might involve replacing.

    // 5. Add to room.timeSlots
    room.timeSlots.push(newAssignedSlot);

    // Re-evaluate conflicts for all slots after adding the new one
    room.timeSlots.forEach(slot => {
      const conflicts = room.timeSlots.filter(otherSlot => 
        otherSlot._id !== slot._id && // Don't compare with itself
        otherSlot.day === slot.day &&
        ((slot.startTime >= otherSlot.startTime && slot.startTime < otherSlot.endTime) ||
         (slot.endTime > otherSlot.startTime && slot.endTime <= otherSlot.endTime) ||
         (slot.startTime <= otherSlot.startTime && slot.endTime >= otherSlot.endTime))
      );
      
      if (conflicts.length > 0) {
        slot.status = 'conflict';
        conflicts.forEach(conflict => conflict.status = 'conflict');
      } else if (slot.status === 'conflict') {
        // If a slot was previously in conflict but no longer is, revert its status
        // This handles cases where a conflicting slot was removed or changed
        slot.status = 'assigned'; // Or 'confirmed' if it was a user-submitted slot
      }
    });

    // 6. Save room
    await room.save();
    await room.populate('timeSlots.user', 'firstName lastName email'); // Populate to send back user info

    // 7. Respond
    res.json(room);
  } catch (error) {
    console.error('Error assigning time slot:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Create a booking or conflict request
// @route   POST /api/coordination/requests
// @access  Private
exports.createRequest = async (req, res) => {
  try {
    const { roomId, type, timeSlot, targetSlot, targetUserId, message } = req.body;
    
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    if (!room.isMember(req.user.id)) {
      return res.status(403).json({ msg: '이 방의 멤버가 아닙니다.' });
    }

    console.log('📝 Request 저장 디버그:');
    console.log('- targetUserId 받은 값:', targetUserId);
    console.log('- targetUserId 타입:', typeof targetUserId);
    
    const request = {
      requester: req.user.id,
      type,
      timeSlot,
      targetSlot,
      targetUserId,
      message,
      status: 'pending'
    };
    
    console.log('- 저장할 request:', request);

    room.requests.push(request);
    await room.save();
    await room.populate('requests.requester', 'firstName lastName email');

    // Send notification to target user (if it's a swap request)
    if ((type === 'time_swap' || type === 'slot_swap') && targetUserId) {
      try {
        const User = require('../models/user');
        const requesterUser = await User.findById(req.user.id);
        
        // Try to find target user by ID first, then by email if ID lookup fails
        let targetUser;
        try {
          targetUser = await User.findById(targetUserId);
        } catch (castError) {
          // If targetUserId is not a valid ObjectId, try finding by email
          targetUser = await User.findOne({ email: targetUserId });
        }
        
        if (requesterUser && targetUser) {
          console.log(`🔔 교환요청 알림: ${requesterUser.firstName} ${requesterUser.lastName}님이 ${targetUser.firstName} ${targetUser.lastName}님에게 시간 교환을 요청했습니다.`);
          console.log(`📅 요청 시간: ${timeSlot.day} ${timeSlot.startTime}-${timeSlot.endTime}`);
          console.log(`💬 메시지: ${message || '메시지 없음'}`);
          console.log(`📧 대상자 이메일: ${targetUser.email}`);
          
          // 여기서 실제 알림 시스템 (이메일, 푸시 알림 등)을 연동할 수 있습니다.
          // 예시: await sendNotificationEmail(targetUser.email, requesterUser.name, timeSlot);
        }
      } catch (notificationError) {
        console.error('Error sending notification:', notificationError);
        // 알림 실패해도 요청 생성은 성공으로 처리
      }
    }

    res.status(201).json(request);
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Handle a request (approve/reject)
// @route   PUT /api/coordination/requests/:requestId
// @access  Private (Room Master only)
exports.handleRequest = async (req, res) => {
  try {
    const { status } = req.body;
    
    const room = await Room.findOne({ 'requests._id': req.params.requestId });
    if (!room) {
      return res.status(404).json({ msg: '요청을 찾을 수 없습니다.' });
    }

    const request = room.requests.id(req.params.requestId);
    if (!request) {
      return res.status(404).json({ msg: '요청을 찾을 수 없습니다.' });
    }

    // Check permissions based on request type
    if (request.type === 'slot_swap') {
      // For swap requests, only the target user can handle them
      if (request.targetUserId?.toString() !== req.user.id) {
        return res.status(403).json({ msg: '교환 요청의 대상자만 이 요청을 처리할 수 있습니다.' });
      }
    } else {
      // For other requests, only room owner can handle them
      if (!room.isOwner(req.user.id)) {
        return res.status(403).json({ msg: '방장만 요청을 처리할 수 있습니다.' });
      }
    }

    request.status = status;

    if (status === 'approved') {
      if (request.type === 'time_request') {
        // Add the requested time slot
        room.timeSlots.push({
          ...request.timeSlot,
          user: request.requester,
          status: 'confirmed'
        });
      } else if (request.type === 'time_change') {
        // Find and remove the original slot (targetSlot)
        // Ensure we remove only the specific slot requested for change by the specific user
        const originalSlotIndex = room.timeSlots.findIndex(
          slot =>
            slot.day === request.targetSlot.day &&
            slot.startTime === request.targetSlot.startTime &&
            slot.endTime === request.targetSlot.endTime &&
            slot.user.toString() === request.requester.toString() // Ensure it's the requester's slot
        );

        if (originalSlotIndex !== -1) {
          room.timeSlots.splice(originalSlotIndex, 1); // Remove the old slot
        }

        // Add the new requested time slot
        room.timeSlots.push({
          ...request.timeSlot,
          user: request.requester,
          status: 'confirmed'
        });
      } else if (request.type === 'slot_release') {
        // Release/cancel a time slot
        const slotToRemoveIndex = room.timeSlots.findIndex(
          slot =>
            slot.day === request.timeSlot.day &&
            slot.startTime === request.timeSlot.startTime &&
            slot.endTime === request.timeSlot.endTime &&
            slot.user.toString() === request.requester.toString()
        );

        if (slotToRemoveIndex !== -1) {
          room.timeSlots.splice(slotToRemoveIndex, 1);
        }
      } else if (request.type === 'slot_swap') {
        // Handle time slot swap - requester wants target's time slot
        const targetSlot = room.timeSlots.find(
          slot =>
            slot.day === request.timeSlot.day &&
            slot.startTime === request.timeSlot.startTime &&
            slot.endTime === request.timeSlot.endTime &&
            slot.user.toString() === request.targetUserId.toString()
        );

        if (targetSlot) {
          // Transfer the slot to the requester
          targetSlot.user = request.requester;
        }
      }
    }

    await room.save();
    
    // Populate and return updated room data
    await room.populate('owner', 'firstName lastName email');
    await room.populate('members.user', 'firstName lastName email');
    await room.populate('timeSlots.user', 'firstName lastName email');
    await room.populate('requests.requester', 'firstName lastName email');
    
    res.json({ 
      msg: `요청이 ${status === 'approved' ? '승인' : '거절'}되었습니다.`,
      room: room
    });
  } catch (error) {
    console.error('Error handling request:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Get all requests for a room
// @route   GET /api/coordination/rooms/:roomId/requests
// @access  Private
exports.getRequestsForRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId)
      .populate('requests.requester', 'firstName lastName email');
    
    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    // Check if the user is a member of this room
    if (!room.isMember(req.user.id)) {
      return res.status(403).json({ msg: '이 방의 요청을 조회할 권한이 없습니다.' });
    }

    // Sort requests by creation date (newest first)
    const requests = room.requests.sort((a, b) => b.createdAt - a.createdAt);

    res.json(requests);
  } catch (error) {
    console.error('Error getting requests for room:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Get all rooms a user is involved in
// @route   GET /api/coordination/my-rooms
// @access  Private
exports.getMyRooms = async (req, res) => {
  try {
    // Get rooms from new Room model
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

    // Get rooms from legacy CoordinationRoom model
    const legacyRooms = await CoordinationRoom.find({
      $or: [
        { roomMasterId: req.user.id },
        { members: req.user.id }
      ]
    })
    .populate('roomMasterId', 'firstName lastName email')
    .populate('members', 'firstName lastName email')
    .sort({ createdAt: -1 });

    // Convert legacy rooms to new format
    const convertedLegacyRooms = legacyRooms.map(legacyRoom => ({
      _id: legacyRoom._id,
      name: legacyRoom.name,
      description: '',
      owner: legacyRoom.roomMasterId ? {
        _id: legacyRoom.roomMasterId._id,
        name: legacyRoom.roomMasterId.name || `${legacyRoom.roomMasterId.firstName} ${legacyRoom.roomMasterId.lastName}`,
        email: legacyRoom.roomMasterId.email
      } : null,
      members: legacyRoom.members.map(member => ({
        user: {
          _id: member._id,
          name: member.name || `${member.firstName} ${member.lastName}`,
          email: member.email
        }
      })),
      inviteCode: legacyRoom.inviteCode,
      maxMembers: legacyRoom.settings?.maxMembers || 10,
      settings: legacyRoom.settings || {},
      memberCount: legacyRoom.members.length,
      createdAt: legacyRoom.createdAt,
      updatedAt: legacyRoom.updatedAt
    }));

    // Separate owned and joined legacy rooms
    const legacyOwnedRooms = convertedLegacyRooms.filter(room => 
      room.owner._id.toString() === req.user.id
    );
    const legacyJoinedRooms = convertedLegacyRooms.filter(room => 
      room.owner._id.toString() !== req.user.id
    );

    // Combine new and legacy rooms
    const allOwnedRooms = [...newOwnedRooms, ...legacyOwnedRooms];
    const allJoinedRooms = [...newJoinedRooms, ...legacyJoinedRooms];

    res.json({
      owned: allOwnedRooms,
      joined: allJoinedRooms
    });
  } catch (error) {
    console.error('Error fetching my rooms:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

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
    if (!room.isOwner(req.user.id)) {
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
    room.timeSlots = room.timeSlots.filter(slot => slot.user.toString() !== memberId);

    // 6. Remove all requests associated with the removed member (as requester or target)
    room.requests = room.requests.filter(request =>
      request.requester.toString() !== memberId &&
      (request.targetSlot ? request.targetSlot.user?.toString() !== memberId : true)
    );

    // 7. Get member info for notification
    const User = require('../models/user');
    const removedUser = await User.findById(memberId);

    // 8. Save room
    await room.save();
    await room.populate('owner', 'firstName lastName email');
    await room.populate('members.user', 'firstName lastName email');

    // 9. Send notification to removed member
    if (removedUser) {
      console.log(`Member ${removedUser.name} (${removedUser.email}) has been removed from room: ${room.name}`);
      // In a real application, you would send an email or push notification here
      // For now, we'll add a simple notification that can be displayed in the UI
    }

    res.json({ 
      msg: '조원이 성공적으로 제거되었습니다.', 
      room,
      removedMember: {
        name: removedUser?.name,
        email: removedUser?.email,
        id: memberId
      }
    });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Delete an assigned time slot (owner only)
// @route   DELETE /api/coordination/rooms/:roomId/slots/:slotId
// @access  Private (Room Owner only)
exports.deleteTimeSlot = async (req, res) => {
  try {
    const { roomId, slotId } = req.params;

    // 1. Find the room
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    // 2. Validate owner
    if (!room.isOwner(req.user.id)) {
      return res.status(403).json({ msg: '방장만 시간 슬롯을 삭제할 수 있습니다.' });
    }

    // 3. Find the slot to delete
    const initialSlotCount = room.timeSlots.length;
    room.timeSlots = room.timeSlots.filter(slot => slot._id.toString() !== slotId);

    if (room.timeSlots.length === initialSlotCount) {
      return res.status(404).json({ msg: '해당 시간 슬롯을 찾을 수 없습니다.' });
    }

    // 4. Re-evaluate conflicts for remaining slots
    room.timeSlots.forEach(slot => {
      const conflicts = room.timeSlots.filter(otherSlot => 
        otherSlot._id !== slot._id &&
        otherSlot.day === slot.day &&
        ((slot.startTime >= otherSlot.startTime && slot.startTime < otherSlot.endTime) ||
         (slot.endTime > otherSlot.startTime && slot.endTime <= otherSlot.endTime) ||
         (slot.startTime <= otherSlot.startTime && slot.endTime >= otherSlot.endTime))
      );
      
      if (conflicts.length > 0) {
        slot.status = 'conflict';
        conflicts.forEach(conflict => conflict.status = 'conflict');
      } else if (slot.status === 'conflict') {
        // If a slot was previously in conflict but no longer is, revert its status
        // Assuming 'confirmed' for user-submitted and 'assigned' for owner-assigned
        slot.status = slot.user.toString() === req.user.id.toString() ? 'confirmed' : 'assigned'; 
      }
    });

    // 5. Save room
    await room.save();
    await room.populate('timeSlots.user', 'firstName lastName email');

    res.json({ msg: '시간 슬롯이 성공적으로 제거되었습니다.', room });
  } catch (error) {
    console.error('Error deleting time slot:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Auto-assign time slots based on pending requests
// @route   POST /api/coordination/rooms/:roomId/auto-assign
// @access  Private (Room Owner only)
exports.autoAssignSlots = async (req, res) => {
  try {
    const { roomId } = req.params;

    // 1. Find the room
    const room = await Room.findById(roomId).populate('requests.requester', 'firstName lastName email');
    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    // 2. Validate owner
    if (!room.isOwner(req.user.id)) {
      return res.status(403).json({ msg: '방장만 자동 배정을 할 수 있습니다.' });
    }

    // 3. Get pending time_request requests
    const pendingRequests = room.requests.filter(req => 
      req.status === 'pending' && req.type === 'time_request'
    );

    if (pendingRequests.length === 0) {
      return res.status(400).json({ msg: '자동 배정할 대기 중인 요청이 없습니다.' });
    }

    let assignedCount = 0;
    const conflictSlots = [];

    // 4. Process each request
    for (const request of pendingRequests) {
      const { day, startTime, endTime } = request.timeSlot;
      
      // Check for conflicts with existing time slots
      const hasConflict = room.timeSlots.some(slot =>
        slot.day === day &&
        ((startTime >= slot.startTime && startTime < slot.endTime) ||
         (endTime > slot.startTime && endTime <= slot.endTime) ||
         (startTime <= slot.startTime && endTime >= slot.endTime))
      );

      if (!hasConflict) {
        // No conflict - auto-assign
        const newSlot = {
          day,
          startTime,
          endTime,
          subject: request.timeSlot.subject || '배정된 일정',
          user: request.requester._id,
          status: 'confirmed'
        };

        room.timeSlots.push(newSlot);
        request.status = 'approved';
        assignedCount++;
      } else {
        // Conflict exists - keep as pending and track
        conflictSlots.push({
          requester: request.requester.name || `${request.requester.firstName} ${request.requester.lastName}`,
          day,
          startTime,
          endTime
        });
      }
    }

    // 5. Save the room
    await room.save();

    // 6. Respond with results
    let message = `${assignedCount}개의 요청이 자동 배정되었습니다.`;
    if (conflictSlots.length > 0) {
      message += ` ${conflictSlots.length}개의 요청은 충돌로 인해 수동 처리가 필요합니다.`;
    }

    res.json({ 
      msg: message,
      assigned: assignedCount,
      conflicts: conflictSlots.length,
      conflictDetails: conflictSlots
    });

  } catch (error) {
    console.error('Error auto-assigning slots:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

