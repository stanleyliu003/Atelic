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