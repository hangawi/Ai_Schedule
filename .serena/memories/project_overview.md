# AI Schedule Project Overview

## Purpose
Group chat-based AI scheduling system. Users coordinate meeting times through chat, AI detects consensus and proposes schedules.

## Tech Stack
- **Frontend**: React + Tailwind CSS (client/)
- **Backend**: Express.js + MongoDB (server/)
- **AI**: LLM-centric (Korean prompts), Gemini 2.0 Flash for OCR
- **Auth**: JWT + Google OAuth
- **Calendar**: FullCalendar, Google Calendar integration

## Key Commands
- `npm run dev` - Run both server and client in dev mode
- `npm run server:dev` - Server only (nodemon)
- `npm run client:dev` - Client only (React dev server)
- `npm run build` - Build client for production

## Project Structure
```
client/src/
  components/mobile/ - Mobile views (MobileCalendarView, BottomNavigation)
  hooks/useChat/ - Chat hooks (enhanced.js, handlers/, hooks/, prompts/, utils/)
server/
  controllers/ - API controllers (event, chat, user, ocr, auth, room)
  models/ - MongoDB models (event, user, room, ScheduleSuggestion)
  services/ - Business logic (aiScheduleService, preferenceService, confirmScheduleService)
  prompts/ - AI prompt templates
  routes/ - Express routes
```

## Architecture
- All users use DB as primary data source
- Google Calendar is auxiliary display only (green events)
- No isGoogleUser branching in code paths
- LLM handles dates, times, locations, consensus
- tabType always 'local', context always 'profile'

## Platform
- Windows development environment
- Git for version control
- Commands: git, npm, node (Windows versions)
