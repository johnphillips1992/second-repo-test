import React, { useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { setCurrentLocation } from '../../store/slices/navigationSlice';
import { Memory } from '../../store/slices/memoriesSlice';
import './MapView.css';

interface MapViewProps {
  memories?: Memory[];
  showCurrentLocation?: boolean;
  showMemoryMarkers?: boolean;
  interactive?: boolean;
  onMemoryMarkerClick?: (memoryId: string) => void;
  onMapClick?: (lat: number, lng: number) => void;
  selectedMemory?: Memory | null;
  currentRoute?: any; // Replace with proper type if needed
  height?: string;
}

const MapView: React.FC<MapViewProps> = ({
  memories = [],
  showCurrentLocation = true,
  showMemoryMarkers = true,
  interactive = true,
  onMemoryMarkerClick,
  onMapClick,
  selectedMemory,
  currentRoute,
  height = '400px',
}) => {
  const dispatch = useDispatch();
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  
  const { currentLocation } = useSelector((state: RootState) => state.navigation);
  
  // Initialize map
  useEffect(() => {
    const initMap = () => {
      if (mapRef.current && !googleMapRef.current) {
        const defaultCenter = { lat: 37.7749, lng: -122.4194 }; // San Francisco
        const mapOptions: google.maps.MapOptions = {
          center: currentLocation 
            ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
            : defaultCenter,
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }]
            }
          ]
        };
        
        googleMapRef.current = new google.maps.Map(mapRef.current, mapOptions);
        
        if (interactive) {
          googleMapRef.current.addListener('click', (e: google.maps.MapMouseEvent) => {
            if (onMapClick && e.latLng) {
              onMapClick(e.latLng.lat(), e.latLng.lng());
            }
          });
        }
        
        setMapLoaded(true);
      }
    };
    
    // Load Google Maps API if not already loaded
    if (!window.google || !window.google.maps) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = initMap;
      document.head.appendChild(script);
      
      return () => {
        document.head.removeChild(script);
      };
    } else {
      initMap();
    }
  }, [interactive, onMapClick]);
  
  // Update current location
  useEffect(() => {
    if (showCurrentLocation && mapLoaded && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          dispatch(setCurrentLocation({ latitude, longitude }));
        },
        (error) => {
          console.error('Error getting location:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000
        }
      );
      
      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    }
  }, [dispatch, showCurrentLocation, mapLoaded]);
  
  // Update map center when current location changes
  useEffect(() => {
    if (mapLoaded && googleMapRef.current && currentLocation && showCurrentLocation) {
      const position = {
        lat: currentLocation.latitude,
        lng: currentLocation.longitude
      };
      
      googleMapRef.current.panTo(position);
      
      // Add or update current location marker
      const markerExists = markersRef.current.some(marker => marker.getTitle() === 'Current Location');
      
      if (!markerExists) {
        const marker = new google.maps.Marker({
          position,
          map: googleMapRef.current,
          title: 'Current Location',
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#4285F4',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
          },
        });
        
        markersRef.current.push(marker);
      } else {
        markersRef.current
          .find(marker => marker.getTitle() === 'Current Location')
          ?.setPosition(position);
      }
    }
  }, [currentLocation, showCurrentLocation, mapLoaded]);
  
  // Update memory markers
  useEffect(() => {
    if (mapLoaded && googleMapRef.current && showMemoryMarkers) {
      // Clear existing memory markers
      markersRef.current
        .filter(marker => marker.getTitle() !== 'Current Location')
        .forEach(marker => {
          marker.setMap(null);
        });
      
      markersRef.current = markersRef.current
        .filter(marker => marker.getTitle() === 'Current Location');
      
      // Add new memory markers
      memories.forEach(memory => {
        const position = {
          lat: memory.location.latitude,
          lng: memory.location.longitude
        };
        
        const isSelected = selectedMemory?.id === memory.id;
        
        const marker = new google.maps.Marker({
          position,
          map: googleMapRef.current,
          title: memory.title,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: isSelected ? 10 : 8,
            fillColor: isSelected ? '#FF4081' : '#FF9800',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
          },
          animation: isSelected ? google.maps.Animation.BOUNCE : null,
        });
        
        if (onMemoryMarkerClick) {
          marker.addListener('click', () => {
            onMemoryMarkerClick(memory.id);
          });
        }
        
        markersRef.current.push(marker);
      });
    }
  }, [memories, selectedMemory, showMemoryMarkers, mapLoaded, onMemoryMarkerClick]);
  
  // Draw route if provided
  useEffect(() => {
    if (mapLoaded && googleMapRef.current && currentRoute) {
      // Remove existing polyline
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
      }
      
      // Create path from route steps
      const path = currentRoute.steps.flatMap((step: any) => [
        { lat: step.startLocation.latitude, lng: step.startLocation.longitude },
        { lat: step.endLocation.latitude, lng: step.endLocation.longitude }
      ]);
      
      // Create new polyline
      polylineRef.current = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: '#4285F4',
        strokeOpacity: 1.0,
        strokeWeight: 4,
        map: googleMapRef.current,
      });
      
      // Fit map to show the entire route
      const bounds = new google.maps.LatLngBounds();
      path.forEach(point => {
        bounds.extend(point);
      });
      googleMapRef.current.fitBounds(bounds);
    }
    
    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
      }
    };
  }, [currentRoute, mapLoaded]);

  return (
    <div className="map-container" style={{ height }}>
      <div ref={mapRef} className="google-map" />
    </div>
  );
};

export default MapView;