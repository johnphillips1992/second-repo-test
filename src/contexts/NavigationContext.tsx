import React, { createContext, useState, useContext, useCallback } from 'react';
import { useMemory, Memory } from './MemoryContext';
import { useLocation } from './LocationContext';
import { useUser } from './UserContext';

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface RouteLeg {
  distance: number;
  duration: number;
  startLocation: Coordinates;
  endLocation: Coordinates;
  steps: RouteStep[];
}

interface RouteStep {
  distance: number;
  duration: number;
  startLocation: Coordinates;
  endLocation: Coordinates;
  instruction: string;
  maneuver?: string;
}

export interface Route {
  distance: number;
  duration: number;
  legs: RouteLeg[];
  memoryWaypoints: MemoryWaypoint[];
}

export interface MemoryWaypoint {
  memory: Memory;
  distanceFromRoute: number;
  detourTime: number;
  waypointIndex: number;
}

interface NavigationState {
  origin: Coordinates | null;
  destination: Coordinates | null;
  currentRoute: Route | null;
  alternativeRoutes: Route[];
  activeNavigation: boolean;
  currentStepIndex: number;
  upcomingMemory: Memory | null;
  distanceToNextMemory: number | null;
  navigationStartTime: Date | null;
  estimatedArrivalTime: Date | null;
  travelledDistance: number;
}

interface NavigationContextType {
  navigationState: NavigationState;
  setOriginAndDestination: (origin: Coordinates, destination: Coordinates) => void;
  calculateRoutes: (transportMode: string, maxDetourMinutes: number, maxMemories?: number) => Promise<Route[]>;
  startNavigation: (routeIndex: number) => void;
  stopNavigation: () => void;
  navigateToNextStep: () => void;
  updateCurrentLocation: (location: Coordinates) => void;
  recalculateRoute: () => Promise<void>;
}

const defaultNavigationState: NavigationState = {
  origin: null,
  destination: null,
  currentRoute: null,
  alternativeRoutes: [],
  activeNavigation: false,
  currentStepIndex: 0,
  upcomingMemory: null,
  distanceToNextMemory: null,
  navigationStartTime: null,
  estimatedArrivalTime: null,
  travelledDistance: 0
};

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};

export const NavigationProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [navigationState, setNavigationState] = useState<NavigationState>(defaultNavigationState);
  const { memories } = useMemory();
  const { calculateDistance } = useLocation();
  const { userProfile } = useUser();

  // Set the starting point and destination for navigation
  const setOriginAndDestination = (origin: Coordinates, destination: Coordinates) => {
    setNavigationState(prevState => ({
      ...prevState,
      origin,
      destination,
      currentRoute: null,
      alternativeRoutes: [],
      activeNavigation: false
    }));
  };

  // Simplified version of route calculation algorithm that includes memory waypoints
  const calculateRoutes = async (
    transportMode: string = 'driving', 
    maxDetourMinutes: number = 10,
    maxMemories: number = 5
  ): Promise<Route[]> => {
    const { origin, destination } = navigationState;
    
    if (!origin || !destination) {
      throw new Error('Origin and destination must be set before calculating routes');
    }

    try {
      // In a real implementation, you would call a mapping API like Google Directions API
      // Here we're creating a simplified simulation of routes with memory waypoints
      
      // Find potential memory waypoints based on proximity to direct route
      const potentialWaypoints = findPotentialMemoryWaypoints(origin, destination, memories, maxDetourMinutes);
      
      // Sort waypoints by importance and proximity
      const sortedWaypoints = sortWaypointsByPriority(potentialWaypoints);
      
      // Select top waypoints based on maxMemories parameter
      const selectedWaypoints = sortedWaypoints.slice(0, maxMemories);
      
      // Generate primary route with waypoints
      const primaryRoute = generateRouteWithWaypoints(origin, destination, selectedWaypoints, transportMode);
      
      // Generate a couple alternative routes with different waypoint combinations
      const alternativeRoutes = generateAlternativeRoutes(origin, destination, sortedWaypoints, transportMode, 2);
      
      // Update state with the new routes
      setNavigationState(prevState => ({
        ...prevState,
        currentRoute: primaryRoute,
        alternativeRoutes
      }));
      
      return [primaryRoute, ...alternativeRoutes];
    } catch (error) {
      console.error('Error calculating routes:', error);
      throw new Error('Failed to calculate routes');
    }
  };

  // Start navigation with the selected route
  const startNavigation = (routeIndex: number = 0) => {
    const routes = [navigationState.currentRoute, ...navigationState.alternativeRoutes].filter(Boolean) as Route[];
    
    if (routes.length <= routeIndex) {
      throw new Error('Invalid route index');
    }
    
    const selectedRoute = routes[routeIndex];
    const now = new Date();
    const eta = new Date(now.getTime() + selectedRoute.duration * 1000);
    
    setNavigationState(prevState => ({
      ...prevState,
      currentRoute: selectedRoute,
      activeNavigation: true,
      currentStepIndex: 0,
      navigationStartTime: now,
      estimatedArrivalTime: eta,
      travelledDistance: 0,
      upcomingMemory: findUpcomingMemory(selectedRoute, 0)
    }));
  };

  // Stop the current navigation
  const stopNavigation = () => {
    setNavigationState(prevState => ({
      ...prevState,
      activeNavigation: false,
      currentStepIndex: 0,
      navigationStartTime: null,
      estimatedArrivalTime: null,
      upcomingMemory: null,
      distanceToNextMemory: null,
      travelledDistance: 0
    }));
  };

  // Move to the next navigation step
  const navigateToNextStep = () => {
    if (!navigationState.activeNavigation || !navigationState.currentRoute) {
      return;
    }
    
    const totalSteps = navigationState.currentRoute.legs.reduce(
      (total, leg) => total + leg.steps.length, 0
    );
    
    const newStepIndex = navigationState.currentStepIndex + 1;
    
    if (newStepIndex >= totalSteps) {
      // Navigation completed
      stopNavigation();
      return;
    }
    
    // Find the upcoming memory for the new step
    const upcomingMemory = findUpcomingMemory(navigationState.currentRoute, newStepIndex);
    
    setNavigationState(prevState => ({
      ...prevState,
      currentStepIndex: newStepIndex,
      upcomingMemory
    }));
  };

  // Update the current location during navigation
  const updateCurrentLocation = (location: Coordinates) => {
    if (!navigationState.activeNavigation || !navigationState.currentRoute) {
      return;
    }
    
    // Find current step based on location
    const { newStepIndex, distanceTravelled } = findCurrentStep(
      navigationState.currentRoute, 
      navigationState.currentStepIndex, 
      location
    );
    
    // Find upcoming memory based on current location
    const upcomingMemory = findUpcomingMemory(navigationState.currentRoute, newStepIndex);
    
    // Calculate distance to next memory
    let distanceToNextMemory = null;
    if (upcomingMemory && upcomingMemory.memory) {
      distanceToNextMemory = calculateDistance(
        location, 
        { latitude: upcomingMemory.memory.location.latitude, longitude: upcomingMemory.memory.location.longitude }
      );
    }
    
    // Update state with new position information
    setNavigationState(prevState => ({
      ...prevState,
      currentStepIndex: newStepIndex,
      upcomingMemory: upcomingMemory?.memory || null,
      distanceToNextMemory,
      travelledDistance: prevState.travelledDistance + distanceTravelled
    }));
  };

  // Recalculate the route based on current location
  const recalculateRoute = async (): Promise<void> => {
    if (!navigationState.activeNavigation || !navigationState.currentRoute || !navigationState.origin || !navigationState.destination) {
      return;
    }
    
    try {
      // Get current location
      const currentLocation = { 
        latitude: navigator.geolocation.getCurrentPosition(pos => pos.coords.latitude),
        longitude: navigator.geolocation.getCurrentPosition(pos => pos.coords.longitude)
      };
      
      // Use current location as new origin
      const maxDetourMinutes = userProfile?.navigationPreferences.maxDetourTime || 10;
      const transportMode = userProfile?.navigationPreferences.transportationMode || 'driving';
      
      // Recalculate routes from current position
      await calculateRoutes(transportMode, maxDetourMinutes);
      
      // Restart navigation with the new primary route
      startNavigation(0);
    } catch (error) {
      console.error('Error recalculating route:', error);
      throw new Error('Failed to recalculate route');
    }
  };

  // HELPER FUNCTIONS

  // Find potential memory waypoints based on proximity to direct route
  const findPotentialMemoryWaypoints = (
    origin: Coordinates, 
    destination: Coordinates,
    memories: Memory[],
    maxDetourMinutes: number
  ): MemoryWaypoint[] => {
    // Very simplified implementation
    // In a real app, you would use more sophisticated spatial algorithms
    
    const waypoints: MemoryWaypoint[] = [];
    const directDistance = calculateDistance(origin, destination);
    const averageSpeed = 50; // km/h, used to estimate detour time
    
    memories.forEach((memory, index) => {
      const memoryCoord = { 
        latitude: memory.location.latitude, 
        longitude: memory.location.longitude 
      };
      
      // Calculate distance from memory to both origin and destination
      const distanceFromOrigin = calculateDistance(origin, memoryCoord);
      const distanceFromDestination = calculateDistance(memoryCoord, destination);
      
      // Total route distance if we go through this memory
      const totalDistanceViaMemory = distanceFromOrigin + distanceFromDestination;
      
      // Extra distance caused by the detour
      const extraDistance = totalDistanceViaMemory - directDistance;
      
      // Estimate detour time in minutes
      const detourTimeMinutes = (extraDistance / 1000) / (averageSpeed / 60);
      
      // Only include memories that don't cause excessive detours
      if (detourTimeMinutes <= maxDetourMinutes) {
        waypoints.push({
          memory,
          distanceFromRoute: extraDistance,
          detourTime: detourTimeMinutes,
          waypointIndex: index
        });
      }
    });
    
    return waypoints;
  };

  // Sort waypoints by a combination of importance and minimal detour
  const sortWaypointsByPriority = (waypoints: MemoryWaypoint[]): MemoryWaypoint[] => {
    return [...waypoints].sort((a, b) => {
      // Create a combined score based on memory importance and detour time
      // Higher importance and lower detour time is better
      const scoreA = a.memory.importance * 10 - a.detourTime * 5;
      const scoreB = b.memory.importance * 10 - b.detourTime * 5;
      return scoreB - scoreA; // Higher score first
    });
  };

  // Generate a route with selected memory waypoints
  const generateRouteWithWaypoints = (
    origin: Coordinates,
    destination: Coordinates,
    waypoints: MemoryWaypoint[],
    transportMode: string
  ): Route => {
    // In a real app, this would call Google Directions API or similar
    // Here we'll create a simplified simulation
    
    // Start with direct route
    const directDistance = calculateDistance(origin, destination);
    const baseSpeed = getBaseSpeedForMode(transportMode); // meters per second
    const directDuration = directDistance / baseSpeed;
    
    if (waypoints.length === 0) {
      // No waypoints, return direct route
      return {
        distance: directDistance,
        duration: directDuration,
        legs: [{
          distance: directDistance,
          duration: directDuration,
          startLocation: origin,
          endLocation: destination,
          steps: [{
            distance: directDistance,
            duration: directDuration,
            startLocation: origin,
            endLocation: destination,
            instruction: `Head to destination`,
          }]
        }],
        memoryWaypoints: []
      };
    }
    
    // Order waypoints by optimal visiting sequence
    // In a real app, you would use a proper routing algorithm
    // Here we'll use a simple greedy approach
    const orderedWaypoints = orderWaypointsByGreedyPath(origin, destination, waypoints);
    
    // Generate route with legs between each point
    const legs: RouteLeg[] = [];
    let totalDistance = 0;
    let totalDuration = 0;
    
    // First leg: origin to first waypoint
    let prevPoint = origin;
    
    // Generate legs between points
    for (let i = 0; i < orderedWaypoints.length; i++) {
      const waypoint = orderedWaypoints[i];
      const waypointCoord = { 
        latitude: waypoint.memory.location.latitude, 
        longitude: waypoint.memory.location.longitude 
      };
      
      const legDistance = calculateDistance(prevPoint, waypointCoord);
      const legDuration = legDistance / baseSpeed;
      
      // Create simulated steps for this leg
      const steps = createSimulatedSteps(prevPoint, waypointCoord, legDistance, legDuration);
      
      legs.push({
        distance: legDistance,
        duration: legDuration,
        startLocation: prevPoint,
        endLocation: waypointCoord,
        steps
      });
      
      totalDistance += legDistance;
      totalDuration += legDuration;
      prevPoint = waypointCoord;
    }
    
    // Final leg: last waypoint to destination
    const finalLegDistance = calculateDistance(prevPoint, destination);
    const finalLegDuration = finalLegDistance / baseSpeed;
    
    const finalSteps = createSimulatedSteps(prevPoint, destination, finalLegDistance, finalLegDuration);
    
    legs.push({
      distance: finalLegDistance,
      duration: finalLegDuration,
      startLocation: prevPoint,
      endLocation: destination,
      steps: finalSteps
    });
    
    totalDistance += finalLegDistance;
    totalDuration += finalLegDuration;
    
    return {
      distance: totalDistance,
      duration: totalDuration,
      legs,
      memoryWaypoints: orderedWaypoints
    };
  };

  // Generate alternative routes with different waypoint combinations
  const generateAlternativeRoutes = (
    origin: Coordinates,
    destination: Coordinates,
    availableWaypoints: MemoryWaypoint[],
    transportMode: string,
    numAlternatives: number
  ): Route[] => {
    const alternatives: Route[] = [];
    
    // If we don't have enough waypoints, we can't create many alternatives
    if (availableWaypoints.length <= 1) {
      return alternatives;
    }
    
    for (let i = 0; i < numAlternatives; i++) {
      // For each alternative, select a different subset of waypoints
      // In a real app, you'd use more sophisticated selection strategies
      const selectedWaypoints = shuffleAndSelectWaypoints(availableWaypoints);
      
      // Generate route with these waypoints
      const route = generateRouteWithWaypoints(origin, destination, selectedWaypoints, transportMode);
      
      alternatives.push(route);
    }
    
    return alternatives;
  };

  // Helper function to find the upcoming memory during navigation
  const findUpcomingMemory = (route: Route, currentStepIndex: number): Memory | null => {
    if (!route.memoryWaypoints.length) {
      return null;
    }
    
    // Find which leg we're currently in
    let stepCount = 0;
    let currentLegIndex = 0;
    
    for (let i = 0; i < route.legs.length; i++) {
      stepCount += route.legs[i].steps.length;
      if (currentStepIndex < stepCount) {
        currentLegIndex = i;
        break;
      }
    }
    
    // Find the next memory waypoint after the current leg
    for (const waypoint of route.memoryWaypoints) {
      if (waypoint.waypointIndex >= currentLegIndex) {
        return waypoint.memory;
      }
    }
    
    return null;
  };

  // Helper function to determine current step based on location
  const findCurrentStep = (
    route: Route, 
    currentStepIndex: number,
    currentLocation: Coordinates
  ): { newStepIndex: number, distanceTravelled: number } => {
    // Simple implementation that assumes we're following the route
    // In a real app, you'd use more sophisticated algorithms to match location to path
    
    // Get current step
    let stepCount = 0;
    let currentLegIndex = 0;
    let legStepIndex = 0;
    
    // Find which leg and step we're currently in
    for (let i = 0; i < route.legs.length; i++) {
      const leg = route.legs[i];
      for (let j = 0; j < leg.steps.length; j++) {
        if (stepCount === currentStepIndex) {
          currentLegIndex = i;
          legStepIndex = j;
          break;
        }
        stepCount++;
      }
      if (stepCount === currentStepIndex) break;
    }
    
    const currentLeg = route.legs[currentLegIndex];
    const currentStep = currentLeg.steps[legStepIndex];
    
    // Calculate distance from end of current step
    const distanceToStepEnd = calculateDistance(currentLocation, currentStep.endLocation);
    
    // If we're very close to the end of the step, move to next step
    if (distanceToStepEnd < 20) { // 20 meters threshold
      return {
        newStepIndex: currentStepIndex + 1,
        distanceTravelled: distanceToStepEnd
      };
    }
    
    // Otherwise stay on current step
    // Calculate approximate distance travelled since last update
    // This is a very simple approximation
    const distanceTravelled = currentStep.distance * 0.1; // Assume we moved 10% of the step
    
    return {
      newStepIndex: currentStepIndex,
      distanceTravelled
    };
  };

  // Helper to get base speed based on transport mode
  const getBaseSpeedForMode = (mode: string): number => {
    switch (mode.toLowerCase()) {
      case 'walking':
        return 1.4; // meters per second (~ 5 km/h)
      case 'bicycling':
        return 4.2; // meters per second (~ 15 km/h)
      case 'transit':
        return 8.3; // meters per second (~ 30 km/h)
      case 'driving':
      default:
        return 13.9; // meters per second (~ 50 km/h)
    }
  };

  // Helper to create simulated navigation steps
  const createSimulatedSteps = (
    start: Coordinates, 
    end: Coordinates, 
    distance: number, 
    duration: number
  ): RouteStep[] => {
    // In a real app, this would come from a directions API
    // Here we'll create a simplified straight-line step
    return [{
      distance,
      duration,
      startLocation: start,
      endLocation: end,
      instruction: `Travel ${Math.round(distance)} meters to the next point`,
    }];
  };

  // Helper to order waypoints using a greedy path algorithm
  const orderWaypointsByGreedyPath = (
    start: Coordinates, 
    end: Coordinates, 
    waypoints: MemoryWaypoint[]
  ): MemoryWaypoint[] => {
    if (waypoints.length <= 1) return waypoints;
    
    const result: MemoryWaypoint[] = [];
    const unvisited = [...waypoints];
    let currentPoint = start;
    
    while (unvisited.length > 0) {
      // Find the closest unvisited waypoint
      let closestIndex = 0;
      let closestDistance = Infinity;
      
      for (let i = 0; i < unvisited.length; i++) {
        const waypoint = unvisited[i];
        const waypointCoord = { 
          latitude: waypoint.memory.location.latitude, 
          longitude: waypoint.memory.location.longitude 
        };
        
        const distance = calculateDistance(currentPoint, waypointCoord);
        
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = i;
        }
      }
      
      // Add the closest waypoint to our path
      const nextWaypoint = unvisited.splice(closestIndex, 1)[0];
      result.push(nextWaypoint);
      
      // Update current point
      currentPoint = { 
        latitude: nextWaypoint.memory.location.latitude, 
        longitude: nextWaypoint.memory.location.longitude 
      };
    }
    
    // Update the waypoint indices to match their position in the path
    return result.map((waypoint, index) => ({
      ...waypoint,
      waypointIndex: index
    }));
  };

  // Helper to randomly select waypoints for alternative routes
  const shuffleAndSelectWaypoints = (waypoints: MemoryWaypoint[]): MemoryWaypoint[] => {
    if (waypoints.length <= 2) return waypoints;
    
    // Shuffle array
    const shuffled = [...waypoints].sort(() => 0.5 - Math.random());
    
    // Select a random subset (between 50-90% of original waypoints)
    const count = Math.max(1, Math.floor(Math.random() * (waypoints.length * 0.4) + waypoints.length * 0.5));
    
    return shuffled.slice(0, count);
  };

  const value: NavigationContextType = {
    navigationState,
    setOriginAndDestination,
    calculateRoutes,
    startNavigation,
    stopNavigation,
    navigateToNextStep,
    updateCurrentLocation,
    recalculateRoute
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};