const { GoogleGenerativeAI } = require('@google/generative-ai');
const ChatMessage = require('../models/ChatMessage');
const Room = require('../models/room');
const RejectedSuggestion = require('../models/RejectedSuggestion');
const ScheduleSuggestion = require('../models/ScheduleSuggestion');
const { generateSchedulePrompt } = require('../prompts/scheduleAnalysis');

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

    // 3. 대화 텍스트 변환 (사용자 메시지 + AI 시스템 메시지를 컨텍스트로 포함)
    const userMessages = sortedMessages.filter(m => m.type === 'text' || !m.type);
    const contextMessages = sortedMessages.filter(m =>
      m.type === 'text' || !m.type || m.type === 'ai-suggestion' || m.type === 'system'
    );
    const conversationText = contextMessages.map(m => {
      if (m.type === 'ai-suggestion' || m.type === 'system') {
        return `[AI시스템]: ${m.content}`;
      }
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
  if (!data || !data.date || !data.startTime || !data.summary) {
    console.error('❌ [AI Schedule] Missing required fields for new schedule:', data);
    return;
  }

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
    return;
  }

  // 거절 내역 체크
  const isRejected = await RejectedSuggestion.isRejected(roomId, data);
  if (isRejected) {
    return;
  }


  // 방 정보 가져오기
  const room = await Room.findById(roomId);
  if (!room) {
    console.error('❌ [AI Schedule] Room not found:', roomId);
    return;
  }

  // 마지막 메시지 작성자를 제안자로 설정 (sortedMessages는 이미 userMessages로 필터링됨)
  const lastMessage = sortedMessages[sortedMessages.length - 1];
  const suggestedByUserId = lastMessage?.sender?._id || lastMessage?.sender;

  // 모든 방 멤버를 memberResponses에 추가
  const memberResponses = room.members.map(member => {
    const memberId = member.user.toString();
    const suggesterId = suggestedByUserId?.toString();
    const isSuggester = memberId === suggesterId;
    return {
      user: member.user,
      status: isSuggester ? 'accepted' : 'pending',
      respondedAt: isSuggester ? new Date() : null,
      personalTimeId: null
    };
  });

  // ScheduleSuggestion 생성
  const suggestion = new ScheduleSuggestion({
    room: roomId,
    summary: data.summary,
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime,
    location: data.location || '',
    memberResponses,
    status: 'future',
    aiResponse: data,
    suggestedBy: suggestedByUserId
  });

  await suggestion.save();

  // 🆕 제안자(생성자)의 personalTime 생성
  if (suggestedByUserId) {
    try {
      const User = require('../models/user');
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
          participants: 1,
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

  // 🆕 최근 대화에서 동의 표현을 한 다른 사용자들 자동 참석 처리
  const acceptPatterns = /ㅇㅋ|ㄱㄱ|좋아|오케이|ㅇㅇ|고고|가자|갈게|나도|간다|가능|ㄱㄴ|됨|돼|할게|갈겡|가즈아|가야지|그래/;
  const autoAcceptedUsers = []; // 🆕 자동 참석 처리된 사용자 추적
  for (const msg of sortedMessages) {
    const msgSenderId = msg.sender?._id?.toString() || msg.sender?.toString();
    if (!msgSenderId || msgSenderId === suggestedByUserId?.toString()) continue;
    if (!msg.content || !acceptPatterns.test(msg.content)) continue;

    // 이 사용자의 memberResponse를 accepted로 변경
    const memberResp = suggestion.memberResponses.find(
      r => r.user.toString() === msgSenderId
    );
    if (memberResp && memberResp.status === 'pending') {
      memberResp.status = 'accepted';
      memberResp.respondedAt = new Date();

      // personalTime 생성
      try {
        const User = require('../models/user');
        const agreeUser = await User.findById(msgSenderId);
        if (agreeUser) {
          let endTime = data.endTime;
          if (endTime === '24:00') endTime = '23:59';
          const acceptedCount = suggestion.memberResponses.filter(r => r.status === 'accepted').length;
          const newPt = {
            id: agreeUser.personalTimes.length > 0
              ? Math.max(...agreeUser.personalTimes.map(pt => pt.id)) + 1
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
            participants: acceptedCount,
            suggestionId: suggestion._id.toString()
          };
          agreeUser.personalTimes.push(newPt);
          await agreeUser.save();
          memberResp.personalTimeId = newPt.id;
          autoAcceptedUsers.push({ userId: msgSenderId, userName: msg.sender?.firstName || '사용자' }); // 🆕
        }
      } catch (err) {
        console.error(`⚠️ [AI Schedule] Failed to auto-accept user:`, err.message);
      }
    }
  }
  await suggestion.save();

  // 시스템 메시지 생성
  const suggesterName = lastMessage?.sender?.firstName || '사용자';
  await sendSystemMessage(roomId, suggestedByUserId,
    `${suggesterName}님이 ${data.date} 일정을 제안하였습니다`,
    'ai-suggestion', suggestion._id);

  // 🆕 자동 참석 처리된 사용자들에게 참석 알림 전송
  for (const accepted of autoAcceptedUsers) {
    await sendSystemMessage(roomId, accepted.userId,
      `${accepted.userName}님이 일정에 참석합니다: ${data.date} ${data.summary}`,
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

  const suggestion = await ScheduleSuggestion.findById(targetId);
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

  // 🆕 수락한 모든 사용자의 personalTimes 동기화 (장소, 시간, 제목 등)
  if (hasDataChange) {
    const User = require('../models/user');
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

  // 마지막 메시지 작성자 확인
  const lastMessage = sortedMessages[sortedMessages.length - 1];
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

  // 🆕 이미 응답한 사용자는 재처리 안 함
  if (userResponse.status !== 'pending') {
    console.log(`[AI분석] 이미 응답 완료 - user: ${userId}, status: ${userResponse.status}, sentiment: ${sentiment}`);
    return;
  }

  // sentiment에 따라 자동 처리
  if (sentiment === 'accept') {

    // 🆕 사용자 개인 캘린더에 일정 추가 (personalTimes)
    const User = require('../models/user');
    const user = await User.findById(userId);
    if (!user) {
      console.error('❌ [AI Schedule] User not found:', userId);
      return;
    }

    // 🆕 24:00을 23:59로 변환 (User 스키마 validation)
    let endTime = suggestion.endTime;
    if (endTime === '24:00') {
      endTime = '23:59';
    }

    // memberResponses 먼저 업데이트 (참석자 수 계산을 위해)
    userResponse.status = 'accepted';
    userResponse.respondedAt = new Date();

    // 🆕 참석자 수 계산 (accepted 상태인 멤버 수 - 현재 사용자 포함)
    const acceptedCount = suggestion.memberResponses.filter(r => r.status === 'accepted').length;

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
      participants: acceptedCount,  // 🆕 실제 참석자 수
      suggestionId: suggestion._id.toString()  // 🆕 원본 일정 ID (추후 동기화용)
    };

    user.personalTimes.push(newPersonalTime);
    await user.save();

    // personalTimeId 업데이트
    userResponse.personalTimeId = newPersonalTime.id;
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

    // 🆕 이미 수락해서 personalTime이 있었다면 제거
    if (userResponse.personalTimeId) {
      const User = require('../models/user');
      const rejectUser = await User.findById(userId);
      if (rejectUser) {
        rejectUser.personalTimes = rejectUser.personalTimes.filter(
          pt => pt.suggestionId !== suggestion._id.toString()
        );
        await rejectUser.save();
      }
      userResponse.personalTimeId = null;
    }

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
    const User = require('../models/user');
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
    const User = require('../models/user');
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
