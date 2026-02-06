const { GoogleGenerativeAI } = require('@google/generative-ai');
const ChatMessage = require('../models/ChatMessage');
const Room = require('../models/room');
const RejectedSuggestion = require('../models/RejectedSuggestion');
const ScheduleSuggestion = require('../models/ScheduleSuggestion');
const User = require('../models/user');
const { generateSchedulePrompt } = require('../prompts/scheduleAnalysis');
const { syncToGoogleCalendar, deleteFromGoogleCalendar } = require('./confirmScheduleService');
const preferenceService = require('./preferenceService');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 분석 중복 방지를 위한 Map (roomId -> 마지막 분석 시간)
const analysisTimestamps = new Map();

/**
 * 대화 내용 분석 및 일정 추출 서비스
 */
exports.analyzeConversation = async (roomId) => {
  try {
    // 🆕 30초 버퍼 제거 - 모든 메시지를 즉시 분석하여 실시간 응답 가능
    // (이전: 30초 이내 재분석 방지로 실시간 참석/불참 처리가 불가능했음)

    // 1. 최근 대화 내용 가져오기 (최근 5개만 - 가장 최근 맥락 우선)
    const messages = await ChatMessage.find({ room: roomId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('sender', 'firstName lastName');

    if (messages.length < 3) {
      return;
    }

    // 시간순 정렬 (과거 -> 현재)
    const sortedMessages = messages.reverse();

    // 마지막 메시지가 AI 제안이면 스킵 (중복 분석 방지)
    if (sortedMessages[sortedMessages.length - 1].type === 'suggestion' ||
        sortedMessages[sortedMessages.length - 1].type === 'ai-suggestion') {
      return;
    }

    // 2. 기존 활성 일정 가져오기
    const existingSuggestions = await ScheduleSuggestion.find({
      room: roomId,
      status: { $in: ['pending', 'future'] }
    }).populate('suggestedBy', 'firstName lastName').populate('memberResponses.user', 'firstName lastName');


    // 🔍 상세 로그: 기존 일정 목록
    if (existingSuggestions.length > 0) {
      existingSuggestions.forEach((s, i) => {
      });
    } else {
    }

    // 3. 대화 텍스트 변환 (조원 메시지만 포함 — AI/시스템 메시지 제외)
    const userMessages = sortedMessages.filter(m => m.type === 'text' || !m.type);
    const conversationText = userMessages.map(m => {
      return `${m.sender?.firstName || 'User'}: ${m.content}`;
    }).join('');


    // 4. Gemini 프롬프트 구성 (기존 일정 정보 포함)
    const prompt = generateSchedulePrompt(conversationText, new Date(), existingSuggestions);

    // 5. Gemini 호출
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0, // 더 결정적인 출력
      }
    });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim();

    // Markdown code block 제거
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '');
    } else if (text.startsWith('```')) {
      text = text.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    // JSON 파싱 시도
    let analysisResult;
    try {
      analysisResult = JSON.parse(text);
    } catch (parseError) {
      console.error('❌ [AI Schedule] JSON parse failed:', parseError);
      console.error('AI Response:', text);
      return;
    }

    // 6. action에 따른 처리
    const action = analysisResult.action;
    console.log('[AI분석] 대화:', conversationText);
    console.log('[AI분석] 결과:', JSON.stringify(analysisResult, null, 2));

    // 🔍 response action인 경우 targetId 검증
    if (action === 'response' && analysisResult.targetId) {
      const targetSchedule = existingSuggestions.find(s => s._id.toString() === analysisResult.targetId);
      if (targetSchedule) {
      } else {
      }
    }

    if (action === 'none') {
      return;
    }

    if (action === 'response') {
      // 🆕 자동 참석/불참 처리
      await handleAutoResponse(roomId, analysisResult, sortedMessages);
      return;
    }

    // 사용자 메시지만 필터링 (시스템 메시지 제외)
    const userMessagesForAction = sortedMessages.filter(m => m.type === 'text' || !m.type);

    if (action === 'new') {
      // 새 일정 생성
      await handleNewSchedule(roomId, analysisResult.data, userMessagesForAction, existingSuggestions);
    } else if (action === 'extend') {
      // 기존 일정 확장
      await handleExtendSchedule(roomId, analysisResult.targetId, analysisResult.data, userMessagesForAction);
    } else if (action === 'cancel') {
      // 일정 취소
      await handleCancelSchedule(roomId, analysisResult.targetId, analysisResult.reason, userMessagesForAction);
    }

  } catch (error) {
    console.error('❌ [AI Schedule] Analysis failed:', error);
    if (error.message?.includes('API key')) {
      console.error('  → Gemini API key issue. Check GEMINI_API_KEY env variable.');
    } else if (error.message?.includes('quota')) {
      console.error('  → API quota exceeded. Check Gemini API usage.');
    }
  }
};

/**
 * 새 일정 생성 처리
 */
async function handleNewSchedule(roomId, data, sortedMessages, existingSuggestions = []) {
  console.log('🆕 [handleNewSchedule] 시작 - data:', JSON.stringify(data));

  if (!data || !data.date || !data.startTime || !data.summary) {
    console.error('❌ [AI Schedule] Missing required fields for new schedule:', data);
    return;
  }
  console.log('✅ [handleNewSchedule] 필수 필드 확인 완료');

  // endTime 자동 생성
  if (!data.endTime) {
    data.endTime = calculateEndTime(data.startTime, data.summary);
  }

  // 날짜/시간 형식 검증
  if (!validateDateTimeFormat(data)) return;

  // 🆕 기존 일정과 중복 체크
  const isDuplicate = existingSuggestions.some(existing => {
    // 같은 날짜인지 확인
    if (existing.date !== data.date) return false;

    // 시간이 비슷한지 확인 (±1시간)
    const existingHour = parseInt(existing.startTime.split(':')[0]);
    const newHour = parseInt(data.startTime.split(':')[0]);
    const hourDiff = Math.abs(existingHour - newHour);

    // 같은 날짜에 시간이 2시간 이내 차이면 중복으로 간주
    if (hourDiff <= 2) {
      return true;
    }

    return false;
  });

  if (isDuplicate) {
    console.log('⚠️ [handleNewSchedule] 중복 일정으로 스킵');
    return;
  }
  console.log('✅ [handleNewSchedule] 중복 체크 통과');

  // 거절 내역 체크
  const isRejected = await RejectedSuggestion.isRejected(roomId, data);
  if (isRejected) {
    console.log('⚠️ [handleNewSchedule] 거절된 일정으로 스킵');
    return;
  }
  console.log('✅ [handleNewSchedule] 거절 체크 통과');


  // 방 정보 가져오기
  console.log('🔍 [handleNewSchedule] 방 정보 조회 중... roomId:', roomId);
  const room = await Room.findById(roomId);
  if (!room) {
    console.error('❌ [AI Schedule] Room not found:', roomId);
    return;
  }
  console.log('✅ [handleNewSchedule] 방 찾음 - 멤버 수:', room.members?.length);

  // 마지막 메시지 작성자를 제안자로 설정 (sortedMessages는 이미 userMessages로 필터링됨)
  const lastMessage = sortedMessages[sortedMessages.length - 1];
  const suggestedByUserId = lastMessage?.sender?._id || lastMessage?.sender;

  // 🆕 일정 충돌 체크
  let conflictInfo = { conflicts: [], availableMembers: [] };
  try {
    console.log('[AI Schedule] 충돌 체크 시작:', { date: data.date, startTime: data.startTime, endTime: data.endTime });
    conflictInfo = await preferenceService.checkTimeConflict(roomId, {
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      summary: data.summary
    });
    console.log('[AI Schedule] 충돌 체크 결과:', JSON.stringify(conflictInfo, null, 2));
  } catch (conflictErr) {
    console.warn('⚠️ [AI Schedule] Failed to check conflicts:', conflictErr.message);
  }

  // 충돌 있는 멤버 ID Set 생성
  const conflictUserIds = new Set(conflictInfo.conflicts.map(c => c.userId.toString()));

  // 모든 방 멤버를 memberResponses에 추가 (충돌 시 자동 불참)
  const memberResponses = room.members.map(member => {
    const memberId = member.user.toString();
    const suggesterId = suggestedByUserId?.toString();
    const isSuggester = memberId === suggesterId;
    const hasConflict = conflictUserIds.has(memberId);

    // 제안자는 충돌이 있어도 참석 (본인이 제안했으니까)
    if (isSuggester) {
      return {
        user: member.user,
        status: 'accepted',
        respondedAt: new Date(),
        personalTimeId: null,
        isAutoRejected: false,
        autoRejectReason: null
      };
    }

    // 충돌이 있는 멤버는 자동 불참
    if (hasConflict) {
      return {
        user: member.user,
        status: 'rejected',
        respondedAt: new Date(),
        personalTimeId: null,
        isAutoRejected: true,
        autoRejectReason: '일정 충돌'
      };
    }

    // 충돌 없는 멤버는 pending
    return {
      user: member.user,
      status: 'pending',
      respondedAt: null,
      personalTimeId: null,
      isAutoRejected: false,
      autoRejectReason: null
    };
  });

  // 자동 불참 멤버 목록 생성
  // 제안자는 충돌이 있어도 참석이므로 자동 불참 목록에서 제외
  const autoRejectedMembers = conflictInfo.conflicts
    .filter(c => c.userId.toString() !== suggestedByUserId?.toString())
    .map(c => c.userName);

  // 외부 참여자 변환 (문자열 배열 → 객체 배열)
  const externalParticipants = (data.participants || []).map(name => ({ name }));

  // ScheduleSuggestion 생성
  const suggestion = new ScheduleSuggestion({
    room: roomId,
    summary: data.summary,
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime,
    location: data.location || '',
    externalParticipants,
    memberResponses,
    status: 'future',
    aiResponse: data,
    suggestedBy: suggestedByUserId
  });

  await suggestion.save();
  console.log('✅ [handleNewSchedule] ScheduleSuggestion 저장 완료 - id:', suggestion._id);

  // 🆕 제안자(생성자)의 personalTime 생성
  if (suggestedByUserId) {
    try {
      const suggester = await User.findById(suggestedByUserId);
      if (suggester) {
        let endTime = data.endTime;
        if (endTime === '24:00') endTime = '23:59';

        const newPersonalTime = {
          id: suggester.personalTimes.length > 0
            ? Math.max(...suggester.personalTimes.map(pt => pt.id)) + 1
            : 1,
          title: `[약속] ${data.summary}`,
          type: 'event',
          startTime: data.startTime,
          endTime: endTime,
          days: [],
          isRecurring: false,
          specificDate: data.date,
          color: '#3b82f6',
          location: data.location || '',
          roomId: roomId,
          participants: 1 + (data.participants?.length || 0),
          externalParticipants: externalParticipants,
          suggestionId: suggestion._id.toString()
        };

        suggester.personalTimes.push(newPersonalTime);
        await suggester.save();

        // memberResponses에 personalTimeId 업데이트
        const suggesterResponse = suggestion.memberResponses.find(
          r => r.user.toString() === suggestedByUserId.toString()
        );
        if (suggesterResponse) {
          suggesterResponse.personalTimeId = newPersonalTime.id;
          await suggestion.save();
        }
      }
    } catch (err) {
      console.error(`⚠️ [AI Schedule] Failed to create suggester personalTime:`, err.message);
    }
  }

  await suggestion.save();

  // 시스템 메시지 생성
  const suggesterName = lastMessage?.sender?.firstName || '사용자';

  await sendSystemMessage(roomId, suggestedByUserId,
    `${suggesterName}님이 ${data.date} 일정을 제안하였습니다`,
    'ai-suggestion', suggestion._id);
  console.log('✅ [handleNewSchedule] 시스템 메시지 전송 완료');

  // 자동 불참자가 있으면 별도 시스템 메시지
  if (autoRejectedMembers.length > 0) {
    await sendSystemMessage(roomId, suggestedByUserId,
      `🚫 ${autoRejectedMembers.join(', ')}님은 해당 시간에 일정이 있어 자동 불참 처리되었습니다`,
      'system', suggestion._id);
  }
}

/**
 * 기존 일정 확장 처리
 */
async function handleExtendSchedule(roomId, targetId, data, sortedMessages) {
  if (!targetId || !data) {
    console.error('❌ [AI Schedule] Missing targetId or data for extend');
    return;
  }

  const suggestion = await ScheduleSuggestion.findById(targetId)
    .populate('memberResponses.user', 'firstName lastName email');
  if (!suggestion) {
    console.error('❌ [AI Schedule] Target suggestion not found:', targetId);
    return;
  }

  // 변경 전 값 저장
  const oldStartTime = suggestion.startTime;
  const oldEndTime = suggestion.endTime;
  const oldSummary = suggestion.summary;
  const oldLocation = suggestion.location;

  // 🆕 sentiment는 별도 보관 후 data에서 제거 (일정 필드가 아님)
  const sentiment = data.sentiment;
  delete data.sentiment;

  // 🆕 변경되지 않은 필드를 data에서 제거 (중복 알림 방지)
  if (data.summary && data.summary === oldSummary) delete data.summary;
  if (data.endTime && data.endTime === oldEndTime) delete data.endTime;
  if (data.startTime && data.startTime === oldStartTime) delete data.startTime;
  if (data.location && data.location === oldLocation) delete data.location;

  // 모든 필드가 제거되었으면 (실제 변경 없음) sentiment만 처리
  const hasDataChange = data.summary || data.endTime || data.startTime || data.location;
  if (!hasDataChange && !sentiment) {
    console.log('[AI분석] 이미 같은 값 - extend 스킵:', { targetId, data, old: { oldSummary, oldStartTime, oldEndTime, oldLocation } });
    return;
  }

  // 일정 업데이트 (변경된 필드만)
  if (data.summary) suggestion.summary = data.summary;
  if (data.endTime) suggestion.endTime = data.endTime;
  if (data.location) suggestion.location = data.location;
  if (data.startTime) suggestion.startTime = data.startTime;

  if (hasDataChange) {
    await suggestion.save();
  }

  // 🆕 시간이 변경되었으면 모든 참여자에 대해 충돌 재체크
  if (data.startTime || data.endTime) {
    console.log('[AI분석] 시간 변경됨 - 충돌 재체크 시작');
    const autoRejectedUsers = [];
    
    for (const response of suggestion.memberResponses) {
      // pending 또는 accepted 상태인 사람만 체크 (이미 수동 불참한 사람은 제외)
      if (response.status === 'rejected' && !response.isAutoRejected) continue;
      
      const memberId = response.user?._id || response.user;
      const member = await User.findById(memberId);
      if (!member) continue;
      
      let hasConflict = false;
      const conflictReasons = [];
      const proposedDate = new Date(suggestion.date);
      proposedDate.setHours(0, 0, 0, 0);
      
      // personalTimes 충돌 체크
      if (member.personalTimes && member.personalTimes.length > 0) {
        for (const pt of member.personalTimes) {
          // 같은 제안의 일정은 제외
          if (pt.suggestionId === suggestion._id.toString()) continue;
          
          if (pt.specificDate) {
            const ptDate = new Date(pt.specificDate);
            ptDate.setHours(0, 0, 0, 0);
            
            if (ptDate.getTime() === proposedDate.getTime()) {
              const isOverlap = !(suggestion.endTime <= pt.startTime || suggestion.startTime >= pt.endTime);
              if (isOverlap) {
                hasConflict = true;
                conflictReasons.push({ type: 'personal', title: pt.title, time: `${pt.startTime}-${pt.endTime}` });
              }
            }
          }
        }
      }
      
      // events 충돌 체크
      try {
        const Event = require('../models/event');
        const userEvents = await Event.find({
          userId: member._id,
          startTime: { $gte: new Date(`${suggestion.date}T00:00:00`), $lt: new Date(`${suggestion.date}T23:59:59`) },
          status: { $ne: 'cancelled' }
        });
        
        for (const event of userEvents) {
          const eventStartTime = event.startTime.toTimeString().substring(0, 5);
          const eventEndTime = event.endTime.toTimeString().substring(0, 5);
          const isOverlap = !(suggestion.endTime <= eventStartTime || suggestion.startTime >= eventEndTime);
          if (isOverlap) {
            hasConflict = true;
            conflictReasons.push({ type: 'event', title: '일정 있음', time: `${eventStartTime}-${eventEndTime}` });
          }
        }
      } catch (eventErr) {
        console.warn('⚠️ [AI Schedule] Failed to check events:', eventErr.message);
      }
      
      // 충돌 있으면 자동 불참 처리
      if (hasConflict) {
        // 기존에 수락했던 사람이면 personalTime 제거
        if (response.status === 'accepted' && response.personalTimeId) {
          const pt = member.personalTimes.find(p => p.id === response.personalTimeId);
          if (pt) {
            member.personalTimes = member.personalTimes.filter(p => p.id !== response.personalTimeId);
            await member.save();
          }
        }
        
        response.status = 'rejected';
        response.isAutoRejected = true;
        response.autoRejectReason = conflictReasons.map(r => r.title).join(', ');
        response.personalTimeId = null;
        
        autoRejectedUsers.push(member.firstName || member.email?.split('@')[0] || '사용자');
        console.log(`[AI분석] 시간 변경으로 자동 불참 - ${member.firstName}: ${conflictReasons.map(r => r.title).join(', ')}`);
      } else if (response.isAutoRejected) {
        // 이전에 자동 불참이었는데 이제 충돌이 없으면 pending으로 복구
        response.status = 'pending';
        response.isAutoRejected = false;
        response.autoRejectReason = null;
        console.log(`[AI분석] 시간 변경으로 충돌 해소 - ${member.firstName} → pending으로 복구`);
      }
    }
    
    await suggestion.save();
    
    // 자동 불참자 알림 메시지
    if (autoRejectedUsers.length > 0) {
      const lastMessage = sortedMessages[sortedMessages.length - 1];
      await sendSystemMessage(roomId, lastMessage?.sender?._id,
        `⚠️ 시간 변경으로 ${autoRejectedUsers.join(', ')}님이 자동 불참 처리되었습니다 (일정 충돌)`,
        'system', suggestion._id);
    }
  }

  // 🆕 수락한 모든 사용자의 personalTimes 동기화 (장소, 시간, 제목 등)
  if (hasDataChange) {
    // 참석자 이름 목록 구성 - User 모델에서 직접 조회
    const acceptedResponses = suggestion.memberResponses.filter(r => r.status === 'accepted');
    const participantNames = [];
    for (const r of acceptedResponses) {
      const memberId = r.user?._id || r.user;
      if (memberId) {
        const member = await User.findById(memberId).select('firstName email');
        if (member) {
          participantNames.push(member.firstName || member.email?.split('@')[0] || '참석자');
        }
      }
    }

    for (const response of suggestion.memberResponses) {
      if (response.status === 'accepted' && response.personalTimeId) {
        try {
          const syncUser = await User.findById(response.user);
          if (syncUser) {
            const pt = syncUser.personalTimes.find(p => p.id === response.personalTimeId);
            if (pt) {
              let changed = false;
              if (data.location) { pt.location = data.location; changed = true; }
              if (data.summary) { pt.title = `[약속] ${data.summary}`; changed = true; }
              if (data.startTime) { pt.startTime = data.startTime; changed = true; }
              if (data.endTime) {
                pt.endTime = data.endTime === '24:00' ? '23:59' : data.endTime;
                changed = true;
              }
              if (changed) {
                await syncUser.save();
                // 🔄 구글 캘린더 사용자면 구글 캘린더 이벤트도 업데이트
                if (syncUser.google && syncUser.google.refreshToken) {
                  try {
                    await syncToGoogleCalendar(syncUser, pt, participantNames);
                    console.log(`[AI Schedule] ✅ 구글 캘린더 업데이트 완료: ${syncUser.email}`);
                  } catch (gcErr) {
                    console.warn(`[AI Schedule] 구글 캘린더 업데이트 실패: ${gcErr.message}`);
                  }
                }
              }
            }
          }
        } catch (syncErr) {
          console.error(`⚠️ [AI Schedule] Failed to sync personalTime:`, syncErr.message);
        }
      }
    }
  }

  // 🆕 시스템 메시지 생성 (변경된 항목별로 각각 전송)
  const lastMessage = sortedMessages[sortedMessages.length - 1];

  if (hasDataChange) {
    // 시간이 변경된 경우
    if (data.startTime || data.endTime) {
      const newStartTime = suggestion.startTime;
      const newEndTime = suggestion.endTime;
      await sendSystemMessage(roomId, lastMessage?.sender?._id,
        `일정 시간이 변경되었습니다: ${oldStartTime}~${oldEndTime} → ${newStartTime}~${newEndTime}`,
        'system', suggestion._id);
    }
    // 장소가 변경된 경우
    if (data.location) {
      await sendSystemMessage(roomId, lastMessage?.sender?._id,
        `일정 장소가 변경되었습니다: ${suggestion.summary} (${oldLocation || '미정'} → ${suggestion.location})`,
        'system', suggestion._id);
    }
    // 내용이 변경된 경우
    if (data.summary) {
      await sendSystemMessage(roomId, lastMessage?.sender?._id,
        `일정 내용이 변경되었습니다: ${oldSummary} → ${suggestion.summary}`,
        'system', suggestion._id);
    }
  }

  // 🆕 extend에 sentiment 처리 (AI가 넣어줬거나, 코드에서 자동 감지)
  let detectedSentiment = sentiment;

  // AI가 sentiment를 안 넣었을 경우, 마지막 메시지에서 직접 감지
  if (!detectedSentiment && lastMessage?.content) {
    const msgText = lastMessage.content;
    const rejectPattern = /못\s*가|못\s*감|불참|불가능|패스|안\s*갈게|빠질게|안될것같아|안\s*될\s*것\s*같아|시험이라|일있어|약속있어|바빠서|일\s*생김|안됨|ㅈㅅ|못\s*갈\s*것\s*같아|안\s*갈래/;

    if (rejectPattern.test(msgText)) {
      detectedSentiment = 'reject';
    } else if (hasDataChange) {
      // 🆕 핵심: 장소/시간/활동을 적극적으로 제안하는 사람 = 암묵적 참석
      // "코엑스로 하자 12시까지 놀자" → 본인도 당연히 가는 것
      detectedSentiment = 'accept';
    }
  }

  if (detectedSentiment) {
    const sentimentResult = {
      targetId: targetId,
      sentiment: detectedSentiment,
      reason: 'extend와 함께 감지된 참석/불참 의사'
    };
    await handleAutoResponse(roomId, sentimentResult, sortedMessages);
  }

  // Socket 이벤트 발송
  if (global.io) {
    global.io.to(`room-${roomId}`).emit('suggestion-updated', {
      suggestionId: suggestion._id,
      suggestion: suggestion
    });
  }
}

/**
 * 🆕 자동 참석/불참 처리
 */
async function handleAutoResponse(roomId, analysisResult, sortedMessages) {
  const { targetId, sentiment, reason } = analysisResult;


  if (!targetId) {
    return;
  }

  const suggestion = await ScheduleSuggestion.findById(targetId).populate('memberResponses.user');
  if (!suggestion) {
    console.error('❌ [AI Schedule] Target suggestion not found:', targetId);
    return;
  }

  // 마지막 유저 메시지 작성자 확인 (AI/시스템 메시지 제외)
  const userOnlyMessages = sortedMessages.filter(m => m.type === 'text' || !m.type);
  const lastMessage = userOnlyMessages[userOnlyMessages.length - 1];
  const userId = lastMessage?.sender?._id?.toString() || lastMessage?.sender?.toString();

  if (!userId) {
    console.error('❌ [AI Schedule] Cannot identify user from last message');
    return;
  }

  // 사용자의 응답 찾기
  const userResponse = suggestion.memberResponses.find(
    r => r.user?._id?.toString() === userId
  );

  if (!userResponse) {
    console.error('❌ [AI Schedule] User not found in memberResponses:', userId);
    return;
  }

  // 🆕 이미 응답한 사용자 재처리 규칙
  // - 자동 불참(isAutoRejected)인 경우: accept 시 참석으로 변경 가능 (충돌 확인 필요)
  // - 참석(accepted) → 불참(reject): 변경 허용
  // - 불참(rejected) → 참석(accept): 변경 허용
  if (userResponse.status !== 'pending') {
    // 🆕 참석 → 불참 변경 허용
    if (userResponse.status === 'accepted' && sentiment === 'reject') {
      console.log(`[AI분석] 참석 → 불참 변경 - user: ${userId}`);
      
      // personalTime 제거
      if (userResponse.personalTimeId) {
        const rejectUser = await User.findById(userId);
        if (rejectUser) {
          rejectUser.personalTimes = rejectUser.personalTimes.filter(
            pt => pt.suggestionId !== suggestion._id.toString()
          );
          await rejectUser.save();
        }
      }
      
      userResponse.status = 'rejected';
      userResponse.respondedAt = new Date();
      userResponse.personalTimeId = null;
      userResponse.isAutoRejected = false;
      await suggestion.save();
      
      // 시스템 메시지
      const lastMessage = sortedMessages[sortedMessages.length - 1];
      const userName = lastMessage?.sender?.firstName || '사용자';
      await sendSystemMessage(roomId, userId,
        `${userName}님이 일정 참석을 취소했습니다: ${suggestion.date} ${suggestion.summary}`,
        'system', suggestion._id);
      
      // Socket 이벤트 발송
      if (global.io) {
        global.io.to(`room-${roomId}`).emit('suggestion-updated', {
          suggestionId: suggestion._id,
          suggestion: suggestion
        });
      }
      return;
    }
    
    // 🆕 수동 불참 → 참석 변경 허용
    if (userResponse.status === 'rejected' && !userResponse.isAutoRejected && sentiment === 'accept') {
      console.log(`[AI분석] 불참 → 참석 변경 - user: ${userId}`);
      // 아래 accept 로직으로 진행 (pending처럼 처리)
      userResponse.status = 'pending';
    }
    
    // 자동 불참자가 참석 의사를 표현한 경우 → 참석으로 변경 허용 (충돌 확인 필요)
    else if (userResponse.isAutoRejected && sentiment === 'accept') {
      console.log(`[AI분석] 자동 불참자 참석 전환 시도 - user: ${userId}`);
      
      // 🆕 현재 사용자의 충돌 일정 체크
      const user = await User.findById(userId);
      const conflictingSchedules = [];
      
      if (user) {
        const proposedDate = new Date(suggestion.date);
        proposedDate.setHours(0, 0, 0, 0);
        
        // personalTimes 충돌 체크
        if (user.personalTimes && user.personalTimes.length > 0) {
          for (const pt of user.personalTimes) {
            // 같은 제안의 일정은 제외
            if (pt.suggestionId === suggestion._id.toString()) continue;
            
            if (pt.specificDate) {
              const ptDate = new Date(pt.specificDate);
              ptDate.setHours(0, 0, 0, 0);
              
              if (ptDate.getTime() === proposedDate.getTime()) {
                // 시간 겹침 체크
                const isOverlap = !(suggestion.endTime <= pt.startTime || suggestion.startTime >= pt.endTime);
                if (isOverlap) {
                  conflictingSchedules.push({
                    type: 'personal',
                    title: pt.title,
                    time: `${pt.startTime}-${pt.endTime}`
                  });
                }
              }
            }
          }
        }
        
        // events 충돌 체크
        try {
          const Event = require('../models/event');
          const userEvents = await Event.find({
            userId: user._id,
            startTime: {
              $gte: new Date(`${suggestion.date}T00:00:00`),
              $lt: new Date(`${suggestion.date}T23:59:59`)
            },
            status: { $ne: 'cancelled' }
          });
          
          for (const event of userEvents) {
            const eventStartTime = event.startTime.toTimeString().substring(0, 5);
            const eventEndTime = event.endTime.toTimeString().substring(0, 5);
            const isOverlap = !(suggestion.endTime <= eventStartTime || suggestion.startTime >= eventEndTime);
            if (isOverlap) {
              conflictingSchedules.push({
                type: 'event',
                title: event.title,
                time: `${eventStartTime}-${eventEndTime}`
              });
            }
          }
        } catch (eventErr) {
          console.warn('⚠️ [AI Schedule] Failed to check events:', eventErr.message);
        }
      }
      
      // 🆕 충돌이 있으면 socket으로 확인 요청
      if (conflictingSchedules.length > 0) {
        console.log(`[AI분석] 충돌 감지 - ${conflictingSchedules.length}개 일정과 충돌, 확인 모달 표시`);
        if (global.io) {
          global.io.to(`room-${roomId}`).emit('conflict-confirmation-needed', {
            suggestionId: suggestion._id,
            suggestion: {
              _id: suggestion._id,
              summary: suggestion.summary,
              date: suggestion.date,
              startTime: suggestion.startTime,
              endTime: suggestion.endTime,
              location: suggestion.location
            },
            conflicts: conflictingSchedules,
            targetUserId: userId
          });
        }
        return; // 참석 처리하지 않고 종료 - 사용자 확인 필요
      }
      
      // 충돌 없음 - 기존대로 진행
      userResponse.isAutoRejected = false;
      userResponse.autoRejectReason = null;
    } else {
      console.log(`[AI분석] 이미 응답 완료 - user: ${userId}, status: ${userResponse.status}, sentiment: ${sentiment}`);
      return;
    }
  }

  // sentiment에 따라 자동 처리
  if (sentiment === 'accept') {

    const user = await User.findById(userId);
    if (!user) {
      console.error('❌ [AI Schedule] User not found:', userId);
      return;
    }

    // 24:00을 23:59로 변환 (User 스키마 validation)
    let endTime = suggestion.endTime;
    if (endTime === '24:00') {
      endTime = '23:59';
    }

    // memberResponses 먼저 업데이트 (참석자 수 계산을 위해)
    userResponse.status = 'accepted';
    userResponse.respondedAt = new Date();

    // 참석자 수 및 이름 계산 (accepted 상태인 멤버)
    const acceptedResponses = suggestion.memberResponses.filter(r => r.status === 'accepted');
    const acceptedCount = acceptedResponses.length;

    // User 모델에서 직접 이름 가져오기
    const participantNames = [];
    for (const r of acceptedResponses) {
      const memberId = r.user?._id || r.user;
      if (memberId) {
        const member = await User.findById(memberId).select('firstName lastName email');
        if (member) {
          const name = member.firstName || member.lastName || member.email?.split('@')[0] || '참석자';
          participantNames.push(name);
        }
      }
    }

    // 🆕 구글 사용자 여부 확인
    const isGoogleUser = !!(user.google && user.google.refreshToken);

    // personalTime 데이터 구성
    const newPersonalTime = {
      id: user.personalTimes.length > 0
        ? Math.max(...user.personalTimes.map(pt => pt.id)) + 1
        : 1,
      title: `[약속] ${suggestion.summary}`,
      type: 'event',
      startTime: suggestion.startTime,
      endTime: endTime,
      days: [],
      isRecurring: false,
      specificDate: suggestion.date,
      color: '#3b82f6',
      location: suggestion.location || '',
      roomId: roomId,
      participants: acceptedCount + (suggestion.externalParticipants?.length || 0),
      externalParticipants: suggestion.externalParticipants || [],
      suggestionId: suggestion._id.toString()
    };

    if (isGoogleUser) {
      // 🆕 구글 사용자: Google Calendar에만 저장 (personalTimes에 저장 안 함)
      try {
        await syncToGoogleCalendar(user, newPersonalTime, participantNames);
        console.log(`[AI Schedule] ✅ 구글 사용자 - Google Calendar에만 저장: ${user.email}`);
      } catch (syncErr) {
        console.warn(`[AI Schedule] 구글 캘린더 동기화 실패: ${syncErr.message}`);
      }
      // 구글 사용자는 personalTimeId를 저장하지 않음 (Google Calendar가 source of truth)
      userResponse.personalTimeId = null;
    } else {
      // 일반 사용자: personalTimes에 저장
      user.personalTimes.push(newPersonalTime);
      await user.save();
      userResponse.personalTimeId = newPersonalTime.id;
    }

    await suggestion.save();

    // 🆕 이미 수락한 다른 사용자들의 personalTimes.participants도 최신화
    for (const response of suggestion.memberResponses) {
      if (response.status === 'accepted' && response.personalTimeId && response.user?._id?.toString() !== userId) {
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
          console.error(`⚠️ [AI Schedule] Failed to sync participants for user:`, syncErr.message);
        }
      }
    }

    // 시스템 메시지
    const userName = lastMessage?.sender?.firstName || '사용자';
    await sendSystemMessage(roomId, userId,
      `${userName}님이 일정에 참석합니다: ${suggestion.date} ${suggestion.summary}`,
      'system', suggestion._id);

  } else if (sentiment === 'reject') {
    userResponse.status = 'rejected';
    userResponse.respondedAt = new Date();

    const rejectUser = await User.findById(userId);
    if (rejectUser) {
      const isGoogleUser = !!(rejectUser.google && rejectUser.google.refreshToken);

      if (isGoogleUser) {
        // 🆕 구글 사용자: Google Calendar에서만 삭제 (personalTimes 없음)
        try {
          // suggestionId로 Google Calendar 이벤트 찾아서 삭제
          const ptData = {
            title: `[약속] ${suggestion.summary}`,
            specificDate: suggestion.date,
            startTime: suggestion.startTime,
            suggestionId: suggestion._id.toString()
          };
          await deleteFromGoogleCalendar(rejectUser, ptData);
          console.log(`[AI Schedule] ✅ 구글 사용자 - Google Calendar에서 삭제: ${ptData.title}`);
        } catch (gcErr) {
          console.warn(`[AI Schedule] 구글 캘린더 삭제 실패: ${gcErr.message}`);
        }
      } else if (userResponse.personalTimeId) {
        // 일반 사용자: personalTimes에서 삭제
        rejectUser.personalTimes = rejectUser.personalTimes.filter(
          pt => pt.suggestionId !== suggestion._id.toString()
        );
        await rejectUser.save();
      }
    }
    userResponse.personalTimeId = null;

    await suggestion.save();

    // 시스템 메시지
    const userName = lastMessage?.sender?.firstName || '사용자';
    await sendSystemMessage(roomId, userId,
      `${userName}님이 일정에 불참합니다: ${suggestion.date} ${suggestion.summary}`,
      'system', suggestion._id);

  } else {
    // sentiment 없거나 알 수 없는 경우 - 단순 응답으로 처리
    return;
  }

  // Socket 이벤트 발송
  if (global.io) {
    global.io.to(`room-${roomId}`).emit('suggestion-updated', {
      suggestionId: suggestion._id,
      suggestion: suggestion
    });
  } else {
    console.warn(`⚠️ [AI Schedule] global.io is not available, socket event not sent`);
  }
}

/**
 * 일정 취소 처리
 */
async function handleCancelSchedule(roomId, targetId, reason, sortedMessages) {
  if (!targetId) {
    console.error('❌ [AI Schedule] Missing targetId for cancel');
    return;
  }

  const suggestion = await ScheduleSuggestion.findById(targetId).populate('memberResponses.user');
  if (!suggestion) {
    console.error('❌ [AI Schedule] Target suggestion not found:', targetId);
    return;
  }

  // 제안자 확인
  const lastMessage = sortedMessages[sortedMessages.length - 1];
  const requesterId = lastMessage?.sender?._id?.toString() || lastMessage?.sender?.toString();
  const suggesterId = suggestion.suggestedBy?.toString();

  // 제안자가 아닌 사람이 취소 요청하면 무시
  if (requesterId !== suggesterId) {
    return;
  }

  // 제안자 제외하고 수락한 사람 수 확인
  const acceptedOthers = suggestion.memberResponses.filter(r =>
    r.status === 'accepted' && r.user?._id?.toString() !== suggesterId
  );


  if (acceptedOthers.length >= 2) {
    // 2명 이상 수락한 경우: 제안자만 불참 처리

    // 제안자의 personalTime 제거
    const suggesterUser = await User.findById(suggesterId);
    if (suggesterUser) {
      suggesterUser.personalTimes = suggesterUser.personalTimes.filter(
        pt => pt.suggestionId !== targetId.toString()
      );
      await suggesterUser.save();
    }

    const suggesterResponse = suggestion.memberResponses.find(
      r => r.user?._id?.toString() === suggesterId
    );
    if (suggesterResponse) {
      suggesterResponse.status = 'rejected';
      suggesterResponse.respondedAt = new Date();
    }
    await suggestion.save();

    // 시스템 메시지
    const suggesterName = lastMessage?.sender?.firstName || '제안자';
    await sendSystemMessage(roomId, lastMessage?.sender?._id,
      `${suggesterName}님이 일정에서 빠졌습니다. 나머지 인원으로 진행됩니다: ${suggestion.date} ${suggestion.summary}`,
      'system', suggestion._id);

  } else {
    // 2명 미만 수락: 일정 완전 취소

    // 모든 수락 멤버의 personalTime 제거
    for (const response of suggestion.memberResponses) {
      if (response.status === 'accepted' && response.personalTimeId) {
        try {
          const member = await User.findById(response.user._id || response.user);
          if (member) {
            member.personalTimes = member.personalTimes.filter(
              pt => pt.suggestionId !== targetId.toString()
            );
            await member.save();
          }
        } catch (err) {
          console.error(`⚠️ [AI Schedule] Failed to remove personalTime on cancel:`, err.message);
        }
      }
    }

    suggestion.status = 'cancelled';
    await suggestion.save();

    // 시스템 메시지
    const suggesterName = lastMessage?.sender?.firstName || '제안자';
    await sendSystemMessage(roomId, lastMessage?.sender?._id,
      `${suggesterName}님이 일정을 취소하였습니다: ${suggestion.date} ${suggestion.summary}`,
      'system', suggestion._id);
  }

  // Socket 이벤트 발송
  if (global.io) {
    global.io.to(`room-${roomId}`).emit('suggestion-updated', {
      suggestionId: suggestion._id,
      suggestion: suggestion
    });
  }
}

/**
 * 시스템 메시지 전송 헬퍼
 */
async function sendSystemMessage(roomId, senderId, content, type, suggestionId = null) {
  const systemMessage = new ChatMessage({
    room: roomId,
    sender: senderId,
    content,
    type,
    suggestionId
  });
  await systemMessage.save();
  await systemMessage.populate('sender', 'firstName lastName email');

  if (global.io) {
    global.io.to(`room-${roomId}`).emit('chat-message', systemMessage);
  }
}

/**
 * endTime 자동 계산
 */
function calculateEndTime(startTime, summary) {
  const summaryLower = (summary || '').toLowerCase();
  let duration = 1;

  const mealKeywords = ['밥', '저녁', '점심', '아침', '식사', '회식', '술', '맥주', '치킨'];
  const activityKeywords = ['볼링', '영화', '노래방', '당구', '게임', '카페', '쇼핑', '운동', '헬스', 'pc방', '피시방'];

  const hasMeal = mealKeywords.some(k => summaryLower.includes(k));
  const hasActivity = activityKeywords.some(k => summaryLower.includes(k));

  if (hasMeal && hasActivity) {
    duration = 3;
  } else if (hasMeal || hasActivity) {
    duration = 2;
  } else if (summaryLower.includes('회의') || summaryLower.includes('미팅') || summaryLower.includes('스터디')) {
    duration = 1;
  }

  const [hours, minutes] = startTime.split(':').map(Number);
  const endHours = (hours + duration) % 24;
  return `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * 날짜/시간 형식 검증
 */
function validateDateTimeFormat(data) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const timeRegex = /^\d{2}:\d{2}$/;

  if (!dateRegex.test(data.date)) {
    console.error('❌ [AI Schedule] Invalid date format:', data.date);
    return false;
  }
  if (!timeRegex.test(data.startTime) || !timeRegex.test(data.endTime)) {
    console.error('❌ [AI Schedule] Invalid time format:', data);
    return false;
  }
  return true;
}
