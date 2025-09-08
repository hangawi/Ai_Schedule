import { useState, useCallback, useRef } from 'react';
import { generateAIPrompt, parseAIResponse, speak } from '../utils';
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export const useVoiceCommands = (isLoggedIn, isVoiceRecognitionEnabled, eventActions, setEventAddedKey) => {
  const [modalText, setModalText] = useState('');
  const listeningModeRef = useRef('hotword');

  const processVoiceCommand = useCallback(async (command, recognition) => {
    if (!isLoggedIn || !isVoiceRecognitionEnabled) {
      setModalText('로그인이 필요하거나 음성인식이 비활성화되어 있습니다.');
      setTimeout(() => setModalText(''), 2000);
      return;
    }

    if (!command) {
      speak('네, 무엇을 도와드릴까요?');
      return;
    }

    setModalText(command);

    try {
      const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
      if (!API_KEY) {
        alert('Gemini API Key가 설정되지 않았습니다.');
        return;
      }

      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = generateAIPrompt(command);
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      const eventData = parseAIResponse(text);

      if (!eventData.startDateTime) {
        speak('언제 일정을 잡을까요?');
        return;
      }

      if (!eventActions) {
        speak('아직 일정 기능을 사용할 수 없습니다. 잠시 후 다시 시도해주세요.');
        return;
      }

      if (eventData.intent === 'add_event') {
        const token = localStorage.getItem('token');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const apiResponse = await fetch(`${API_BASE_URL}/api/calendar/events/google`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token,
          },
          body: JSON.stringify(eventData),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!apiResponse.ok) {
          const errorData = await apiResponse.json();
          throw new Error(errorData.msg || 'Failed to add event to Google Calendar');
        }

        speak('일정을 성공적으로 추가했습니다.');
        setEventAddedKey(prevKey => prevKey + 1);
        setModalText('');
      } else {
        speak('해당 기능은 현재 지원하지 않습니다.');
      }

      setModalText('');
      
      setTimeout(() => {
        if (isVoiceRecognitionEnabled && recognition) {
          try {
            recognition.start();
          } catch (e) {
            // 재시작 실패 시 조용히 처리
          }
        }
      }, 100);
    } catch (error) {
      if (error.name !== 'AbortError') {
        speak(`음성 명령 처리에 실패했습니다. ${error.message}`);
      }
      setModalText('');
      
      setTimeout(() => {
        if (isVoiceRecognitionEnabled && recognition) {
          try {
            recognition.start();
          } catch (e) {
            // 재시작 실패 시 조용히 처리
          }
        }
      }, 100);
    }
  }, [isLoggedIn, eventActions, isVoiceRecognitionEnabled, setEventAddedKey]);

  const handleVoiceResult = useCallback((transcript, isFinal, recognition) => {
    if (listeningModeRef.current === 'command') {
      const displayText = transcript.trim();
      if (displayText) {
        setModalText(displayText);
      }
    }

    if (isFinal && transcript) {
      const command = transcript.trim();
      
      if (listeningModeRef.current === 'hotword' && command) {
        const HOTWORDS = ['큐브야', '비서야', '자비스', '큐브', '비서'];
        if (HOTWORDS.some(h => command.toLowerCase().includes(h.toLowerCase()))) {
          speak('네, 말씀하세요.');
          setModalText('');
          listeningModeRef.current = 'command';
          
          setTimeout(() => {
            try {
              if (recognition && listeningModeRef.current === 'command') {
                setModalText('말씀하세요...');
                recognition.start();
              }
            } catch (e) {
              // 재시작 실패 시 조용히 처리
            }
          }, 500);
        }
      } else if (listeningModeRef.current === 'command' && command) {
        setModalText('명령 처리 중...');
        processVoiceCommand(command, recognition);
        listeningModeRef.current = 'hotword';
      }
    }
  }, [processVoiceCommand]);

  return {
    modalText,
    setModalText,
    handleVoiceResult,
    listeningModeRef
  };
};