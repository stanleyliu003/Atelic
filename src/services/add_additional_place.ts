import { API, graphqlOperation } from 'aws-amplify';
import { Activity } from '../types/activity.types';
import { Colors } from '../../constants/Colors';

export async function addAdditionalPlace(placeName: string, selectedCity: string): Promise<Activity | null> {
  const result = await API.graphql(graphqlOperation(`
    query AddAdditionalPlace($placeName: String!, $selectedCity: String!) {
      addAdditionalPlace(placeName: $placeName, selectedCity: $selectedCity) {
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
    }
  `, { 
    placeName,
    selectedCity: selectedCity || 'Unknown City',
  })) as any;

  return result?.data?.addAdditionalPlace ?? null;
}

export function buildExistingPlaceIdSet(
  wishlistActivities: Activity[] = [],
  dayActivities?: { [key: number]: { activities: Activity[] } }
): Set<string> {
  const ids = new Set<string>();
  wishlistActivities.forEach(a => {
    if (a?.place_id) ids.add(a.place_id);
  });
  if (dayActivities) {
    Object.values(dayActivities).forEach(dayObj => {
      const activities = (dayObj as any)?.activities as Activity[] | undefined;
      activities?.forEach(a => {
        if (a?.place_id) ids.add(a.place_id);
      });
    });
  }
  return ids;
}

export async function addAdditionalPlaceWithDedup(
  placeName: string,
  selectedCity: string,
  existingPlaceIds: Set<string>
): Promise<{ activity: Activity | null; duplicate: boolean }> {
  const newActivity = await addAdditionalPlace(placeName, selectedCity);
  if (!newActivity) return { activity: null, duplicate: false };
  const isDup = !!newActivity.place_id && existingPlaceIds.has(newActivity.place_id);
  return { activity: newActivity, duplicate: isDup };
}

export const defaultAddPlacesButtonStyle = { marginTop: 10, borderColor: Colors.GRAY } as const;


