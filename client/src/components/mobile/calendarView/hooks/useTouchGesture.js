/**
 * useTouchGesture.js - 터치 스와이프 제스처 관리 훅
 *
 * 📍 위치: calendarView/hooks/useTouchGesture.js
 * 🔗 연결: ../../MobileCalendarView.js
 */

import { useState } from 'react';

const useTouchGesture = (calendarRef) => {
   const [touchStart, setTouchStart] = useState(null);
   const [translateY, setTranslateY] = useState(0);
   const [isSwiping, setIsSwiping] = useState(false);

   const handleTouchStart = (e) => {
      setTouchStart(e.targetTouches[0].clientY);
      setIsSwiping(true);
   };

   const handleTouchMove = (e) => {
      if (touchStart === null) return;
      const currentY = e.targetTouches[0].clientY;
      const diff = currentY - touchStart;
      setTranslateY(diff * 0.5);
   };

   const handleTouchEnd = () => {
      if (touchStart === null) return;
      const minSwipeDistance = 80;
      const calendarApi = calendarRef.current?.getApi();
      if (calendarApi) {
         if (translateY < -minSwipeDistance) calendarApi.next();
         else if (translateY > minSwipeDistance) calendarApi.prev();
      }
      setIsSwiping(false);
      setTranslateY(0);
      setTouchStart(null);
   };

   return { translateY, isSwiping, handleTouchStart, handleTouchMove, handleTouchEnd };
};

export default useTouchGesture;
