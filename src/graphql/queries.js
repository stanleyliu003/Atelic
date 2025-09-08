/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const analyzeWishlist = /* GraphQL */ `
  query AnalyzeWishlist($wishlist_text: String!, $selectedCity: String!) {
    analyzeWishlist(
      wishlist_text: $wishlist_text
      selectedCity: $selectedCity
    ) {
      wishlist_activities {
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
        display_name
        website_uri
        editorial_summary
        primary_type_display_name
        __typename
      }
      __typename
    }
  }
`;
export const getRoute = /* GraphQL */ `
  query GetRoute($waypoints: [WaypointInput!]!) {
    getRoute(waypoints: $waypoints) {
      polyline
      totalDistance
      totalDuration
      legs {
        distance
        duration
        polyline
        __typename
      }
      __typename
    }
  }
`;
export const getRegionImage = /* GraphQL */ `
  query GetRegionImage($selectedCity: String!) {
    getRegionImage(selectedCity: $selectedCity) {
      city
      photo_reference
      __typename
    }
  }
`;
export const getCityCategories = /* GraphQL */ `
  query GetCityCategories($selectedCity: String!) {
    getCityCategories(selectedCity: $selectedCity) {
      city
      categories {
        category
        category_items
        emoji
        __typename
      }
      __typename
    }
  }
`;
export const getCityPhoto = /* GraphQL */ `
  query GetCityPhoto($selectedCity: String!) {
    getCityPhoto(selectedCity: $selectedCity) {
      city
      photo_reference
      categories {
        category
        category_items
        emoji
        __typename
      }
      __typename
    }
  }
`;
export const addAdditionalPlace = /* GraphQL */ `
  query AddAdditionalPlace($placeName: String!, $selectedCity: String!) {
    addAdditionalPlace(placeName: $placeName, selectedCity: $selectedCity) {
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
      __typename
    }
  }
`;
export const getWishlistAnalysis = /* GraphQL */ `
  query GetWishlistAnalysis($id: ID!) {
    getWishlistAnalysis(id: $id) {
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
export const listWishlistAnalyses = /* GraphQL */ `
  query ListWishlistAnalyses(
    $filter: ModelWishlistAnalysisFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listWishlistAnalyses(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        wishlist_text
        timestamp
        analysis
        status
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
