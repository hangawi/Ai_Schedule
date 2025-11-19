import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Send, MessageCircle, ArrowLeft, ArrowRight, Calendar } from 'lucide-react';
import { extractSchedulesFromImages } from '../../utils/ocrUtils';
import ScheduleOptimizationModal from '../modals/ScheduleOptimizationModal';
import { auth } from '../../config/firebaseConfig';

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

  // 대화형 추천 상태
  const [userProfile, setUserProfile] = useState({}); // 나이, 학년 등
  const [conversationHistory, setConversationHistory] = useState([]); // AI용 대화 히스토리

  // 시간표 히스토리 및 롤백 기능 (ScheduleOptimizationModal과 동일)
  const [originalSchedule, setOriginalSchedule] = useState(null); // 맨 처음 원본
  const [scheduleHistory, setScheduleHistory] = useState([]); // 단계별 히스토리
  const [redoStack, setRedoStack] = useState([]); // Redo 스택

  // OCR 결과 및 모달
  const [extractedSchedules, setExtractedSchedules] = useState(null);
  const [schedulesByImage, setSchedulesByImage] = useState(null); // 이미지별 스케줄 정보
  const [baseSchedules, setBaseSchedules] = useState(null); // 기본 베이스 스케줄 (학교 시간표)
  const [overallTitle, setOverallTitle] = useState('업로드된 시간표'); // 전체 시간표 제목
  const [filteredSchedules, setFilteredSchedules] = useState(null);
  const [fixedSchedules, setFixedSchedules] = useState([]); // 고정 일정 (최우선)
  const [customSchedulesForLegend, setCustomSchedulesForLegend] = useState([]); // ⭐ 커스텀 일정 범례용
  const [showOptimizationModal, setShowOptimizationModal] = useState(false);
  const [slideDirection, setSlideDirection] = useState('left'); // 'left' or 'right'

  // 중복 감지 상태
  const [duplicateInfo, setDuplicateInfo] = useState(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

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
  const handleProcessImages = async (skipDuplicateCheck = false) => {

    if (selectedImages.length === 0) {
      setError('최소 1개 이상의 이미지를 선택해주세요.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProgress({ current: 0, total: selectedImages.length, message: '준비 중...' });

    try {

      // OCR 처리
      setProgress({ current: 0, total: 100, message: `이미지 ${selectedImages.length}개 분석 중...` });

      const result = await extractSchedulesFromImages(selectedImages, (progressPercent) => {
        setProgress({ current: progressPercent, total: 100, message: `분석 중... ${progressPercent}%` });
      }, null, skipDuplicateCheck);
      // 🔍 중복 감지 처리
      if (result.hasDuplicates && result.duplicates && result.duplicates.length > 0) {
        setDuplicateInfo(result);
        setShowDuplicateModal(true);
        setIsProcessing(false);
        return; // OCR 처리 중단
      }

      // ⭐ 최적화된 스케줄 사용
      const schedulesToUse = result.optimizedSchedules || result.schedules;

      setExtractedSchedules(schedulesToUse);

      // ⭐ schedulesByImage도 최적화된 스케줄에 맞게 필터링
      const selectedImageNames = [...new Set(schedulesToUse.map(s => s.sourceImage))];
      let filteredSchedulesByImage = result.schedulesByImage.filter(img =>
        selectedImageNames.includes(img.fileName)
      );

      // ⭐ 실제로 선택된 스케줄이 있는 이미지만 유지 (나이 필터링으로 비어있을 수 있음)
      const imagesWithSchedules = filteredSchedulesByImage.filter(img => {
        const imageSchedules = schedulesToUse.filter(s => s.sourceImage === img.fileName);
        const hasSchedules = imageSchedules.length > 0;
        if (!hasSchedules) {
        }
        return hasSchedules;
      });

      filteredSchedulesByImage = imagesWithSchedules;

      // ⭐ sourceImageIndex 재할당 (필터링으로 인한 색상 인덱스 불일치 방지)
      const reindexedSchedulesByImage = filteredSchedulesByImage.map((img, newIndex) => {
        return {
          ...img,
          schedules: img.schedules.map(schedule => ({
            ...schedule,
            sourceImageIndex: newIndex  // ⭐ 새로운 인덱스로 재할당
          }))
        };
      });

      // schedulesToUse의 sourceImageIndex도 재할당
      const imageNameToNewIndex = {};
      filteredSchedulesByImage.forEach((img, newIndex) => {
        imageNameToNewIndex[img.fileName] = newIndex;
      });

      const reindexedSchedulesToUse = schedulesToUse.map(schedule => ({
        ...schedule,
        sourceImageIndex: imageNameToNewIndex[schedule.sourceImage]
      }));

      setSchedulesByImage(reindexedSchedulesByImage);
      setExtractedSchedules(reindexedSchedulesToUse);  // ⭐ 재할당된 인덱스로 업데이트

      // ⭐ 원본 전체 시간표 저장 (OCR 추출된 모든 스케줄)
      if (!originalSchedule && result.allSchedules) {
        setOriginalSchedule(JSON.parse(JSON.stringify(result.allSchedules)));
      }

      // 기본 베이스 스케줄 저장 (서버에서 분석된 것)
      if (result.baseSchedules && result.baseSchedules.length > 0) {
        setBaseSchedules(result.baseSchedules);
      }

      // 전체 제목 저장 (서버에서 생성된 것 - 필터링된 이미지 기반)
      if (reindexedSchedulesByImage.length > 0) {
        const titles = reindexedSchedulesByImage.map(img => img.title || img.fileName).filter(Boolean);
        const newOverallTitle = titles.join(' + ') || '업로드된 시간표';
        setOverallTitle(newOverallTitle);
      }

      setFilteredSchedules(reindexedSchedulesToUse);  // ⭐ 수정!

      setProgress({ current: 100, total: 100, message: 'OCR 분석 완료!' });

      // ⭐ 필터링된 이미지 정보 추가 (나이 제한으로 제외된 이미지)
      const removedImages = result.schedulesByImage.filter(img =>
        !imagesWithSchedules.some(kept => kept.fileName === img.fileName)
      );

      // 이미지별로 반 목록 구성 (필터링된 이미지만 사용)
      let classListByImage = '';
      if (reindexedSchedulesByImage && reindexedSchedulesByImage.length > 0) {
        classListByImage = reindexedSchedulesByImage.map((imageResult, idx) => {
          const classNames = [...new Set(imageResult.schedules.map(s => s.title))];
          const classList = classNames.map((name, i) => `  ${i + 1}. ${name}`).join('\n');
          // 생성된 제목이 있으면 사용, 없으면 기본 형식
          const imageTitle = imageResult.title || `이미지 ${idx + 1}`;
          return `📸 ${imageTitle} (${imageResult.fileName}):\n${classList}`;
        }).join('\n\n');

        // 나이 제한으로 제외된 이미지 정보 추가
        if (removedImages.length > 0) {
          const removedList = removedImages.map(img =>
            `  ⚠️ ${img.title || img.fileName} - 학생 나이에 맞지 않아 제외됨`
          ).join('\n');
          classListByImage += `\n\n🚫 **제외된 이미지**:\n${removedList}`;
        }
      } else {
        // 이미지별 정보 없으면 전체 목록으로
        const classNames = [...new Set(result.schedules.map(s => s.title))];
        classListByImage = classNames.map((name, idx) => `${idx + 1}. ${name}`).join('\n');
      }

      // 동적 예시 생성 (실제 추출된 반 이름 기반) - 필터링된 이미지 사용
      let exampleTexts = [];
      if (reindexedSchedulesByImage && reindexedSchedulesByImage.length > 0) {
        // 첫 번째 이미지에서 2-3개 반 이름 추출
        const firstImageClasses = [...new Set(reindexedSchedulesByImage[0].schedules.map(s => s.title))];
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
        text: `시간표 이미지를 분석했어요! 총 ${result.schedules.length}개의 수업을 찾았고, 그중 ${schedulesToUse.length}개를 선택했습니다.\n\n📋 발견된 반 목록:\n${classListByImage}\n\n어떤 수업을 추가하고 싶으세요?\n예: ${exampleText}`,
        timestamp: new Date()
      };

      setChatHistory([botMessage]);

    } catch (err) {
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
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setChatHistory(prev => [...prev, { id: Date.now(), sender: 'bot', text: '로그인이 필요합니다.', timestamp: new Date() }]);
        setIsFilteringChat(false);
        return;
      }
      const idToken = await currentUser.getIdToken();

      // ⭐ 고정 일정 관련 요청인지 먼저 확인
      const fixedScheduleResponse = await fetch(`${API_BASE_URL}/api/schedule/fixed-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          message: currentMessage,
          currentSchedules: extractedSchedules,
          schedulesByImage: schedulesByImage,
          fixedSchedules: fixedSchedules
        })
      });

      const fixedData = await fixedScheduleResponse.json();
      // 고정 일정 관련 요청이면 처리하고 리턴
      // ⭐ optimizedSchedule이 있거나, action이 있거나, intent가 있으면 고정 일정 API가 처리한 것
      if ((fixedData.intent && fixedData.intent !== 'none') || fixedData.optimizedSchedule || fixedData.action) {
        // 고정 일정 관련 요청임 (성공 여부와 무관하게)

        // ⭐ 여러 개 발견 시 사용자 선택 요청 (action: 'move_multiple_found')
        if (fixedData.action === 'move_multiple_found' && fixedData.options) {
          const botMessage = {
            id: Date.now() + 1,
            sender: 'bot',
            text: fixedData.explanation || fixedData.message || '여러 일정이 발견되었습니다.',
            timestamp: new Date()
          };
          setChatHistory(prev => [...prev, botMessage]);
          setIsFilteringChat(false);
          return;
        }

        // 실패한 경우 메시지만 표시하고 종료
        if (!fixedData.success || (!fixedData.action && !fixedData.optimizedSchedule)) {
          const botMessage = {
            id: Date.now() + 1,
            sender: 'bot',
            text: fixedData.message || fixedData.explanation || '고정 일정 처리에 실패했습니다.',
            timestamp: new Date()
          };
          setChatHistory(prev => [...prev, botMessage]);
          setIsFilteringChat(false);
          return;
        }

        // 성공한 경우 기존 로직 실행
        let newFixedSchedules = fixedSchedules;

        if (fixedData.action === 'add') {
          // 중복 체크: 같은 title, days, startTime, endTime이 있으면 추가 안 함
          const newSchedules = fixedData.schedules.filter(newSched => {
            return !fixedSchedules.some(existing =>
              existing.title === newSched.title &&
              JSON.stringify(existing.days) === JSON.stringify(newSched.days) &&
              existing.startTime === newSched.startTime &&
              existing.endTime === newSched.endTime
            );
          });

          if (newSchedules.length === 0) {
            setIsFilteringChat(false);
            return;
          }

          newFixedSchedules = [...fixedSchedules, ...newSchedules];
          setFixedSchedules(newFixedSchedules);
        } else if (fixedData.action === 'remove') {
          newFixedSchedules = fixedSchedules.filter(s => !fixedData.scheduleIds.includes(s.id));
          setFixedSchedules(newFixedSchedules);
        }

        // ⭐ 커스텀 일정 범례 업데이트 (fixedData에서)
        if (fixedData.customSchedules && fixedData.customSchedules.length > 0) {
          setCustomSchedulesForLegend(prev => {
            // 중복 제거하면서 병합
            const existingIndices = new Set(prev.map(c => c.sourceImageIndex));
            const newCustoms = fixedData.customSchedules.filter(c => !existingIndices.has(c.sourceImageIndex));
            return [...prev, ...newCustoms];
          });
        }

        // ⭐ 삭제된 일정의 범례 제거
        if (fixedData.titlesToRemoveFromLegend && fixedData.titlesToRemoveFromLegend.length > 0) {
          setCustomSchedulesForLegend(prev =>
            prev.filter(c => !fixedData.titlesToRemoveFromLegend.includes(c.title))
          );
        }

        // 봇 응답 추가
        const botMessage = {
          id: Date.now() + 1,
          sender: 'bot',
          text: fixedData.message,
          timestamp: new Date()
        };
        setChatHistory(prev => [...prev, botMessage]);

        // ⭐ 일정 이동 처리 (이미 최적화됨)
        if (fixedData.optimizedSchedule) {
          setFilteredSchedules(fixedData.optimizedSchedule);

          // 고정 일정 업데이트
          if (fixedData.fixedSchedules) {
            setFixedSchedules(fixedData.fixedSchedules);
          }

          // 모달 띄우기
          setSlideDirection('left');
          setTimeout(() => {
            setShowOptimizationModal(true);
          }, 50);

          setIsFilteringChat(false);
          return;
        }

        // ⭐ 고정 일정 추가/삭제 시 즉시 재최적화 실행
        if (fixedData.action === 'add' || fixedData.action === 'remove') {
          // 재최적화 API 호출
          // ⭐ 첫 고정 일정 추가면 원본, 이후에는 최적화된 결과 사용
          const currentOptimizedSchedules = filteredSchedules || extractedSchedules;

          const reoptimizeResponse = await fetch(`${API_BASE_URL}/api/schedule/optimize`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              schedules: currentOptimizedSchedules, // ⭐ 최적화된 결과 사용
              schedulesByImage: schedulesByImage,
              fixedSchedules: newFixedSchedules // 새로 업데이트된 고정 일정
            })
          });

          const reoptimizeData = await reoptimizeResponse.json();

          if (reoptimizeData.success && Array.isArray(reoptimizeData.optimizedSchedules)) {
            const kpopSchedules = reoptimizeData.optimizedSchedules.filter(s => s.title?.includes('KPOP'));
            setFilteredSchedules(reoptimizeData.optimizedSchedules);

            // ⭐ 커스텀 일정 범례 업데이트 (reoptimizeData에서)
            if (reoptimizeData.customSchedules && reoptimizeData.customSchedules.length > 0) {
              setCustomSchedulesForLegend(prev => {
                // 중복 제거하면서 병합
                const existingIndices = new Set(prev.map(c => c.sourceImageIndex));
                const newCustoms = reoptimizeData.customSchedules.filter(c => !existingIndices.has(c.sourceImageIndex));
                if (newCustoms.length > 0) {
                  return [...prev, ...newCustoms];
                }
                return prev;
              });
            }

            // 모달 띄우기
            setSlideDirection('left');
            setTimeout(() => {
              setShowOptimizationModal(true);
            }, 50);

            // 추가 메시지
            const optimizeMessage = {
              id: Date.now() + 2,
              sender: 'bot',
              text: '✨ 고정 일정을 반영해서 시간표를 다시 최적화했어요!',
              timestamp: new Date()
            };
            setChatHistory(prev => [...prev, optimizeMessage]);
          }
        }

        setIsFilteringChat(false);
        return; // 고정 일정 처리 완료, 일반 채팅 처리 안 함
      }

      // 직전 봇 응답 찾기 (대화 컨텍스트 유지)
      const lastBotMessage = chatHistory
        .slice()
        .reverse()
        .find(msg => msg.sender === 'bot' && !msg.text.includes('💭'));
      const lastAiResponse = lastBotMessage ? lastBotMessage.text : null;

      // ⭐ 통합 API 호출 (/api/schedule/chat)
      const response = await fetch(`${API_BASE_URL}/api/schedule/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          message: currentMessage,
          currentSchedule: extractedSchedules,
          originalSchedule: originalSchedule || extractedSchedules,
          scheduleHistory: scheduleHistory,
          lastAiResponse: lastAiResponse,
          redoStack: redoStack,
          fixedSchedules: fixedSchedules,  // ⭐ 고정 일정 전달
          schedulesByImage: schedulesByImage  // ⭐ 이미지별 스케줄 전달
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '처리 실패');
      }

      // ⭐ 시간표 업데이트 (ScheduleOptimizationModal 로직과 동일)
      if (data.action === 'delete' || data.action === 'add') {
        // 현재 상태를 히스토리에 저장
        setScheduleHistory(prev => [...prev, extractedSchedules]);
        setRedoStack([]);
        setExtractedSchedules(data.schedule);
        setFilteredSchedules(data.schedule);
      } else if (data.action === 'redo') {
        setExtractedSchedules(data.schedule);
        setFilteredSchedules(data.schedule);
        setRedoStack(prev => prev.slice(0, -1));
        setScheduleHistory(prev => [...prev, extractedSchedules]);
      } else if (data.action === 'step_back') {
        setExtractedSchedules(data.schedule);
        setFilteredSchedules(data.schedule);
        setRedoStack(prev => [...prev, extractedSchedules]);
        setScheduleHistory(prev => prev.slice(0, -1));
      } else if (data.action === 'undo') {
        setExtractedSchedules(data.schedule);
        setFilteredSchedules(data.schedule);
        setScheduleHistory([]);
        setFixedSchedules([]); // 고정 일정도 초기화
        setCustomSchedulesForLegend([]); // ⭐ 커스텀 범례도 초기화
      } else if (data.action === 'question') {

      }

      // 🔎 필터링 응답 처리
      else {
        const botMessage = {
          id: Date.now() + 1,
          sender: 'bot',
          text: data.explanation,
          timestamp: new Date()
        };
        setChatHistory(prev => [...prev, botMessage]);

        // action === "filter"면 바로 모달 띄우기
        if (data.action === 'filter' && data.filteredSchedules && data.filteredSchedules.length > 0) {

        // days 필드 검증
        const schedulesWithoutDays = data.filteredSchedules.filter(s => !s.days || s.days.length === 0);
        setFilteredSchedules(data.filteredSchedules);

        // 모달 띄우기 (왼쪽으로 슬라이드)
        setSlideDirection('left');
        setTimeout(() => {
          setShowOptimizationModal(true);
        }, 50);
      } else if (data.action === 'filter' && (!data.filteredSchedules || data.filteredSchedules.length === 0)) {
        const warningMessage = {
          id: Date.now() + 2,
          sender: 'bot',
          text: '필터링된 수업이 없습니다. 다른 조건으로 다시 시도해주세요.',
          timestamp: new Date()
        };
        setChatHistory(prev => [...prev, warningMessage]);
      }
    }

    } catch (err) {

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
      <div className="bg-white rounded-lg" style={{ width: '50vw', height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
            <h2 className="text-xl font-bold">{filteredSchedules ? '최적 시간표' : '시간표 이미지 업로드'}</h2>
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
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
            {/* 분석 전: 업로드 UI만 */}
            {!filteredSchedules ? (
              <div className="w-full" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
                      className="w-full border-2 border-dashed border-gray-300 rounded-lg p-3 hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Upload className="mx-auto mb-1 text-gray-400" size={24} />
                      <p className="text-xs text-gray-600">
                        이미지 선택 (최대 10개)
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

                  {/* 에러 메시지 */}
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                      {error}
                    </div>
                  )}
                </div>
              </div>

              {/* 진행률 + 분석 버튼 */}
              {selectedImages.length > 0 && !extractedSchedules && (
                <div className="border-t bg-white" style={{ flexShrink: 0 }}>
                  {/* 진행률 */}
                  {isProcessing && (
                    <div className="px-4 pt-3 pb-2">
                      <div className="flex justify-between text-sm mb-1">
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

                  {/* 분석 버튼 */}
                  <div className="p-4">
                    <button
                      onClick={() => handleProcessImages()}
                      disabled={isProcessing}
                      className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? '분석 중...' : '시간표 분석 시작'}
                    </button>
                  </div>
                </div>
              )}
              </div>
            ) : (
              /* 분석 후: 왼쪽 시간표 (70%) + 오른쪽 채팅 (30%) */
              <>
                {/* 왼쪽: 시간표 표시 */}
                <div style={{ width: '70%', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid #e5e7eb' }}>
                  <ScheduleOptimizationModal
                    key={filteredSchedules && Array.isArray(filteredSchedules) ? JSON.stringify(filteredSchedules.map(s => s.title + s.startTime)) : 'default'}
                    initialSchedules={filteredSchedules}
                    schedulesByImage={schedulesByImage}
                    fixedSchedules={fixedSchedules}
                    customSchedulesForLegend={customSchedulesForLegend}
                    overallTitle={overallTitle}
                    onClose={null}
                    onSchedulesApplied={handleSchedulesApplied}
                    isEmbedded={true}
                    hideBackButton={true}
                  />
                </div>

                {/* 오른쪽: 채팅 */}
                <div style={{ width: '30%', display: 'flex', flexDirection: 'column', backgroundColor: '#f9fafb' }}>
                  {/* 채팅 메시지 */}
                  <div className="p-3" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                    {chatHistory.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-gray-400">
                        <div className="text-center">
                          <MessageCircle size={32} className="mx-auto mb-2 opacity-50" />
                          <p className="text-xs">채팅으로 필터링</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {chatHistory.map((msg) => (
                          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] px-3 py-1.5 rounded-lg ${msg.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200'}`}>
                              <p className="text-xs whitespace-pre-wrap">{msg.text}</p>
                            </div>
                          </div>
                        ))}
                        {isFilteringChat && (
                          <div className="flex justify-start">
                            <div className="bg-white border border-gray-200 px-3 py-1.5 rounded-lg">
                              <p className="text-xs text-gray-500">생각 중...</p>
                            </div>
                          </div>
                        )}
                        <div ref={chatEndRef} />
                      </div>
                    )}
                  </div>

                  {/* 채팅 입력 */}
                  <div className="p-2 border-t bg-white" style={{ flexShrink: 0 }}>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                        disabled={!extractedSchedules || isFilteringChat}
                        placeholder="예: 공연반만"
                        className="flex-1 px-2 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                      <button
                        onClick={handleSendChat}
                        disabled={!extractedSchedules || !chatMessage.trim() || isFilteringChat}
                        className="px-2 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 중복 이미지 확인 모달 */}
        {showDuplicateModal && duplicateInfo && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" style={{ zIndex: 9999 }}>
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-bold mb-4">⚠️ 중복된 이미지 발견</h3>
              <div className="space-y-3 mb-6">
                <p className="text-gray-700">다음 이미지가 이미 업로드된 이미지와 중복됩니다:</p>
                {duplicateInfo.duplicates.map((dup, idx) => (
                  <div key={idx} className="bg-yellow-50 border border-yellow-200 rounded p-3">
                    <p className="font-semibold text-sm">"{dup.filename}"</p>
                    <p className="text-xs text-gray-600 mt-1">
                      → "{dup.duplicateWith}"와 {dup.similarity}% 유사
                    </p>
                  </div>
                ))}
                <p className="text-sm text-gray-600 mt-4">
                  중복된 이미지를 제거하고 계속하시겠습니까?
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {

                    // 중복된 이미지의 인덱스 추출
                    const duplicateIndices = duplicateInfo.duplicates.map(dup => dup.index);

                    // 중복되지 않은 이미지만 필터링
                    const filteredImages = selectedImages.filter((_, index) => !duplicateIndices.includes(index));
                    const filteredPreviews = imagePreviews.filter((_, index) => !duplicateIndices.includes(index));

                    // 상태 업데이트
                    setSelectedImages(filteredImages);
                    setImagePreviews(filteredPreviews);

                    // 모달 닫기
                    setShowDuplicateModal(false);
                    setDuplicateInfo(null);

                    // 중복 체크 건너뛰고 OCR 처리
                    handleProcessImages(true);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  중복 제거하고 계속
                </button>
                <button
                  onClick={() => {

                    // 모달 닫기
                    setShowDuplicateModal(false);
                    setDuplicateInfo(null);

                    // 중복 체크 건너뛰고 모든 이미지로 OCR 처리
                    handleProcessImages(true);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  중복 무시하고 계속
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
};

export default TimetableUploadWithChat;
