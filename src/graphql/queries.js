/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const analyzeWishlist = /* GraphQL */ `
  query AnalyzeWishlist($wishlist_text: String!, $selectedCity: String!) {
    analyzeWishlist(
      wishlist_text: $wishlist_text
      selectedCity: $selectedCity
    ) {
      wishlist_activities {
        instanceId
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
        notes
        startTime
        endTime
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
      travelMode
      polylineTravelMode
      distanceTravelMode
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
      instanceId
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
      notes
      startTime
      endTime
      __typename
    }
  }
`;
export const generateCategoryActivities = /* GraphQL */ `
  query GenerateCategoryActivities(
    $selectedCity: String!
    $category: String!
    $existingWishlistActivities: [String!]
  ) {
    generateCategoryActivities(
      selectedCity: $selectedCity
      category: $category
      existingWishlistActivities: $existingWishlistActivities
    ) {
      activities {
        instanceId
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
        notes
        startTime
        endTime
        __typename
      }
      category
      __typename
    }
  }
`;
export const searchAutocomplete = /* GraphQL */ `
  query SearchAutocomplete(
    $selectedCity: String!
    $query: String!
    $filters: [String!]
  ) {
    searchAutocomplete(
      selectedCity: $selectedCity
      query: $query
      filters: $filters
    ) {
      suggestions {
        name
        address_info
        place_id
        __typename
      }
      __typename
    }
  }
`;
export const getPlaceDetails = /* GraphQL */ `
  query GetPlaceDetails($place_id: String!, $selectedCity: String!) {
    getPlaceDetails(place_id: $place_id, selectedCity: $selectedCity) {
      activity {
        instanceId
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
        notes
        startTime
        endTime
        __typename
      }
      query
      __typename
    }
  }
`;
export const searchActivities = /* GraphQL */ `
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
      activities {
        instanceId
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
        notes
        startTime
        endTime
        __typename
      }
      query
      __typename
    }
  }
`;
export const getTripIDs = /* GraphQL */ `
  query GetTripIDs($userID: String!) {
    getTripIDs(userID: $userID) {
      tripId
      selectedCity
      tripPhotoReference
      createdAt
      startDate
      endDate
      tripLength
      userRole
      __typename
    }
  }
`;
export const getUserTrips = /* GraphQL */ `
  query GetUserTrips($userID: String!, $tripID: String!) {
    getUserTrips(userID: $userID, tripID: $tripID) {
      tripId
      days {
        dayNumber
        encodedPolyline
        travelModes
        __typename
      }
      wishlist {
        instanceId
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
        notes
        startTime
        endTime
        __typename
      }
      tripLength
      selectedCity
      tripPhotoReference
      createdAt
      startDate
      endDate
      collaborators {
        email
        fullName
        username
        userID
        role
        addedBy
        __typename
      }
      version
      updatedAt
      lastUpdatedBy
      cityCategories {
        category
        category_items
        emoji
        __typename
      }
      notes
      duration
      arrivalTime
      photos
      hotel
      flight
      savedActivities
      recentSearches {
        place_id
        name
        address_info
        timestamp
        __typename
      }
      __typename
    }
  }
`;
export const searchUsers = /* GraphQL */ `
  query SearchUsers($searchTerm: String!) {
    searchUsers(searchTerm: $searchTerm) {
      userID
      email
      fullName
      username
      isExternalProvider
      identities
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
        instanceId
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
        notes
        startTime
        endTime
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
export const getUserProfile = /* GraphQL */ `
  query GetUserProfile($username: String, $userID: String) {
    getUserProfile(username: $username, userID: $userID) {
      username
      userID
      email
      fullName
      age
      gender
      ownedTripsCount
      ownedTrips {
        tripId
        selectedCity
        tripPhotoReference
        startDate
        endDate
        tripLength
        createdAt
        updatedAt
        __typename
      }
      sharedTripsCount
      sharedTrips {
        tripId
        selectedCity
        tripPhotoReference
        startDate
        endDate
        tripLength
        role
        ownerUsername
        createdAt
        updatedAt
        __typename
      }
      totalTripsCompleted
      totalTripsUpcoming
      totalTripsInProgress
      activitiesPerTrip
      totalActivitiesOwned
      avgActivitiesPerTrip
      collaboratorsPerTrip
      totalCollaboratorsAcrossTrips
      avgCollaboratorsPerTrip
      mostVisitedCities
      totalTripDuration
      avgTripDuration
      lastTripDate
      nextTripDate
      followersCount
      followingCount
      friends
      bio
      profilePhotoUrl
      socialLinks
      accountCreatedAt
      appVersion
      deviceType
      modelName
      osVersion
      activityPreferences
      selectedUseCases
      subscriptionTier
      subscriptionStartDate
      subscriptionEndDate
      subscriptionStatus
      trialEndsAt
      lastActiveAt
      accountStatus
      preferences {
        notifications
        theme
        language
        defaultCurrency
        preferredTravelMode
        distanceUnit
        timeFormat
        dateFormat
        profileVisibility
        allowCollaborationRequests
        shareActivityHistory
        __typename
      }
      version
      __typename
    }
  }
`;
