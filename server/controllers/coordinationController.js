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
    await room.populate('requests.requester', '_id firstName lastName email');

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

    // 중복 요청 체크
    const existingRequest = room.requests.find(request => 
      request.requester.toString() === req.user.id &&
      request.status === 'pending' &&
      request.type === type &&
      request.timeSlot.day === timeSlot.day &&
      request.timeSlot.startTime === timeSlot.startTime &&
      request.timeSlot.endTime === timeSlot.endTime &&
      (targetUserId ? request.targetUserId === targetUserId : true)
    );

    if (existingRequest) {
      return res.status(400).json({ 
        msg: '동일한 시간표에 대한 교환요청이 이미 존재합니다.',
        duplicateRequest: true 
      });
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
    await room.populate('requests.requester', '_id firstName lastName email');
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
    console.log('=== 교환 요청 처리 시작 ===');
    console.log('requestId:', requestId);
    console.log('action:', action);
    console.log('user:', req.user.id);
    const room = await Room.findOne({ 'requests._id': requestId });

    if (!room) {
      return res.status(404).json({ msg: '요청을 찾을 수 없습니다.' });
    }

    const request = room.requests.id(requestId);
    if (!request) {
      console.log('요청을 찾을 수 없음 - requestId:', requestId);
      console.log('방의 모든 요청들:', room.requests.map(r => ({ id: r._id, type: r.type })));
      return res.status(404).json({ msg: '요청을 찾을 수 없습니다.' });
    }
    
    console.log('찾은 요청:', {
      id: request._id,
      type: request.type,
      status: request.status,
      requester: request.requester,
      targetUserId: request.targetUserId,
      timeSlot: request.timeSlot,
      targetSlot: request.targetSlot
    });

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
        
        // targetSlot 유효성 검사
        if (!targetSlot) {
          console.error('targetSlot이 없습니다:', request);
          request.status = 'failed';
          return res.status(400).json({ msg: '교환 대상 시간대 정보가 없습니다.' });
        }

        console.log('교환 요청 처리 시작:', {
          requestId: requestId,
          requesterId: request.requester,
          targetUserId: request.targetUserId,
          requesterSlot,
          targetSlot
        });
        
        console.log('현재 방의 모든 타임슬롯:', room.timeSlots.map(slot => ({
          day: slot.day,
          startTime: slot.startTime,
          endTime: slot.endTime,
          user: slot.user?.toString(),
          status: slot.status
        })));

        // Find the actual time slots in the room's timeSlots array
        // First, try to find exactly what the requester specified
        let roomRequesterSlot = room.timeSlots.find(slot =>
          slot.day === requesterSlot.day &&
          slot.startTime === requesterSlot.startTime &&
          slot.endTime === requesterSlot.endTime &&
          slot.user.toString() === request.requester.toString()
        );
        
        // If not found, find any slot owned by the requester (fallback)
        if (!roomRequesterSlot) {
          console.log('정확한 요청자 슬롯을 찾을 수 없음, 요청자의 다른 슬롯 검색...');
          roomRequesterSlot = room.timeSlots.find(slot =>
            slot.user.toString() === request.requester.toString()
          );
          console.log('대체 요청자 슬롯:', roomRequesterSlot ? {
            day: roomRequesterSlot.day,
            startTime: roomRequesterSlot.startTime,
            endTime: roomRequesterSlot.endTime
          } : 'none');
        }

        const roomTargetSlot = room.timeSlots.find(slot =>
          slot.day === targetSlot.day &&
          slot.startTime === targetSlot.startTime &&
          slot.endTime === targetSlot.endTime &&
          (slot.user.toString() === request.targetUserId || 
           slot.user.toString() === request.targetUserId?.toString() ||
           slot.user === request.targetUserId ||
           slot.user === request.targetUserId?.toString()) // More flexible comparison
        );

        console.log('슬롯 검색 결과:', {
          roomRequesterSlot: roomRequesterSlot ? 'found' : 'not found',
          roomTargetSlot: roomTargetSlot ? 'found' : 'not found',
          searchCriteria: {
            requesterSlot: {
              day: requesterSlot.day,
              startTime: requesterSlot.startTime,
              endTime: requesterSlot.endTime,
              expectedUser: request.requester.toString()
            },
            targetSlot: {
              day: targetSlot.day,
              startTime: targetSlot.startTime,
              endTime: targetSlot.endTime,
              expectedUser: request.targetUserId
            }
          }
        });

        if (roomRequesterSlot && roomTargetSlot) {
          console.log('교환 전 상태:', {
            requesterSlotUser: roomRequesterSlot.user.toString(),
            targetSlotUser: roomTargetSlot.user.toString()
          });

          // Perform the swap
          const tempUser = roomRequesterSlot.user;
          roomRequesterSlot.user = roomTargetSlot.user;
          roomTargetSlot.user = tempUser;

          // Update status to confirmed
          roomRequesterSlot.status = 'confirmed';
          roomTargetSlot.status = 'confirmed';

          console.log('교환 후 상태:', {
            requesterSlotUser: roomRequesterSlot.user.toString(),
            targetSlotUser: roomTargetSlot.user.toString()
          });
        } else {
          console.error('교환 실패 - 슬롯을 찾을 수 없음:', {
            requesterSlotFound: !!roomRequesterSlot,
            targetSlotFound: !!roomTargetSlot,
            allTimeSlots: room.timeSlots.map(slot => ({
              day: slot.day,
              startTime: slot.startTime,
              endTime: slot.endTime,
              user: slot.user.toString()
            }))
          });
          request.status = 'failed';
          return res.status(400).json({ msg: '교환할 시간대를 찾을 수 없습니다.' });
        }
      }
    } else if (action === 'rejected') {
      request.status = 'rejected';
    }

    await room.save();
    
    // Populate all necessary fields for updated response
    await room.populate('owner', 'firstName lastName email');
    await room.populate('members.user', 'firstName lastName email');
    await room.populate('timeSlots.user', 'firstName lastName email');
    await room.populate('requests.requester', '_id firstName lastName email');

    res.json({ 
      msg: `요청이 ${action === 'approved' ? '승인' : '거절'}되었습니다.`,
      room: room
    });
  } catch (error) {
    console.error('Error handling request:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Get exchange requests count for user
// @route   GET /api/coordination/exchange-requests-count
// @access  Private
exports.getExchangeRequestsCount = async (req, res) => {
  try {
    // Find all rooms where user is a member
    const rooms = await Room.find({
      $or: [
        { owner: req.user.id },
        { 'members.user': req.user.id }
      ]
    });

    let totalExchangeRequests = 0;

    // Count exchange requests targeting this user across all rooms
    rooms.forEach(room => {
      if (room.requests) {
        const userExchangeRequests = room.requests.filter(request =>
          request.status === 'pending' &&
          request.type === 'slot_swap' &&
          (request.targetUserId === req.user.id || 
           request.targetUserId === req.user.email || 
           request.targetUserId?.toString() === req.user.id?.toString())
        );
        totalExchangeRequests += userExchangeRequests.length;
      }
    });

    res.json({ 
      success: true, 
      count: totalExchangeRequests 
    });
  } catch (error) {
    console.error('Error getting exchange requests count:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Get exchange requests count per room (for room-specific badges)
// @route   GET /api/coordination/rooms/exchange-counts  
// @access  Private
exports.getRoomExchangeCounts = async (req, res) => {
  try {
    const rooms = await Room.find({
      $or: [
        { owner: req.user.id },
        { 'members.user': req.user.id }
      ]
    });

    const roomCounts = {};
    rooms.forEach(room => {
      if (room.requests) {
        // Filter for exchange requests targeting this user in this specific room
        const userExchangeRequests = room.requests.filter(request =>
          request.status === 'pending' &&
          request.type === 'slot_swap' &&
          (
            request.targetUserId === req.user.id ||
            request.targetUserId === req.user.email ||
            request.targetUserId?.toString() === req.user.id?.toString()
          )
        );
        roomCounts[room._id.toString()] = userExchangeRequests.length;
      } else {
        roomCounts[room._id.toString()] = 0;
      }
    });

    res.json({
      success: true,
      roomCounts
    });

  } catch (error) {
    console.error('Error getting room exchange counts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get room exchange counts',
      error: error.message
    });
  }
};

// @desc    Get sent requests by user
// @route   GET /api/coordination/sent-requests
// @access  Private
exports.getSentRequests = async (req, res) => {
  try {
    const rooms = await Room.find({
      'members.user': req.user.id
    }).populate('requests.requester', '_id firstName lastName email');

    const sentRequests = [];

    rooms.forEach(room => {
      if (room.requests && room.requests.length > 0) {
        const userSentRequests = room.requests.filter(request => 
          request.requester._id.toString() === req.user.id
        );
        
        userSentRequests.forEach(request => {
          sentRequests.push({
            _id: request._id,
            roomId: room._id,
            roomName: room.name,
            type: request.type,
            timeSlot: request.timeSlot,
            targetSlot: request.targetSlot,
            targetUserId: request.targetUserId,
            message: request.message,
            status: request.status,
            createdAt: request.createdAt
          });
        });
      }
    });

    // 최신순으로 정렬
    sentRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      requests: sentRequests
    });

  } catch (error) {
    console.error('Error getting sent requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get sent requests',
      error: error.message
    });
  }
};

// @desc    Cancel request (only by requester)
// @route   DELETE /api/coordination/requests/:requestId
// @access  Private
exports.cancelRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    
    const room = await Room.findOne({
      'requests._id': requestId
    });

    if (!room) {
      return res.status(404).json({ msg: '요청을 찾을 수 없습니다.' });
    }

    const request = room.requests.id(requestId);
    if (!request) {
      return res.status(404).json({ msg: '요청을 찾을 수 없습니다.' });
    }

    // 요청자 본인만 취소 가능
    if (request.requester.toString() !== req.user.id) {
      return res.status(403).json({ msg: '본인이 보낸 요청만 취소할 수 있습니다.' });
    }

    // 이미 처리된 요청은 취소 불가
    if (request.status !== 'pending') {
      return res.status(400).json({ msg: '이미 처리된 요청은 취소할 수 없습니다.' });
    }

    // 요청 삭제
    room.requests.pull(requestId);
    await room.save();
    await room.populate('requests.requester', '_id firstName lastName email');

    res.json({
      success: true,
      message: '요청이 성공적으로 취소되었습니다.',
      room
    });

  } catch (error) {
    console.error('Error canceling request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel request',
      error: error.message
    });
  }
};

