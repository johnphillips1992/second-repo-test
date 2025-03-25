import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../index';
import { Memory, MemoryLocation } from './memoriesSlice';

interface RoutePoint {
  latitude: number;
  longitude: number;
  memoryId?: string;
  isMemoryLocation: boolean;
  distanceFromRoute?: number; // in meters
}

interface RouteStep {
  instruction: string;
  distance: number; // in meters
  duration: number; // in seconds
  maneuver?: string;
  startLocation: {
    latitude: number;
    longitude: number;
  };
  endLocation: {
    latitude: number;
    longitude: number;
  };
  associatedMemoryId?: string;
}

export interface Route {
  id: string;
  origin: {
    latitude: number;
    longitude: number;
    address: string;
  };
  destination: {
    latitude: number;
    longitude: number;
    address: string;
  };
  waypoints: RoutePoint[];
  steps: RouteStep[];
  distance: number; // in meters
  duration: number; // in seconds
  memoryCount: number;
  createdAt: Date;
}

interface NavigationSettings {
  maxDetourTime: number; // in minutes
  maxMemoriesPerRoute: number;
  prioritizeImportantMemories: boolean;
  memoryNotificationsEnabled: boolean;
  voiceNavigationEnabled: boolean;
  notificationDistance: number; // in meters
}

interface NavigationState {
  currentLocation: {
    latitude: number;
    longitude: number;
  } | null;
  currentRoute: Route | null;
  alternativeRoutes: Route[];
  activeNavigation: boolean;
  currentStep: number;
  upcomingMemory: Memory | null;
  memoryDistanceRemaining: number | null;
  distanceToDestination: number | null;
  timeToDestination: number | null;
  settings: NavigationSettings;
  recentRoutes: Route[];
  isLoading: boolean;
  error: string | null;
}

const initialState: NavigationState = {
  currentLocation: null,
  currentRoute: null,
  alternativeRoutes: [],
  activeNavigation: false,
  currentStep: 0,
  upcomingMemory: null,
  memoryDistanceRemaining: null,
  distanceToDestination: null,
  timeToDestination: null,
  settings: {
    maxDetourTime: 10, // default 10 minutes
    maxMemoriesPerRoute: 5,
    prioritizeImportantMemories: true,
    memoryNotificationsEnabled: true,
    voiceNavigationEnabled: true,
    notificationDistance: 300, // 300 meters
  },
  recentRoutes: [],
  isLoading: false,
  error: null,
};

// Simulating the routing algorithm with memories
// In a real application, this would be a complex algorithm using Google Maps Directions API
export const calculateRouteWithMemories = createAsyncThunk(
  'navigation/calculateRoute',
  async ({
    origin,
    destination,
    settings
  }: {
    origin: { latitude: number; longitude: number; address: string };
    destination: { latitude: number; longitude: number; address: string };
    settings?: Partial<NavigationSettings>;
  }, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const allMemories = state.memories.memories;
      const mergedSettings = { ...state.navigation.settings, ...settings };

      // Simulate API call to calculate route
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Here we would normally call the routing API to get the base route
      // For now, we'll simulate a direct route
      
      // Find memories that are close to the direct route
      const routeMemories = allMemories
        .filter(memory => {
          // Simple distance check - in reality, this would be more complex
          // using actual distance from route calculation
          const memLat = memory.location.latitude;
          const memLng = memory.location.longitude;
          
          // This is a simplified check that would be replaced by actual route proximity calculation
          const isNearRoute = Math.random() > 0.5; // Simplified for demo
          
          return isNearRoute;
        })
        .sort((a, b) => {
          // Sort by importance if prioritizing important memories
          if (mergedSettings.prioritizeImportantMemories) {
            return b.importance - a.importance;
          }
          return 0;
        })
        .slice(0, mergedSettings.maxMemoriesPerRoute);

      // Create waypoints from the memory locations
      const waypoints: RoutePoint[] = routeMemories.map(memory => ({
        latitude: memory.location.latitude,
        longitude: memory.location.longitude,
        memoryId: memory.id,
        isMemoryLocation: true,
        distanceFromRoute: Math.floor(Math.random() * 500) // Simulate distance from route
      }));

      // Create simulated route steps
      const steps: RouteStep[] = [];
      let currentLat = origin.latitude;
      let currentLng = origin.longitude;
      const latStep = (destination.latitude - origin.latitude) / 10;
      const lngStep = (destination.longitude - origin.longitude) / 10;

      // Create intermediate steps
      for (let i = 0; i < 10; i++) {
        const nextLat = currentLat + latStep;
        const nextLng = currentLng + lngStep;
        
        // Check if any memory is close to this step
        const nearbyMemory = waypoints.find(wp => {
          const latDiff = Math.abs(wp.latitude - nextLat);
          const lngDiff = Math.abs(wp.longitude - nextLng);
          return latDiff < 0.005 && lngDiff < 0.005; // Arbitrary small threshold
        });
        
        steps.push({
          instruction: nearbyMemory 
            ? "Drive past a memory location" 
            : `Continue on the route for ${Math.floor(Math.random() * 500 + 100)} meters`,
          distance: Math.floor(Math.random() * 500 + 100),
          duration: Math.floor(Math.random() * 60 + 30),
          maneuver: i === 0 ? "start" : (i === 9 ? "arrive" : "straight"),
          startLocation: {
            latitude: currentLat,
            longitude: currentLng
          },
          endLocation: {
            latitude: nextLat,
            longitude: nextLng
          },
          associatedMemoryId: nearbyMemory?.memoryId
        });
        
        currentLat = nextLat;
        currentLng = nextLng;
      }

      // Calculate total distance and duration
      const totalDistance = steps.reduce((sum, step) => sum + step.distance, 0);
      const totalDuration = steps.reduce((sum, step) => sum + step.duration, 0);

      // Create the route object
      const route: Route = {
        id: `route_${Date.now()}`,
        origin,
        destination,
        waypoints,
        steps,
        distance: totalDistance,
        duration: totalDuration,
        memoryCount: routeMemories.length,
        createdAt: new Date()
      };

      // Also generate a couple of alternative routes with fewer/different memories
      const alternativeRoutes: Route[] = Array(2).fill(null).map((_, index) => {
        const altWaypoints = routeMemories
          .filter(() => Math.random() > 0.3) // Randomly exclude some memories
          .map(memory => ({
            latitude: memory.location.latitude,
            longitude: memory.location.longitude,
            memoryId: memory.id,
            isMemoryLocation: true,
            distanceFromRoute: Math.floor(Math.random() * 500)
          }));

        // Create slightly different steps for the alternative route
        const altSteps = steps.map(step => ({
          ...step,
          distance: step.distance * (0.9 + Math.random() * 0.2), // +/- 10%
          duration: step.duration * (0.9 + Math.random() * 0.2) // +/- 10%
        }));

        const altTotalDistance = altSteps.reduce((sum, step) => sum + step.distance, 0);
        const altTotalDuration = altSteps.reduce((sum, step) => sum + step.duration, 0);

        return {
          id: `route_alt_${index}_${Date.now()}`,
          origin,
          destination,
          waypoints: altWaypoints,
          steps: altSteps,
          distance: altTotalDistance,
          duration: altTotalDuration,
          memoryCount: altWaypoints.length,
          createdAt: new Date()
        };
      });

      return {
        route,
        alternativeRoutes
      };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const startNavigation = createAsyncThunk(
  'navigation/startNavigation',
  async (routeId: string, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const { currentRoute, alternativeRoutes } = state.navigation;
      
      // Find the selected route
      let selectedRoute: Route | null = null;
      
      if (currentRoute && currentRoute.id === routeId) {
        selectedRoute = currentRoute;
      } else {
        selectedRoute = alternativeRoutes.find(route => route.id === routeId) || null;
      }
      
      if (!selectedRoute) {
        return rejectWithValue('Selected route not found');
      }
      
      // We would typically start location tracking and other navigation setup here
      
      return selectedRoute;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateCurrentLocation = createAsyncThunk(
  'navigation/updateCurrentLocation',
  async (location: { latitude: number; longitude: number }, { getState, dispatch }) => {
    const state = getState() as RootState;
    const { currentRoute, currentStep, settings, activeNavigation } = state.navigation;
    
    if (!activeNavigation || !currentRoute) {
      return location;
    }
    
    // Update navigation progress
    const currentStepData = currentRoute.steps[currentStep];
    const nextStepData = currentRoute.steps[currentStep + 1];
    
    // Check if we've reached the next step
    if (nextStepData) {
      const distanceToNextStep = calculateDistance(
        location.latitude,
        location.longitude,
        nextStepData.startLocation.latitude,
        nextStepData.startLocation.longitude
      );
      
      if (distanceToNextStep < 20) { // Within 20 meters of next step
        dispatch(advanceToNextStep());
      }
    }
    
    // Check for upcoming memories
    const upcomingMemoryWaypoints = currentRoute.waypoints
      .filter(wp => wp.isMemoryLocation)
      .map(wp => {
        const distance = calculateDistance(
          location.latitude,
          location.longitude,
          wp.latitude,
          wp.longitude
        );
        return { ...wp, currentDistance: distance };
      })
      .filter(wp => wp.currentDistance < settings.notificationDistance)
      .sort((a, b) => (a.currentDistance || 0) - (b.currentDistance || 0));
    
    // If we have an upcoming memory within notification distance
    if (upcomingMemoryWaypoints.length > 0) {
      const nextMemory = upcomingMemoryWaypoints[0];
      dispatch(setUpcomingMemory({
        memoryId: nextMemory.memoryId,
        distance: nextMemory.currentDistance || 0
      }));
    }
    
    // Calculate remaining stats
    const remainingSteps = currentRoute.steps.slice(currentStep);
    const distanceRemaining = remainingSteps.reduce((sum, step) => sum + step.distance, 0);
    const timeRemaining = remainingSteps.reduce((sum, step) => sum + step.duration, 0);
    
    dispatch(updateNavigationStats({
      distanceToDestination: distanceRemaining,
      timeToDestination: timeRemaining
    }));
    
    return location;
  }
);

// Helper function to calculate distance between two coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

const navigationSlice = createSlice({
  name: 'navigation',
  initialState,
  reducers: {
    setCurrentLocation: (state, action: PayloadAction<{ latitude: number; longitude: number }>) => {
      state.currentLocation = action.payload;
    },
    advanceToNextStep: (state) => {
      if (state.currentRoute && state.currentStep < state.currentRoute.steps.length - 1) {
        state.currentStep += 1;
      }
    },
    setUpcomingMemory: (state, action: PayloadAction<{ memoryId?: string; distance: number }>) => {
      if (action.payload.memoryId) {
        // This would normally fetch the memory from the memories state
        // For now, we'll just update the distance
        state.memoryDistanceRemaining = action.payload.distance;
      } else {
        state.upcomingMemory = null;
        state.memoryDistanceRemaining = null;
      }
    },
    updateNavigationStats: (state, action: PayloadAction<{ 
      distanceToDestination: number; 
      timeToDestination: number 
    }>) => {
      state.distanceToDestination = action.payload.distanceToDestination;
      state.timeToDestination = action.payload.timeToDestination;
    },
    stopNavigation: (state) => {
      state.activeNavigation = false;
      state.currentStep = 0;
      state.upcomingMemory = null;
      state.memoryDistanceRemaining = null;
      
      // Add current route to recent routes if it exists
      if (state.currentRoute) {
        state.recentRoutes = [
          state.currentRoute,
          ...state.recentRoutes.slice(0, 4) // Keep only the 5 most recent
        ];
      }
    },
    updateSettings: (state, action: PayloadAction<Partial<NavigationSettings>>) => {
      state.settings = { ...state.settings, ...action.payload };
    },
    clearRoutes: (state) => {
      state.currentRoute = null;
      state.alternativeRoutes = [];
    },
  },
  extraReducers: (builder) => {
    // Calculate route
    builder.addCase(calculateRouteWithMemories.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(calculateRouteWithMemories.fulfilled, (state, action) => {
      state.currentRoute = action.payload.route;
      state.alternativeRoutes = action.payload.alternativeRoutes;
      state.isLoading = false;
    });
    builder.addCase(calculateRouteWithMemories.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    
    // Start navigation
    builder.addCase(startNavigation.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(startNavigation.fulfilled, (state, action) => {
      state.currentRoute = action.payload;
      state.activeNavigation = true;
      state.currentStep = 0;
      state.isLoading = false;
    });
    builder.addCase(startNavigation.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    
    // Update current location
    builder.addCase(updateCurrentLocation.fulfilled, (state, action) => {
      state.currentLocation = action.payload;
    });
  },
});

export const {
  setCurrentLocation,
  advanceToNextStep,
  setUpcomingMemory,
  updateNavigationStats,
  stopNavigation,
  updateSettings,
  clearRoutes,
} = navigationSlice.actions;

export default navigationSlice.reducer;