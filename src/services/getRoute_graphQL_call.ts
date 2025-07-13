import { generateClient } from '@aws-amplify/api';
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
}

export async function fetchRoutePolyline(activities: Activity[]): Promise<RouteData> {
  const client = generateClient();
  const waypoints = activities
    .filter(a => a.lat != null && a.lng != null && a.place_id)
    .map(a => ({ place_id: a.place_id!, lat: a.lat!, lng: a.lng! }));

  if (waypoints.length < 2) {
    return {
      polyline: [],
      legs: [],
      totalDistance: 0,
      totalDuration: ''
    };
  }

  const result = await client.graphql({
    query: getRoute,
    variables: { waypoints }
  });

  const routeData = (result as any)?.data?.getRoute;
  if (!routeData) {
    return {
      polyline: [],
      legs: [],
      totalDistance: 0,
      totalDuration: ''
    };
  }

  const polyline = routeData.polyline ? decodePolyline(routeData.polyline) : [];
  const legs = routeData.legs || [];
  const totalDistance = routeData.totalDistance || 0;
  const totalDuration = routeData.totalDuration || '';

  return {
    polyline,
    legs,
    totalDistance,
    totalDuration
  };
} 