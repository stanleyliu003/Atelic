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