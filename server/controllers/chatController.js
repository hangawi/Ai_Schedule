const ChatMessage = require('../models/ChatMessage');
const Room = require('../models/room');
const User = require('../models/user');
const ScheduleSuggestion = require('../models/ScheduleSuggestion');
const RejectedSuggestion = require('../models/RejectedSuggestion');
const aiScheduleService = require('../services/aiScheduleService');
const preferenceService = require('../services/preferenceService');
const upload = require('../middleware/upload');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Gemini AI 인스턴스
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
    } else {
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

// @desc    Delete a message
// @route   DELETE /api/chat/:roomId/message/:messageId
// @access  Private
exports.deleteMessage = async (req, res) => {
  try {
    const { roomId, messageId } = req.params;
    const userId = req.user.id;

    // 메시지 찾기
    const message = await ChatMessage.findById(messageId);

    if (!message) {
      return res.status(404).json({ msg: '메시지를 찾을 수 없습니다.' });
    }

    // 본인 메시지인지 확인
    if (message.sender.toString() !== userId) {
      return res.status(403).json({ msg: '본인의 메시지만 삭제할 수 있습니다.' });
    }

    // 메시지 삭제
    await ChatMessage.findByIdAndDelete(messageId);

    // 소켓으로 삭제 이벤트 브로드캐스트
    if (global.io) {
      global.io.to(`room-${roomId}`).emit('message-deleted', { messageId });
    }

    res.json({ success: true, messageId });
  } catch (error) {
    console.error('Delete message error:', error);
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
      content: `AI 일정 제안을 거절했습니다`,
      type: 'system'
    });
    await systemMsg.save();
    await systemMsg.populate('sender', 'firstName lastName');

    if (global.io) {
      global.io.to(`room-${roomId}`).emit('chat-message', systemMsg);
      global.io.to(`room-${roomId}`).emit('schedule-rejected'); // 클라이언트가 제안 카드 숨기도록
    }

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
      .populate('suggestedBy', 'firstName lastName email')
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
    // 🆕 먼저 수락 처리 후 참석자 수 계산
    await suggestion.acceptByUser(userId, null); // personalTimeId는 아래에서 업데이트

    const acceptedCount = suggestion.memberResponses.filter(r => r.status === 'accepted').length;

    const newPersonalTime = {
      id: user.personalTimes.length > 0
        ? Math.max(...user.personalTimes.map(pt => pt.id)) + 1
        : 1,
      title: `[약속] ${suggestion.summary}`,
      type: 'event',
      startTime: suggestion.startTime,
      endTime: suggestion.endTime === '24:00' ? '23:59' : suggestion.endTime,
      days: [],
      isRecurring: false,
      specificDate: suggestion.date,
      color: '#3b82f6',
      location: suggestion.location || '',
      roomId: roomId,
      participants: acceptedCount,
      suggestionId: suggestion._id.toString()
    };

    user.personalTimes.push(newPersonalTime);
    await user.save();

    // 4. personalTimeId 업데이트
    const userResponse = suggestion.memberResponses.find(
      r => r.user.toString() === userId.toString() || r.user._id?.toString() === userId.toString()
    );
    if (userResponse) {
      userResponse.personalTimeId = newPersonalTime.id;
      await suggestion.save();
    }

    // 🆕 이미 수락한 다른 사용자들의 participants 동기화
    for (const response of suggestion.memberResponses) {
      const respUserId = response.user._id?.toString() || response.user.toString();
      if (response.status === 'accepted' && response.personalTimeId && respUserId !== userId.toString()) {
        try {
          const otherUser = await User.findById(response.user._id || response.user);
          if (otherUser) {
            const pt = otherUser.personalTimes.find(p => p.id === response.personalTimeId);
            if (pt) {
              pt.participants = acceptedCount;
              await otherUser.save();
              }
          }
        } catch (syncErr) {
          console.error(`⚠️ [Accept] Failed to sync participants:`, syncErr.message);
        }
      }
    }

    // 5. 시스템 메시지 전송
    const systemMsg = new ChatMessage({
      room: roomId,
      sender: userId,
      content: `${user.firstName}님이 일정에 참석했습니다: ${suggestion.date} ${suggestion.startTime} ${suggestion.summary}`,
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

// @desc    Delete a schedule suggestion (only by suggestedBy user)
// @route   DELETE /api/chat/:roomId/suggestions/:suggestionId
// @access  Private
exports.deleteSuggestion = async (req, res) => {
  try {
    const { roomId, suggestionId } = req.params;
    const userId = req.user.id;

    // 1. 제안 조회
    const suggestion = await ScheduleSuggestion.findById(suggestionId);
    if (!suggestion) {
      return res.status(404).json({ msg: 'Suggestion not found' });
    }

    // 2. 권한 체크: suggestedBy가 현재 사용자인지 확인
    if (!suggestion.suggestedBy || suggestion.suggestedBy.toString() !== userId) {
      return res.status(403).json({ msg: '제안을 삭제할 권한이 없습니다. 제안자만 삭제할 수 있습니다.' });
    }

    // 3. 제안 삭제
    await ScheduleSuggestion.findByIdAndDelete(suggestionId);

    // 4. 사용자 정보 조회
    const user = await User.findById(userId);

    // 5. 시스템 메시지 전송
    const systemMsg = new ChatMessage({
      room: roomId,
      sender: userId,
      content: `${user.firstName}님이 일정 제안을 삭제했습니다: ${suggestion.date} ${suggestion.startTime} ${suggestion.summary}`,
      type: 'system'
    });
    await systemMsg.save();
    await systemMsg.populate('sender', 'firstName lastName');

    // 6. Socket 이벤트 발송
    if (global.io) {
      global.io.to(`room-${roomId}`).emit('chat-message', systemMsg);
      global.io.to(`room-${roomId}`).emit('suggestion-deleted', {
        suggestionId
      });
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Delete suggestion error:', error);
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

    // 3.5. 전원 불참 체크
    const allRejected = suggestion.memberResponses.every(r => r.status === 'rejected');
    if (allRejected) {
      suggestion.status = 'cancelled';
      await suggestion.save();
    }

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
    const messageContent = allRejected
      ? `모든 멤버가 불참하여 일정이 취소되었습니다: ${suggestion.date} ${suggestion.startTime} ${suggestion.summary}`
      : `${user.firstName}님이 일정에 불참했습니다: ${suggestion.date} ${suggestion.startTime} ${suggestion.summary}`;

    const systemMsg = new ChatMessage({
      room: roomId,
      sender: userId,
      content: messageContent,
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

// @desc    AI 오타 교정
// @route   POST /api/chat/correct-typo
// @access  Private
exports.correctTypo = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.json({ corrected: text || '' });
    }

    // 텍스트가 너무 짧거나 이미 정상적이면 그대로 반환
    if (text.length < 2) {
      return res.json({ corrected: text });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `당신은 한국어 채팅 메시지 교정 전문가입니다.

[상황]
사용자가 모바일이나 PC에서 빠르게 타이핑하다가 오타가 발생한 채팅 메시지를 보냈습니다.
당신의 역할은 이 메시지에서 사용자가 실제로 무슨 말을 하려고 했는지 의도를 정확히 파악하여 자연스러운 한국어 문장으로 복원하는 것입니다.

[한글 키보드 오타의 특성]
- 한글은 자음과 모음이 조합되어 글자가 완성되는 구조입니다.
- 빠르게 타이핑할 때 타이밍이 어긋나면 자음/모음이 분리되거나 순서가 뒤바뀔 수 있습니다.
- 쌍자음(ㄲ,ㄸ,ㅃ,ㅆ,ㅉ)을 치려다 단자음이 두 번 입력되기도 합니다.
- Shift 키 타이밍 문제로 의도치 않은 문자가 입력될 수 있습니다.
- 받침이 다음 글자의 초성으로 넘어가거나, 초성이 이전 글자의 받침으로 붙는 경우도 있습니다.

[판단 원칙]
1. 분리된 자음/모음들을 조합했을 때 어떤 단어가 되는지 추론하세요.
2. 문맥상 가장 자연스럽고 일상적인 대화체 표현을 선택하세요.
3. 한국인이 일상 채팅에서 실제로 쓸 법한 문장인지 검증하세요.
4. 여러 해석이 가능하다면 대화 상황에서 가장 흔히 쓰이는 표현을 선택하세요.

[유지해야 할 것]
- ㅋㅋㅋ, ㅎㅎㅎ, ㅠㅠ 등 감정 표현 자음
- 이모티콘, 이모지
- 숫자, 영어 단어
- ?!, ... 등 문장부호
- 의도적인 줄임말이나 신조어

[출력 규칙]
- 오직 교정된 문장만 출력하세요.
- 설명, 따옴표, 부연 없이 결과 텍스트만 반환하세요.
- 오타가 없다고 판단되면 원문 그대로 반환하세요.

[입력 메시지]
${text}

[교정된 메시지]`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let corrected = response.text().trim();

    // 응답이 비어있거나 이상한 경우 원본 반환
    if (!corrected || corrected.length === 0 || corrected.length > text.length * 3) {
      corrected = text;
    }

    res.json({ corrected });

  } catch (error) {
    console.error('Typo correction error:', error);
    // 오류 시 원본 텍스트 반환 (사용자 경험 유지)
    res.json({ corrected: req.body.text || '' });
  }
};
