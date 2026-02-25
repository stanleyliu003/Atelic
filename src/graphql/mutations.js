/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const optimizeRoute = /* GraphQL */ `
  mutation OptimizeRoute($activities: [ActivityInput!]!) {
    optimizeRoute(activities: $activities) {
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
      detailsLoaded
      __typename
    }
  }
`;
export const createTrip = /* GraphQL */ `
  mutation CreateTrip($input: CreateTripInput!) {
    createTrip(input: $input) {
      tripId
      tripTitle
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
        detailsLoaded
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
      deletedSavedPlaceIds
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
export const deleteSavedPlace = /* GraphQL */ `
  mutation DeleteSavedPlace(
    $userID: String!
    $savedPlaceId: String!
    $deleteType: String
  ) {
    deleteSavedPlace(
      userID: $userID
      savedPlaceId: $savedPlaceId
      deleteType: $deleteType
    ) {
      savedPlaceId
      userID
      __typename
    }
  }
`;
export const deleteSavedCity = /* GraphQL */ `
  mutation DeleteSavedCity($userID: String!, $city: String!) {
    deleteSavedCity(userID: $userID, city: $city) {
      success
      count
      __typename
    }
  }
`;
export const deleteSavedCountry = /* GraphQL */ `
  mutation DeleteSavedCountry($userID: String!, $country: String!) {
    deleteSavedCountry(userID: $userID, country: $country) {
      success
      count
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
      tripTitle
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
        detailsLoaded
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
      deletedSavedPlaceIds
      __typename
    }
  }
`;
export const removeCollaborator = /* GraphQL */ `
  mutation RemoveCollaborator($tripId: String!, $username: String!) {
    removeCollaborator(tripId: $tripId, username: $username) {
      tripId
      tripTitle
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
        detailsLoaded
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
      deletedSavedPlaceIds
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
      tripTitle
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
        detailsLoaded
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
      deletedSavedPlaceIds
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
      countriesVisited
      citiesVisited
      countriesVisitedList
      citiesVisitedList
      statsLastUpdated
      followersCount
      followingCount
      friends
      bio
      profilePhotoUrl
      isPrivateAccount
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
export const followUser = /* GraphQL */ `
  mutation FollowUser($followerUsername: String!, $targetUsername: String!) {
    followUser(
      followerUsername: $followerUsername
      targetUsername: $targetUsername
    ) {
      success
      status
      message
      action
      isPrivate
      autoApprovedRequests
      __typename
    }
  }
`;
export const unfollowUser = /* GraphQL */ `
  mutation UnfollowUser($followerUsername: String!, $targetUsername: String!) {
    unfollowUser(
      followerUsername: $followerUsername
      targetUsername: $targetUsername
    ) {
      success
      status
      message
      action
      isPrivate
      autoApprovedRequests
      __typename
    }
  }
`;
export const approveFollowRequest = /* GraphQL */ `
  mutation ApproveFollowRequest(
    $targetUsername: String!
    $requesterUsername: String!
    $action: String!
  ) {
    approveFollowRequest(
      targetUsername: $targetUsername
      requesterUsername: $requesterUsername
      action: $action
    ) {
      success
      status
      message
      action
      isPrivate
      autoApprovedRequests
      __typename
    }
  }
`;
export const updateUserPrivacy = /* GraphQL */ `
  mutation UpdateUserPrivacy($username: String!, $isPrivate: Boolean!) {
    updateUserPrivacy(username: $username, isPrivate: $isPrivate) {
      success
      status
      message
      action
      isPrivate
      autoApprovedRequests
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
        detailsLoaded
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
        detailsLoaded
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
        detailsLoaded
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const createTripOperation = /* GraphQL */ `
  mutation CreateTripOperation(
    $input: CreateTripOperationInput!
    $condition: ModelTripOperationConditionInput
  ) {
    createTripOperation(input: $input, condition: $condition) {
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
export const updateTripOperation = /* GraphQL */ `
  mutation UpdateTripOperation(
    $input: UpdateTripOperationInput!
    $condition: ModelTripOperationConditionInput
  ) {
    updateTripOperation(input: $input, condition: $condition) {
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
export const deleteTripOperation = /* GraphQL */ `
  mutation DeleteTripOperation(
    $input: DeleteTripOperationInput!
    $condition: ModelTripOperationConditionInput
  ) {
    deleteTripOperation(input: $input, condition: $condition) {
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
export const registerDeviceToken = /* GraphQL */ `
  mutation RegisterDeviceToken($username: String, $userID: String) {
    registerDeviceToken(username: $username, userID: $userID) {
      success
      message
      endpointArn
      __typename
    }
  }
`;
export const sendPushNotification = /* GraphQL */ `
  mutation SendPushNotification(
    $username: String
    $userID: String
    $title: String!
    $body: String!
    $data: AWSJSON
  ) {
    sendPushNotification(
      username: $username
      userID: $userID
      title: $title
      body: $body
      data: $data
    ) {
      success
      message
      messageId
      error
      __typename
    }
  }
`;
