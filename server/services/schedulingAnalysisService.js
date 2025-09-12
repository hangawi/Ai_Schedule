const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function findOptimalSlots(membersAvailability, constraints) {
   try {
      // 모델 가져오기 (비동기일 수 있음)
      const model = await genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      // AI에게 줄 prompt 생성
      const prompt = `
You are an expert meeting scheduler AI. Your task is to find the best possible meeting times for a group of people based on their availability.

**Participants:**
${membersAvailability.map(m => `- ${m.name} (ID: ${m.id})`).join('\n')}

**Meeting Constraints:**
- Duration: ${constraints.durationMinutes} minutes
- Desired time of day: ${constraints.timeOfDay || 'Any'}
- Number of options to provide: ${constraints.numberOfOptions || 3}

**Participants' Availability (in UTC):**
${membersAvailability
   .map(
      m => `
**${m.name}'s Schedule:**
${
   m.availability.length > 0
      ? m.availability
           .map(slot => `- Available from ${new Date(slot.start).toISOString()} to ${new Date(slot.end).toISOString()}`)
           .join('\n')
      : '- No availability provided.'
}
`,
   )
   .join('\n')}

**Your Task:**

1. Find Common Slots: Analyze all participants' availability to find time slots where everyone is free for the entire duration of ${
         constraints.durationMinutes
      } minutes.
2. Prioritize and Select: From the common slots, select the top ${
         constraints.numberOfOptions || 3
      } best options. Consider the desired time of day if specified.
3. Format Output (Success): If you find common slots, respond with a JSON object in the following format. Do not add any extra text or explanations outside of the JSON object.
\`\`\`json
{
  "success": true,
  "commonSlots": [
    { "startTime": "YYYY-MM-DDTHH:mm:ss.sssZ", "endTime": "YYYY-MM-DDTHH:mm:ss.sssZ" }
  ]
}
\`\`\`
4. Conflict Resolution (Failure): If you cannot find any time slot where everyone is available, provide three alternative suggestions in this format. Only respond with JSON.
\`\`\`json
{
  "success": false,
  "alternatives": {
    "recommendation": {
      "title": "빈 시간대 추천",
      "description": "참여자 대부분이 가능한 최적의 대체 시간대를 제안합니다.",
      "details": { "startTime": "YYYY-MM-DDTHH:mm:ss.sssZ", "endTime": "YYYY-MM-DDTHH:mm:ss.sssZ", "absentMembers": [{"id": "memberId1", "name": "Member Name 1"}] }
    },
    "concession": {
      "title": "양보 요청",
      "description": "한 명만 불가능한 시간대를 찾아 해당 멤버에게 양보를 요청하는 안입니다.",
      "details": { "startTime": "YYYY-MM-DDTHH:mm:ss.sssZ", "endTime": "YYYY-MM-DDTHH:mm:ss.sssZ", "conflictingMember": {"id": "memberId2", "name": "Member Name 2"} }
    },
    "supplement": {
      "title": "보충 제안",
      "description": "이번 주에 일정을 잡기 어려우니, 다음 주 중 모두가 가능한 시간을 제안합니다.",
      "details": { "startTime": "YYYY-MM-DDTHH:mm:ss.sssZ", "endTime": "YYYY-MM-DDTHH:mm:ss.sssZ" }
    }
  }
}
\`\`\`

Important Instructions:
- All output dates must be in UTC ISO 8601 format.
- The meeting must fit entirely within a single availability block for each participant.
- If no common slots are found, creatively generate the three alternatives as described.
- Only return JSON without any extra text or markdown.
`;

      // AI 호출
      const result = await model.generateContent(prompt);
      const text = await result.text();

      // JSON 정리
      const jsonText = text
         .replace(/```json/g, '')
         .replace(/```/g, '')
         .trim();
      return JSON.parse(jsonText);
   } catch (error) {
      console.error('Error calling Gemini API:', error);
      throw new Error('Failed to analyze schedules with AI.');
   }
}

module.exports = { findOptimalSlots };
