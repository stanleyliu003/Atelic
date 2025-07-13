import { API, graphqlOperation } from 'aws-amplify';
import { optimizeRoute } from '../graphql/mutations';
import { Activity } from '../types/activity.types';

const optimizeRouteCache: { [hash: string]: Activity[] } = {};

function hashActivitiesForOptimization(activities: Activity[]): string {
  // Hash by ordered place_ids (order matters for optimization)
  return activities.map(a => a.place_id).join(',');
}

export async function fetchOptimizedRoute(activities: Activity[]): Promise<{ result: Activity[], wasCached: boolean }> {
  const hash = hashActivitiesForOptimization(activities);
  if (optimizeRouteCache[hash]) {
    console.log(`[OPTIMIZE ROUTE CACHE] Cache hit for hash: ${hash}`);
    return { result: optimizeRouteCache[hash], wasCached: true };
  }
  console.log(`[OPTIMIZE ROUTE CACHE] Fetching new optimized route for hash: ${hash}`);
  
  // Only send place_id, name, lat, lng
  const activityInputs = activities.map(({ place_id, name, lat, lng }) => ({ place_id, name, lat, lng }));
  const result = await API.graphql(graphqlOperation(optimizeRoute, { activities: activityInputs }));
  const optimized = (result as any)?.data?.optimizeRoute || [];
  optimizeRouteCache[hash] = optimized;
  return { result: optimized, wasCached: false };
} 