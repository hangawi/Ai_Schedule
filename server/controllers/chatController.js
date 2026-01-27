const ChatMessage = require('../models/ChatMessage');
const Room = require('../models/room');
const User = require('../models/user');
const ScheduleSuggestion = require('../models/ScheduleSuggestion');
const RejectedSuggestion = require('../models/RejectedSuggestion');
const aiScheduleService = require('../services/aiScheduleService');
const preferenceService = require('../services/preferenceService');
const upload = require('../middleware/upload');

// @desc    Get chat history
// @route   GET /api/chat/:roomId
// @access  Private
exports.getMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 50, before } = req.query;

    const query = { room: roomId };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await ChatMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('sender', 'firstName lastName email');

    res.json(messages.reverse());
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Send a message
// @route   POST /api/chat/:roomId
// @access  Private
exports.sendMessage = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { content, type = 'text' } = req.body;
    const userId = req.user.id;

    // 1. Save Message
    const message = new ChatMessage({
      room: roomId,
      sender: userId,
      content,
      type
    });
    await message.save();
    
    // Update Room's lastMessageAt
    await Room.findByIdAndUpdate(roomId, { lastMessageAt: new Date() });
    
    // Populate sender info for frontend
    await message.populate('sender', 'firstName lastName email');

    // 2. Broadcast via Socket
    if (global.io) {
      global.io.to(`room-${roomId}`).emit('chat-message', message);
    }

    // 3. Trigger AI Analysis (Async - don't wait)
    // Only analyze for text messages
    if (type === 'text') {
      aiScheduleService.analyzeConversation(roomId).catch(err => {
        console.error('AI Analysis Trigger Error:', err);
      });
    }

    res.status(201).json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Upload file
// @route   POST /api/chat/:roomId/upload
// @access  Private
exports.uploadFile = [
  upload.single('file'),
  async (req, res) => {
    try {
      const { roomId } = req.params;
      const userId = req.user.id;

      if (!req.file) {
        return res.status(400).json({ msg: '파일이 업로드되지 않았습니다.' });
      }

      // 파일 크기 포맷팅
      const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
      };

      // 한글 파일명 처리: 클라이언트에서 보낸 UTF-8 파일명 사용
      // req.body.originalFileName이 있으면 사용, 없으면 fallback으로 Buffer 디코딩
      const originalFileName = req.body.originalFileName || 
        Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      
      // 파일 URL 생성 (서버의 static 경로)
      const fileUrl = `/uploads/${req.file.filename}`;

      // 메시지 생성
      const message = new ChatMessage({
        room: roomId,
        sender: userId,
        content: originalFileName, // 디코딩된 파일명
        type: 'file',
        fileUrl,
        fileName: originalFileName,
        fileType: req.file.mimetype,
        fileSize: formatFileSize(req.file.size)
      });

      await message.save();

      // Update Room's lastMessageAt
      await Room.findByIdAndUpdate(roomId, { lastMessageAt: new Date() });

      // Populate sender info
      await message.populate('sender', 'firstName lastName email');

      // Broadcast via Socket
      if (global.io) {
        global.io.to(`room-${roomId}`).emit('chat-message', message);
      }

      res.status(201).json(message);
    } catch (error) {
      console.error('File upload error:', error);
      res.status(500).json({ msg: 'Server error' });
    }
  }
];

// @desc    Check schedule conflict with member preferences
// @route   POST /api/chat/:roomId/check-conflict
// @access  Private
exports.checkScheduleConflict = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { date, startTime, endTime, summary } = req.body;

    // 필수 필드 검증
    if (!date || !startTime || !endTime) {
      return res.status(400).json({ msg: 'Missing required fields: date, startTime, endTime' });
    }

    // preferenceService를 사용하여 충돌 체크
    const conflictInfo = await preferenceService.checkTimeConflict(roomId, {
      date,
      startTime,
      endTime,
      summary
    });

    // 충돌 메시지 생성
    const message = preferenceService.generateConflictMessage(conflictInfo);

    // 클라이언트에 충돌 정보 반환
    res.json({
      hasConflict: conflictInfo.hasConflict,
      conflicts: conflictInfo.conflicts,
      availableMembers: conflictInfo.availableMembers,
      totalMembers: conflictInfo.totalMembers,
      conflictCount: conflictInfo.conflictCount,
      availableCount: conflictInfo.availableCount,
      message
    });

  } catch (error) {
    console.error('❌ [Check Conflict] Error:', error);
    res.status(500).json({ msg: 'Server error', error: error.message });
  }
};

// @desc    Confirm suggested schedule
// @route   POST /api/chat/:roomId/confirm
// @access  Private
exports.confirmSchedule = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { date, startTime, endTime, summary } = req.body;
    const userId = req.user.id;

    // 1. Create TimeSlot
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ msg: 'Room not found' });

    // 요일 계산
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = dayNames[new Date(date).getDay()];

    const newSlot = {
      user: userId, // 확정한 사람을 할당자로? 혹은 빈 배정? -> 여기서는 확정된 일정이므로 'confirmed' 상태로 모두에게 보이면 됨.
      // 하지만 Room 스키마 구조상 user 필드가 필수일 수 있음. 보통은 '공통 일정' 개념이 필요하지만,
      // 현재 구조에서는 assignedBy(확정자)와 user(대상)가 있음.
      // 공통 일정이라면 모든 멤버에게 슬롯을 추가하거나, '공통' 표시가 필요함.
      // 여기서는 일단 확정자를 user로 등록하거나, 또는 별도의 로직이 필요.
      // *간소화를 위해 확정자를 user로 등록하고, subject에 [공통] 태그 추가.*
      user: userId,
      date: new Date(date),
      day: dayOfWeek,
      startTime,
      endTime,
      subject: `[확정] ${summary}`,
      status: 'confirmed',
      assignedBy: userId,
      assignedAt: new Date()
    };

    room.timeSlots.push(newSlot);
    await room.save();

    // 2. Broadcast System Message
    const systemMsg = new ChatMessage({
      room: roomId,
      sender: userId, // or system
      content: `📅 일정이 확정되었습니다: ${date} ${startTime}~${endTime} (${summary})`,
      type: 'system'
    });
    await systemMsg.save();
    await systemMsg.populate('sender', 'firstName lastName');

    if (global.io) {
      global.io.to(`room-${roomId}`).emit('chat-message', systemMsg);
      global.io.to(`room-${roomId}`).emit('schedule-confirmed-refresh'); // 클라이언트가 일정표 새로고침하도록
    }

    res.json({ success: true, slot: newSlot });

  } catch (error) {
    console.error('Confirm schedule error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};


// @desc    Reject suggested schedule
// @route   POST /api/chat/:roomId/reject
// @access  Private
exports.rejectSchedule = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { date, startTime, endTime, summary, location } = req.body;
    const userId = req.user.id;

    // RejectedSuggestion 모델 import 필요
    const RejectedSuggestion = require('../models/RejectedSuggestion');

    // 1. Save rejected suggestion
    const rejectedSuggestion = new RejectedSuggestion({
      room: roomId,
      suggestion: {
        summary,
        date,
        startTime,
        endTime,
        location: location || ''
      },
      rejectedBy: userId,
      rejectedAt: new Date()
    });

    await rejectedSuggestion.save();

    // 2. Broadcast system message
    const systemMsg = new ChatMessage({
      room: roomId,
      sender: userId,
      content: `🚫 AI 일정 제안을 거절했습니다 (${date} ${startTime} ${summary})`,
      type: 'system'
    });
    await systemMsg.save();
    await systemMsg.populate('sender', 'firstName lastName');

    if (global.io) {
      global.io.to(`room-${roomId}`).emit('chat-message', systemMsg);
      global.io.to(`room-${roomId}`).emit('schedule-rejected'); // 클라이언트가 제안 카드 숨기도록
    }

    console.log(`🚫 [Chat] Schedule rejected for room ${roomId}:`, { date, startTime, summary });

    res.json({ success: true });

  } catch (error) {
    console.error('Reject schedule error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Mark room messages as read
// @route   POST /api/chat/:roomId/read
// @access  Private
exports.markAsRead = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    await Room.updateOne(
      { _id: roomId, 'members.user': userId },
      { $set: { 'members.$.lastReadAt': new Date() } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// ===================================================================================================
// 일정 제안 관리 API
// ===================================================================================================

// @desc    Get schedule suggestions for a room
// @route   GET /api/chat/:roomId/suggestions
// @access  Private
exports.getSuggestions = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { status } = req.query; // 'future', 'today', 'past', 'all'

    // 모든 제안의 상태 업데이트
    await ScheduleSuggestion.updateExpiredSuggestions();

    let query = { room: roomId };
    if (status && status !== 'all') {
      query.status = status;
    }

    const suggestions = await ScheduleSuggestion.find(query)
      .populate('memberResponses.user', 'firstName lastName email')
      .sort({ date: 1, startTime: 1 });

    res.json(suggestions);
  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Accept a schedule suggestion
// @route   POST /api/chat/:roomId/suggestions/:suggestionId/accept
// @access  Private
exports.acceptSuggestion = async (req, res) => {
  try {
    const { roomId, suggestionId } = req.params;
    const userId = req.user.id;

    // 1. 제안 조회
    const suggestion = await ScheduleSuggestion.findById(suggestionId);
    if (!suggestion) {
      return res.status(404).json({ msg: 'Suggestion not found' });
    }

    // 2. 사용자 정보 조회
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // 3. 개인 캘린더에 일정 추가 (personalTimes에 추가)
    const newPersonalTime = {
      id: user.personalTimes.length > 0
        ? Math.max(...user.personalTimes.map(pt => pt.id)) + 1
        : 1,
      title: `[약속] ${suggestion.summary}`,
      type: 'event',
      startTime: suggestion.startTime,
      endTime: suggestion.endTime,
      days: [], // 반복 없음
      isRecurring: false,
      specificDate: suggestion.date, // 특정 날짜에만
      color: '#3b82f6', // 파란색
      location: suggestion.location || '',
      roomId: roomId
    };

    user.personalTimes.push(newPersonalTime);
    await user.save();

    // 4. 제안의 memberResponses 업데이트
    await suggestion.acceptByUser(userId, newPersonalTime.id);

    // 5. 시스템 메시지 전송
    const systemMsg = new ChatMessage({
      room: roomId,
      sender: userId,
      content: `✅ ${user.firstName}님이 일정을 수락했습니다: ${suggestion.date} ${suggestion.startTime} ${suggestion.summary}`,
      type: 'system'
    });
    await systemMsg.save();
    await systemMsg.populate('sender', 'firstName lastName');

    // 6. Socket 이벤트 발송
    const updatedSuggestion = await ScheduleSuggestion.findById(suggestionId).populate('memberResponses.user', 'firstName lastName email');
    if (global.io) {
      global.io.to(`room-${roomId}`).emit('chat-message', systemMsg);
      global.io.to(`room-${roomId}`).emit('suggestion-updated', {
        suggestionId,
        userId,
        status: 'accepted',
        memberResponses: updatedSuggestion.memberResponses
      });
    }

    res.json({
      success: true,
      suggestion: updatedSuggestion
    });

  } catch (error) {
    console.error('Accept suggestion error:', error);
    res.status(500).json({ msg: 'Server error', error: error.message });
  }
};

// @desc    Reject a schedule suggestion
// @route   POST /api/chat/:roomId/suggestions/:suggestionId/reject
// @access  Private
exports.rejectSuggestion = async (req, res) => {
  try {
    const { roomId, suggestionId } = req.params;
    const userId = req.user.id;

    // 1. 제안 조회
    const suggestion = await ScheduleSuggestion.findById(suggestionId);
    if (!suggestion) {
      return res.status(404).json({ msg: 'Suggestion not found' });
    }

    // 2. 사용자 정보 조회
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // 3. 제안의 memberResponses 업데이트
    await suggestion.rejectByUser(userId);

    // 4. RejectedSuggestion에도 기록 (중복 제안 방지)
    const rejectedSuggestion = new RejectedSuggestion({
      room: roomId,
      suggestion: {
        summary: suggestion.summary,
        date: suggestion.date,
        startTime: suggestion.startTime,
        endTime: suggestion.endTime,
        location: suggestion.location
      },
      rejectedBy: userId,
      rejectedAt: new Date()
    });
    await rejectedSuggestion.save();

    // 5. 시스템 메시지 전송
    const systemMsg = new ChatMessage({
      room: roomId,
      sender: userId,
      content: `🚫 ${user.firstName}님이 일정을 거절했습니다: ${suggestion.date} ${suggestion.startTime} ${suggestion.summary}`,
      type: 'system'
    });
    await systemMsg.save();
    await systemMsg.populate('sender', 'firstName lastName');

    // 6. Socket 이벤트 발송
    const updatedSuggestion = await ScheduleSuggestion.findById(suggestionId).populate('memberResponses.user', 'firstName lastName email');
    if (global.io) {
      global.io.to(`room-${roomId}`).emit('chat-message', systemMsg);
      global.io.to(`room-${roomId}`).emit('suggestion-updated', {
        suggestionId,
        userId,
        status: 'rejected',
        memberResponses: updatedSuggestion.memberResponses
      });
    }

    res.json({
      success: true,
      suggestion: updatedSuggestion
    });

  } catch (error) {
    console.error('Reject suggestion error:', error);
    res.status(500).json({ msg: 'Server error', error: error.message });
  }
};
