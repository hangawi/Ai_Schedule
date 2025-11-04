import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Send, MessageCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import { extractSchedulesFromImages } from '../../utils/ocrUtils';
import ScheduleOptimizationModal from '../modals/ScheduleOptimizationModal';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

/**
 * 시간표 이미지 업로드 + 채팅 필터링 컴포넌트
 *
 * 기능:
 * 1. 이미지 업로드 (기존)
 * 2. 채팅으로 원하는 반 선택 (신규)
 * 3. OCR 분석 후 바로 AI 최적 시간표 모달 띄우기 (신규)
 */
const TimetableUploadWithChat = ({ onSchedulesExtracted, onClose }) => {
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
  const [error, setError] = useState(null);

  // 채팅 관련 상태
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isFilteringChat, setIsFilteringChat] = useState(false);

  // OCR 결과 및 모달
  const [extractedSchedules, setExtractedSchedules] = useState(null);
  const [schedulesByImage, setSchedulesByImage] = useState(null); // 이미지별 스케줄 정보
  const [baseSchedules, setBaseSchedules] = useState(null); // 기본 베이스 스케줄 (학교 시간표)
  const [overallTitle, setOverallTitle] = useState('업로드된 시간표'); // 전체 시간표 제목
  const [filteredSchedules, setFilteredSchedules] = useState(null);
  const [showOptimizationModal, setShowOptimizationModal] = useState(false);
  const [slideDirection, setSlideDirection] = useState('left'); // 'left' or 'right'

  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  // 자동 스크롤
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  // 이미지 선택
  const handleImageSelect = (event) => {
    const files = Array.from(event.target.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      setError('이미지 파일만 업로드 가능합니다.');
      return;
    }

    if (imageFiles.length > 10) {
      setError('최대 10개의 이미지만 업로드 가능합니다.');
      return;
    }

    setSelectedImages(imageFiles);
    setError(null);

    // 미리보기 생성
    const previews = [];
    imageFiles.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        previews.push({
          id: index,
          url: e.target.result,
          name: file.name
        });

        if (previews.length === imageFiles.length) {
          setImagePreviews(previews);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index) => {
    const newImages = selectedImages.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    setSelectedImages(newImages);
    setImagePreviews(newPreviews);
  };

  // OCR 처리
  const handleProcessImages = async () => {
    if (selectedImages.length === 0) {
      setError('최소 1개 이상의 이미지를 선택해주세요.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProgress({ current: 0, total: selectedImages.length, message: '준비 중...' });

    try {
      console.log('🔄 OCR 처리 시작...', selectedImages.length, '개 이미지');

      // OCR 처리
      setProgress({ current: 0, total: 100, message: `이미지 ${selectedImages.length}개 분석 중...` });

      const result = await extractSchedulesFromImages(selectedImages, (progressPercent) => {
        setProgress({ current: progressPercent, total: 100, message: `분석 중... ${progressPercent}%` });
      });

      console.log('✅ OCR 완료. 추출된 스케줄:', result.schedules.length, '개');

      setExtractedSchedules(result.schedules);
      setSchedulesByImage(result.schedulesByImage); // 이미지별 정보 저장

      // 기본 베이스 스케줄 저장 (서버에서 분석된 것)
      if (result.baseSchedules && result.baseSchedules.length > 0) {
        console.log('📚 기본 베이스 스케줄:', result.baseSchedules.length, '개');
        setBaseSchedules(result.baseSchedules);
      }

      // 전체 제목 저장 (서버에서 생성된 것)
      if (result.overallTitle) {
        console.log('📋 전체 제목:', result.overallTitle);
        setOverallTitle(result.overallTitle);
      }

      setProgress({ current: 100, total: 100, message: 'OCR 분석 완료!' });

      // 이미지별로 반 목록 구성
      let classListByImage = '';
      if (result.schedulesByImage && result.schedulesByImage.length > 0) {
        classListByImage = result.schedulesByImage.map((imageResult, idx) => {
          const classNames = [...new Set(imageResult.schedules.map(s => s.title))];
          const classList = classNames.map((name, i) => `  ${i + 1}. ${name}`).join('\n');
          // 생성된 제목이 있으면 사용, 없으면 기본 형식
          const imageTitle = imageResult.title || `이미지 ${idx + 1}`;
          return `📸 ${imageTitle} (${imageResult.fileName}):\n${classList}`;
        }).join('\n\n');
      } else {
        // 이미지별 정보 없으면 전체 목록으로
        const classNames = [...new Set(result.schedules.map(s => s.title))];
        classListByImage = classNames.map((name, idx) => `${idx + 1}. ${name}`).join('\n');
      }

      // 동적 예시 생성 (실제 추출된 반 이름 기반)
      let exampleTexts = [];
      if (result.schedulesByImage && result.schedulesByImage.length > 0) {
        // 첫 번째 이미지에서 2-3개 반 이름 추출
        const firstImageClasses = [...new Set(result.schedulesByImage[0].schedules.map(s => s.title))];
        if (firstImageClasses.length >= 1) {
          exampleTexts.push(`"${firstImageClasses[0]}만 할거야"`);
        }
        if (firstImageClasses.length >= 2) {
          exampleTexts.push(`"${firstImageClasses[1]} 반 하고 싶어요"`);
        }
        // 빈도 정보가 있으면 추가
        const hasFrequency = firstImageClasses.some(c => c.includes('주') && (c.includes('회') || c.includes('일')));
        if (hasFrequency) {
          exampleTexts.push(`"주5회만"`);
        } else {
          exampleTexts.push(`"월수금만"`);
        }
      } else {
        exampleTexts = ['"1학년만"', '"오전만"', '"월수금만"'];
      }

      const exampleText = exampleTexts.join(', ');

      // 채팅 히스토리에 봇 메시지 추가
      const botMessage = {
        id: Date.now(),
        sender: 'bot',
        text: `시간표 이미지를 분석했어요! 총 ${result.schedules.length}개의 수업을 찾았습니다.\n\n📋 발견된 반 목록:\n${classListByImage}\n\n어떤 수업을 추가하고 싶으세요?\n예: ${exampleText}`,
        timestamp: new Date()
      };

      setChatHistory([botMessage]);

    } catch (err) {
      console.error('❌ OCR 처리 실패:', err);
      setError(err.message || 'OCR 처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 채팅 메시지 전송
  const handleSendChat = async () => {
    if (!chatMessage.trim() || !extractedSchedules) {
      return;
    }

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text: chatMessage,
      timestamp: new Date()
    };

    setChatHistory(prev => [...prev, userMessage]);
    const currentMessage = chatMessage;
    setChatMessage('');
    setIsFilteringChat(true);

    // 새로운 필터링 시작 - 모달 닫기
    if (showOptimizationModal) {
      setShowOptimizationModal(false);
    }

    try {
      const token = localStorage.getItem('token');

      console.log('📤 전송 데이터:', {
        chatMessage: currentMessage,
        extractedSchedulesCount: extractedSchedules?.length,
        schedulesByImageCount: schedulesByImage?.length,
        baseSchedulesCount: baseSchedules?.length,
        baseSchedules: baseSchedules?.slice(0, 3) // 처음 3개만 출력
      });

      const response = await fetch(`${API_BASE_URL}/api/ocr-chat/filter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({
          chatMessage: currentMessage,
          extractedSchedules: extractedSchedules,
          schedulesByImage: schedulesByImage, // 이미지별 정보 추가
          baseSchedules: baseSchedules, // 기본 베이스 스케줄 추가 (학교 시간표)
          imageDescription: `이미지 ${selectedImages.length}개에서 추출된 시간표`
        })
      });

      const data = await response.json();

      console.log('📥 서버 응답 받음:', {
        success: data.success,
        action: data.action,
        hasFilteredSchedules: !!data.filteredSchedules,
        filteredSchedulesType: data.filteredSchedules ? (Array.isArray(data.filteredSchedules) ? 'array' : typeof data.filteredSchedules) : 'undefined',
        filteredSchedulesLength: data.filteredSchedules?.length
      });

      if (!data.success) {
        throw new Error(data.error || '필터링 실패');
      }

      console.log('✅ 채팅 필터링 완료:', data);

      const botMessage = {
        id: Date.now() + 1,
        sender: 'bot',
        text: data.explanation,
        timestamp: new Date()
      };

      setChatHistory(prev => [...prev, botMessage]);

      // action === "filter"면 바로 모달 띄우기
      if (data.action === 'filter' && data.filteredSchedules && data.filteredSchedules.length > 0) {
        console.log('📋 필터링된 스케줄:', data.filteredSchedules.length, '개');
        console.log('첫 번째 스케줄:', data.filteredSchedules[0]);
        console.log('마지막 스케줄:', data.filteredSchedules[data.filteredSchedules.length - 1]);

        // 모든 필터링된 스케줄 출력
        console.log('📋 필터링된 모든 스케줄:');
        data.filteredSchedules.forEach((schedule, idx) => {
          console.log(`  [${idx}] ${schedule.title} - days: ${schedule.days ? JSON.stringify(schedule.days) : 'NONE'} - ${schedule.startTime}-${schedule.endTime} - sourceImageIndex: ${schedule.sourceImageIndex}`);
        });

        // days 필드 검증
        const schedulesWithoutDays = data.filteredSchedules.filter(s => !s.days || s.days.length === 0);
        if (schedulesWithoutDays.length > 0) {
          console.warn('⚠️ days가 없는 스케줄:', schedulesWithoutDays);
        }

        console.log('🔄 filteredSchedules 업데이트:', data.filteredSchedules.length, '개');
        console.log('첫 3개 수업:', data.filteredSchedules.slice(0, 3).map(s => s.title));
        setFilteredSchedules(data.filteredSchedules);

        // 모달 띄우기 (왼쪽으로 슬라이드)
        setSlideDirection('left');
        setTimeout(() => {
          console.log('✅ 모달 열기 - 현재 filteredSchedules:', filteredSchedules?.length);
          setShowOptimizationModal(true);
        }, 50);
      } else if (data.action === 'filter' && (!data.filteredSchedules || data.filteredSchedules.length === 0)) {
        console.warn('⚠️ 필터링된 스케줄이 없습니다');
        const warningMessage = {
          id: Date.now() + 2,
          sender: 'bot',
          text: '필터링된 수업이 없습니다. 다른 조건으로 다시 시도해주세요.',
          timestamp: new Date()
        };
        setChatHistory(prev => [...prev, warningMessage]);
      }

    } catch (err) {
      console.error('❌ 채팅 필터링 실패:', err);

      const errorMessage = {
        id: Date.now() + 1,
        sender: 'bot',
        text: '채팅 처리 중 오류가 발생했습니다. 다시 시도해주세요.',
        timestamp: new Date()
      };

      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsFilteringChat(false);
    }
  };

  // 모달에서 최종 적용
  const handleSchedulesApplied = (appliedSchedules, applyScope = 'month') => {
    console.log('✅ 시간표 적용 완료:', appliedSchedules.length, '개', '범위:', applyScope);
    setShowOptimizationModal(false);

    // 부모 컴포넌트에 전달 - 올바른 형식으로
    if (onSchedulesExtracted) {
      // 색상 제거 (개인시간은 자주색으로 표시되어야 함)
      const schedulesWithoutColor = appliedSchedules.map(s => {
        const { color, sourceImageIndex, sourceImage, ...rest } = s;
        return rest;
      });

      onSchedulesExtracted({
        type: 'schedule_selected',
        schedules: schedulesWithoutColor,
        applyScope: applyScope, // 적용 범위 추가
        data: {
          schedules: schedulesWithoutColor,
          conflicts: [],
          age: null,
          gradeLevel: null
        }
      });
    }

    // 완료 메시지
    const finalMessage = {
      id: Date.now(),
      sender: 'bot',
      text: '시간표 입력 완료!',
      timestamp: new Date()
    };

    setChatHistory(prev => [...prev, finalMessage]);

    // 2초 후 닫기
    setTimeout(() => {
      if (onClose) {
        onClose();
      }
    }, 2000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full" style={{ height: '80vh', maxHeight: '80vh', maxWidth: '1200px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* 헤더 */}
        <div className="flex justify-between items-center p-4 border-b" style={{ flexShrink: 0 }}>
          <div className="flex items-center gap-3">
            {showOptimizationModal && (
              <button
                onClick={() => setShowOptimizationModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                title="뒤로 가기"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <h2 className="text-xl font-bold">{showOptimizationModal ? '최적 시간표 추천' : '시간표 이미지 업로드'}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            disabled={isProcessing || isFilteringChat}
          >
            <X size={20} />
          </button>
        </div>

          {/* 내용 */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
            {/* 왼쪽: 이미지 업로드 */}
            <div
              className="w-1/2 border-r"
              style={{
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                position: 'absolute',
                left: showOptimizationModal ? '-50%' : '0',
                top: 0,
                bottom: 0,
                transition: 'left 0.3s ease-in-out'
              }}>
              <div className="p-4 flex-1" style={{ overflowY: 'auto' }}>
                <div className="space-y-4">
                  {/* 파일 선택 */}
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isProcessing}
                      className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Upload className="mx-auto mb-2 text-gray-400" size={32} />
                      <p className="text-sm text-gray-600">
                        클릭하여 이미지 선택 (최대 10개)
                      </p>
                    </button>
                  </div>

                  {/* 이미지 미리보기 */}
                  {imagePreviews.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-semibold text-sm">선택된 이미지 ({imagePreviews.length}개)</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {imagePreviews.map((preview, index) => (
                          <div key={preview.id} className="relative group">
                            <img
                              src={preview.url}
                              alt={preview.name}
                              className="w-full h-32 object-cover rounded border"
                            />
                            <button
                              onClick={() => removeImage(index)}
                              disabled={isProcessing}
                              className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 진행률 */}
                  {isProcessing && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{progress.message}</span>
                        <span>{progress.current}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress.current}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* 에러 메시지 */}
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                      {error}
                    </div>
                  )}
                </div>
              </div>

              {/* 분석 버튼 - 맨 아래 고정 */}
              {selectedImages.length > 0 && !extractedSchedules && (
                <div className="p-4 border-t bg-white" style={{ flexShrink: 0 }}>
                  <button
                    onClick={handleProcessImages}
                    disabled={isProcessing}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? '분석 중...' : '시간표 분석 시작'}
                  </button>
                </div>
              )}
            </div>

            {/* 오른쪽: 채팅 */}
            <div
              className="w-1/2 bg-gray-50"
              style={{
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                minHeight: 0,
                maxHeight: '100%',
                position: 'absolute',
                left: showOptimizationModal ? '-50%' : '50%',
                top: 0,
                bottom: 0,
                transition: 'left 0.3s ease-in-out'
              }}>
              {/* 채팅 메시지 영역 */}
              <div className="p-4 bg-gray-50" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                {chatHistory.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <MessageCircle size={48} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">이미지를 분석하면 채팅이 시작됩니다</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {chatHistory.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] px-4 py-2 rounded-lg ${
                            msg.sender === 'user'
                              ? 'bg-blue-600 text-white'
                              : 'bg-white border border-gray-200'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                        </div>
                      </div>
                    ))}
                    {isFilteringChat && (
                      <div className="flex justify-start">
                        <div className="bg-white border border-gray-200 px-4 py-2 rounded-lg">
                          <p className="text-sm text-gray-500">생각 중...</p>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </div>

              {/* 채팅 입력 */}
              <div className="p-4 border-t bg-white" style={{ flexShrink: 0 }}>
                {/* 다음으로 버튼 */}
                {filteredSchedules && !showOptimizationModal && (
                  <div className="mb-2">
                    <button
                      onClick={() => {
                        setSlideDirection('left');
                        setTimeout(() => setShowOptimizationModal(true), 50);
                      }}
                      className="w-full px-3 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                      최적 시간표 보기
                      <ArrowRight size={16} />
                    </button>
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                    disabled={!extractedSchedules || isFilteringChat}
                    placeholder={extractedSchedules ? "예: 공연반만 할거야" : "먼저 이미지를 분석해주세요"}
                    className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  <button
                    onClick={handleSendChat}
                    disabled={!extractedSchedules || !chatMessage.trim() || isFilteringChat}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </div>

            {/* 최적 시간표 패널 - 슬라이드 */}
            {filteredSchedules && (
              <div
                style={{
                  position: 'absolute',
                  left: showOptimizationModal ? '0' : '100%',
                  top: 0,
                  width: '100%',
                  height: '100%',
                  transition: 'left 0.3s ease-in-out',
                  backgroundColor: 'white'
                }}
              >
                <ScheduleOptimizationModal
                  key={JSON.stringify(filteredSchedules.map(s => s.title + s.startTime))}
                  initialSchedules={filteredSchedules}
                  schedulesByImage={schedulesByImage}
                  overallTitle={overallTitle}
                  onClose={() => setShowOptimizationModal(false)}
                  onSchedulesApplied={handleSchedulesApplied}
                  isEmbedded={true}
                />
              </div>
            )}
          </div>
        </div>
      </div>
  );
};

export default TimetableUploadWithChat;
