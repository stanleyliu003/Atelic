/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const onTripUpdated = /* GraphQL */ `
  subscription OnTripUpdated($tripId: String!) {
    onTripUpdated(tripId: $tripId) {
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
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const onCreateTripOperation = /* GraphQL */ `
  subscription OnCreateTripOperation(
    $filter: ModelSubscriptionTripOperationFilterInput
  ) {
    onCreateTripOperation(filter: $filter) {
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
export const onUpdateTripOperation = /* GraphQL */ `
  subscription OnUpdateTripOperation(
    $filter: ModelSubscriptionTripOperationFilterInput
  ) {
    onUpdateTripOperation(filter: $filter) {
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
export const onDeleteTripOperation = /* GraphQL */ `
  subscription OnDeleteTripOperation(
    $filter: ModelSubscriptionTripOperationFilterInput
  ) {
    onDeleteTripOperation(filter: $filter) {
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
