import React, { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';

const AddressAutocomplete = ({ value, onChange, placeholder = "주소를 입력하세요" }) => {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);

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
          types: ['address', 'establishment'] // 주소와 장소
        }
      );

      // 장소 선택 이벤트 리스너
      const listener = autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();

        if (place && place.formatted_address) {
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
      console.error('Google Maps Autocomplete 초기화 실패:', error);
    }
  }, [isLoaded, onChange]);

  const handleInputChange = (e) => {
    // 수동 입력도 허용
    onChange({
      address: e.target.value,
      lat: null,
      lng: null,
      placeId: null
    });
  };

  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
        <MapPin size={18} />
      </div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
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
