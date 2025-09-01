const { google } = require('googleapis');
const User = require('../models/user');

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
    console.error('Access Token 갱신 실패:', error.message);
    throw new Error('Access Token 갱신에 실패했습니다. 다시 로그인해주세요.');
  }
};

exports.getCalendarEvents = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
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
    console.error('캘린더 이벤트 가져오기 오류:', error);
    res.status(500).json({ msg: '캘린더 이벤트를 가져오는 데 실패했습니다.' });
  }
};

exports.createGoogleCalendarEvent = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
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
    console.error('Google 캘린더 이벤트 생성 오류:', error);
    res.status(500).json({ msg: 'Google 캘린더 이벤트를 생성하는 데 실패했습니다.' });
  }
};

exports.deleteGoogleCalendarEvent = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
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
    console.error('Google 캘린더 이벤트 삭제 오류:', error.message, error.stack);
    res.status(500).json({ msg: 'Google 캘린더 이벤트를 삭제하는 데 실패했습니다.', error: error.message });
  }
};

exports.updateGoogleCalendarEvent = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
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
    console.error('Google 캘린더 이벤트 업데이트 오류:', error);
    if (error.response && error.response.data && error.response.data.error && error.response.data.error.errors) {
      console.error('Google API 상세 오류:', error.response.data.error.errors);
    }
    res.status(500).json({ msg: 'Google 캘린더 이벤트를 업데이트하는 데 실패했습니다.', error: error.message });
  }
};