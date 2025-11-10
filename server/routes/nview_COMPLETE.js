const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Gemini API 초기화
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

// N-view를 위한 메모리 저장소
const sessions = new Map(); // 학생 세션 저장
const questions = new Map(); // 학생별 문제 저장
const answers = new Map(); // 학생별 답안 저장
const learningHistory = new Map(); // 학생별 학습 이력 저장 (전체 기록)
const dailyQuestions = new Map(); // 오늘의 문제 저장소
const dailyAnswers = new Map(); // 오늘의 답안 저장소

