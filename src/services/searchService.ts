import { API, graphqlOperation } from 'aws-amplify';
import { Activity } from '../types/activity.types';
import { randomUUID } from 'expo-crypto';

/**
 * Place suggestion from autocomplete
 * Contains the place name, address info, and place_id
 */
export interface PlaceSuggestion {
  name: string;
  address_info: string;
  place_id?: string;
}

interface SearchAutocompleteResponse {
  suggestions: PlaceSuggestion[];
}

interface GetPlaceDetailsResponse {
  activity: Activity;
  query: string;
}

interface SearchActivitiesResponse {
  activities: Activity[];
  query: string;
}

interface ActivityDeduplication {
  name: string;
  place_id?: string;
}

/**
 * Get search autocomplete suggestions using Google Places Autocomplete API
 * Returns specific place suggestions with name, address, and place_id
 * @param selectedCity - The city to search in
 * @param query - The user's search query
 * @param filters - Optional array of filter IDs (e.g., ['kid_friendly', 'budget_friendly'])
 * @returns Array of place suggestions
 */
export async function getSearchAutocomplete(
  selectedCity: string,
  query: string,
  filters: string[] = []
): Promise<PlaceSuggestion[]> {
  try {
    console.log('[getSearchAutocomplete] Making GraphQL call with params:', {
      selectedCity,
      query,
      filters
    });

    const result = await API.graphql(graphqlOperation(`
      query SearchAutocomplete($selectedCity: String!, $query: String!, $filters: [String!]) {
        searchAutocomplete(selectedCity: $selectedCity, query: $query, filters: $filters) {
          suggestions {
            name
            address_info
            place_id
          }
        }
      }
    `, {
      selectedCity,
      query,
      filters
    })) as any;

    console.log('[getSearchAutocomplete] GraphQL response:', result?.data?.searchAutocomplete);

    return result?.data?.searchAutocomplete?.suggestions ?? [];
  } catch (error) {
    console.error('[getSearchAutocomplete] GraphQL error:', error);
    throw error;
  }
}

/**
 * Get full place details by place_id
 * Called when user selects a place from autocomplete
 * @param place_id - The Google Places place_id
 * @param selectedCity - The city context
 * @returns Activity object with full details
 */
export async function getPlaceDetails(
  place_id: string,
  selectedCity: string
): Promise<Activity> {
  try {
    console.log('[getPlaceDetails] Making GraphQL call with params:', {
      place_id,
      selectedCity
    });

    const result = await API.graphql(graphqlOperation(`
      query GetPlaceDetails($place_id: String!, $selectedCity: String!) {
        getPlaceDetails(place_id: $place_id, selectedCity: $selectedCity) {
          activity {
            name
            city
            lat
            lng
            rating
            user_ratings_total
            formatted_address
            types
            primaryType
            place_id
            photo_reference
            is_recommended
            display_name
            website_uri
            editorial_summary
            primary_type_display_name
            international_phone_number
            detailsLoaded
            instanceId
            regular_opening_hours {
              open_now
              weekday_text
            }
            reviews {
              author_name
              rating
              text
              time
              author_url
              profile_photo_url
            }
          }
          query
        }
      }
    `, {
      place_id,
      selectedCity
    })) as any;

    console.log('[getPlaceDetails] GraphQL response:', result?.data?.getPlaceDetails);

    const activityData = result?.data?.getPlaceDetails?.activity;

    if (!activityData) {
      throw new Error('No activity data returned from getPlaceDetails');
    }

    return activityData;
  } catch (error) {
    console.error('[getPlaceDetails] GraphQL error:', error);
    throw error;
  }
}

/**
 * Search for activities using the searchBarActivities Lambda
 * Handles both address queries (returns 1 result) and general searches (returns 4 results)
 * @param selectedCity - The city to search in
 * @param searchQuery - The user's search query (can be address or general search)
 * @param filters - Optional array of filter IDs
 * @param existingWishlistActivities - Activities to exclude from results (for deduplication). Pass full Activity objects with name and place_id for best results.
 * @returns Search activities response with activities array
 */
export async function searchActivities(
  selectedCity: string,
  searchQuery: string,
  filters: string[] = [],
  existingWishlistActivities: ActivityDeduplication[] | Activity[] = []
): Promise<SearchActivitiesResponse> {
  try {
    // Map activities to the new format with name and place_id
    const formattedActivities = existingWishlistActivities.map(activity => {
      if (typeof activity === 'string') {
        // Legacy string format - convert to object format
        return { name: activity, place_id: undefined };
      }
      // Object format - extract name and place_id
      return {
        name: activity.name,
        place_id: activity.place_id || undefined
      };
    });

    console.log('[searchActivities] Making GraphQL call with params:', {
      selectedCity,
      searchQuery,
      filters,
      existingWishlistActivities: formattedActivities
    });

    const result = await API.graphql(graphqlOperation(`
      query SearchActivities(
        $selectedCity: String!
        $searchQuery: String!
        $filters: [String!]
        $existingWishlistActivities: [ActivityDeduplicationInput!]
      ) {
        searchActivities(
          selectedCity: $selectedCity
          searchQuery: $searchQuery
          filters: $filters
          existingWishlistActivities: $existingWishlistActivities
        ) {
          query
          activities {
            name
            city
            lat
            lng
            rating
            user_ratings_total
            formatted_address
            types
            primaryType
            place_id
            photo_reference
            is_recommended
            display_name
            website_uri
            editorial_summary
            primary_type_display_name
            international_phone_number
            detailsLoaded
            regular_opening_hours {
              open_now
              weekday_text
            }
            reviews {
              author_name
              rating
              text
              time
              author_url
              profile_photo_url
            }
          }
        }
      }
    `, {
      selectedCity,
      searchQuery,
      filters,
      existingWishlistActivities: formattedActivities
    })) as any;

    console.log('[searchActivities] GraphQL response:', result?.data?.searchActivities);

    // Add instanceId to all activities for duplicate support
    const response = result?.data?.searchActivities ?? { activities: [], query: searchQuery };
    if (response.activities && response.activities.length > 0) {
      response.activities = response.activities.map((activity: Activity) => ({
        ...activity,
        instanceId: randomUUID()
      }));
    }

    return response;
  } catch (error) {
    console.error('[searchActivities] GraphQL error:', error);
    throw error;
  }
}

/**
 * Fetch lazy-loaded place details (Enterprise + Atmosphere fields)
 * Called on-demand when user opens the description card for an activity
 * that was loaded with only eager fields (detailsLoaded === false).
 * @param place_id - The Google Places place_id
 * @returns Partial Activity with lazy fields (rating, reviews, hours, etc.)
 */
export async function fetchPlaceDetailsLazy(
  place_id: string
): Promise<Partial<Activity>> {
  try {
    const result = await API.graphql(graphqlOperation(`
      query FetchPlaceDetailsLazy($place_id: String!, $lazyLoad: Boolean!) {
        fetchPlaceDetailsLazy(place_id: $place_id, lazyLoad: $lazyLoad) {
          rating
          user_ratings_total
          editorial_summary
          website_uri
          international_phone_number
          regular_opening_hours {
            open_now
            periods {
              open { day time }
              close { day time }
            }
            weekday_text
          }
          reviews {
            author_name
            rating
            text
            time
            author_url
            profile_photo_url
          }
        }
      }
    `, { place_id, lazyLoad: true })) as any;

    const lazyData = result?.data?.fetchPlaceDetailsLazy;

    if (!lazyData) {
      console.warn('[fetchPlaceDetailsLazy] No data returned for place_id:', place_id);
      return {};
    }

    return lazyData;
  } catch (error) {
    console.error('[fetchPlaceDetailsLazy] GraphQL error:', error);
    throw error;
  }
}