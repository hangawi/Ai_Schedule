/**
 * ===================================================================================================
 * useMobileDetection.js - 모바일 기기 감지 커스텀 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/chat/hooks
 *
 * 🎯 주요 기능:
 *    - 현재 접속 환경이 모바일 기기인지 여부를 판별
 *    - User-Agent 문자열과 브라우저 창의 너비를 기준으로 모바일 환경을 감지
 *    - 브라우저 창 크기 조절 시 실시간으로 모바일 여부 업데이트
 *
 * 🔗 연결된 파일:
 *    - 여러 컴포넌트에서 반응형 UI 구현을 위해 사용될 수 있음
 *
 * 💡 UI 위치:
 *    - 이 훅 자체는 UI가 없으나, 이 훅의 반환값에 따라 UI가 다르게 렌더링될 수 있음
 *
 * ✏️ 수정 가이드:
 *    - 모바일 감지 기준 변경: `checkMobile` 함수 내의 `userAgent` 테스트 로직 또는 `window.innerWidth` 기준값(768) 수정
 *
 * 📝 참고사항:
 *    - `useEffect`를 사용하여 컴포넌트 마운트 시와 창 크기 조절 시에 모바일 여부를 확인합니다.
 *    - 클린업 함수를 통해 컴포넌트 언마운트 시 `resize` 이벤트 리스너를 제거하여 메모리 누수를 방지합니다.
 *    - User-Agent만으로 완벽한 감지가 어려울 수 있어, 창 너비를 함께 확인하는 방식을 사용합니다.
 *
 * ===================================================================================================
 */

import { useState, useEffect } from 'react';

/**
 * useMobileDetection
 *
 * @description 현재 브라우저 환경이 모바일 기기인지 여부를 판별하는 커스텀 훅입니다.
 *              User-Agent와 화면 너비를 조합하여 판단하며, 화면 크기 변경에 따라 실시간으로 업데이트됩니다.
 * @returns {boolean} 모바일 환경일 경우 true, 아닐 경우 false를 반환합니다.
 *
 * @example
 * // 컴포넌트 내에서 사용 예시
 * const isMobile = useMobileDetection();
 *
 * return (
 *   <div>
 *     {isMobile ? <MobileLayout /> : <DesktopLayout />}
 *   </div>
 * );
 *
 * @note
 * - 데스크톱 환경을 먼저 특정하고, 그 외의 환경에서 User-Agent가 모바일 패턴과 일치하거나
 *   창 너비가 768px 이하일 경우 모바일로 간주합니다.
 * - 컴포넌트가 마운트될 때 한 번, 그리고 창 크기가 변경될 때마다 감지 로직이 실행됩니다.
 * - 컴포넌트가 언마운트될 때 `resize` 이벤트 리스너가 자동으로 제거됩니다.
 */
export const useMobileDetection = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent;
      const isDesktop = /Windows NT|Macintosh|X11.*Linux/i.test(userAgent) &&
                        !/Mobile|Tablet/i.test(userAgent);
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent);
      const mobile = !isDesktop && (isMobileUA || window.innerWidth <= 768);
      setIsMobile(mobile);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
};
