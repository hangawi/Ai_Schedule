/**
 * ============================================================================
 * ocrHandlers.js - OCR 처리 관련 이벤트 핸들러 팩토리 함수들
 * ============================================================================
 */

import { extractSchedulesFromImages } from '../../../utils/ocrUtils';

/**
 * OCR 이미지 처리 핸들러 생성
 */
export const createHandleProcessImages = ({
  selectedImages,
  setError,
  setIsProcessing,
  setProgress,
  setExtractedSchedules,
  setSchedulesByImage,
  setOriginalSchedule,
  originalSchedule,
  setBaseSchedules,
  setOverallTitle,
  setFilteredSchedules,
  setChatHistory,
  setDuplicateInfo,
  setShowDuplicateModal,
  setSelectedImages,
  setImagePreviews,
  imagePreviews
}) => {
  return async (skipDuplicateCheck = false) => {
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

      // 중복 감지 처리
      if (result.hasDuplicates && result.duplicates && result.duplicates.length > 0) {
        setDuplicateInfo(result);
        setShowDuplicateModal(true);
        setIsProcessing(false);
        return;
      }

      // 최적화된 스케줄 사용
      const schedulesToUse = result.optimizedSchedules || result.schedules;
      setExtractedSchedules(schedulesToUse);

      // schedulesByImage 필터링
      const selectedImageNames = [...new Set(schedulesToUse.map(s => s.sourceImage))];
      let filteredSchedulesByImage = result.schedulesByImage.filter(img =>
        selectedImageNames.includes(img.fileName)
      );

      // 실제로 선택된 스케줄이 있는 이미지만 유지
      const imagesWithSchedules = filteredSchedulesByImage.filter(img => {
        const imageSchedules = schedulesToUse.filter(s => s.sourceImage === img.fileName);
        return imageSchedules.length > 0;
      });

      filteredSchedulesByImage = imagesWithSchedules;

      // sourceImageIndex 재할당
      const reindexedSchedulesByImage = filteredSchedulesByImage.map((img, newIndex) => {
        return {
          ...img,
          schedules: img.schedules.map(schedule => ({
            ...schedule,
            sourceImageIndex: newIndex
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
      setExtractedSchedules(reindexedSchedulesToUse);

      // 원본 전체 시간표 저장
      if (!originalSchedule && result.allSchedules) {
        setOriginalSchedule(JSON.parse(JSON.stringify(result.allSchedules)));
      }

      // 기본 베이스 스케줄 저장
      if (result.baseSchedules && result.baseSchedules.length > 0) {
        setBaseSchedules(result.baseSchedules);
      }

      // 전체 제목 저장
      if (reindexedSchedulesByImage.length > 0) {
        const titles = reindexedSchedulesByImage.map(img => img.title || img.fileName).filter(Boolean);
        const newOverallTitle = titles.join(' + ') || '업로드된 시간표';
        setOverallTitle(newOverallTitle);
      }

      setFilteredSchedules(reindexedSchedulesToUse);
      setProgress({ current: 100, total: 100, message: 'OCR 분석 완료!' });

      // 필터링된 이미지 정보 추가
      const removedImages = result.schedulesByImage.filter(img =>
        !imagesWithSchedules.some(kept => kept.fileName === img.fileName)
      );

      // 이미지별로 반 목록 구성
      let classListByImage = '';
      if (reindexedSchedulesByImage && reindexedSchedulesByImage.length > 0) {
        classListByImage = reindexedSchedulesByImage.map((imageResult, idx) => {
          const classNames = [...new Set(imageResult.schedules.map(s => s.title))];
          const classList = classNames.map((name, i) => `  ${i + 1}. ${name}`).join('\n');
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
        const classNames = [...new Set(result.schedules.map(s => s.title))];
        classListByImage = classNames.map((name, idx) => `${idx + 1}. ${name}`).join('\n');
      }

      // 동적 예시 생성
      let exampleTexts = [];
      if (reindexedSchedulesByImage && reindexedSchedulesByImage.length > 0) {
        const firstImageClasses = [...new Set(reindexedSchedulesByImage[0].schedules.map(s => s.title))];
        if (firstImageClasses.length >= 1) {
          exampleTexts.push(`"${firstImageClasses[0]}만 할거야"`);
        }
        if (firstImageClasses.length >= 2) {
          exampleTexts.push(`"${firstImageClasses[1]} 반 하고 싶어요"`);
        }
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
};
