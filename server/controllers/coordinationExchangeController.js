const Room = require('../models/Room');
/**
 * ============================================================================
 * coordinationExchangeController.js - 일정맞추기 교환 API
 * ============================================================================
 * 
 * 🔴 일정맞추기 탭의 채팅 시간 변경 기능 백엔드
 * 
 * [주요 API]
 * - parseExchangeRequest: Gemini로 자연어 메시지 파싱
 *   POST /api/coordination/rooms/:roomId/parse-exchange-request
 * 
 * - smartExchange: 시간 변경/교환 실행
 *   POST /api/coordination/rooms/:roomId/smart-exchange
 * 
 * [프론트엔드 연결]
 * - client/src/hooks/useChat.js에서 호출
 * - ChatBox.js의 메시지가 useChat 훅을 통해 이 API로 전달됨
 * 
 * [사용 예시]
 * 조원: "수요일로 바꿔줘"
 * → parseExchangeRequest로 파싱
 * → smartExchange로 교환 실행
 * ============================================================================
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper functions for time calculations
function addHours(timeStr, hours) {
   const [h, m] = timeStr.split(':').map(Number);
   const totalMinutes = h * 60 + m + (hours * 60);
   const newH = Math.floor(totalMinutes / 60) % 24;
   const newM = totalMinutes % 60;
   return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

function getHoursDifference(startTime, endTime) {
   const [sh, sm] = startTime.split(':').map(Number);
   const [eh, em] = endTime.split(':').map(Number);
   return ((eh * 60 + em) - (sh * 60 + sm)) / 60;
}

/**
 * Handle date-based change requests (e.g., "11월 11일 → 11월 14일")
 */
async function handleDateChange(req, res, room, memberData, params) {
   const { sourceMonth, sourceDay, targetMonth, targetDateNum, targetTime, viewMode, currentWeekStartDate } = params;

   const now = new Date();
   const currentYear = now.getFullYear();
   const currentMonth = now.getMonth() + 1;

   // Calculate source date (use UTC to avoid timezone issues)
   let sourceDate;
   if (sourceMonth && sourceDay) {
      sourceDate = new Date(Date.UTC(currentYear, sourceMonth - 1, sourceDay, 0, 0, 0, 0));
   } else {
      // "오늘 일정" - find user's slot for today
      const today = new Date();
      sourceDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0));
   }

   // Calculate target date (use UTC to avoid timezone issues)
   const finalTargetMonth = targetMonth || currentMonth;
   const targetDate = new Date(Date.UTC(currentYear, finalTargetMonth - 1, targetDateNum, 0, 0, 0, 0));

   // Get day of week for target date
   const dayOfWeek = targetDate.getDay();
   const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
   const targetDayEnglish = dayNames[dayOfWeek];

   // Validate: only weekdays
   if (dayOfWeek === 0 || dayOfWeek === 6) {
      return res.status(400).json({
         success: false,
         message: `${finalTargetMonth}월 ${targetDateNum}일은 주말입니다. 평일(월~금)로만 이동할 수 있습니다.`
      });
   }

   console.log(`📅 Date change: ${sourceMonth || 'today'}/${sourceDay || 'today'} → ${finalTargetMonth}/${targetDateNum} (${targetDayEnglish})`);

   // Find the source slot
   const sourceDateStr = sourceDate.toISOString().split('T')[0];

   console.log(`🔍 Looking for slots on source date: ${sourceDateStr}`);
   console.log(`👤 User ID: ${req.user.id}`);

   // First, check all user's slots regardless of date
   const allUserSlots = room.timeSlots.filter(slot => {
      const slotUserId = (slot.user._id || slot.user).toString();
      return slotUserId === req.user.id.toString();
   });

   console.log(`📊 Total slots for user: ${allUserSlots.length}`);
   allUserSlots.forEach(slot => {
      const slotDate = new Date(slot.date).toISOString().split('T')[0];
      console.log(`   - ${slotDate} ${slot.startTime}-${slot.endTime} (subject: "${slot.subject}")`);
   });

   const requesterSlots = room.timeSlots.filter(slot => {
      const slotUserId = (slot.user._id || slot.user).toString();
      const slotDate = new Date(slot.date).toISOString().split('T')[0];
      const isUserSlot = slotUserId === req.user.id.toString();
      const isSourceDate = slotDate === sourceDateStr;
      const isValidSubject = slot.subject === '자동 배정' || slot.subject === '교환 결과';

      if (isUserSlot && isSourceDate) {
         console.log(`   🎯 Found matching date slot: ${slotDate} ${slot.startTime}-${slot.endTime}, subject="${slot.subject}", valid=${isValidSubject}`);
      }

      return isUserSlot && isSourceDate && isValidSubject;
   });

   console.log(`✅ Filtered slots on ${sourceDateStr}: ${requesterSlots.length}`);

   if (requesterSlots.length === 0) {
      return res.status(400).json({
         success: false,
         message: `${sourceMonth || (now.getMonth() + 1)}월 ${sourceDay || now.getDate()}일에 배정된 일정이 없습니다.`
      });
   }

   // Sort and group into continuous block
   requesterSlots.sort((a, b) => {
      const [aH, aM] = a.startTime.split(':').map(Number);
      const [bH, bM] = b.startTime.split(':').map(Number);
      return (aH * 60 + aM) - (bH * 60 + bM);
   });

   const blockStartTime = requesterSlots[0].startTime;
   const blockEndTime = requesterSlots[requesterSlots.length - 1].endTime;
   const totalHours = getHoursDifference(blockStartTime, blockEndTime);

   const newStartTime = targetTime || blockStartTime;
   const newEndTime = addHours(newStartTime, totalHours);

   // Remove old slots and create new ones
   const slotIdsToRemove = requesterSlots.map(slot => slot._id.toString());
   for (const slotId of slotIdsToRemove) {
      const index = room.timeSlots.findIndex(slot => slot._id.toString() === slotId);
      if (index !== -1) {
         room.timeSlots.splice(index, 1);
      }
   }

   // Create new slots
   const newSlots = [];
   let currentTime = newStartTime;
   for (let i = 0; i < requesterSlots.length; i++) {
      const slotEndTime = addHours(currentTime, 0.5);
      newSlots.push({
         user: req.user.id,
         date: targetDate,
         startTime: currentTime,
         endTime: slotEndTime,
         day: targetDayEnglish,
         priority: requesterSlots[i].priority || 3,
         subject: '자동 배정',
         assignedBy: room.owner._id,
         assignedAt: new Date(),
         status: 'confirmed'
      });
      currentTime = slotEndTime;
   }

   room.timeSlots.push(...newSlots);
   await room.save();
   await room.populate('timeSlots.user', '_id firstName lastName email');

   const targetDateFormatted = `${finalTargetMonth}월 ${targetDateNum}일`;
   return res.json({
      success: true,
      message: `${targetDateFormatted} ${newStartTime}-${newEndTime}로 즉시 변경되었습니다!`,
      immediateSwap: true,
      targetDay: targetDayEnglish,
      targetTime: newStartTime
   });
}

/**
 * Parse natural language exchange request using Gemini
 * POST /api/coordination/rooms/:roomId/parse-exchange-request
 */
exports.parseExchangeRequest = async (req, res) => {
   try {
      const { roomId } = req.params;
      const { message } = req.body;

      if (!message || !message.trim()) {
         return res.status(400).json({ error: '메시지를 입력해주세요.' });
      }

      // Verify room exists and user is a member
      const room = await Room.findById(roomId);
      if (!room) {
         return res.status(404).json({ error: '방을 찾을 수 없습니다.' });
      }

      const isMember = room.members.some(m =>
         (m.user._id || m.user).toString() === req.user.id.toString()
      );
      if (!isMember) {
         return res.status(403).json({ error: '방 멤버만 이 기능을 사용할 수 있습니다.' });
      }

      // Use Gemini to parse the natural language request
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

      const prompt = `
다음 메시지의 의도를 파악해주세요.

메시지: "${message}"

다음 JSON 형식으로 응답해주세요:
{
  "type": "응답 타입 (time_change, date_change, confirm, reject 중 하나)",
  "sourceWeekOffset": "소스 주 오프셋 (지지난주=-2, 저번주=-1, 이번주=0, 다음주=1. 소스가 명시되지 않으면 null)",
  "sourceDay": "소스 요일 (time_change에서 소스가 명시된 경우, 예: 월요일. date_change일 때는 숫자)",
  "targetDay": "목표 요일 (time_change일 때, 예: 월요일~금요일. date_change일 때는 null)",
  "targetTime": "시간 (HH:00 형식, 예: 14:00. 명시되지 않으면 null)",
  "weekNumber": "주차 (1~5. 명시되지 않으면 null)",
  "weekOffset": "목표 주 오프셋 (이번주=0, 다음주=1, 다다음주=2. 명시되지 않으면 null)",
  "sourceMonth": "출발 월 (date_change일 때, 예: 11)",
  "targetMonth": "목표 월 (date_change일 때, 예: 11)",
  "targetDate": "목표 일 (date_change일 때, 예: 14)"
}

**응답 타입 판단 규칙:**
1. **time_change**: 요일 기반 시간 변경 (예: "수요일로 바꿔줘", "다음주 목요일로")
2. **date_change**: 날짜 기반 시간 변경 (예: "11월 11일을 11월 14일로", "15일로 옮겨줘")
3. **confirm**: 긍정/확인 응답 ("네", "예", "응", "어", "웅", "ㅇㅇ", "ㅇ", "그래", "좋아", "오케이", "ok", "yes", "y")
4. **reject**: 부정/거절 응답 ("아니", "아니요", "아뇨", "싫어", "안돼", "안할래", "no", "n", "nope", "취소")

**time_change 규칙:**
1. 요일만 언급: targetDay만 추출, sourceWeekOffset은 null
2. "다음주", "이번주" 등 목표 주: weekOffset 사용 (이번주=0, 다음주=1, 다다음주=2)
3. "저번주", "지지난주" 등 소스 주: sourceWeekOffset 사용 (지지난주=-2, 저번주=-1, 이번주=0)
4. 소스 요일이 명시되면 sourceDay에 요일 추출
5. "둘째 주", "셋째 주" 등: weekNumber 사용 (1~5)
6. 시간은 24시간 형식 (오후 2시 → 14:00)

**date_change 규칙:**
1. "11월 11일을 14일로" → sourceMonth=11, sourceDay=11, targetMonth=11, targetDate=14
2. "오늘 일정을 15일로" → sourceMonth=null, sourceDay=null (오늘), targetMonth=현재월, targetDate=15
3. 월이 명시되지 않으면 현재 월로 간주

**예시:**
- "수요일로 바꿔줘" -> {"type": "time_change", "sourceWeekOffset": null, "sourceDay": null, "targetDay": "수요일", "weekOffset": null, ...}
- "다음주 수요일로" -> {"type": "time_change", "sourceWeekOffset": null, "sourceDay": null, "targetDay": "수요일", "weekOffset": 1, ...}
- "이번주 금요일로" -> {"type": "time_change", "sourceWeekOffset": null, "sourceDay": null, "targetDay": "금요일", "weekOffset": 0, ...}
- "저번주 화요일 일정 다음주 화요일로" -> {"type": "time_change", "sourceWeekOffset": -1, "sourceDay": "화요일", "targetDay": "화요일", "weekOffset": 1, ...}
- "저번주 월요일 일정 이번주 수요일로" -> {"type": "time_change", "sourceWeekOffset": -1, "sourceDay": "월요일", "targetDay": "수요일", "weekOffset": 0, ...}
- "지지난주 금요일을 다음주로" -> {"type": "time_change", "sourceWeekOffset": -2, "sourceDay": "금요일", "targetDay": "금요일", "weekOffset": 1, ...}
- "오늘 일정 다음주 수요일로" -> {"type": "time_change", "sourceWeekOffset": 0, "sourceDay": null, "targetDay": "수요일", "weekOffset": 1, ...}
- "둘째 주 월요일로" -> {"type": "time_change", "sourceWeekOffset": null, "sourceDay": null, "targetDay": "월요일", "weekNumber": 2, ...}
- "11월 11일 일정 14일로" -> {"type": "date_change", "sourceMonth": 11, "sourceDay": 11, "targetMonth": 11, "targetDate": 14, ...}
- "오늘 일정 15일로" -> {"type": "date_change", "sourceMonth": null, "sourceDay": null, "targetMonth": null, "targetDate": 15, ...}
- "네" -> {"type": "confirm", ...}
- "아니" -> {"type": "reject", ...}

JSON만 반환하고 다른 텍스트는 포함하지 마세요.
`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      // Parse JSON response
      let parsed;
      try {
         // Remove markdown code blocks if present
         const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
         parsed = JSON.parse(jsonText);
      } catch (parseError) {
         console.error('Failed to parse Gemini response:', text);
         return res.status(500).json({
            error: '요청을 이해하지 못했습니다. 다시 시도해주세요.',
            debug: text
         });
      }

      // Validate parsed data based on type
      if (!parsed.type) {
         return res.status(400).json({
            error: '메시지 타입을 파악할 수 없습니다.'
         });
      }

      // Validate time_change type
      if (parsed.type === 'time_change') {
         const validDays = ['월요일', '화요일', '수요일', '목요일', '금요일'];
         if (!parsed.targetDay || !validDays.includes(parsed.targetDay)) {
            return res.status(400).json({
               error: '요일을 명확히 말씀해주세요. (월요일~금요일)'
            });
         }

         // Validate time format if provided
         if (parsed.targetTime) {
            const timeRegex = /^([0-1][0-9]|2[0-3]):00$/;
            if (!timeRegex.test(parsed.targetTime)) {
               return res.status(400).json({
                  error: '시간 형식이 올바르지 않습니다. (예: 14:00)'
               });
            }
         }
      }

      // Validate date_change type
      if (parsed.type === 'date_change') {
         if (!parsed.targetDate) {
            return res.status(400).json({
               error: '목표 날짜를 명확히 말씀해주세요. (예: 15일)'
            });
         }
      }

      res.json({ parsed });

   } catch (error) {
      console.error('Parse exchange request error:', error);
      res.status(500).json({
         error: '서버 오류가 발생했습니다.',
         details: error.message
      });
   }
};

/**
 * Execute smart exchange with validation
 * POST /api/coordination/rooms/:roomId/smart-exchange
 */
exports.smartExchange = async (req, res) => {
   try {
      const { roomId } = req.params;
      const {
         type,
         targetDay,
         targetTime,
         viewMode,
         currentWeekStartDate,
         weekNumber,
         weekOffset,
         sourceWeekOffset,
         sourceDay,  // date_change: 숫자 (3일 → 3), time_change: 문자열 ("월요일")
         sourceMonth,
         targetMonth,
         targetDate: targetDateNum
      } = req.body;

      // time_change용으로 sourceDayStr 별도 변수 생성
      const sourceDayStr = (type === 'time_change' && sourceDay) ? sourceDay : null;

      console.log('🚀 ========== SMART EXCHANGE REQUEST ==========');
      console.log('📝 Request params:', { roomId, type, targetDay, targetTime, viewMode, weekNumber, weekOffset, sourceWeekOffset, sourceDay, sourceDayStr, sourceMonth, targetMonth, targetDateNum });
      console.log('👤 Requester user ID:', req.user.id);

      // Verify room exists
      const room = await Room.findById(roomId)
         .populate('owner', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes')
         .populate('members.user', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes')
         .populate('timeSlots.user', '_id firstName lastName email');

      if (!room) {
         return res.status(404).json({ success: false, message: '방을 찾을 수 없습니다.' });
      }

      // Verify user is a member
      const memberData = room.members.find(m =>
         (m.user._id || m.user).toString() === req.user.id.toString()
      );
      if (!memberData) {
         return res.status(403).json({ success: false, message: '방 멤버만 이 기능을 사용할 수 있습니다.' });
      }

      // Map day names to English
      const dayMap = {
         '월요일': 'monday',
         '화요일': 'tuesday',
         '수요일': 'wednesday',
         '목요일': 'thursday',
         '금요일': 'friday'
      };

      // Handle date_change type (날짜 기반 이동)
      if (type === 'date_change') {
         return await handleDateChange(req, res, room, memberData, {
            sourceMonth,
            sourceDay,
            targetMonth,
            targetDateNum,
            targetTime,
            viewMode,
            currentWeekStartDate
         });
      }

      // For time_change type, validate targetDay
      const targetDayEnglish = dayMap[targetDay];
      if (!targetDayEnglish) {
         return res.status(400).json({ success: false, message: '유효하지 않은 요일입니다.' });
      }

      // 🧠 Phase 4: Smart validation logic

      // Get current week's Monday
      // weekOffset 사용 시에는 항상 오늘 기준으로 계산 (캘린더 뷰 위치와 무관)
      let monday;
      const now = new Date();
      const day = now.getUTCDay();
      const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1);
      monday = new Date(now);
      monday.setUTCDate(diff);
      monday.setUTCHours(0, 0, 0, 0);

      console.log(`📅 Current week Monday: ${monday.toISOString().split('T')[0]} (from today: ${now.toISOString().split('T')[0]})`);

      // currentWeekStartDate가 제공되고 weekOffset이 없으면 해당 주 기준으로 계산
      if (currentWeekStartDate && !weekOffset && weekOffset !== 0) {
         const providedDate = new Date(currentWeekStartDate);
         const providedDay = providedDate.getUTCDay();
         const providedDiff = providedDate.getUTCDate() - providedDay + (providedDay === 0 ? -6 : 1);
         monday = new Date(providedDate);
         monday.setUTCDate(providedDiff);
         monday.setUTCHours(0, 0, 0, 0);
         console.log(`📅 Using provided week Monday: ${monday.toISOString().split('T')[0]}`);
      }

      // Calculate target date
      const dayNumbers = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5 };
      const targetDayNumber = dayNumbers[targetDayEnglish];
      let targetDate;

      // weekOffset 처리 (이번주=0, 다음주=1, 다다음주=2)
      if (weekOffset !== null && weekOffset !== undefined) {
         const targetWeekMonday = new Date(monday);
         targetWeekMonday.setUTCDate(monday.getUTCDate() + (weekOffset * 7));

         targetDate = new Date(targetWeekMonday);
         targetDate.setUTCDate(targetWeekMonday.getUTCDate() + targetDayNumber - 1);

         console.log(`📅 Week offset ${weekOffset}: Target date = ${targetDate.toISOString().split('T')[0]}`);
      }
      // 월간 모드에서 weekNumber가 제공된 경우 해당 주차로 계산
      else if (viewMode === 'month' && weekNumber) {
         // 현재 월의 첫째 주 월요일 찾기
         const year = monday.getFullYear();
         const month = monday.getMonth();
         const firstDayOfMonth = new Date(year, month, 1);
         const firstDayOfWeek = firstDayOfMonth.getDay();
         const daysToFirstMonday = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
         const firstMonday = new Date(firstDayOfMonth);
         firstMonday.setDate(firstDayOfMonth.getDate() - daysToFirstMonday);
         firstMonday.setUTCHours(0, 0, 0, 0);

         // 요청한 주차의 월요일
         const targetWeekMonday = new Date(firstMonday);
         targetWeekMonday.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);

         // 요청한 요일
         targetDate = new Date(targetWeekMonday);
         targetDate.setUTCDate(targetWeekMonday.getUTCDate() + targetDayNumber - 1);

         console.log(`📅 Monthly mode with weekNumber ${weekNumber}: Target date = ${targetDate.toISOString().split('T')[0]}`);
      } else {
         // 기본: 현재 주 내에서 계산
         targetDate = new Date(monday);
         targetDate.setUTCDate(monday.getUTCDate() + targetDayNumber - 1);
      }

      // 🔒 viewMode 검증: 주간 모드에서는 이번 주 내에서만 이동 가능
      if (viewMode === 'week') {
         const weekStart = new Date(monday);
         const weekEnd = new Date(monday);
         weekEnd.setUTCDate(monday.getUTCDate() + 6);
         weekEnd.setUTCHours(23, 59, 59, 999);

         if (targetDate < weekStart || targetDate > weekEnd) {
            const weekStartStr = weekStart.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
            const weekEndStr = weekEnd.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
            return res.status(400).json({
               success: false,
               message: `주간 모드에서는 이번 주(${weekStartStr} ~ ${weekEndStr}) 내에서만 이동할 수 있습니다. 다른 주로 이동하려면 월간 모드로 전환해주세요.`
            });
         }
      } else if (viewMode === 'month') {
         // 월간 모드: 해당 월 범위 검증
         const year = monday.getFullYear();
         const month = monday.getMonth();
         const firstDayOfMonth = new Date(year, month, 1);
         const lastDayOfMonth = new Date(year, month + 1, 0);

         // 첫째 주 월요일
         const firstDayOfWeek = firstDayOfMonth.getDay();
         const daysToFirstMonday = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
         const monthStart = new Date(firstDayOfMonth);
         monthStart.setDate(firstDayOfMonth.getDate() - daysToFirstMonday);
         monthStart.setUTCHours(0, 0, 0, 0);

         // 마지막 주 일요일
         const lastDayOfWeek = lastDayOfMonth.getDay();
         const daysToLastSunday = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;
         const monthEnd = new Date(lastDayOfMonth);
         monthEnd.setDate(lastDayOfMonth.getDate() + daysToLastSunday);
         monthEnd.setUTCHours(23, 59, 59, 999);

         if (targetDate < monthStart || targetDate > monthEnd) {
            const monthName = firstDayOfMonth.toLocaleDateString('ko-KR', { month: 'long' });
            return res.status(400).json({
               success: false,
               message: `${monthName} 범위를 벗어나는 이동입니다. 다른 달로 이동하시겠습니까?`,
               warning: 'out_of_month_range'
            });
         }
      }

      // Find ALL requester's current assignments (including exchanged slots)
      const requesterCurrentSlots = room.timeSlots.filter(slot => {
         const slotUserId = (slot.user._id || slot.user).toString();
         const isUserSlot = slotUserId === req.user.id.toString();
         // Accept both '자동 배정' and '교환 결과'
         const isValidSubject = slot.subject === '자동 배정' || slot.subject === '교환 결과';
         return isUserSlot && isValidSubject;
      });

      if (requesterCurrentSlots.length === 0) {
         return res.status(400).json({
            success: false,
            message: '현재 배정된 시간이 없습니다. 먼저 자동 배정을 받으세요.'
         });
      }

      console.log(`📋 Found ${requesterCurrentSlots.length} slots for user:`, requesterCurrentSlots.map(s => ({
         day: s.day,
         date: s.date,
         time: `${s.startTime}-${s.endTime}`
      })));

      // Group slots by date to find continuous blocks
      const slotsByDate = {};
      requesterCurrentSlots.forEach(slot => {
         const dateKey = new Date(slot.date).toISOString().split('T')[0];
         if (!slotsByDate[dateKey]) {
            slotsByDate[dateKey] = [];
         }
         slotsByDate[dateKey].push(slot);
      });

      // Sort each date's slots by start time and find continuous blocks
      const continuousBlocks = [];
      Object.entries(slotsByDate).forEach(([dateKey, slots]) => {
         // Sort by start time
         slots.sort((a, b) => {
            const [aH, aM] = a.startTime.split(':').map(Number);
            const [bH, bM] = b.startTime.split(':').map(Number);
            return (aH * 60 + aM) - (bH * 60 + bM);
         });

         // Find continuous blocks
         let currentBlock = [slots[0]];
         for (let i = 1; i < slots.length; i++) {
            const prev = currentBlock[currentBlock.length - 1];
            const curr = slots[i];

            // Check if current slot continues from previous
            if (prev.endTime === curr.startTime) {
               currentBlock.push(curr);
            } else {
               // Save current block and start new one
               continuousBlocks.push([...currentBlock]);
               currentBlock = [curr];
            }
         }
         continuousBlocks.push(currentBlock);
      });

      console.log(`📦 Found ${continuousBlocks.length} continuous blocks:`, continuousBlocks.map(block => ({
         day: block[0].day,
         date: block[0].date,
         time: `${block[0].startTime}-${block[block.length - 1].endTime}`,
         slotCount: block.length
      })));

      // Select block to move
      let selectedBlock;

      // 📍 STEP 1: Determine source week range
      let sourceWeekMonday, sourceWeekSunday;

      if (sourceWeekOffset !== null && sourceWeekOffset !== undefined) {
         // sourceWeekOffset이 명시된 경우: 해당 주차 계산 (저번주=-1, 이번주=0, 다음주=1)
         const now = new Date();
         const day = now.getUTCDay();
         const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1);
         const todayMonday = new Date(now);
         todayMonday.setUTCDate(diff);
         todayMonday.setUTCHours(0, 0, 0, 0);

         sourceWeekMonday = new Date(todayMonday);
         sourceWeekMonday.setUTCDate(todayMonday.getUTCDate() + (sourceWeekOffset * 7));

         sourceWeekSunday = new Date(sourceWeekMonday);
         sourceWeekSunday.setUTCDate(sourceWeekMonday.getUTCDate() + 6);

         console.log(`🎯 Source week specified: offset=${sourceWeekOffset}, range=${sourceWeekMonday.toISOString().split('T')[0]} to ${sourceWeekSunday.toISOString().split('T')[0]}`);
      } else {
         // sourceWeekOffset이 없으면 이번주 기준
         sourceWeekMonday = new Date(monday);
         sourceWeekSunday = new Date(monday);
         sourceWeekSunday.setUTCDate(sourceWeekMonday.getUTCDate() + 6);

         console.log(`📅 Source week defaulting to current week: ${sourceWeekMonday.toISOString().split('T')[0]} to ${sourceWeekSunday.toISOString().split('T')[0]}`);
      }

      // 📍 STEP 2: Filter blocks in source week
      const sourceWeekBlocks = continuousBlocks.filter(block => {
         const blockDate = new Date(block[0].date);
         return blockDate >= sourceWeekMonday && blockDate <= sourceWeekSunday;
      });

      console.log(`🔍 Found ${sourceWeekBlocks.length} blocks in source week`);

      // 📍 STEP 3: sourceDayStr이 명시된 경우 해당 요일만 필터
      let candidateBlocks = sourceWeekBlocks;

      if (sourceDayStr) {
         // 한글 요일 → 영어 요일 변환
         const dayMap = {
            '월요일': 'monday', '월': 'monday',
            '화요일': 'tuesday', '화': 'tuesday',
            '수요일': 'wednesday', '수': 'wednesday',
            '목요일': 'thursday', '목': 'thursday',
            '금요일': 'friday', '금': 'friday',
            '토요일': 'saturday', '토': 'saturday',
            '일요일': 'sunday', '일': 'sunday'
         };

         const sourceDayEnglish = dayMap[sourceDayStr] || sourceDayStr.toLowerCase();

         candidateBlocks = sourceWeekBlocks.filter(block => block[0].day === sourceDayEnglish);

         console.log(`🎯 Source day specified: ${sourceDayStr} (${sourceDayEnglish}), found ${candidateBlocks.length} blocks`);
      }

      // 📍 STEP 4: Select block from candidates
      if (candidateBlocks.length > 0) {
         // 타겟 요일이 아닌 블록 우선 선택 (다른 요일로 이동하는 경우)
         const blocksNotOnTargetDay = candidateBlocks.filter(block => block[0].day !== targetDayEnglish);
         const blocksOnTargetDay = candidateBlocks.filter(block => block[0].day === targetDayEnglish);

         if (blocksNotOnTargetDay.length > 0) {
            selectedBlock = blocksNotOnTargetDay[0];
            console.log(`✅ Selected block from ${selectedBlock[0].day} ${selectedBlock[0].startTime}-${selectedBlock[selectedBlock.length - 1].endTime} (date: ${selectedBlock[0].date}) → ${targetDayEnglish}`);
         } else if (blocksOnTargetDay.length > 0) {
            selectedBlock = blocksOnTargetDay[0];
            console.log(`✅ Selected block on same day ${selectedBlock[0].day} ${selectedBlock[0].startTime}-${selectedBlock[selectedBlock.length - 1].endTime} (date: ${selectedBlock[0].date})`);
         } else {
            selectedBlock = candidateBlocks[0];
            console.log(`✅ Selected first available block: ${selectedBlock[0].day} ${selectedBlock[0].startTime}-${selectedBlock[selectedBlock.length - 1].endTime}`);
         }
      } else {
         // 후보 블록이 없으면 fallback: 전체 블록에서 선택
         console.log(`⚠️ No blocks found in specified source, selecting from all blocks`);
         const blocksNotOnTargetDay = continuousBlocks.filter(block => block[0].day !== targetDayEnglish);
         if (blocksNotOnTargetDay.length > 0) {
            selectedBlock = blocksNotOnTargetDay[0];
         } else {
            selectedBlock = continuousBlocks[0];
         }
         console.log(`⚠️ Fallback: selected block from ${selectedBlock[0].date}`);
      }

      // console.log(`   Total blocks available: ${continuousBlocks.length}`);

      const requesterCurrentSlot = selectedBlock[0]; // For compatibility with existing code
      const allSlotsInBlock = selectedBlock;

      // 🔒 Check if target time is within MEMBER's preferred schedule (from User.defaultSchedule)
      const calculateTotalHours = (startTime, endTime) => {
         return getHoursDifference(startTime, endTime);
      };

      const blockStartTime = allSlotsInBlock[0].startTime;
      const blockEndTime = allSlotsInBlock[allSlotsInBlock.length - 1].endTime;
      const totalHours = calculateTotalHours(blockStartTime, blockEndTime);

      // Calculate all time slots that will be needed
      const newStartTime = targetTime || blockStartTime;
      const newEndTime = addHours(newStartTime, totalHours);

      // 🔒 STEP 1: Check OWNER's preferred schedule first
      const ownerUser = room.owner;
      const ownerDefaultSchedule = ownerUser.defaultSchedule || [];

      // Map day to dayOfWeek number (1=Monday, 2=Tuesday, ..., 5=Friday)
      const dayOfWeekMap = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5 };
      const targetDayOfWeek = dayOfWeekMap[targetDayEnglish];

      console.log(`🎯 Target day: ${targetDayEnglish} (dayOfWeek: ${targetDayOfWeek})`);

      // Find owner's schedule for target day
      const ownerTargetDaySchedules = ownerDefaultSchedule.filter(s => s.dayOfWeek === targetDayOfWeek);

      // console.log(`👑 Owner schedules for ${targetDay}:`, JSON.stringify(ownerTargetDaySchedules, null, 2));

      if (ownerTargetDaySchedules.length === 0) {
         return res.status(400).json({
            success: false,
            message: `${targetDay}는 방장의 선호 시간이 아닙니다. 방장이 설정한 선호 요일로만 변경할 수 있습니다.`
         });
      }

      // 🔒 STEP 2: Check MEMBER's preferred schedule
      const requesterUser = memberData.user;
      const requesterDefaultSchedule = requesterUser.defaultSchedule || [];

      // console.log('👤 Requester info:', {
      //    id: requesterUser._id,
      //    email: requesterUser.email,
      //    name: `${requesterUser.firstName} ${requesterUser.lastName}`
      // });
      // console.log('🔍 Requester FULL defaultSchedule (all days):', JSON.stringify(requesterDefaultSchedule.map(s => ({
      //    dayOfWeek: s.dayOfWeek,
      //    day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][s.dayOfWeek],
      //    startTime: s.startTime,
      //    endTime: s.endTime
      // })), null, 2));

      // Find requester's schedule for target day
      const memberTargetDaySchedules = requesterDefaultSchedule.filter(s => s.dayOfWeek === targetDayOfWeek);

      // console.log(`📅 Member schedules for ${targetDay}:`, JSON.stringify(memberTargetDaySchedules, null, 2));

      if (memberTargetDaySchedules.length === 0) {
         return res.status(400).json({
            success: false,
            message: `${targetDay}는 당신의 선호 시간이 아닙니다. 본인이 설정한 선호 요일로만 변경할 수 있습니다.`
         });
      }

      // 🔒 STEP 3: Merge and find overlapping time ranges (OWNER ∩ MEMBER)

      // Helper function to merge continuous slots
      const mergeSlots = (schedules) => {
         const sorted = [...schedules].sort((a, b) => {
            const [aH, aM] = a.startTime.split(':').map(Number);
            const [bH, bM] = b.startTime.split(':').map(Number);
            return (aH * 60 + aM) - (bH * 60 + bM);
         });

         const merged = [];
         let current = null;

         for (const schedule of sorted) {
            const [startH, startM] = schedule.startTime.split(':').map(Number);
            const [endH, endM] = schedule.endTime.split(':').map(Number);
            const startMinutes = startH * 60 + startM;
            const endMinutes = endH * 60 + endM;

            if (!current) {
               current = { startMinutes, endMinutes, startTime: schedule.startTime, endTime: schedule.endTime };
            } else {
               if (startMinutes <= current.endMinutes) {
                  current.endMinutes = Math.max(current.endMinutes, endMinutes);
                  current.endTime = schedule.endTime;
               } else {
                  merged.push({ ...current });
                  current = { startMinutes, endMinutes, startTime: schedule.startTime, endTime: schedule.endTime };
               }
            }
         }
         if (current) merged.push(current);
         return merged;
      };

      const ownerMergedRanges = mergeSlots(ownerTargetDaySchedules);
      const memberMergedRanges = mergeSlots(memberTargetDaySchedules);

      // console.log(`👑 Owner merged ranges for ${targetDay}:`, ownerMergedRanges.map(r => `${r.startTime}-${r.endTime}`));
      // console.log(`📊 Member merged ranges for ${targetDay}:`, memberMergedRanges.map(r => `${r.startTime}-${r.endTime}`));

      // Find intersection (overlapping ranges)
      const overlappingRanges = [];
      for (const ownerRange of ownerMergedRanges) {
         for (const memberRange of memberMergedRanges) {
            const overlapStart = Math.max(ownerRange.startMinutes, memberRange.startMinutes);
            const overlapEnd = Math.min(ownerRange.endMinutes, memberRange.endMinutes);

            if (overlapStart < overlapEnd) {
               // Convert back to time strings
               const startH = Math.floor(overlapStart / 60);
               const startM = overlapStart % 60;
               const endH = Math.floor(overlapEnd / 60);
               const endM = overlapEnd % 60;
               overlappingRanges.push({
                  startMinutes: overlapStart,
                  endMinutes: overlapEnd,
                  startTime: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
                  endTime: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
               });
            }
         }
      }

      // console.log(`🤝 Overlapping ranges (Owner ∩ Member):`, overlappingRanges.map(r => `${r.startTime}-${r.endTime}`));

      if (overlappingRanges.length === 0) {
         return res.status(400).json({
            success: false,
            message: `${targetDay}에 방장과 당신의 선호 시간이 겹치지 않습니다. 겹치는 시간대로만 변경할 수 있습니다.`
         });
      }

      // 🔧 If targetTime is not specified and moving to different day, use first overlap range start time
      let finalNewStartTime = newStartTime;
      let finalNewEndTime = newEndTime;

      if (!targetTime && selectedBlock[0].day !== targetDayEnglish) {
         // Moving to different day without specific time → use first overlap range start
         const firstOverlapStart = overlappingRanges[0].startTime;
         finalNewStartTime = firstOverlapStart;
         finalNewEndTime = addHours(firstOverlapStart, totalHours);
         console.log(`⚙️ No target time specified, using first overlap start: ${finalNewStartTime}`);
      }

      // Check if the entire block fits within any overlapping range
      const [newStartH, newStartM] = finalNewStartTime.split(':').map(Number);
      const [newEndH, newEndM] = finalNewEndTime.split(':').map(Number);
      const newStartMinutes = newStartH * 60 + newStartM;
      const newEndMinutes = newEndH * 60 + newEndM;

      // console.log(`🕐 New time range: ${finalNewStartTime}-${finalNewEndTime} (${newStartMinutes}-${newEndMinutes} minutes)`);

      let isWithinOverlap = false;
      for (const range of overlappingRanges) {
         // console.log(`  📋 Checking overlap range: ${range.startTime}-${range.endTime} (${range.startMinutes}-${range.endMinutes} minutes)`);
         // console.log(`     ${newStartMinutes} >= ${range.startMinutes} && ${newEndMinutes} <= ${range.endMinutes} = ${newStartMinutes >= range.startMinutes && newEndMinutes <= range.endMinutes}`);

         if (newStartMinutes >= range.startMinutes && newEndMinutes <= range.endMinutes) {
            isWithinOverlap = true;
            // console.log(`  ✅ Match found in overlapping range!`);
            break;
         }
      }

      if (!isWithinOverlap) {
         // Create a more helpful error message
         const availableRanges = overlappingRanges.map(r => `${r.startTime}-${r.endTime}`).join(', ');
         return res.status(400).json({
            success: false,
            message: `${targetDay} ${newStartTime}-${newEndTime}는 사용할 수 없습니다. 방장과 겹치는 가능한 시간: ${availableRanges}`
         });
      }

      console.log('✅ Target time is within overlapping preferred schedule (Owner ∩ Member)');

      // Check if target slot exists and who occupies it
      const targetSlots = room.timeSlots.filter(slot => {
         const slotDate = new Date(slot.date);
         return slotDate.toISOString().split('T')[0] === targetDate.toISOString().split('T')[0] &&
                (!targetTime || slot.startTime === targetTime);
      });

      const occupiedSlot = targetSlots.find(slot =>
         (slot.user._id || slot.user).toString() !== req.user.id.toString()
      );

      // Case 1: Target slot is empty → Immediate swap
      if (!occupiedSlot) {
         console.log('🔧 Current block:', {
            startTime: blockStartTime,
            endTime: blockEndTime,
            totalSlots: allSlotsInBlock.length,
            totalHours: totalHours,
            date: allSlotsInBlock[0].date
         });

         console.log('📅 New times:', { startTime: newStartTime, endTime: newEndTime, totalHours });

         // Check if already at target position (same day and same time)
         const currentBlockDate = new Date(allSlotsInBlock[0].date);
         const isSameDay = currentBlockDate.toISOString().split('T')[0] === targetDate.toISOString().split('T')[0];
         const isSameTime = blockStartTime === newStartTime && blockEndTime === newEndTime;

         if (isSameDay && isSameTime) {
            console.log('⚠️ Already at target position. No changes needed.');
            return res.json({
               success: true,
               message: `이미 ${targetDay} ${newStartTime}-${newEndTime}에 배정되어 있습니다.`,
               immediateSwap: true,
               targetDay,
               targetTime: newStartTime
            });
         }

         // Remove ALL slots in the block
         const slotIdsToRemove = allSlotsInBlock.map(slot => slot._id.toString());
         console.log(`🗑️ Attempting to remove ${slotIdsToRemove.length} slots:`, slotIdsToRemove);
         console.log(`📊 Total timeSlots before removal: ${room.timeSlots.length}`);

         const beforeLength = room.timeSlots.length;

         // Use Mongoose array methods to ensure changes are tracked
         for (const slotId of slotIdsToRemove) {
            const index = room.timeSlots.findIndex(slot => slot._id.toString() === slotId);
            if (index !== -1) {
               room.timeSlots.splice(index, 1);
            }
         }

         const afterLength = room.timeSlots.length;

         console.log(`🗑️ Removed ${beforeLength - afterLength} slots (expected ${slotIdsToRemove.length})`);
         console.log(`📊 Total timeSlots after removal: ${afterLength}`);

         // Create new continuous slots at target time (same 30-min intervals)
         const newSlots = [];
         let currentTime = finalNewStartTime;

         for (let i = 0; i < allSlotsInBlock.length; i++) {
            const slotEndTime = addHours(currentTime, 0.5); // 30 minutes
            newSlots.push({
               user: req.user.id,
               date: targetDate,
               startTime: currentTime,
               endTime: slotEndTime,
               day: targetDayEnglish,
               priority: allSlotsInBlock[i].priority || 3,
               subject: '자동 배정',
               assignedBy: room.owner._id,
               assignedAt: new Date(),
               status: 'confirmed'
            });
            currentTime = slotEndTime;
         }

         room.timeSlots.push(...newSlots);
         console.log(`✅ Created ${newSlots.length} new slots at ${finalNewStartTime}-${finalNewEndTime}`);

         await room.save();
         await room.populate('timeSlots.user', '_id firstName lastName email');

         return res.json({
            success: true,
            message: `${targetDay} ${finalNewStartTime}-${finalNewEndTime}로 즉시 변경되었습니다!`,
            immediateSwap: true,
            targetDay,
            targetTime: finalNewStartTime
         });
      }

      // Case 2: Target slot is occupied → Create exchange request
      console.log('🔔 Target slot is occupied, creating exchange request...');

      const occupiedUserId = (occupiedSlot.user._id || occupiedSlot.user).toString();
      const requesterSlotIds = allSlotsInBlock.map(s => s._id.toString());

      // Create exchange request
      const exchangeRequest = {
         requester: req.user.id,
         type: 'exchange_request',
         targetUser: occupiedUserId,
         requesterSlots: allSlotsInBlock.map(s => ({
            day: s.day,
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            subject: s.subject,
            user: req.user.id
         })),
         targetSlot: {
            day: occupiedSlot.day,
            date: occupiedSlot.date,
            startTime: occupiedSlot.startTime,
            endTime: occupiedSlot.endTime,
            subject: occupiedSlot.subject,
            user: occupiedUserId
         },
         desiredDay: targetDay,
         desiredTime: finalNewStartTime,
         message: `${memberData.user.firstName}님이 ${targetDay} ${finalNewStartTime}로 시간 변경을 요청했습니다.`,
         status: 'pending',
         createdAt: new Date()
      };

      room.requests.push(exchangeRequest);
      await room.save();

      await room.populate('requests.requester', 'firstName lastName email');
      await room.populate('requests.targetUser', 'firstName lastName email');

      const createdRequest = room.requests[room.requests.length - 1];

      console.log('✅ Exchange request created:', createdRequest._id);

      res.json({
         success: true,
         message: `${targetDay} ${finalNewStartTime}는 ${occupiedSlot.user.firstName}님이 사용 중입니다. 조정 요청을 전송했습니다.`,
         immediateSwap: false,
         needsApproval: true,
         targetDay,
         targetTime: finalNewStartTime,
         occupiedBy: occupiedSlot.user.firstName + ' ' + occupiedSlot.user.lastName,
         requestId: createdRequest._id
      });

   } catch (error) {
      console.error('Smart exchange error:', error);
      res.status(500).json({
         success: false,
         message: '서버 오류가 발생했습니다.',
         details: error.message
      });
   }
};
