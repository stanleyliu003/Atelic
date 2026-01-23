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
        savedPlaceId
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
        isLodging
        lodgingCheckIn
        lodgingCheckOut
        source
        sourceUrl
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
      savedPlaceId
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
      isLodging
      lodgingCheckIn
      lodgingCheckOut
      lodgingTime {
        checkIn
        checkOut
        __typename
      }
      source
      sourceUrl
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
        savedPlaceId
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
        isLodging
        lodgingCheckIn
        lodgingCheckOut
        source
        sourceUrl
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
        savedPlaceId
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
        isLodging
        lodgingCheckIn
        lodgingCheckOut
        source
        sourceUrl
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
        savedPlaceId
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
        isLodging
        lodgingCheckIn
        lodgingCheckOut
        source
        sourceUrl
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
        savedPlaceId
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
        isLodging
        lodgingCheckIn
        lodgingCheckOut
        source
        sourceUrl
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
      attributionSource
      attributionCampaign
      attributionCampaignId
      attributionInstallDate
      attributionDeviceId
      attributionStatus
      activityPreferences
      selectedUseCases
      notificationsEnabled
      devicePushToken
      snsEndpointArn
      subscriptionTier
      subscriptionStartDate
      subscriptionEndDate
      subscriptionStatus
      trialEndsAt
      lastActiveAt
      accountStatus
      preferences {
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
export const getVersionConfig = /* GraphQL */ `
  query GetVersionConfig($platform: String!, $environment: String!) {
    getVersionConfig(platform: $platform, environment: $environment) {
      id
      platform
      minimumVersion
      environment
      lastUpdated
      __typename
    }
  }
`;
export const getSavedPlaces = /* GraphQL */ `
  query GetSavedPlaces($userID: String!, $city: String) {
    getSavedPlaces(userID: $userID, city: $city) {
      savedPlaces {
        userID
        savedPlaceId
        source
        sourceUrl
        sourcePostId
        sourceUsername
        city
        savedAt
        __typename
      }
      cities {
        city
        count
        __typename
      }
      city
      totalCount
      __typename
    }
  }
`;
export const getPlacePhoto = /* GraphQL */ `
  query GetPlacePhoto(
    $placeId: String!
    $photoReference: String!
    $maxWidth: Int
  ) {
    getPlacePhoto(
      placeId: $placeId
      photoReference: $photoReference
      maxWidth: $maxWidth
    ) {
      photoUrl
      cached
      fallback
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
        savedPlaceId
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
        isLodging
        lodgingCheckIn
        lodgingCheckOut
        source
        sourceUrl
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
export const getTripOperation = /* GraphQL */ `
  query GetTripOperation($id: ID!) {
    getTripOperation(id: $id) {
      id
      tripID
      timestamp
      opId
      userId
      sequenceNumber
      type
      target
      dayNumber
      operationData
      ttl
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const listTripOperations = /* GraphQL */ `
  query ListTripOperations(
    $filter: ModelTripOperationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listTripOperations(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        tripID
        timestamp
        opId
        userId
        sequenceNumber
        type
        target
        dayNumber
        operationData
        ttl
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const listOperationsByTrip = /* GraphQL */ `
  query ListOperationsByTrip(
    $tripID: ID!
    $timestamp: ModelFloatKeyConditionInput
    $sortDirection: ModelSortDirection
    $filter: ModelTripOperationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listOperationsByTrip(
      tripID: $tripID
      timestamp: $timestamp
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        tripID
        timestamp
        opId
        userId
        sequenceNumber
        type
        target
        dayNumber
        operationData
        ttl
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
