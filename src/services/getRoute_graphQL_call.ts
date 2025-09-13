import { API, graphqlOperation } from 'aws-amplify';
import { getRoute } from '../graphql/queries';
import { Activity } from '../types/activity.types';
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
  console.log('Frontend received route data:', JSON.stringify(routeData, null, 2));
  
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
  
  console.log('Frontend processed legs:', legs);
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