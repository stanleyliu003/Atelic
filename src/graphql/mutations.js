/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const optimizeRoute = /* GraphQL */ `
  mutation OptimizeRoute($activities: [ActivityInput!]!) {
    optimizeRoute(activities: $activities) {
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
export const deleteUserAccount = /* GraphQL */ `
  mutation DeleteUserAccount($userID: String!) {
    deleteUserAccount(userID: $userID) {
      success
      message
      userID
      deletedTripsCount
      cognitoUserDeleted
      ownedTripsDeleted
      sharedTripsRemoved
      errors
      __typename
    }
  }
`;
export const addCollaborator = /* GraphQL */ `
  mutation AddCollaborator(
    $tripId: String!
    $userID: String!
    $userEmail: String!
    $fullName: String!
    $username: String!
    $role: CollaboratorRole!
    $addedBy: String
  ) {
    addCollaborator(
      tripId: $tripId
      userID: $userID
      userEmail: $userEmail
      fullName: $fullName
      username: $username
      role: $role
      addedBy: $addedBy
    ) {
      tripId
      days {
        dayNumber
        encodedPolyline
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
export const removeCollaborator = /* GraphQL */ `
  mutation RemoveCollaborator($tripId: String!, $username: String!) {
    removeCollaborator(tripId: $tripId, username: $username) {
      tripId
      days {
        dayNumber
        encodedPolyline
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
export const updateCollaboratorRole = /* GraphQL */ `
  mutation UpdateCollaboratorRole(
    $tripId: String!
    $username: String!
    $role: CollaboratorRole!
  ) {
    updateCollaboratorRole(tripId: $tripId, username: $username, role: $role) {
      tripId
      days {
        dayNumber
        encodedPolyline
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
export const updateUserProfile = /* GraphQL */ `
  mutation UpdateUserProfile(
    $username: String!
    $action: String!
    $tripData: AWSJSON
  ) {
    updateUserProfile(
      username: $username
      action: $action
      tripData: $tripData
    ) {
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
