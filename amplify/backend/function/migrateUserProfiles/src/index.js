/* Amplify Params - DO NOT EDIT
	ENV
	FUNCTION_CREATETRIPSTORAGE_NAME
	FUNCTION_GETUSERPROFILE_NAME
	FUNCTION_UPDATEUSERPROFILE_NAME
	REGION
	STORAGE_USERPROFILESSTORAGE_ARN
	STORAGE_USERPROFILESSTORAGE_NAME
	STORAGE_USERPROFILESSTORAGE_STREAMARN
Amplify Params - DO NOT EDIT */

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */
exports.handler = async (event) => {
    console.log(`EVENT: ${JSON.stringify(event)}`);
    return {
        statusCode: 200,
    //  Uncomment below to enable CORS requests
    //  headers: {
    //      "Access-Control-Allow-Origin": "*",
    //      "Access-Control-Allow-Headers": "*"
    //  },
        body: JSON.stringify('Hello from Lambda!'),
    };
};
