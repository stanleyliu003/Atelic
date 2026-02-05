/* eslint-disable */
// Custom mutations file - this will NOT be overwritten by Amplify

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

// Social Features Mutations

export const followUser = /* GraphQL */ `
  mutation FollowUser($followerUsername: String!, $targetUsername: String!) {
    followUser(followerUsername: $followerUsername, targetUsername: $targetUsername) {
      success
      status
      message
      __typename
    }
  }
`;

export const unfollowUser = /* GraphQL */ `
  mutation UnfollowUser($followerUsername: String!, $targetUsername: String!) {
    unfollowUser(followerUsername: $followerUsername, targetUsername: $targetUsername) {
      success
      status
      message
      __typename
    }
  }
`;

export const approveFollowRequest = /* GraphQL */ `
  mutation ApproveFollowRequest($targetUsername: String!, $requesterUsername: String!, $action: String!) {
    approveFollowRequest(targetUsername: $targetUsername, requesterUsername: $requesterUsername, action: $action) {
      success
      action
      message
      __typename
    }
  }
`;

export const updateUserPrivacy = /* GraphQL */ `
  mutation UpdateUserPrivacy($username: String!, $isPrivate: Boolean!) {
    updateUserPrivacy(username: $username, isPrivate: $isPrivate) {
      success
      isPrivate
      message
      autoApprovedRequests
      __typename
    }
  }
`;