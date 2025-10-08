/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_PLACESAPIACTIVITYSTORAGE_NAME
	STORAGE_PLACESAPIACTIVITYSTORAGE_ARN
	STORAGE_PLACESAPIACTIVITYSTORAGE_STREAMARN
	GEMINI_API_KEY
	GOOGLE_PLACES_API_KEY
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
