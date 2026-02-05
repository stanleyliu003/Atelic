/* eslint-disable */
// Custom queries file - this will NOT be overwritten by Amplify

export const getUserTripsDetailed = /* GraphQL */ `
  query GetUserTripsDetailed($userID: String!, $tripID: String!) {
    getUserTrips(userID: $userID, tripID: $tripID) {
      tripId
      days {
        dayNumber
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
          notes
          startTime
          endTime
          source
          sourceUrl
          __typename
        }
        encodedPolyline
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
        notes
        startTime
        endTime
        source
        sourceUrl
        __typename
      }
      tripTitle
      tripLength
      selectedCity
      tripPhotoReference
      createdAt
      startDate
      endDate
      collaborators {
        email
        fullName
        userID
        username
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

export const getSavedPlacesDetailed = /* GraphQL */ `
  query GetSavedPlacesDetailed($userID: String!, $city: String) {
    getSavedPlaces(userID: $userID, city: $city) {
      savedPlaces {
        userID
        savedPlaceId
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
          __typename
        }
        source
        sourceUrl
        sourcePostId
        sourceUsername
        city
        country
        savedAt
        __typename
      }
      cities {
        city
        country
        count
        __typename
      }
      city
      totalCount
      __typename
    }
  }
`;

// Social Features Queries

export const getFollowers = /* GraphQL */ `
  query GetFollowers($username: String!, $nextToken: String, $limit: Int) {
    getFollowers(username: $username, nextToken: $nextToken, limit: $limit) {
      followers {
        username
        fullName
        profilePhotoUrl
        bio
        isPrivate
        followersCount
        followingCount
        __typename
      }
      nextToken
      __typename
    }
  }
`;

export const getFollowing = /* GraphQL */ `
  query GetFollowing($username: String!, $nextToken: String, $limit: Int) {
    getFollowing(username: $username, nextToken: $nextToken, limit: $limit) {
      following {
        username
        fullName
        profilePhotoUrl
        bio
        isPrivate
        followersCount
        followingCount
        __typename
      }
      nextToken
      __typename
    }
  }
`;

export const getFollowRequests = /* GraphQL */ `
  query GetFollowRequests($targetUsername: String!, $nextToken: String, $limit: Int) {
    getFollowRequests(targetUsername: $targetUsername, nextToken: $nextToken, limit: $limit) {
      requests {
        requesterUsername
        targetUsername
        createdAt
        status
        requesterProfile {
          username
          fullName
          profilePhotoUrl
          bio
          isPrivate
          followersCount
          followingCount
          __typename
        }
        __typename
      }
      nextToken
      __typename
    }
  }
`;

export const getFeed = /* GraphQL */ `
  query GetFeed($username: String!, $nextToken: String, $limit: Int) {
    getFeed(username: $username, nextToken: $nextToken, limit: $limit) {
      trips {
        tripId
        tripTitle
        selectedCity
        tripPhotoReference
        startDate
        endDate
        tripLength
        createdAt
        updatedAt
        ownerUsername
        ownerFullName
        ownerProfilePhotoUrl
        isOwnTrip
        __typename
      }
      nextToken
      __typename
    }
  }
`;

export const getUserStatistics = /* GraphQL */ `
  query GetUserStatistics($username: String!) {
    getUserStatistics(username: $username) {
      countriesVisited
      citiesVisited
      totalTrips
      tripsCompleted
      tripsUpcoming
      __typename
    }
  }
`;