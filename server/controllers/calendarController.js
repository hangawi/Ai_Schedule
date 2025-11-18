const { google } = require('googleapis');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const User = require('../models/user');
const multer = require('multer');

// Gemini AI 초기화
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Access Token 갱신 함수
const updateAccessToken = async (user) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: user.google.refreshToken,
  });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    user.google.accessToken = credentials.access_token;
    if (credentials.refresh_token) {
      user.google.refreshToken = credentials.refresh_token;
    }
    await user.save();
    return oauth2Client;
  } catch (error) {
    throw new Error('Access Token 갱신에 실패했습니다. 다시 로그인해주세요.');
  }
};

exports.getCalendarEvents = async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user.id });
    if (!user || !user.google || !user.google.accessToken) {
      return res.status(401).json({ msg: 'Google 계정이 연결되지 않았거나 토큰이 없습니다.' });
    }

    let oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: user.google.accessToken });

    // Access Token 만료 확인 및 갱신
    if (oauth2Client.isTokenExpiring()) {
      oauth2Client = await updateAccessToken(user);
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const { timeMin, timeMax } = req.query;

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin || (new Date()).toISOString(),
      timeMax: timeMax,
      maxResults: 250,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items;
    res.json(events);

  } catch (error) {
    res.status(500).json({ msg: '캘린더 이벤트를 가져오는 데 실패했습니다.' });
  }
};

exports.createGoogleCalendarEvent = async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user.id });
    if (!user || !user.google || !user.google.accessToken) {
      return res.status(401).json({ msg: 'Google 계정이 연결되지 않았거나 토큰이 없습니다.' });
    }

    let oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: user.google.accessToken });

    // Access Token 만료 확인 및 갱신
    if (oauth2Client.isTokenExpiring()) {
      oauth2Client = await updateAccessToken(user);
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const { title, description, startDateTime, endDateTime } = req.body;

    const event = {
      summary: title,
      description: description,
      start: {
        dateTime: startDateTime,
        timeZone: 'Asia/Seoul', // 또는 사용자의 타임존
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'Asia/Seoul', // 또는 사용자의 타임존
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    res.status(201).json(response.data);

  } catch (error) {
    res.status(500).json({ msg: 'Google 캘린더 이벤트를 생성하는 데 실패했습니다.' });
  }
};

exports.deleteGoogleCalendarEvent = async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user.id });
    if (!user || !user.google || !user.google.accessToken) {
      return res.status(401).json({ msg: 'Google 계정이 연결되지 않았거나 토큰이 없습니다.' });
    }

    let oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: user.google.accessToken });

    // Access Token 만료 확인 및 갱신
    if (oauth2Client.isTokenExpiring()) {
      oauth2Client = await updateAccessToken(user);
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const { eventId } = req.params;

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
    });

    res.status(204).json({ msg: '이벤트가 성공적으로 삭제되었습니다.' });

  } catch (error) {
    res.status(500).json({ msg: 'Google 캘린더 이벤트를 삭제하는 데 실패했습니다.', error: error.message });
  }
};

exports.updateGoogleCalendarEvent = async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user.id });
    if (!user || !user.google || !user.google.accessToken) {
      return res.status(401).json({ msg: 'Google 계정이 연결되지 않았거나 토큰이 없습니다.' });
    }

    let oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: user.google.accessToken });

    // Access Token 만료 확인 및 갱신
    if (oauth2Client.isTokenExpiring()) {
      oauth2Client = await updateAccessToken(user);
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const { eventId } = req.params;
    const { title, description, startDateTime, endDateTime, etag } = req.body;

    // 시작 시간과 종료 시간 유효성 검사
    if (new Date(startDateTime) >= new Date(endDateTime)) {
      return res.status(400).json({ msg: '종료 시간은 시작 시간보다 늦어야 합니다.' });
    }

    const event = {
      summary: title,
      description: description,
      start: {
        dateTime: startDateTime,
        timeZone: 'Asia/Seoul',
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'Asia/Seoul',
      },
    };

    const response = await calendar.events.update({
      calendarId: 'primary',
      eventId: eventId,
      resource: event,
      headers: { 'If-Match': etag }, // etag를 If-Match 헤더로 전송
    });

    res.status(200).json(response.data);

  } catch (error) {
    if (error.response && error.response.data && error.response.data.error && error.response.data.error.errors) {
    }
    res.status(500).json({ msg: 'Google 캘린더 이벤트를 업데이트하는 데 실패했습니다.', error: error.message });
  }
};

// 이미지에서 스케줄 정보 추출
exports.analyzeImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '이미지 파일이 업로드되지 않았습니다.'
      });
    }

    // Gemini Vision 모델 가져오기
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // 이미지를 Base64로 변환
    const imageBase64 = req.file.buffer.toString('base64');

    // 현재 날짜 정보 생성
    const today = new Date();
    const currentDate = today.toISOString().split('T')[0];
    const currentDay = today.getDay(); // 0=일요일, 1=월요일, ...

    // 이번 주 월요일부터 금요일까지의 날짜 계산
    const getThisWeekDates = (today) => {
      const dates = {};
      const daysOfWeek = ['월', '화', '수', '목', '금'];

      // 한국 시간대로 현재 날짜 계산
      const koreaDate = new Date(today.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));

      // 이번 주 월요일 찾기
      const thisMonday = new Date(koreaDate);
      const dayOfWeek = koreaDate.getDay(); // 0=일요일, 1=월요일, ...
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 일요일인 경우 지난 주 월요일로
      thisMonday.setDate(koreaDate.getDate() - daysFromMonday);

      daysOfWeek.forEach((day, index) => {
        const date = new Date(thisMonday);
        date.setDate(thisMonday.getDate() + index);
        // 한국 시간대 기준으로 YYYY-MM-DD 형식 생성
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const dayStr = String(date.getDate()).padStart(2, '0');
        dates[day] = `${year}-${month}-${dayStr}`;
      });

      return dates;
    };

    const weekDates = getThisWeekDates(today);

    // 프롬프트 구성
    const prompt = `
이 이미지에서 학교 시간표나 일정 정보를 추출해주세요. 정확한 JSON 형태로만 반환해주세요.

중요: 응답은 반드시 유효한 JSON 형식이어야 하며, 주석이나 추가 설명 없이 오직 JSON만 반환해주세요.

현재 정보:
- 오늘 날짜: ${currentDate}
- 이번 주 날짜: 월(${weekDates.월}), 화(${weekDates.화}), 수(${weekDates.수}), 목(${weekDates.목}), 금(${weekDates.금})

학교 시간표 인식 규칙:
- 1교시: 09:00-09:50 (50분 수업)
- 2교시: 10:00-10:50
- 3교시: 11:00-11:50
- 4교시: 12:00-12:50
- 5교시: 13:40-14:30 (점심시간 후)
- 6교시: 14:40-15:30
- 7교시: 15:40-16:30
- 8교시: 16:40-17:30

요일별 날짜 매핑:
- 월요일 → ${weekDates.월}
- 화요일 → ${weekDates.화}
- 수요일 → ${weekDates.수}
- 목요일 → ${weekDates.목}
- 금요일 → ${weekDates.금}

반환 형식:
{
  "schedules": [
    {
      "title": "과목명 (예: 수학, 영어, 과학 등)",
      "date": "YYYY-MM-DD",
      "time": "HH:MM-HH:MM",
      "location": "교실",
      "description": "N교시"
    }
  ]
}

처리 예시:
- 이미지에 "월요일 1교시 수학"이 있으면 → title: "수학", date: "${weekDates.월}", time: "09:00-09:50", description: "1교시"
- "화 3교시 영어"가 있으면 → title: "영어", date: "${weekDates.화}", time: "11:00-11:50", description: "3교시"

일반 일정의 경우:
- 시간 범위가 있는 경우: "HH:MM-HH:MM" 형식 사용
- 시간이 없는 경우: "00:00-00:00" 사용

이미지에서 일정을 찾을 수 없는 경우:
{
  "schedules": []
}
`;

    // 이미지와 함께 API 호출
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBase64,
          mimeType: req.file.mimetype
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();

    try {

      // ```json으로 감싸진 JSON 블록 찾기
      let jsonString = '';
      const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonBlockMatch) {
        jsonString = jsonBlockMatch[1];
      } else {
        // 일반 JSON 객체 찾기
        const jsonMatch = text.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          jsonString = jsonMatch[0];
        }
      }

      if (jsonString) {
        // 주석 제거 (// 주석)
        jsonString = jsonString.replace(/\/\/.*$/gm, '');
        // 여러 줄 주석 제거 (/* */ 주석)
        jsonString = jsonString.replace(/\/\*[\s\S]*?\*\//g, '');
        // 마지막 쉼표 제거
        jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');

        const scheduleData = JSON.parse(jsonString);

        if (scheduleData.schedules && scheduleData.schedules.length > 0) {
          // 추출된 스케줄이 있는 경우
          return res.json({
            success: true,
            message: `총 ${scheduleData.schedules.length}개의 일정을 찾았습니다. 이 일정들을 추가하시겠습니까?`,
            extractedSchedules: scheduleData.schedules
          });
        } else {
          // 스케줄을 찾지 못한 경우
          return res.json({
            success: false,
            message: '이미지에서 일정 정보를 찾을 수 없습니다. 다른 이미지를 시도해보시거나 텍스트로 일정을 입력해주세요.'
          });
        }
      } else {
        throw new Error('JSON 형식을 찾을 수 없음');
      }
    } catch (parseError) {

      // JSON 파싱 실패 시 텍스트 응답 처리
      return res.json({
        success: false,
        message: '이미지 분석 중 오류가 발생했습니다. AI 응답을 처리할 수 없습니다. 다시 시도해보세요.'
      });
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      message: '이미지 분석 중 오류가 발생했습니다: ' + error.message
    });
  }
};