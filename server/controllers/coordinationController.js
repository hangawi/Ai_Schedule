const Room = require('../models/room');
const CoordinationRoom = require('../models/coordinationRoom');
const User = require('../models/user');

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
    await room.populate('owner', 'name email');
    await room.populate('members.user', 'name email');

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
    
    // Try to find in new Room model first
    let room = await Room.findById(req.params.roomId);
    let isLegacy = false;

    // If not found, try legacy CoordinationRoom model
    if (!room) {
      const legacyRoom = await CoordinationRoom.findById(req.params.roomId);
      if (legacyRoom) {
        return res.status(400).json({ msg: '레거시 방은 수정할 수 없습니다. 먼저 마이그레이션을 수행해주세요.' });
      }
    }

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
    await room.populate('owner', 'name email');
    await room.populate('members.user', 'name email');

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
      await room.populate('owner', 'name email');
      await room.populate('members.user', 'name email');
      return res.json({ 
        ...room.toJSON(), 
        message: '방장은 초대 코드 없이 직접 방에 입장할 수 있습니다.' 
      });
    }

    // Check if already a member
    if (room.isMember(req.user.id)) {
      await room.populate('owner', 'name email');
      await room.populate('members.user', 'name email');
      return res.json(room);
    }

    // Check room capacity
    if (room.members.length >= room.maxMembers) {
      return res.status(400).json({ msg: '방이 가득 찼습니다.' });
    }

    // Add user as member
    room.members.push({ user: req.user.id });
    await room.save();
    await room.populate('owner', 'name email');
    await room.populate('members.user', 'name email');

    res.json(room);
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
    console.log(`\n=== Room Access Debug ===`);
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
    console.log('=== End Debug ===\n');
    
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
    console.log('\n=== TimeSlot Submission Debug ===');
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

    // Remove existing slots for this user
    const beforeCount = room.timeSlots.length;
    room.timeSlots = room.timeSlots.filter(slot => slot.user.toString() !== req.user.id);
    const afterCount = room.timeSlots.length;
    
    console.log(`Removed ${beforeCount - afterCount} existing slots for user`);

    // Add new slots
    if (slots && slots.length > 0) {
      const newSlots = slots.map(slot => ({
        ...slot,
        user: req.user.id,
        status: 'confirmed'
      }));

      console.log('Adding new slots:', newSlots);
      room.timeSlots.push(...newSlots);

      // Check for conflicts
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
        }
      });
    }

    await room.save();
    await room.populate('timeSlots.user', 'name email');

    console.log('TimeSlots saved successfully');
    console.log('Total timeSlots:', room.timeSlots.length);
    console.log('=== End TimeSlot Debug ===\n');

    res.json(room);
  } catch (error) {
    console.error('Error submitting time slots:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Create a booking or conflict request
// @route   POST /api/coordination/requests
// @access  Private
exports.createRequest = async (req, res) => {
  try {
    const { roomId, type, timeSlot, targetSlot, message } = req.body;
    
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    if (!room.isMember(req.user.id)) {
      return res.status(403).json({ msg: '이 방의 멤버가 아닙니다.' });
    }

    const request = {
      requester: req.user.id,
      type,
      timeSlot,
      targetSlot,
      message,
      status: 'pending'
    };

    room.requests.push(request);
    await room.save();
    await room.populate('requests.requester', 'name email');

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

    // Only room owner can handle requests
    if (!room.isOwner(req.user.id)) {
      return res.status(403).json({ msg: '방장만 요청을 처리할 수 있습니다.' });
    }

    const request = room.requests.id(req.params.requestId);
    if (!request) {
      return res.status(404).json({ msg: '요청을 찾을 수 없습니다.' });
    }

    request.status = status;

    if (status === 'approved' && request.type === 'time_request') {
      // Add the requested time slot
      room.timeSlots.push({
        ...request.timeSlot,
        user: request.requester,
        status: 'confirmed'
      });
    }

    await room.save();
    res.json({ msg: `요청이 ${status === 'approved' ? '승인' : '거절'}되었습니다.` });
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
      .populate('requests.requester', 'name email');
    
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
      .populate('owner', 'name email')
      .populate('members.user', 'name email')
      .sort({ createdAt: -1 });

    const newJoinedRooms = await Room.find({ 
      'members.user': req.user.id,
      owner: { $ne: req.user.id }
    })
      .populate('owner', 'name email')
      .populate('members.user', 'name email')
      .sort({ createdAt: -1 });

    // Get rooms from legacy CoordinationRoom model
    const legacyRooms = await CoordinationRoom.find({
      $or: [
        { roomMasterId: req.user.id },
        { members: req.user.id }
      ]
    })
    .populate('roomMasterId', 'name email')
    .populate('members', 'name email')
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
