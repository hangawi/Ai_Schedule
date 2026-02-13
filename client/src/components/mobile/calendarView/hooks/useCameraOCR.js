/**
 * useCameraOCR.js - 카메라 촬영 및 OCR 처리 훅
 *
 * 📍 위치: calendarView/hooks/useCameraOCR.js
 * 🔗 연결: ../../MobileCalendarView.js
 */

import { useState, useRef } from 'react';
import { auth } from '../../../../config/firebaseConfig';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const useCameraOCR = (fetchSchedule, fetchGlobalEvents, showToast) => {
   const [isOcrProcessing, setIsOcrProcessing] = useState(false);
   const cameraInputRef = useRef(null);

   const handleStartCamera = () => {
      if (cameraInputRef.current) {
         cameraInputRef.current.click();
      }
   };

   const handleCameraCapture = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsOcrProcessing(true);
      try {
         const currentUser = auth.currentUser;
         if (!currentUser) { showToast('로그인이 필요합니다.'); return; }

         const formData = new FormData();
         formData.append('image', file);

         const response = await fetch(`${API_BASE_URL}/api/ocr/analyze-schedule`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` },
            body: formData,
         });

         if (!response.ok) throw new Error('OCR 처리 실패');

         const result = await response.json();
         const scheduleItems = result.scheduleItems || result.events || [];

         if (scheduleItems.length === 0) {
            showToast('시간표에서 일정을 찾을 수 없습니다. 다시 촬영해 주세요.');
            return;
         }

         let addedCount = 0;
         for (const item of scheduleItems) {
            try {
               await fetch(`${API_BASE_URL}/api/events`, {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json',
                     'Authorization': `Bearer ${await currentUser.getIdToken()}`
                  },
                  body: JSON.stringify({
                     title: item.title || item.subject || '시간표 일정',
                     date: item.date,
                     time: item.startTime || item.time || '09:00',
                     duration: item.duration || 60,
                     location: item.location || '',
                  })
               });
               addedCount++;
            } catch (err) {
               console.warn('일정 등록 실패:', item, err);
            }
         }

         if (addedCount > 0) {
            showToast(`시간표에서 ${addedCount}개의 일정을 등록했습니다!`);
         } else {
            showToast('일정 등록에 실패했습니다. 다시 시도해 주세요.');
         }
         await fetchSchedule();
         await fetchGlobalEvents();
      } catch (error) {
         console.error('OCR 처리 오류:', error);
         showToast('시간표 인식에 실패했습니다. 다시 시도해 주세요.');
      } finally {
         setIsOcrProcessing(false);
         if (cameraInputRef.current) cameraInputRef.current.value = '';
      }
   };

   return { isOcrProcessing, cameraInputRef, handleStartCamera, handleCameraCapture };
};

export default useCameraOCR;
