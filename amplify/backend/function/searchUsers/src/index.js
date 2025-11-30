/* Amplify Params - DO NOT EDIT
	AUTH_AMPLIFYBACKEND59CCDBF8_USERPOOLID
	ENV
	REGION
	STORAGE_TRIPSTORAGE_ARN
	STORAGE_TRIPSTORAGE_NAME
	STORAGE_TRIPSTORAGE_STREAMARN
Amplify Params - DO NOT EDIT */

const {
  CognitoIdentityProviderClient,
  ListUsersCommand
} = require('@aws-sdk/client-cognito-identity-provider');

const client = new CognitoIdentityProviderClient();

/**
 * Search users by full name OR email (Google Docs-style)
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event));

  // Get search term from GraphQL arguments
  const { searchTerm } = event.arguments;

  // Validate required parameters
  if (!searchTerm || searchTerm.trim().length < 2) {
    throw new Error('Search term must be at least 2 characters long');
  }

  console.log('searchTerm:', searchTerm);

  const userPoolId = process.env.AUTH_AMPLIFYBACKEND59CCDBF8_USERPOOLID;
  if (!userPoolId) {
    throw new Error('User Pool ID not found in environment');
  }

  try {
    // Search users in Cognito User Pool
    // Note: Cognito listUsers doesn't support partial matching well,
    // so we'll get all users and filter on the Lambda side for now
    const params = {
      UserPoolId: userPoolId,
      Limit: 60 // Get more users to have better filtering results
      // Don't use AttributesToGet - it doesn't support preferred_username
      // Instead, fetch all attributes and filter on Lambda side
    };

    console.log('Cognito listUsers params:', JSON.stringify(params));
    const result = await client.send(new ListUsersCommand(params));

    console.log(`Found ${result.Users.length} total users`);

    // Filter users based on search term (case-insensitive partial matching)
    const searchTermLower = searchTerm.toLowerCase().trim();
    const filteredUsers = result.Users
      .filter(user => {
        // Get email, name, and username attributes
        const emailAttr = user.Attributes.find(attr => attr.Name === 'email');
        const nameAttr = user.Attributes.find(attr => attr.Name === 'name');
        const usernameAttr = user.Attributes.find(attr => attr.Name === 'preferred_username');

        const email = emailAttr ? emailAttr.Value.toLowerCase() : '';
        const fullName = nameAttr ? nameAttr.Value.toLowerCase() : '';
        const username = usernameAttr ? usernameAttr.Value.toLowerCase() : '';

        // CRITICAL: Filter out incomplete user profiles
        // Users must have both a username and full name to appear in search results
        // This prevents incomplete Google/Apple sign-ups from being displayed as "@"
        if (!username || username.trim().length === 0) {
          return false;
        }
        if (!fullName || fullName.trim().length === 0) {
          return false;
        }

        // Match against username (highest priority), full name, or email (partial matching)
        return username.includes(searchTermLower) || fullName.includes(searchTermLower) || email.includes(searchTermLower);
      })
      .slice(0, 5) // Limit to top 5 results
      .map(user => {
        // Extract user attributes
        const emailAttr = user.Attributes.find(attr => attr.Name === 'email');
        const nameAttr = user.Attributes.find(attr => attr.Name === 'name');
        const usernameAttr = user.Attributes.find(attr => attr.Name === 'preferred_username');
        const identitiesAttr = user.Attributes.find(attr => attr.Name === 'identities');

        // Determine if user is from external provider (Google or Apple)
        // Users authenticated via OAuth will have an 'identities' attribute
        // Google users: Username starts with 'google_'
        // Apple users: Username starts with 'signinwithapple_'
        const isExternalProvider = !!identitiesAttr || user.Username.startsWith('google_') || user.Username.startsWith('signinwithapple_');

        return {
          userID: user.Username,
          email: emailAttr ? emailAttr.Value : '',
          fullName: nameAttr ? nameAttr.Value : '',
          username: usernameAttr ? usernameAttr.Value : '',
          isExternalProvider: isExternalProvider,
          identities: identitiesAttr ? identitiesAttr.Value : null
        };
      });

    console.log(`Filtered to ${filteredUsers.length} matching users:`, JSON.stringify(filteredUsers));

    return filteredUsers;

  } catch (error) {
    console.error('Cognito listUsers error:', error);
    console.error('Full error details:', JSON.stringify(error, null, 2));
    throw new Error(`Failed to search users: ${error.message}`);
  }
};