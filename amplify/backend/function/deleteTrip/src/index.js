/* Amplify Params - DO NOT EDIT
   ENV
   REGION
   STORAGE_TRIPSTORAGE_ARN
   STORAGE_TRIPSTORAGE_NAME
   STORAGE_TRIPSTORAGE_STREAMARN
Amplify Params - DO NOT EDIT */


const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, DeleteCommand } = require('@aws-sdk/lib-dynamodb');


const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);


/**
* @type {import('@types/aws-lambda').APIGatewayProxyHandler}
*/
exports.handler = async (event) => {
   console.log('Received event:', JSON.stringify(event));


   try {
       const { userID, tripID } = event.arguments;


       if (!userID || !tripID) {
           throw new Error('userID and tripID are required');
       }


       const params = {
           TableName: process.env.STORAGE_TRIPSTORAGE_NAME,
           Key: {
               userID: userID,
               tripID: tripID
           }
       };


       await docClient.send(new DeleteCommand(params));


       return {
           success: true,
           message: 'Trip deleted successfully',
           deletedTripID: tripID
       };


   } catch (error) {
       console.error('DynamoDB delete error:', error);
       throw new Error('Failed to delete trip');
   }
};
