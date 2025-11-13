import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Sparkles, Clock, Calendar, CheckCircle, AlertTriangle } from 'lucide-react';
import {
  detectConflicts,
  generateOptimizationQuestions,
  generateAutoSchedule,
  optimizeScheduleWithGPT
} from '../../utils/scheduleOptimizer';

/**
 * 스마트 스케줄 최적화 모달
 *
 * 사용자에게 맞춤형 질문을 하고 최적의 스케줄을 자동 생성
 */
const ScheduleOptimizerModal = ({ schedules, onClose, onOptimized }) => {
  const [step, setStep] = useState('intro'); // intro, questions, processing, result
  const [conflicts, setConflicts] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [optimizedResult, setOptimizedResult] = useState(null);
  const [useGPT, setUseGPT] = useState(true);

  useEffect(() => {
    // 충돌 감지
    const detectedConflicts = detectConflicts(schedules);
    setConflicts(detectedConflicts);

    // 질문 생성
    const generatedQuestions = generateOptimizationQuestions(schedules, detectedConflicts);
    setQuestions(generatedQuestions);

  }, [schedules]);

  const handleStart = () => {
    setStep('questions');
  };

  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleNext = () => {
    const currentQuestion = questions[currentQuestionIndex];

    // 필수 질문 체크
    if (currentQuestion.required && !answers[currentQuestion.id]) {
      alert('필수 항목입니다. 답변을 입력해주세요.');
      return;
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      handleOptimize();
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleOptimize = async () => {
    setStep('processing');
    setIsProcessing(true);

    try {
      let result;

      if (useGPT) {
        // GPT 기반 최적화
        result = await optimizeScheduleWithGPT(schedules, conflicts, answers);
      } else {
        // 규칙 기반 최적화
        result = generateAutoSchedule(schedules, answers);
      }

      setOptimizedResult(result);
      setStep('result');
    } catch (error) {
      alert('스케줄 최적화에 실패했습니다. 다시 시도해주세요.');
      setStep('questions');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApply = () => {
    if (optimizedResult && onOptimized) {
      onOptimized(optimizedResult);
    }
    onClose();
  };

  const currentQuestion = questions[currentQuestionIndex];
  const progress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-bold">스마트 스케줄 최적화</h2>
              <p className="text-sm text-purple-100">AI가 최적의 시간표를 만들어드립니다</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* Intro */}
          {step === 'intro' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-bold text-blue-900 mb-3">
                  📊 현재 시간표 분석 결과
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-white rounded-lg p-4">
                    <div className="text-gray-500 mb-1">전체 일정</div>
                    <div className="text-2xl font-bold text-blue-600">{schedules.length}개</div>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <div className="text-gray-500 mb-1">충돌 발생</div>
                    <div className="text-2xl font-bold text-red-600">{conflicts.length}건</div>
                  </div>
                </div>
              </div>

              {conflicts.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-yellow-900 mb-2">
                        시간이 겹치는 일정이 있습니다
                      </h4>
                      <ul className="text-sm text-yellow-800 space-y-1">
                        {conflicts.slice(0, 3).map((conflict, idx) => (
                          <li key={idx}>
                            • {conflict.schedule1.title} ↔ {conflict.schedule2.title}
                          </li>
                        ))}
                        {conflicts.length > 3 && (
                          <li className="text-yellow-600">외 {conflicts.length - 3}건...</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h3 className="font-bold text-lg">💡 최적화 방법</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  몇 가지 질문에 답변해주시면, AI가 다음을 자동으로 처리합니다:
                </p>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>충돌하는 일정 자동 해결</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>하교 시간, 식사 시간, 이동 시간 고려</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>숙제 및 휴식 시간 자동 배치</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>우선순위 기반 최적 스케줄 생성</span>
                  </li>
                </ul>
              </div>

              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="use-gpt"
                  checked={useGPT}
                  onChange={(e) => setUseGPT(e.target.checked)}
                  className="w-4 h-4 text-purple-600"
                />
                <label htmlFor="use-gpt" className="text-sm flex-1">
                  <span className="font-semibold">GPT 기반 스마트 최적화 사용</span>
                  <span className="text-gray-500 block text-xs mt-0.5">
                    더 정교한 분석과 맞춤형 제안을 받을 수 있습니다
                  </span>
                </label>
              </div>

              <button
                onClick={handleStart}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all flex items-center justify-center gap-2"
              >
                시작하기
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Questions */}
          {step === 'questions' && currentQuestion && (
            <div className="space-y-6">
              {/* Progress */}
              <div>
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>질문 {currentQuestionIndex + 1} / {questions.length}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>

              {/* Question */}
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="bg-purple-100 rounded-full p-2">
                    {currentQuestion.category === 'basic' && <Clock className="w-5 h-5 text-purple-600" />}
                    {currentQuestion.category === 'priority' && <Sparkles className="w-5 h-5 text-purple-600" />}
                    {currentQuestion.category === 'preference' && <Calendar className="w-5 h-5 text-purple-600" />}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg mb-2">
                      {currentQuestion.question}
                      {currentQuestion.required && <span className="text-red-500 ml-1">*</span>}
                    </h3>
                    {currentQuestion.helpText && (
                      <p className="text-sm text-gray-500">{currentQuestion.helpText}</p>
                    )}
                  </div>
                </div>

                {/* Answer Input */}
                <div className="mt-4">
                  {renderQuestionInput(currentQuestion, answers[currentQuestion.id], handleAnswerChange)}
                </div>
              </div>

              {/* Navigation */}
              <div className="flex gap-3">
                <button
                  onClick={handlePrev}
                  disabled={currentQuestionIndex === 0}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    currentQuestionIndex === 0
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  이전
                </button>
                <button
                  onClick={handleNext}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all"
                >
                  {currentQuestionIndex === questions.length - 1 ? '최적화 시작' : '다음'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Processing */}
          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
                <Sparkles className="w-8 h-8 text-purple-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  {useGPT ? 'AI가 최적의 스케줄을 생성하고 있습니다...' : '스케줄을 최적화하고 있습니다...'}
                </h3>
                <p className="text-sm text-gray-500">
                  {useGPT ? '잠시만 기다려주세요. GPT가 분석 중입니다.' : '규칙 기반으로 최적화하고 있습니다.'}
                </p>
              </div>
            </div>
          )}

          {/* Result */}
          {step === 'result' && optimizedResult && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                <h3 className="text-xl font-bold text-green-900 mb-2">
                  최적화 완료!
                </h3>
                <p className="text-sm text-green-700">
                  {optimizedResult.conflictsResolved || conflicts.length}건의 충돌이 해결되었습니다
                </p>
              </div>

              {optimizedResult.explanation && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">💡 AI의 설명</h4>
                  <p className="text-sm text-blue-800 whitespace-pre-line">
                    {optimizedResult.explanation}
                  </p>
                </div>
              )}

              {optimizedResult.statistics && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white border rounded-lg p-4 text-center">
                    <div className="text-gray-500 text-sm mb-1">총 수업</div>
                    <div className="text-2xl font-bold text-purple-600">
                      {optimizedResult.statistics.totalClasses}개
                    </div>
                  </div>
                  <div className="bg-white border rounded-lg p-4 text-center">
                    <div className="text-gray-500 text-sm mb-1">주당 시간</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {optimizedResult.statistics.totalHoursPerWeek?.toFixed(1)}시간
                    </div>
                  </div>
                  <div className="bg-white border rounded-lg p-4 text-center">
                    <div className="text-gray-500 text-sm mb-1">일평균</div>
                    <div className="text-2xl font-bold text-green-600">
                      {optimizedResult.statistics.averageHoursPerDay?.toFixed(1)}시간
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleApply}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all flex items-center justify-center gap-2"
              >
                이 스케줄 적용하기
                <CheckCircle className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * 질문 타입에 따른 입력 필드 렌더링
 */
const renderQuestionInput = (question, value, onChange) => {
  switch (question.type) {
    case 'time':
      return (
        <input
          type="time"
          value={value || ''}
          onChange={(e) => onChange(question.id, e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder={question.placeholder}
        />
      );

    case 'number':
      return (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(question.id, e.target.value)}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder={question.placeholder}
            min="0"
          />
          {question.unit && (
            <span className="text-gray-600 font-medium">{question.unit}</span>
          )}
        </div>
      );

    case 'select':
      return (
        <select
          value={value || ''}
          onChange={(e) => onChange(question.id, e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          <option value="">선택해주세요</option>
          {question.options.map((option, idx) => (
            <option key={idx} value={option.value || option}>
              {option.label || option}
            </option>
          ))}
        </select>
      );

    case 'multiselect':
      return (
        <div className="space-y-2">
          {question.options.map((option, idx) => (
            <label
              key={idx}
              className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={(value || []).includes(option)}
                onChange={(e) => {
                  const current = value || [];
                  const updated = e.target.checked
                    ? [...current, option]
                    : current.filter(v => v !== option);
                  onChange(question.id, updated);
                }}
                className="w-4 h-4 text-purple-600"
              />
              <span className="flex-1">{option}</span>
            </label>
          ))}
        </div>
      );

    case 'timerange':
      return (
        <div className="flex items-center gap-3">
          <input
            type="time"
            value={value?.start || ''}
            onChange={(e) => onChange(question.id, { ...value, start: e.target.value })}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <span className="text-gray-500">~</span>
          <input
            type="time"
            value={value?.end || ''}
            onChange={(e) => onChange(question.id, { ...value, end: e.target.value })}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
      );

    case 'ranking':
      // 드래그앤드롭으로 순위 정하기 (간단 버전)
      const selectedSubjects = question.dependsOn ? (value || []) : question.options;
      return (
        <div className="space-y-2">
          {selectedSubjects.map((subject, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg"
            >
              <span className="w-8 h-8 flex items-center justify-center bg-purple-100 text-purple-600 font-bold rounded-full">
                {idx + 1}
              </span>
              <span className="flex-1">{subject}</span>
            </div>
          ))}
          <p className="text-xs text-gray-500 mt-2">
            * 위에서 선택한 순서대로 우선순위가 결정됩니다
          </p>
        </div>
      );

    default:
      return (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(question.id, e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder={question.placeholder}
        />
      );
  }
};

export default ScheduleOptimizerModal;
