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
 *    - 자동완성 목록이 없을 때 Geocoding API로 좌표 찾기
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
      // 기존 pac-container 제거 (중복 방지)
      const existingContainers = document.querySelectorAll('.pac-container');
      existingContainers.forEach(container => container.remove());

      // Autocomplete 초기화
      autocompleteRef.current = new window.google.maps.places.Autocomplete(
        inputRef.current,
        {
          componentRestrictions: { country: 'kr' }, // 한국으로 제한
          fields: ['formatted_address', 'geometry', 'name', 'place_id']
          // types 제거 - 주소, 역, 건물 등 모든 장소 검색 가능
        }
      );

      // 장소 선택 이벤트 리스너
      const listener = autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();

        if (place && place.formatted_address) {
          const lat = place.geometry?.location?.lat();
          const lng = place.geometry?.location?.lng();

          console.log('🎯 [주소선택]', {
            address: place.formatted_address,
            lat: lat,
            lng: lng,
            hasGeometry: !!place.geometry
          });

          setInputValue(place.formatted_address);
          onChange({
            address: place.formatted_address,
            lat: lat,
            lng: lng,
            placeId: place.place_id
          });
        }
      });

      return () => {
        // 리스너 제거
        if (listener) {
          window.google.maps.event.removeListener(listener);
        }

        // autocomplete 인스턴스의 모든 이벤트 제거
        if (autocompleteRef.current) {
          window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
        }

        // pac-container 제거
        const pacContainers = document.querySelectorAll('.pac-container');
        pacContainers.forEach(container => container.remove());
      };
    } catch (error) {
      console.error('Autocomplete 초기화 오류:', error);
    }
  }, [isLoaded, onChange]);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      console.log('⌨️ [엔터키] 감지');

      // pac-container 찾기
      const pacContainer = document.querySelector('.pac-container');
      const pacItems = document.querySelectorAll('.pac-item');

      console.log('📋 [자동완성 상태]', {
        containerExists: !!pacContainer,
        itemCount: pacItems.length,
        inputValue: inputValue
      });

      // 자동완성 항목이 있으면 첫 번째 항목 선택
      if (pacItems && pacItems.length > 0) {
        console.log('✅ [첫번째 항목 선택]');
        e.preventDefault();

        // pac-container가 숨겨져 있으면 보이게 만들기
        if (pacContainer && pacContainer.style.display === 'none') {
          pacContainer.style.display = 'block';
        }

        // 첫 번째 항목 클릭 시뮬레이션
        const firstItem = pacItems[0];
        const clickEvent = new MouseEvent('mousedown', {
          view: window,
          bubbles: true,
          cancelable: true
        });
        firstItem.dispatchEvent(clickEvent);
      } else {
        // 자동완성 목록이 없으면 Geocoding API로 좌표 찾기
        console.log('🔎 [엔터키] 자동완성 목록 없음 - Geocoding으로 좌표 찾기');

        if (inputValue && inputValue.trim()) {
          e.preventDefault();
          e.stopPropagation();

          console.log('🌍 [Geocoding] 주소 검색 중:', inputValue);

          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode(
            {
              address: inputValue,
              componentRestrictions: { country: 'kr' }
            },
            (results, status) => {
              if (status === 'OK' && results[0]) {
                const result = results[0];
                const lat = result.geometry.location.lat();
                const lng = result.geometry.location.lng();

                console.log('✅ [Geocoding 성공]', {
                  address: result.formatted_address,
                  lat: lat,
                  lng: lng
                });

                setInputValue(result.formatted_address);
                onChange({
                  address: result.formatted_address,
                  lat: lat,
                  lng: lng,
                  placeId: result.place_id
                });
              } else {
                console.error('❌ [Geocoding 실패]', status);
                alert('주소를 찾을 수 없습니다. 자동완성 목록에서 선택해주세요.');
              }
            }
          );
        }
      }
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
