/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const optimizeRoute = /* GraphQL */ `
  mutation OptimizeRoute($activities: [ActivityInput!]!) {
    optimizeRoute(activities: $activities) {
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
  }
`;
export const createTrip = /* GraphQL */ `
  mutation CreateTrip($input: CreateTripInput!) {
    createTrip(input: $input) {
      tripId
      days {
        dayNumber
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
        editorial_summary
        primary_type_display_name
        international_phone_number
        __typename
      }
      tripLength
      selectedCity
      tripPhotoReference
      createdAt
      __typename
    }
  }
`;
export const deleteTrip = /* GraphQL */ `
  mutation DeleteTrip($userID: String!, $tripID: String!) {
    deleteTrip(userID: $userID, tripID: $tripID) {
      success
      message
      deletedTripID
      __typename
    }
  }
`;
export const createWishlistAnalysis = /* GraphQL */ `
  mutation CreateWishlistAnalysis(
    $input: CreateWishlistAnalysisInput!
    $condition: ModelWishlistAnalysisConditionInput
  ) {
    createWishlistAnalysis(input: $input, condition: $condition) {
      id
      wishlist_text
      timestamp
      analysis
      status
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
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const updateWishlistAnalysis = /* GraphQL */ `
  mutation UpdateWishlistAnalysis(
    $input: UpdateWishlistAnalysisInput!
    $condition: ModelWishlistAnalysisConditionInput
  ) {
    updateWishlistAnalysis(input: $input, condition: $condition) {
      id
      wishlist_text
      timestamp
      analysis
      status
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
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const deleteWishlistAnalysis = /* GraphQL */ `
  mutation DeleteWishlistAnalysis(
    $input: DeleteWishlistAnalysisInput!
    $condition: ModelWishlistAnalysisConditionInput
  ) {
    deleteWishlistAnalysis(input: $input, condition: $condition) {
      id
      wishlist_text
      timestamp
      analysis
      status
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
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
