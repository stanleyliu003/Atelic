import { API, graphqlOperation } from 'aws-amplify';
import { getRoute } from '../graphql/queries';
import { Activity, TravelMode, RouteLegModeData } from '../types/activity.types';
import { decodePolyline } from '../utils/polyline';

export interface RouteLeg {
  distance: number; // in meters
  duration: string; // Google's duration format (e.g., "15m 30s")
  polyline: string;
}

export interface RouteData {
  polyline: { latitude: number; longitude: number }[];
  legs: RouteLeg[];
  totalDistance: number;
  totalDuration: string;
  travelMode: string;
}

export async function fetchRoutePolyline(activities: Activity[]): Promise<RouteData> {
  const waypoints = activities
    .filter(a => a.lat != null && a.lng != null && a.place_id)
    .map(a => ({ place_id: a.place_id!, lat: a.lat!, lng: a.lng! }));

  if (waypoints.length < 2) {
    return {
      polyline: [],
      legs: [],
      totalDistance: 0,
      totalDuration: '',
      travelMode: 'DRIVE'
    };
  }

  const result = await API.graphql(graphqlOperation(getRoute, { waypoints }));

  const routeData = (result as any)?.data?.getRoute;
  
  if (!routeData) {
    console.log('No route data received from GraphQL');
    return {
      polyline: [],
      legs: [],
      totalDistance: 0,
      totalDuration: '',
      travelMode: 'DRIVE'
    };
  }

  const polyline = routeData.polyline ? decodePolyline(routeData.polyline) : [];
  const legs = routeData.legs || [];
  const totalDistance = routeData.totalDistance || 0;
  const totalDuration = routeData.totalDuration || '';
  const travelMode = routeData.travelMode || 'DRIVE';
  
  console.log('Frontend legs count:', legs.length);
  if (legs.length > 0) {
    console.log('First leg distances:', legs.map((leg: any) => leg.distance));
  }

  return {
    polyline,
    legs,
    totalDistance,
    totalDuration,
    travelMode
  };
}

/**
 * Fetch route polyline with a specific travel mode
 * @param activities Array of activities to route between
 * @param travelMode Specific travel mode to use (WALK, DRIVE, or TRANSIT)
 * @returns Route data with legs for the specified mode
 */
export async function fetchRoutePolylineWithMode(
  activities: Activity[],
  travelMode: TravelMode
): Promise<{ legs: RouteLegModeData[]; totalDistance: number; totalDuration: string }> {
  const waypoints = activities
    .filter(a => a.lat != null && a.lng != null && a.place_id)
    .map(a => ({
      place_id: a.place_id!,
      lat: a.lat!,
      lng: a.lng!,
      travelMode  // Pass mode to backend
    }));

  if (waypoints.length < 2) {
    return {
      legs: [],
      totalDistance: 0,
      totalDuration: ''
    };
  }

  try {
    const result: any = await API.graphql(
      graphqlOperation(getRoute, { waypoints })
    );

    const routeData = result?.data?.getRoute;

    if (!routeData) {
      console.log(`No route data received for ${travelMode} mode`);
      return {
        legs: [],
        totalDistance: 0,
        totalDuration: ''
      };
    }

    return {
      legs: routeData.legs?.map((leg: any) => ({
        distance: leg.distance,
        duration: leg.duration,
        polyline: leg.polyline
      })) || [],
      totalDistance: routeData.totalDistance || 0,
      totalDuration: routeData.totalDuration || ''
    };
  } catch (error) {
    console.error(`Error fetching route for ${travelMode} mode:`, error);
    return {
      legs: [],
      totalDistance: 0,
      totalDuration: ''
    };
  }
}
