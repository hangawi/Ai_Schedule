import React, { useState, useRef, useEffect } from 'react';
import { Calendar, Clock, X, CheckCircle, AlertTriangle, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { formatWeeklySchedule, summarizeSchedule } from '../../utils/ocrUtils';
import ScheduleGridSelector from '../tabs/ScheduleGridSelector';

const ScheduleOptimizationModal = ({
  combinations,
  onSelect,
  onClose,
  userAge,
  gradeLevel
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [applyScope, setApplyScope] = useState('month'); // 'week' 또는 'month'
  const [modifiedCombinations, setModifiedCombinations] = useState(combinations);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [selectedSchedules, setSelectedSchedules] = useState({}); // 겹치는 일정 선택 상태
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  if (!combinations || combinations.length === 0) {
    return null;
  }

  // 디버그: 조합 확인
  if (currentIndex === 0) {
    console.log('📦 Total combinations:', combinations.length);
    console.log('📦 Combination 0 has', combinations[0]?.length, 'schedules');
  }

  const currentCombination = modifiedCombinations[currentIndex];
  const weeklySchedule = formatWeeklySchedule(currentCombination);

  // ScheduleGridSelector를 위해 personalTimes 형식으로 변환
  const personalTimes = currentCombination.map((schedule, index) => {
    if (!schedule.days || schedule.days.length === 0) return null;

    const dayMap = {
      'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4,
      'FRI': 5, 'SAT': 6, 'SUN': 7
    };

    // days가 배열이 아니면 배열로 변환
    const daysArray = Array.isArray(schedule.days) ? schedule.days : [schedule.days];
    const mappedDays = daysArray.map(day => dayMap[day] || day).filter(d => d);

    return {
      id: Date.now() + index,
      type: 'study',
      days: mappedDays,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      title: schedule.title || '수업',
      color: '#9333ea',
      description: schedule.description || '',
      isRecurring: true
    };
  }).filter(item => item !== null);

  // 월요일 15:00 확인
  const mon15Personal = personalTimes.filter(p =>
    p.days.includes(1) && p.startTime === '15:00'
  );
  console.log('🔍 personalTimes에서 월 15:00:', mon15Personal.map(p => `${p.title} days=${p.days} ${p.startTime}`));

  // 시간표 데이터에서 최소/최대 시간 추출
  const getTimeRange = () => {
    let minHour = 24;
    let maxHour = 0;

    // currentCombination과 personalTimes 모두 확인
    const allSchedules = [...currentCombination, ...personalTimes];

    allSchedules.forEach(schedule => {
      if (schedule.startTime) {
        const startHour = parseInt(schedule.startTime.split(':')[0]);
        minHour = Math.min(minHour, startHour);
      }
      if (schedule.endTime) {
        const endHour = parseInt(schedule.endTime.split(':')[0]);
        const endMinute = parseInt(schedule.endTime.split(':')[1]);
        // 분이 있으면 다음 시간까지 표시
        maxHour = Math.max(maxHour, endMinute > 0 ? endHour + 1 : endHour);
      }
    });

    // 실제 시간표에 맞춰 동적 조정 (제한 없음)
    if (minHour === 24) minHour = 9; // 시간 정보가 없으면 기본 9시
    if (maxHour === 0) maxHour = 18; // 시간 정보가 없으면 기본 18시

    console.log('⏰ 시간 범위:', { start: minHour, end: maxHour });

    return { start: minHour, end: maxHour };
  };

  const timeRange = getTimeRange();

  const dayLabels = {
    MON: '월요일',
    TUE: '화요일',
    WED: '수요일',
    THU: '목요일',
    FRI: '금요일',
    SAT: '토요일',
    SUN: '일요일'
  };

  const gradeLevelLabels = {
    elementary: '초등부',
    middle: '중등부',
    high: '고등부'
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < combinations.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleSelectSchedule = () => {
    console.log('🔍 선택된 combination:', currentCombination);

    onSelect(currentCombination, applyScope);
    onClose();
  };

  // 채팅 제출 핸들러
  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: chatInput,
      sender: 'user',
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    const input = chatInput.trim();
    setChatInput('');

    // 명령 파싱
    const dayMap = {
      '월요일': 'MON', '화요일': 'TUE', '수요일': 'WED', '목요일': 'THU',
      '금요일': 'FRI', '토요일': 'SAT', '일요일': 'SUN',
      '월': 'MON', '화': 'TUE', '수': 'WED', '목': 'THU',
      '금': 'FRI', '토': 'SAT', '일': 'SUN'
    };

    const gradeLevelMap = {
      '초등부': 'elementary', '중등부': 'middle', '고등부': 'high',
      '초등': 'elementary', '중등': 'middle', '고등': 'high'
    };

    // 시간 파싱 함수 (오후 3시, 3pm, 15:00 등 다양한 형식 지원)
    const parseTime = (timeStr) => {
      // "오후 3시" 형식
      const koreanTimeMatch = timeStr.match(/(오전|오후)\s*(\d+)시?\s*(\d+)?분?/);
      if (koreanTimeMatch) {
        let hour = parseInt(koreanTimeMatch[2]);
        const minute = koreanTimeMatch[3] ? parseInt(koreanTimeMatch[3]) : 0;
        if (koreanTimeMatch[1] === '오후' && hour !== 12) hour += 12;
        if (koreanTimeMatch[1] === '오전' && hour === 12) hour = 0;
        return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      }

      // "3pm", "3PM" 형식
      const pmMatch = timeStr.match(/(\d+)\s*(pm|PM)/);
      if (pmMatch) {
        let hour = parseInt(pmMatch[1]);
        if (hour !== 12) hour += 12;
        return `${hour.toString().padStart(2, '0')}:00`;
      }

      // "3am", "3AM" 형식
      const amMatch = timeStr.match(/(\d+)\s*(am|AM)/);
      if (amMatch) {
        let hour = parseInt(amMatch[1]);
        if (hour === 12) hour = 0;
        return `${hour.toString().padStart(2, '0')}:00`;
      }

      // "14:40", "14시 40분" 형식
      const timeMatch = timeStr.match(/(\d+)[시:]?\s*(\d+)?분?/);
      if (timeMatch) {
        const hour = parseInt(timeMatch[1]);
        const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      }

      return null;
    };

    // 삭제 명령
    const deletePattern = /삭제|지워|없애/;
    if (deletePattern.test(input)) {
      let dayToDelete = null;
      let timeToDelete = null;
      let gradeToDelete = null;

      // 요일 추출
      for (const [key, value] of Object.entries(dayMap)) {
        if (input.includes(key)) {
          dayToDelete = value;
          break;
        }
      }

      // 시간 추출
      const parsedTime = parseTime(input);
      if (parsedTime) {
        timeToDelete = parsedTime;
      }

      // 학년부 추출
      for (const [key, value] of Object.entries(gradeLevelMap)) {
        if (input.includes(key)) {
          gradeToDelete = value;
          break;
        }
      }

      const updatedCombinations = [...modifiedCombinations];
      const currentSchedules = [...updatedCombinations[currentIndex]];

      // 필터링 및 요일 제거 처리
      const filteredSchedules = currentSchedules.map((schedule, idx) => {
        let shouldModify = false;
        let matchesAllConditions = true;

        // 조건이 하나라도 지정되어 있으면 체크 시작
        const hasAnyCondition = dayToDelete || timeToDelete || gradeToDelete;

        if (hasAnyCondition) {
          // 요일 조건이 있으면 체크
          if (dayToDelete) {
            if (!schedule.days || !schedule.days.includes(dayToDelete)) {
              matchesAllConditions = false;
            } else {
              shouldModify = true;
            }
          }

          // 시간 조건이 있으면 체크
          if (timeToDelete && matchesAllConditions) {
            if (schedule.startTime !== timeToDelete) {
              matchesAllConditions = false;
            }
          }

          // 학년 조건이 있으면 체크
          if (gradeToDelete && matchesAllConditions) {
            if (schedule.gradeLevel !== gradeToDelete) {
              matchesAllConditions = false;
            }
          }
        }

        // 조건에 맞으면
        if (matchesAllConditions && shouldModify && dayToDelete) {
          // 요일만 삭제 조건이고, days가 여러 개면 해당 요일만 제거
          if (!timeToDelete && !gradeToDelete && schedule.days && schedule.days.length > 1) {
            const updatedDays = schedule.days.filter(day => day !== dayToDelete);
            if (updatedDays.length > 0) {
              return { ...schedule, days: updatedDays };
            }
          }
          // days가 1개거나 다른 조건도 있으면 전체 삭제
          return null;
        }

        return schedule;
      }).filter(schedule => schedule !== null);

      const deletedCount = currentSchedules.length - filteredSchedules.length;

      // 스케줄이 수정되었는지 확인 (요일만 제거된 경우)
      const hasChanges = deletedCount > 0 ||
        JSON.stringify(currentSchedules) !== JSON.stringify(filteredSchedules);

      if (hasChanges) {
        updatedCombinations[currentIndex] = filteredSchedules;
        setModifiedCombinations(updatedCombinations);

        let message = '';
        if (deletedCount > 0) {
          message = `✅ ${deletedCount}개의 시간표를 삭제했습니다.`;
        } else {
          // 요일만 제거된 경우
          message = `✅ 월요일 시간표를 제거했습니다.`;
        }

        const botMessage = {
          id: Date.now() + 1,
          text: message,
          sender: 'bot',
          timestamp: new Date()
        };
        setChatMessages(prev => [...prev, botMessage]);
      } else {
        const botMessage = {
          id: Date.now() + 1,
          text: '❌ 해당 조건에 맞는 시간표를 찾을 수 없습니다.',
          sender: 'bot',
          timestamp: new Date()
        };
        setChatMessages(prev => [...prev, botMessage]);
      }
      return;
    }

    // 선택 명령 (겹치는 시간에서 하나만 선택)
    const selectPattern = /선택|남겨|유지/;
    if (selectPattern.test(input)) {
      let dayToSelect = null;
      let timeToSelect = null;
      let titleToSelect = null;

      // 요일 추출
      for (const [key, value] of Object.entries(dayMap)) {
        if (input.includes(key)) {
          dayToSelect = value;
          break;
        }
      }

      // 시간 추출
      const parsedTime = parseTime(input);
      if (parsedTime) {
        timeToSelect = parsedTime;
      }

      // 제목 추출 (예: "목요일 4시는 피아노 선택", "목요일 16시 태권도만 남겨")
      const titleMatch = input.match(/(피아노|태권도|영어|수학|국어|과학|축구|농구|수영|미술|음악|댄스|발레|체육|독서)/);
      if (titleMatch) {
        titleToSelect = titleMatch[1];
      }

      if (dayToSelect && timeToSelect && titleToSelect) {
        const updatedCombinations = [...modifiedCombinations];
        const currentSchedules = [...updatedCombinations[currentIndex]];

        // 해당 요일/시간에 있는 스케줄들 찾기
        const matchingSchedules = currentSchedules.filter(schedule => {
          return schedule.days?.includes(dayToSelect) &&
                 schedule.startTime === timeToSelect;
        });

        if (matchingSchedules.length > 1) {
          // 선택된 제목만 남기고 나머지 삭제
          const filteredSchedules = currentSchedules.filter(schedule => {
            const isTargetSchedule = schedule.days?.includes(dayToSelect) &&
                                     schedule.startTime === timeToSelect;

            if (isTargetSchedule) {
              // 선택된 제목이면 유지, 아니면 삭제
              return schedule.title?.includes(titleToSelect);
            }

            // 다른 스케줄은 유지
            return true;
          });

          updatedCombinations[currentIndex] = filteredSchedules;
          setModifiedCombinations(updatedCombinations);

          const deletedCount = currentSchedules.length - filteredSchedules.length;
          const botMessage = {
            id: Date.now() + 1,
            text: `✅ ${dayToSelect} ${timeToSelect} 시간대에서 "${titleToSelect}"만 남기고 ${deletedCount}개를 제거했습니다.`,
            sender: 'bot',
            timestamp: new Date()
          };
          setChatMessages(prev => [...prev, botMessage]);
        } else {
          const botMessage = {
            id: Date.now() + 1,
            text: '❌ 해당 시간대에 겹치는 스케줄이 없거나 이미 하나만 있습니다.',
            sender: 'bot',
            timestamp: new Date()
          };
          setChatMessages(prev => [...prev, botMessage]);
        }
      } else {
        const botMessage = {
          id: Date.now() + 1,
          text: '❌ 요일, 시간, 과목명을 모두 입력해주세요. 예: "목요일 4시는 피아노 선택"',
          sender: 'bot',
          timestamp: new Date()
        };
        setChatMessages(prev => [...prev, botMessage]);
      }
      return;
    }

    // 수정 명령
    const modifyPattern = /수정|변경|바꿔/;
    if (modifyPattern.test(input)) {
      // "월요일 14:40 초등부 시간표를 16:00으로 수정"
      let dayToModify = null;
      let oldTime = null;
      let newTime = null;
      let gradeToModify = null;

      // 요일 추출
      for (const [key, value] of Object.entries(dayMap)) {
        if (input.includes(key)) {
          dayToModify = value;
          break;
        }
      }

      // 학년부 추출
      for (const [key, value] of Object.entries(gradeLevelMap)) {
        if (input.includes(key)) {
          gradeToModify = value;
          break;
        }
      }

      // "을/를/에서" 기준으로 이전 시간과 이후 시간 분리
      const modifyMatch = input.match(/(.+?)(을|를|에서)\s*(.+?)(으로|로)\s*(.+)/);
      if (modifyMatch) {
        const beforePart = modifyMatch[1] + modifyMatch[3];
        const afterPart = modifyMatch[5];

        oldTime = parseTime(beforePart);
        newTime = parseTime(afterPart);
      }

      if (oldTime && newTime) {
        const updatedCombinations = [...modifiedCombinations];
        const currentSchedules = [...updatedCombinations[currentIndex]];

        let modified = false;
        const newSchedules = currentSchedules.map(schedule => {
          let shouldModify = true;

          if (dayToModify && (!schedule.days || !schedule.days.includes(dayToModify))) {
            shouldModify = false;
          }

          if (oldTime && schedule.startTime !== oldTime) {
            shouldModify = false;
          }

          if (gradeToModify && schedule.gradeLevel !== gradeToModify) {
            shouldModify = false;
          }

          if (shouldModify) {
            modified = true;
            // 시간 차이 계산
            const [oldHour, oldMin] = oldTime.split(':').map(Number);
            const [newHour, newMin] = newTime.split(':').map(Number);
            const oldMinutes = oldHour * 60 + oldMin;
            const newMinutes = newHour * 60 + newMin;
            const diff = newMinutes - oldMinutes;

            // endTime도 같이 조정
            if (schedule.endTime) {
              const [endHour, endMin] = schedule.endTime.split(':').map(Number);
              const endMinutes = endHour * 60 + endMin + diff;
              const newEndHour = Math.floor(endMinutes / 60);
              const newEndMin = endMinutes % 60;

              return {
                ...schedule,
                startTime: newTime,
                endTime: `${newEndHour.toString().padStart(2, '0')}:${newEndMin.toString().padStart(2, '0')}`
              };
            }

            return { ...schedule, startTime: newTime };
          }

          return schedule;
        });

        if (modified) {
          updatedCombinations[currentIndex] = newSchedules;
          setModifiedCombinations(updatedCombinations);

          const botMessage = {
            id: Date.now() + 1,
            text: `✅ 시간표를 ${oldTime}에서 ${newTime}로 수정했습니다.`,
            sender: 'bot',
            timestamp: new Date()
          };
          setChatMessages(prev => [...prev, botMessage]);
        } else {
          const botMessage = {
            id: Date.now() + 1,
            text: '❌ 해당 조건에 맞는 시간표를 찾을 수 없습니다.',
            sender: 'bot',
            timestamp: new Date()
          };
          setChatMessages(prev => [...prev, botMessage]);
        }
      } else {
        const botMessage = {
          id: Date.now() + 1,
          text: '❌ 시간 정보를 찾을 수 없습니다. 예: "월요일 14:40을 16:00으로 수정"',
          sender: 'bot',
          timestamp: new Date()
        };
        setChatMessages(prev => [...prev, botMessage]);
      }
      return;
    }

    // 추가 명령
    const addPattern = /추가|넣어|생성/;
    if (addPattern.test(input)) {
      let dayToAdd = null;
      let timeToAdd = null;
      let gradeToAdd = null;
      let titleToAdd = '수업';

      // 요일 추출
      for (const [key, value] of Object.entries(dayMap)) {
        if (input.includes(key)) {
          dayToAdd = value;
          break;
        }
      }

      // 시간 추출
      const parsedTime = parseTime(input);
      if (parsedTime) {
        timeToAdd = parsedTime;
      }

      // 학년부 추출
      for (const [key, value] of Object.entries(gradeLevelMap)) {
        if (input.includes(key)) {
          gradeToAdd = value;
          titleToAdd = key;
          break;
        }
      }

      if (dayToAdd && timeToAdd) {
        const updatedCombinations = [...modifiedCombinations];
        const currentSchedules = [...updatedCombinations[currentIndex]];

        // 기본 종료 시간 (1시간 후)
        const [hour, min] = timeToAdd.split(':').map(Number);
        const endMinutes = hour * 60 + min + 60;
        const endHour = Math.floor(endMinutes / 60);
        const endMin = endMinutes % 60;
        const endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;

        const newSchedule = {
          title: titleToAdd,
          days: [dayToAdd],
          startTime: timeToAdd,
          endTime: endTime,
          duration: 60,
          gradeLevel: gradeToAdd
        };

        currentSchedules.push(newSchedule);
        updatedCombinations[currentIndex] = currentSchedules;
        setModifiedCombinations(updatedCombinations);

        const botMessage = {
          id: Date.now() + 1,
          text: `✅ ${dayMap[dayToAdd] ? Object.keys(dayMap).find(k => dayMap[k] === dayToAdd) : dayToAdd} ${timeToAdd}에 ${titleToAdd} 시간표를 추가했습니다.`,
          sender: 'bot',
          timestamp: new Date()
        };
        setChatMessages(prev => [...prev, botMessage]);
      } else {
        const botMessage = {
          id: Date.now() + 1,
          text: '❌ 요일과 시간을 지정해주세요. 예: "토요일 오후 3시 초등부 추가"',
          sender: 'bot',
          timestamp: new Date()
        };
        setChatMessages(prev => [...prev, botMessage]);
      }
      return;
    }

    // 알 수 없는 명령
    const botMessage = {
      id: Date.now() + 1,
      text: '사용 가능한 명령:\n- 삭제: "토요일 11:00 삭제"\n- 수정: "월요일 14:40을 16:00으로 수정"\n- 추가: "토요일 오후 3시 초등부 추가"',
      sender: 'bot',
      timestamp: new Date()
    };
    setChatMessages(prev => [...prev, botMessage]);
  };

  const getTotalClassHours = () => {
    let total = 0;
    currentCombination.forEach(schedule => {
      if (schedule.duration) {
        total += schedule.duration;
      }
    });
    return total;
  };

  const renderScheduleCard = (schedule, index) => {
    return (
      <div
        key={index}
        className="bg-white border border-purple-200 rounded-lg p-3 hover:shadow-md transition-shadow"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="font-semibold text-gray-800 text-sm">
              {schedule.title}
            </h4>
            <div className="flex items-center mt-1 text-xs text-gray-600">
              <Clock size={12} className="mr-1" />
              {schedule.startTime} - {schedule.endTime}
              {schedule.inferredDuration && (
                <span className="ml-2 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
                  추정
                </span>
              )}
            </div>
            {schedule.duration && (
              <div className="text-xs text-gray-500 mt-1">
                {schedule.duration}분 수업
              </div>
            )}
          </div>
          {schedule.gradeLevel && (
            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
              {gradeLevelLabels[schedule.gradeLevel]}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-6 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-7xl w-full my-auto max-h-[85vh] overflow-hidden flex flex-col">
        {/* 통합 헤더 */}
        <div className="bg-gradient-to-r from-purple-600 via-purple-500 to-blue-600 text-white px-5 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex-1 text-center">
              <h2 className="text-xl font-bold">최적 시간표 추천</h2>
              <p className="text-xs text-purple-100 mt-1">
                충돌 없는 시간표 조합을 찾았습니다
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* 메인 컨텐츠 영역 */}
        <div className="flex flex-row flex-1 overflow-hidden">
          {/* 왼쪽: 시간표 영역 */}
          <div className="flex-1 flex flex-col overflow-hidden">{/* 헤더를 제거하고 내용만 유지 */}

        {/* 사용자 정보 */}
        <div className="px-5 py-3 bg-purple-50 border-b border-purple-100 flex-shrink-0">
          <div className="flex items-center space-x-4 text-xs">
            <div className="flex items-center">
              <span className="font-medium text-gray-700">나이:</span>
              <span className="ml-2 text-gray-900">{userAge}세</span>
            </div>
            <div className="flex items-center">
              <span className="font-medium text-gray-700">학년부:</span>
              <span className="ml-2 text-gray-900">{gradeLevelLabels[gradeLevel]}</span>
            </div>
            <div className="flex items-center ml-auto">
              <CheckCircle size={16} className="text-green-600 mr-2" />
              <span className="text-green-700 font-medium">
                {combinations.length}개의 최적 조합 발견
              </span>
            </div>
          </div>
        </div>

        {/* 조합 네비게이션 */}
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className={`flex items-center px-3 py-1.5 text-sm rounded-lg transition-colors ${
                currentIndex === 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              <ChevronLeft size={20} className="mr-1" />
              이전
            </button>

            <div className="text-center">
              <div className="text-base font-bold text-gray-800">
                조합 {currentIndex + 1} / {combinations.length}
              </div>
              <div className="text-xs text-gray-600">
                총 {currentCombination.length}개 수업 · {getTotalClassHours()}분
              </div>
            </div>

            <button
              onClick={handleNext}
              disabled={currentIndex === combinations.length - 1}
              className={`flex items-center px-3 py-1.5 text-sm rounded-lg transition-colors ${
                currentIndex === combinations.length - 1
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              다음
              <ChevronRight size={20} className="ml-1" />
            </button>
          </div>
        </div>

        {/* 주간 시간표 그리드 */}
        <div className="px-5 py-4 overflow-y-auto flex-1">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <ScheduleGridSelector
              schedule={[]}
              exceptions={[]}
              personalTimes={personalTimes}
              readOnly={true}
              enableMonthView={false}
              showViewControls={false}
              initialTimeRange={timeRange}
              defaultShowMerged={true}
            />
          </div>
        </div>

        {/* 적용 범위 선택 */}
        <div className="px-5 py-3 bg-blue-50 border-t border-blue-100 flex-shrink-0">
          <div className="flex items-center justify-center gap-3">
            <span className="font-medium text-gray-700 text-sm">적용 범위:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setApplyScope('week')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors font-medium ${
                  applyScope === 'week'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                이번 주만
              </button>
              <button
                onClick={() => setApplyScope('month')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors font-medium ${
                  applyScope === 'month'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                전체 달
              </button>
            </div>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex-shrink-0">
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              닫기
            </button>
            <button
              onClick={handleSelectSchedule}
              className="flex-1 px-4 py-2 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors font-medium shadow-lg"
            >
              <CheckCircle size={18} className="inline mr-1.5" />
              이 시간표 선택하기
            </button>
          </div>
        </div>
      </div>

      {/* 오른쪽: 채팅 영역 */}
      <div className="flex flex-col bg-gradient-to-b from-purple-50 to-blue-50 border-l border-gray-200" style={{ width: '40%', maxWidth: '420px' }}>
        {/* 채팅 메시지 영역 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4" style={{ background: 'linear-gradient(to bottom, #faf5ff, #eff6ff)' }}>
          {chatMessages.length === 0 && (
            <div className="text-center mt-8">
              <div className="inline-block bg-white rounded-2xl shadow-lg p-5 border border-purple-100">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Send size={20} className="text-white" />
                </div>
                <p className="font-bold text-gray-700 mb-3 text-sm">💬 사용 가능한 명령</p>
                <div className="text-left space-y-2.5 text-xs">
                  <div className="flex items-start space-x-2 p-2.5 bg-red-50 rounded-lg border-l-3 border-red-400">
                    <span className="font-bold text-red-600 text-lg leading-none">×</span>
                    <div>
                      <p className="font-semibold text-red-700">삭제</p>
                      <p className="text-gray-600 mt-0.5">"토요일 11:00 삭제"</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2 p-2.5 bg-blue-50 rounded-lg border-l-3 border-blue-400">
                    <span className="font-bold text-blue-600 text-lg leading-none">✎</span>
                    <div>
                      <p className="font-semibold text-blue-700">수정</p>
                      <p className="text-gray-600 mt-0.5">"월요일 14:40을 16:00으로 수정"</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2 p-2.5 bg-green-50 rounded-lg border-l-3 border-green-400">
                    <span className="font-bold text-green-600 text-lg leading-none">+</span>
                    <div>
                      <p className="font-semibold text-green-700">추가</p>
                      <p className="text-gray-600 mt-0.5">"토요일 오후 3시 초등부 추가"</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {chatMessages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
            >
              <div
                className={`max-w-[85%] rounded-2xl text-sm shadow-md ${
                  message.sender === 'user'
                    ? 'bg-gradient-to-br from-purple-600 to-purple-500 text-white'
                    : 'bg-white text-gray-800 border border-gray-100'
                }`}
                style={{
                  borderBottomRightRadius: message.sender === 'user' ? '4px' : '16px',
                  borderBottomLeftRadius: message.sender === 'bot' ? '4px' : '16px'
                }}
              >
                <p className="px-4 pt-3 pb-1 whitespace-pre-line leading-relaxed">{message.text}</p>
                <p className={`px-4 pb-2 text-xs ${
                  message.sender === 'user' ? 'text-purple-200' : 'text-gray-400'
                }`}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* 채팅 입력 영역 */}
        <div className="p-4 bg-white border-t border-gray-200 flex-shrink-0 shadow-lg">
          <form onSubmit={handleChatSubmit} className="flex space-x-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="예: 토요일 11:00 삭제"
              className="flex-1 px-4 py-3 text-sm border-2 border-gray-200 rounded-full focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all placeholder-gray-400"
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full hover:from-purple-700 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleOptimizationModal;
