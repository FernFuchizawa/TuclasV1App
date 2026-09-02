import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Crisp inline SVG pin icon (100% reliable, never fails to load)
const pinSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="#0284c7" stroke="#ffffff" stroke-width="1.5">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
    <circle cx="12" cy="9" r="3" fill="#ffffff"/>
  </svg>
`;

const customPinIcon = L.divIcon({
  html: pinSvg,
  className: 'custom-map-pin',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

interface LocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(
        parseFloat(e.latlng.lat.toFixed(6)),
        parseFloat(e.latlng.lng.toFixed(6))
      );
    },
  });
  return null;
}

export default function LocationPickerMap({ latitude, longitude, onChange }: LocationPickerProps) {
  // Validate coordinates
  const validLat = typeof latitude === 'number' && !isNaN(latitude) ? latitude : null;
  const validLng = typeof longitude === 'number' && !isNaN(longitude) ? longitude : null;

  const [position, setPosition] = useState<[number, number] | null>(
    validLat && validLng ? [validLat, validLng] : null
  );

  useEffect(() => {
    if (validLat && validLng) {
      setPosition([validLat, validLng]);
    } else {
      setPosition(null);
    }
  }, [validLat, validLng]);

  const handleMapClick = (lat: number, lng: number) => {
    setPosition([lat, lng]);
    onChange(lat, lng);
  };

  const defaultCenter: [number, number] = [12.6186, 122.0722]; // Calatrava, Romblon

  return (
    <div className="h-64 w-full rounded-xl overflow-hidden border border-slate-200 relative z-0">
      <MapContainer
        center={position || defaultCenter}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onClick={handleMapClick} />
        {position && <Marker position={position} icon={customPinIcon} />}
      </MapContainer>
    </div>
  );
}