import { API, graphqlOperation } from 'aws-amplify';
import { Activity } from '../types/activity.types';

interface GenerateCategoryActivitiesResponse {
  activities: Activity[];
  category: string;
}

export async function generateCategoryActivities(
  selectedCity: string,
  category: string,
  existingWishlistActivities: string[] = []
): Promise<GenerateCategoryActivitiesResponse | null> {
  try {
    console.log('[generateCategoryActivities] Making GraphQL call with params:', {
      selectedCity,
      category,
      existingWishlistActivities
    });

    const result = await API.graphql(graphqlOperation(`
      query GenerateCategoryActivities($selectedCity: String!, $category: String!, $existingWishlistActivities: [String!]) {
        generateCategoryActivities(selectedCity: $selectedCity, category: $category, existingWishlistActivities: $existingWishlistActivities) {
          activities {
            name
            city
            lat
            lng
            place_id
            rating
            user_ratings_total
            formatted_address
            types
            primaryType
            photo_reference
            is_recommended
            display_name
            website_uri
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
            editorial_summary
            primary_type_display_name
            international_phone_number
          }
          category
        }
      }
    `, {
      selectedCity,
      category,
      existingWishlistActivities
    })) as any;

    console.log('[generateCategoryActivities] GraphQL response:', result?.data?.generateCategoryActivities);

    return result?.data?.generateCategoryActivities ?? null;
  } catch (error) {
    console.error('[generateCategoryActivities] GraphQL error:', error);
    throw error;
  }
}