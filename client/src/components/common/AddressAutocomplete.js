import React, { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';

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
      // Autocomplete 초기화 (기존 방식 유지 - 경고는 무시)
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
