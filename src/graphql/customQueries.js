/* eslint-disable */
// Custom queries file - this will NOT be overwritten by Amplify

export const getUserTripsDetailed = /* GraphQL */ `
  query GetUserTripsDetailed($userID: String!, $tripID: String!) {
    getUserTrips(userID: $userID, tripID: $tripID) {
      tripId
      days {
        dayNumber
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
          regular_opening_hours {
            open_now
            periods {
              open {
                day
                time
                date
                truncated
                __typename
              }
              close {
                day
                time
                date
                truncated
                __typename
              }
              __typename
            }
            weekday_text
            __typename
          }
          reviews {
            author_name
            rating
            text
            time
            author_url
            profile_photo_url
            __typename
          }
          editorial_summary
          primary_type_display_name
          international_phone_number
          __typename
        }
        encodedPolyline
        __typename
      }
      wishlist {
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
        regular_opening_hours {
          open_now
          periods {
            open {
              day
              time
              date
              truncated
              __typename
            }
            close {
              day
              time
              date
              truncated
              __typename
            }
            __typename
          }
          weekday_text
          __typename
        }
        reviews {
          author_name
          rating
          text
          time
          author_url
          profile_photo_url
          __typename
        }
        editorial_summary
        primary_type_display_name
        international_phone_number
        __typename
      }
      tripLength
      selectedCity
      tripPhotoReference
      createdAt
      collaborators {
        email
        fullName
        userID
        role
        addedBy
        __typename
      }
      version
      updatedAt
      lastUpdatedBy
      __typename
    }
  }
`;

export const generateCategoryActivitiesDetailed = /* GraphQL */ `
  query GenerateCategoryActivitiesDetailed($selectedCity: String!, $category: String!, $existingCategoryActivities: [String!]) {
    generateCategoryActivities(
      selectedCity: $selectedCity
      category: $category
      existingCategoryActivities: $existingCategoryActivities
    ) {
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
        regular_opening_hours {
          open_now
          periods {
            open {
              day
              time
              date
              truncated
              __typename
            }
            close {
              day
              time
              date
              truncated
              __typename
            }
            __typename
          }
          weekday_text
          __typename
        }
        reviews {
          author_name
          rating
          text
          time
          author_url
          profile_photo_url
          __typename
        }
        editorial_summary
        primary_type_display_name
        international_phone_number
        __typename
      }
      category
      __typename
    }
  }
`;