import { API, graphqlOperation } from 'aws-amplify';
import { Activity } from '../types/activity.types';

interface SearchAutocompleteResponse {
  suggestions: string[];
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
 * Get search autocomplete suggestions using Gemini AI
 * @param selectedCity - The city to search in
 * @param query - The user's search query
 * @param filters - Optional array of filter IDs (e.g., ['kid_friendly', 'budget_friendly'])
 * @returns Array of autocomplete suggestions
 */
export async function getSearchAutocomplete(
  selectedCity: string,
  query: string,
  filters: string[] = []
): Promise<string[]> {
  try {
    console.log('[getSearchAutocomplete] Making GraphQL call with params:', {
      selectedCity,
      query,
      filters
    });

    const result = await API.graphql(graphqlOperation(`
      query SearchAutocomplete($selectedCity: String!, $query: String!, $filters: [String!]) {
        searchAutocomplete(selectedCity: $selectedCity, query: $query, filters: $filters) {
          suggestions
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

    return result?.data?.searchActivities ?? { activities: [], query: searchQuery };
  } catch (error) {
    console.error('[searchActivities] GraphQL error:', error);
    throw error;
  }
}