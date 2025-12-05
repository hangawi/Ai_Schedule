/**
 * ===================================================================================================
 * AddressAutocomplete.js - Google Places API를 이용한 주소 자동완성 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/common
 *
 * 🎯 주요 기능:
 *    - Google Places Autocomplete API를 사용하여 주소 입력 시 자동완성 기능 제공
 *    - 사용자가 주소를 선택하면 주소 문자열, 위도, 경도, 장소 ID를 부모 컴포넌트로 전달
 *    - 한국(kr) 주소로 검색 제한
 *    - 엔터 키 입력 시 첫 번째 추천 항목을 자동으로 선택하는 편의 기능 제공
 *    - Google Maps API 로딩 상태를 표시하는 스피너 기능
 *
 * 🔗 연결된 파일:
 *    - 이 컴포넌트를 사용하는 부모 컴포넌트 (예: 프로필 수정, 이벤트 생성 모달 등)
 *
 * 💡 UI 위치:
 *    - 사용자 프로필 탭 > 개인정보 수정 섹션 > 주소 입력 필드
 *    - 이벤트 생성/수정 모달 > 장소 입력 필드
 *
 * ✏️ 수정 가이드:
 *    - 검색 국가 변경: `componentRestrictions: { country: 'kr' }` 부분 수정
 *    - 검색 결과 타입 변경: `types: ['geocode']` 부분 수정 (예: 'establishment' 추가)
 *    - 엔터 키 동작 변경: `handleKeyDown` 함수의 로직 수정
 *
 * 📝 참고사항:
 *    - 이 컴포넌트가 제대로 동작하려면 상위 컴포넌트 트리에서 Google Maps API 스크립트가 로드되어 있어야 합니다.
 *      (보통 `App.js`의 `LoadScript` 컴포넌트를 통해 로드됩니다)
 *    - `window.google.maps.places.Autocomplete` 초기화 시 발생하는 경고는
 *      React의 라이프사이클과 Google Maps API의 로드 방식 차이로 인한 것으로, 현재 로직에서는 무시해도 기능상 문제가 없습니다.
 *
 * ===================================================================================================
 */

import React, { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';

/**
 * AddressAutocomplete
 *
 * @description Google Places API를 사용하여 주소 자동완성 기능을 제공하는 입력 필드 컴포넌트입니다.
 * @param {Object} props - 컴포넌트 프롭스
 * @param {string} props.value - 입력 필드의 현재 값 (주소 문자열)
 * @param {Function} props.onChange - 주소가 변경될 때 호출되는 콜백 함수.
 *                                    선택된 주소 정보({ address, lat, lng, placeId })를 인자로 받습니다.
 * @param {string} [props.placeholder="주소를 입력하세요"] - 입력 필드의 플레이스홀더 텍스트
 * @returns {JSX.Element} 주소 자동완성 입력 필드 컴포넌트
 *
 * @example
 * const [location, setLocation] = useState({ address: '', lat: null, lng: null });
 * <AddressAutocomplete
 *   value={location.address}
 *   onChange={(newLocation) => setLocation(newLocation)}
 * />
 */
const AddressAutocomplete = ({ value, onChange, placeholder = "주소를 입력하세요" }) => {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  useEffect(() => {
    // Google Maps API가 로드될 때까지 대기
    const checkGoogleMaps = setInterval(() => {
      if (window.google && window.google.maps && window.google.maps.places) {
        setIsLoaded(true);
        clearInterval(checkGoogleMaps);
      }
    }, 100);

    return () => clearInterval(checkGoogleMaps);
  }, []);

  useEffect(() => {
    if (!isLoaded || !inputRef.current) return;

    try {
      // Autocomplete 초기화
      autocompleteRef.current = new window.google.maps.places.Autocomplete(
        inputRef.current,
        {
          componentRestrictions: { country: 'kr' }, // 한국으로 제한
          fields: ['formatted_address', 'geometry', 'name', 'place_id'],
          types: ['geocode'] // 주소만
        }
      );

      // 장소 선택 이벤트 리스너
      const listener = autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();

        if (place && place.formatted_address) {
          setInputValue(place.formatted_address);
          onChange({
            address: place.formatted_address,
            lat: place.geometry?.location?.lat(),
            lng: place.geometry?.location?.lng(),
            placeId: place.place_id
          });
        }
      });

      return () => {
        if (listener) {
          window.google.maps.event.removeListener(listener);
        }
        // Autocomplete 인스턴스 정리
        if (autocompleteRef.current) {
          window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
        }
      };
    } catch (error) {
      console.error('Autocomplete 초기화 오류:', error);
    }
  }, [isLoaded, onChange]);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    // 사용자가 직접 입력할 때
    onChange({
      address: e.target.value,
      lat: null,
      lng: null,
      placeId: null
    });
  };

  const handleKeyDown = (e) => {
    // 엔터키를 누르면 첫 번째 추천 항목을 자동으로 선택
    if (e.key === 'Enter') {
      e.preventDefault();

      // Google Maps Autocomplete의 첫 번째 항목을 선택하기 위해
      // PAC container에서 첫 번째 항목을 찾아 클릭 이벤트 트리거
      setTimeout(() => {
        const pacContainer = document.querySelector('.pac-container');
        if (pacContainer) {
          const firstItem = pacContainer.querySelector('.pac-item:first-child');
          if (firstItem) {
            // 첫 번째 항목에 마우스 다운 이벤트 트리거
            const mouseDownEvent = new MouseEvent('mousedown', {
              bubbles: true,
              cancelable: true,
              view: window
            });
            firstItem.dispatchEvent(mouseDownEvent);
          }
        }
      }, 100);
    }
  };

  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
        <MapPin size={18} />
      </div>
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      {!isLoaded && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
