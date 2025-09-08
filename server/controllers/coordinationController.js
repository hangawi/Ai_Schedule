const CoordinationRoom = require('../models/coordinationRoom');
const TimeSlot = require('../models/timeSlot');
const CoordinationRequest = require('../models/coordinationRequest');
const User = require('../models/user');

// @desc    Create a new coordination room
// @route   POST /api/coordination/rooms
// @access  Private
exports.createRoom = async (req, res) => {
  console.log('req.body:', req.body);
  const { roomName, maxMembers } = req.body;
  const roomMasterId = req.user.id; // Assuming req.user.id is set by auth middleware

  try {
    // Removed: Check if the user already masters a room
    // const existingRoom = await CoordinationRoom.findOne({ roomMasterId });
    // if (existingRoom) {
    //   return res.status(400).json({ msg: '이미 방을 생성했습니다. 한 명의 방장은 하나의 방만 관리할 수 있습니다.' });
    // }

    const newRoom = new CoordinationRoom({
      name: roomName,
      roomMasterId,
      members: [roomMasterId], // Master is automatically a member
      settings: {
        maxMembers: maxMembers || 10, // Use provided maxMembers or default
      },
    });

    await newRoom.save();

    res.status(201).json(newRoom);
  } catch (err) {
    console.error('Error creating room:', err);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
};

// @desc    Join a coordination room
// @route   POST /api/coordination/rooms/:inviteCode/join
// @access  Private
exports.joinRoom = async (req, res) => {
  const { inviteCode } = req.params;
  const userId = req.user.id;

  try {
    const room = await CoordinationRoom.findOne({ inviteCode });

    if (!room) {
      return res.status(404).json({ msg: '초대 코드가 유효하지 않거나 방을 찾을 수 없습니다.' });
    }

    // Check if user is already a member
    if (room.members.includes(userId)) {
      return res.status(400).json({ msg: '이미 이 방의 멤버입니다.' });
    }

    // Check if room is full
    if (room.members.length >= room.settings.maxMembers) {
      return res.status(400).json({ msg: '방의 정원이 가득 찼습니다.' });
    }

    room.members.push(userId);
    await room.save();

    res.status(200).json(room);
  } catch (err) {
    console.error('Error joining room:', err.message);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
};

// @desc    Get room details by ID
// @route   GET /api/coordination/rooms/:roomId
// @access  Private
exports.getRoomDetails = async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user.id;

  try {
    const room = await CoordinationRoom.findById(roomId)
      .populate('roomMasterId', 'firstName lastName email') // Populate master details
      .populate('members', 'firstName lastName email'); // Populate member details

    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    // Check if the user is a member of this room
    if (!room.members.some(member => member._id.toString() === userId)) {
      return res.status(403).json({ msg: '이 방에 접근할 권한이 없습니다.' });
    }

    // Also fetch all time slots for this room
    const timeSlots = await TimeSlot.find({ roomId })
      .populate('userId', 'firstName lastName email'); // Populate user who booked the slot

    // Combine room details with time slots
    const roomDetails = {
      ...room.toObject(),
      timeSlots: timeSlots,
    };

    res.status(200).json(roomDetails);
  } catch (err) {
    console.error('Error getting room details:', err.message);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
};

// @desc    Add or update time slots for a user in a room
// @route   POST /api/coordination/rooms/:roomId/slots
// @access  Private
exports.submitTimeSlots = async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user.id;
  const { slots } = req.body; // slots is an array of { startTime, endTime }

  try {
    const room = await CoordinationRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    // Check if the user is a member of this room
    if (!room.members.some(member => member._id.toString() === userId)) {
      return res.status(403).json({ msg: '이 방에 시간표를 제출할 권한이 없습니다.' });
    }

    // Clear existing slots for this user in this room
    await TimeSlot.deleteMany({ roomId, userId });

    const newTimeSlots = [];
    for (const slot of slots) {
      const newSlot = new TimeSlot({
        roomId,
        userId,
        startTime: new Date(slot.startTime),
        endTime: new Date(slot.endTime),
      });
      newTimeSlots.push(newSlot);
    }

    await TimeSlot.insertMany(newTimeSlots);

    res.status(200).json({ msg: '시간표가 성공적으로 제출되었습니다.', submittedSlots: newTimeSlots });
  } catch (err) {
    console.error('Error submitting time slots:', err.message);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
};

// @desc    Create a booking or conflict request
// @route   POST /api/coordination/requests
// @access  Private
exports.createRequest = async (req, res) => {
  const { roomId, requestType, requestedSlot, conflictingUserId, message } = req.body;
  const requesterId = req.user.id;

  try {
    const room = await CoordinationRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    // Check if requester is a member of the room
    if (!room.members.some(member => member._id.toString() === requesterId)) {
      return res.status(403).json({ msg: '이 방에서 요청을 생성할 권한이 없습니다.' });
    }

    const newRequest = new CoordinationRequest({
      roomId,
      requesterId,
      requestType,
      requestedSlot,
      conflictingUserId: requestType === 'conflict' ? conflictingUserId : undefined,
      message,
    });

    await newRequest.save();

    res.status(201).json(newRequest);
  } catch (err) {
    console.error('Error creating request:', err.message);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
};

// @desc    Handle a request (approve/reject)
// @route   PUT /api/coordination/requests/:requestId
// @access  Private (Room Master only)
exports.handleRequest = async (req, res) => {
  const { requestId } = req.params;
  const { status } = req.body; // 'approved' or 'rejected'
  const userId = req.user.id; // The user making the decision

  try {
    const request = await CoordinationRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ msg: '요청을 찾을 수 없습니다.' });
    }

    const room = await CoordinationRoom.findById(request.roomId);
    if (!room) {
      return res.status(404).json({ msg: '관련 방을 찾을 수 없습니다.' });
    }

    // Only the room master can handle requests
    if (room.roomMasterId.toString() !== userId) {
      return res.status(403).json({ msg: '요청을 처리할 권한이 없습니다. 방장만 가능합니다.' });
    }

    request.status = status;
    await request.save();

    // If approved, and it's a booking request, create a TimeSlot
    if (status === 'approved' && request.requestType === 'booking') {
      const newTimeSlot = new TimeSlot({
        roomId: request.roomId,
        userId: request.requesterId,
        startTime: request.requestedSlot.startTime,
        endTime: request.requestedSlot.endTime,
      });
      await newTimeSlot.save();
    }
    // If approved, and it's a conflict request, the master needs to manually resolve it
    // (e.g., by moving the conflicting user's slot or communicating with them)
    // This part is outside the scope of this API call, but the request status is updated.

    res.status(200).json(request);
  } catch (err) {
    console.error('Error handling request:', err.message);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
};

// @desc    Get all requests for a room
// @route   GET /api/coordination/rooms/:roomId/requests
// @access  Private
exports.getRequestsForRoom = async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user.id;

  try {
    const room = await CoordinationRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ msg: '방을 찾을 수 없습니다.' });
    }

    // Check if the user is a member of this room
    if (!room.members.some(member => member._id.toString() === userId)) {
      return res.status(403).json({ msg: '이 방의 요청을 조회할 권한이 없습니다.' });
    }

    const requests = await CoordinationRequest.find({ roomId })
      .populate('requesterId', 'firstName lastName email')
      .populate('conflictingUserId', 'firstName lastName email')
      .sort({ createdAt: -1 }); // Latest requests first

    res.status(200).json(requests);
  } catch (err) {
    console.error('Error getting requests for room:', err.message);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
};

// @desc    Get all rooms a user is involved in
// @route   GET /api/coordination/my-rooms
// @access  Private
exports.getMyRooms = async (req, res) => {
  try {
    const userId = req.user.id;
    const rooms = await CoordinationRoom.find({
      $or: [
        { roomMasterId: userId },
        { members: userId }
      ]
    })
    .populate('roomMasterId', 'firstName lastName email')
    .populate('members', 'firstName lastName email');

    res.json(rooms);
  } catch (err) {
    console.error('Error getting user rooms:', err.message);
    res.status(500).json({ msg: '서버 오류가 발생했습니다.' });
  }
};
