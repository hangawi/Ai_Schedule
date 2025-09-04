import { useEffect, useRef, useState } from 'react';

export const usePullToRefresh = (onRefresh) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);
  const pullDistance = useRef(0);
  const threshold = 70; // 새로고침을 위한 최소 거리

  useEffect(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (!isMobile) return;

    let pullRefreshElement = null;

    const handleTouchStart = (e) => {
      // 스크롤이 최상단에 있을 때만 동작
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
        pullDistance.current = 0;
        
        // 새로고침 인디케이터 엘리먼트 생성
        if (!pullRefreshElement) {
          pullRefreshElement = document.createElement('div');
          pullRefreshElement.id = 'pull-refresh-indicator';
          pullRefreshElement.innerHTML = `
            <div style="
              position: fixed;
              top: -80px;
              left: 0;
              right: 0;
              height: 80px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              transition: transform 0.3s ease;
              z-index: 1000;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            ">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="
                  width: 20px;
                  height: 20px;
                  border: 2px solid rgba(255,255,255,0.3);
                  border-top: 2px solid white;
                  border-radius: 50%;
                  animation: spin 1s linear infinite;
                "></div>
                <span id="refresh-text">아래로 당겨서 새로고침</span>
              </div>
            </div>
            <style>
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            </style>
          `;
          document.body.appendChild(pullRefreshElement);
        }
      }
    };

    const handleTouchMove = (e) => {
      if (window.scrollY === 0 && startY.current > 0) {
        currentY.current = e.touches[0].clientY;
        pullDistance.current = Math.max(0, currentY.current - startY.current);
        
        if (pullDistance.current > 0 && pullRefreshElement) {
          e.preventDefault(); // 스크롤 방지
          
          const translateY = Math.min(pullDistance.current * 0.5, 40);
          
          const indicator = pullRefreshElement.firstChild;
          const text = pullRefreshElement.querySelector('#refresh-text');
          
          indicator.style.transform = `translateY(${translateY}px)`;
          
          if (pullDistance.current >= threshold) {
            text.textContent = '놓으면 새로고침';
            indicator.style.background = 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)';
          } else {
            text.textContent = '아래로 당겨서 새로고침';
            indicator.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
          }
          
          // 스크롤 위치 조정
          document.body.style.transform = `translateY(${translateY}px)`;
        }
      }
    };

    const handleTouchEnd = async () => {
      if (pullDistance.current >= threshold && window.scrollY === 0 && !isRefreshing) {
        setIsRefreshing(true);
        
        if (pullRefreshElement) {
          const text = pullRefreshElement.querySelector('#refresh-text');
          text.textContent = '새로고침 중...';
        }
        
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          
          // 애니메이션으로 원래 위치로 복귀
          if (pullRefreshElement) {
            const indicator = pullRefreshElement.firstChild;
            indicator.style.transition = 'transform 0.3s ease';
            indicator.style.transform = 'translateY(-80px)';
            
            document.body.style.transition = 'transform 0.3s ease';
            document.body.style.transform = 'translateY(0)';
            
            setTimeout(() => {
              if (pullRefreshElement && pullRefreshElement.parentNode) {
                pullRefreshElement.parentNode.removeChild(pullRefreshElement);
                pullRefreshElement = null;
              }
              document.body.style.transition = '';
              document.body.style.transform = '';
            }, 300);
          }
        }
      } else {
        // 새로고침하지 않는 경우 원래 위치로 복귀
        if (pullRefreshElement) {
          const indicator = pullRefreshElement.firstChild;
          indicator.style.transition = 'transform 0.3s ease';
          indicator.style.transform = 'translateY(-80px)';
          
          document.body.style.transition = 'transform 0.3s ease';
          document.body.style.transform = 'translateY(0)';
          
          setTimeout(() => {
            if (pullRefreshElement && pullRefreshElement.parentNode) {
              pullRefreshElement.parentNode.removeChild(pullRefreshElement);
              pullRefreshElement = null;
            }
            document.body.style.transition = '';
            document.body.style.transform = '';
          }, 300);
        }
      }
      
      // 초기화
      startY.current = 0;
      currentY.current = 0;
      pullDistance.current = 0;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      
      // 정리
      if (pullRefreshElement && pullRefreshElement.parentNode) {
        pullRefreshElement.parentNode.removeChild(pullRefreshElement);
      }
      document.body.style.transition = '';
      document.body.style.transform = '';
    };
  }, [onRefresh, isRefreshing]);

  return { isRefreshing };
};