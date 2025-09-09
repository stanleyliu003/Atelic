/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const onCreateWishlistAnalysis = /* GraphQL */ `
  subscription OnCreateWishlistAnalysis(
    $filter: ModelSubscriptionWishlistAnalysisFilterInput
  ) {
    onCreateWishlistAnalysis(filter: $filter) {
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
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onUpdateWishlistAnalysis = /* GraphQL */ `
  subscription OnUpdateWishlistAnalysis(
    $filter: ModelSubscriptionWishlistAnalysisFilterInput
  ) {
    onUpdateWishlistAnalysis(filter: $filter) {
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
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onDeleteWishlistAnalysis = /* GraphQL */ `
  subscription OnDeleteWishlistAnalysis(
    $filter: ModelSubscriptionWishlistAnalysisFilterInput
  ) {
    onDeleteWishlistAnalysis(filter: $filter) {
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
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
