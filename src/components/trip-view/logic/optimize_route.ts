import { Activity } from '../../../types/activity.types';
import { isLodgingActivity } from '../../../utils/lodging_enforcement';

// Haversine distance calculation
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
            Math.cos(lat1Rad) * Math.cos(lat2Rad) * 
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c;
}

// Build distance matrix using Haversine
function buildDistanceMatrix(activities: Activity[]): number[][] {
  const n = activities.length;
  const matrix = Array(n).fill(null).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        matrix[i][j] = haversineDistance(
          activities[i].lat!,
          activities[i].lng!,
          activities[j].lat!,
          activities[j].lng!
        );
      }
    }
  }
  return matrix;
}

// Find optimal starting point by trying all possible starting points
function findOptimalStartingPoint(distances: number[][]): number {
  const n = distances.length;
  let bestTotalDistance = Infinity;
  let bestStartingPoint = 0;
  
  // Try each location as a starting point
  for (let start = 0; start < n; start++) {
    const visited = Array(n).fill(false);
    const order = [start];
    visited[start] = true;
    
    // Build route from this starting point using nearest neighbor
    for (let step = 1; step < n; step++) {
      const current = order[order.length - 1];
      let minDist = Infinity;
      let nextIdx = -1;
      
      // Find nearest unvisited neighbor
      for (let j = 0; j < n; j++) {
        if (!visited[j] && distances[current][j] < minDist) {
          minDist = distances[current][j];
          nextIdx = j;
        }
      }
      
      if (nextIdx === -1) break; // No unvisited nodes
      order.push(nextIdx);
      visited[nextIdx] = true;
    }
    
    // Calculate total distance for this route
    const totalDistance = calculateTotalDistance(order, distances);
    
    // Update best if this route is shorter
    if (totalDistance < bestTotalDistance) {
      bestTotalDistance = totalDistance;
      bestStartingPoint = start;
    }
  }
  
  return bestStartingPoint;
}

// Nearest Neighbor algorithm with optimal starting point
function nearestNeighborOrder(distances: number[][]): number[] {
  const n = distances.length;
  const visited = Array(n).fill(false);
  
  // Find the optimal starting point
  const optimalStart = findOptimalStartingPoint(distances);
  const order = [optimalStart];
  visited[optimalStart] = true;
  
  for (let step = 1; step < n; step++) {
    const current = order[order.length - 1];
    let minDist = Infinity;
    let nextIdx = -1;
    
    // Find nearest unvisited neighbor
    for (let j = 0; j < n; j++) {
      if (!visited[j] && distances[current][j] < minDist) {
        minDist = distances[current][j];
        nextIdx = j;
      }
    }
    
    if (nextIdx === -1) break; // No unvisited nodes
    order.push(nextIdx); 
    visited[nextIdx] = true;
  }
  
  return order;
}

// 2-Opt algorithm for route improvement
function twoOptOptimize(route: number[], distances: number[][]): number[] {
  let improved = true;
  let bestDistance = calculateTotalDistance(route, distances);
  
  while (improved) {
    improved = false;
    
    for (let i = 0; i < route.length - 1; i++) {
      for (let j = i + 2; j < route.length; j++) {
        // Try swapping segments
        const newRoute = twoOptSwap(route, i, j);
        const newDistance = calculateTotalDistance(newRoute, distances);
        
        if (newDistance < bestDistance) {
          route = newRoute;
          bestDistance = newDistance;
          improved = true;
        }
      }
    }
  }
  
  return route;
}

function twoOptSwap(route: number[], i: number, j: number): number[] {
  return [
    ...route.slice(0, i + 1),
    ...route.slice(i + 1, j + 1).reverse(),
    ...route.slice(j + 1)
  ];
}

function calculateTotalDistance(route: number[], distances: number[][]): number {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    total += distances[route[i]][route[i + 1]];
  }
  return total;
}

// Main optimization function
export function optimizeRouteWithHaversine(activities: Activity[]): { result: Activity[], wasCached: boolean } {
  if (!activities || activities.length < 2) {
    return { result: activities, wasCached: false };
  }

  // Separate lodging from non-lodging activities
  const lodgingActivities: Activity[] = [];
  const nonLodgingActivities: Activity[] = [];

  activities.forEach(activity => {
    if (isLodgingActivity(activity)) {
      lodgingActivities.push(activity);
    } else {
      nonLodgingActivities.push(activity);
    }
  });

  // If there are lodging activities, only optimize the non-lodging ones
  if (lodgingActivities.length > 0) {
    // If there are no non-lodging activities to optimize, return as-is
    if (nonLodgingActivities.length === 0) {
      console.log('[HAVERSINE OPTIMIZATION] Only lodging activities found, no optimization needed');
      return { result: activities, wasCached: false };
    }

    // Optimize only the non-lodging activities
    const distances = buildDistanceMatrix(nonLodgingActivities);
    const initialRoute = nearestNeighborOrder(distances);
    const optimizedRoute = twoOptOptimize(initialRoute, distances);
    const optimizedNonLodging = optimizedRoute.map(idx => nonLodgingActivities[idx]);

    // Log the optimal starting point among non-lodging activities
    const optimalStartIndex = optimizedRoute[0];
    const optimalStartActivity = nonLodgingActivities[optimalStartIndex];
    console.log(`[HAVERSINE OPTIMIZATION] Optimal starting point (non-lodging): "${optimalStartActivity.name}" (index ${optimalStartIndex})`);

    // Reconstruct with lodging anchored at start and end
    let result: Activity[];
    if (lodgingActivities.length === 1) {
      const lodging = lodgingActivities[0];

      // Check if this is a check-out only activity (last day scenario)
      if (lodging.notes === 'Check-out') {
        // Only place at start, don't duplicate at end
        result = [lodging, ...optimizedNonLodging];
        console.log(`[HAVERSINE OPTIMIZATION] Anchored check-out lodging "${lodging.name}" at start only (last day)`);
      } else {
        // Same-day check-in/check-out or middle day - place at start and end
        result = [lodging, ...optimizedNonLodging, lodging];
        console.log(`[HAVERSINE OPTIMIZATION] Anchored lodging "${lodging.name}" at start and end`);
      }
    } else {
      // Multiple lodgings: place first at start, last at end
      const firstLodging = lodgingActivities[0];
      const lastLodging = lodgingActivities[lodgingActivities.length - 1];
      const middleLodgings = lodgingActivities.slice(1, -1);
      result = [firstLodging, ...optimizedNonLodging, ...middleLodgings, lastLodging];
      console.log(`[HAVERSINE OPTIMIZATION] Anchored first lodging "${firstLodging.name}" at start and last lodging "${lastLodging.name}" at end`);
    }

    return { result, wasCached: false };
  }

  // No lodging activities - optimize everything normally
  const distances = buildDistanceMatrix(activities);
  const initialRoute = nearestNeighborOrder(distances);
  const optimizedRoute = twoOptOptimize(initialRoute, distances);
  const result = optimizedRoute.map(idx => activities[idx]);

  // Log the optimal starting point
  const optimalStartIndex = optimizedRoute[0];
  const optimalStartActivity = activities[optimalStartIndex];
  console.log(`[HAVERSINE OPTIMIZATION] Optimal starting point: "${optimalStartActivity.name}" (index ${optimalStartIndex})`);

  return { result, wasCached: false };
} 