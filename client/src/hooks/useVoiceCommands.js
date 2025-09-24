import { useState, useCallback, useRef } from 'react';
import { speak } from '../utils';

export const useVoiceCommands = (isLoggedIn, isVoiceRecognitionEnabled, handleChatMessage, { onCommandStart, onCommandEnd }) => {
  const [modalText, setModalText] = useState('');
  const listeningModeRef = useRef('hotword');

  const processVoiceCommand = useCallback(async (command) => {
    if (!isLoggedIn || !isVoiceRecognitionEnabled) {
      setModalText('로그인이 필요하거나 음성인식이 비활성화되어 있습니다.');
      setTimeout(() => setModalText(''), 2000);
      return;
    }

    if (!command) {
      speak('네, 무엇을 도와드릴까요?');
      return;
    }

    setModalText(`"${command}" 처리 중...`);

    if (onCommandStart) onCommandStart();

    try {
      const commandStartTime = performance.now();
      const result = await Promise.race([
        handleChatMessage(command),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('명령 처리 시간이 너무 깁니다')), 8000)
        )
      ]);
      const commandEndTime = performance.now();

      speak(result.message);
    } catch (error) {
      speak(`음성 명령 처리에 실패했습니다. ${error.message}`);
    } finally {
      setModalText('');
      if (onCommandEnd) onCommandEnd();
    }
  }, [isLoggedIn, isVoiceRecognitionEnabled, handleChatMessage, onCommandStart, onCommandEnd]);

  const handleVoiceResult = useCallback((transcript, isFinal) => {
    if (listeningModeRef.current === 'command' && !isFinal) {
        setModalText(transcript);
        return true;
    }

    if (isFinal && transcript) {
      const command = transcript.trim();
      
      if (listeningModeRef.current === 'hotword' && command) {
        const HOTWORDS = ['큐브야', '비서야', '자비스', '큐브', '비서'];
        const normalizedCommand = command.toLowerCase().replace(/[~!?.]/g, '');
        if (HOTWORDS.some(h => normalizedCommand.includes(h.toLowerCase()))) {
          speak('네, 말씀하세요.');
          listeningModeRef.current = 'command';
          setModalText('말씀하세요...');
          return true;
        }
      } else if (listeningModeRef.current === 'command' && command) {
        processVoiceCommand(command);
        listeningModeRef.current = 'hotword';
        return true;
      }
    }
    return false;
  }, [processVoiceCommand]);

  return {
    modalText,
    setModalText,
    handleVoiceResult,
    listeningModeRef
  };
};