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
      place_id
      photo_reference
      is_recommended
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
        place_id
        photo_reference
        is_recommended
        __typename
      }
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
        place_id
        photo_reference
        is_recommended
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
        place_id
        photo_reference
        is_recommended
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
        place_id
        photo_reference
        is_recommended
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
