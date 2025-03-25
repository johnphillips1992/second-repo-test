import React, { createContext, useState, useEffect, useContext } from 'react';

interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface Address {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  formattedAddress: string;
}

interface LocationContextType {
  currentLocation: Coordinates | null;
  loading: boolean;
  error: string | null;
  watchLocation: () => void;
  stopWatchingLocation: () => void;
  getAddress: (coordinates: Coordinates) => Promise<Address | null>;
  calculateDistance: (from: Coordinates, to: Coordinates) => number;
  isWithinRadius: (center: Coordinates, point: Coordinates, radiusMeters: number) => boolean;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};

export const LocationProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);

  // Clear watch on unmount
  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  const watchLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const id = navigator.geolocation.watchPosition(
        (position) => {
          setCurrentLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
          setLoading(false);
        },
        (err) => {
          setError(`Failed to get location: ${err.message}`);
          setLoading(false);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10000, // 10 seconds
          timeout: 5000 // 5 seconds
        }
      );

      setWatchId(id);
    } catch (err) {
      if (err instanceof Error) {
        setError(`Error starting location watch: ${err.message}`);
      } else {
        setError('An unknown error occurred while trying to watch location');
      }
      setLoading(false);
    }
  };

  const stopWatchingLocation = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
  };

  const getAddress = async (coordinates: Coordinates): Promise<Address | null> => {
    try {
      // Using Nominatim OpenStreetMap API for geocoding
      // Note: For production, you might want to use Google Maps Geocoding API or similar
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coordinates.latitude}&lon=${coordinates.longitude}&zoom=18&addressdetails=1`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch address data');
      }
      
      const data = await response.json();
      
      if (!data || !data.address) {
        throw new Error('Invalid address data received');
      }
      
      const { address } = data;
      
      // Format the address object based on OpenStreetMap response
      return {
        street: address.road || '',
        city: address.city || address.town || address.village || '',
        state: address.state || '',
        country: address.country || '',
        postalCode: address.postcode || '',
        formattedAddress: data.display_name || ''
      };
    } catch (err) {
      console.error('Error geocoding coordinates:', err);
      return null;
    }
  };

  // Calculate distance between two coordinates in meters using Haversine formula
  const calculateDistance = (from: Coordinates, to: Coordinates): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = from.latitude * Math.PI / 180;
    const φ2 = to.latitude * Math.PI / 180;
    const Δφ = (to.latitude - from.latitude) * Math.PI / 180;
    const Δλ = (to.longitude - from.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    return distance;
  };

  // Check if a point is within a certain radius of a center point
  const isWithinRadius = (center: Coordinates, point: Coordinates, radiusMeters: number): boolean => {
    const distance = calculateDistance(center, point);
    return distance <= radiusMeters;
  };

  const value: LocationContextType = {
    currentLocation,
    loading,
    error,
    watchLocation,
    stopWatchingLocation,
    getAddress,
    calculateDistance,
    isWithinRadius
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};