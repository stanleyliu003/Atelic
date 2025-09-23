/* Amplify Params - DO NOT EDIT
   ENV
   REGION
   STORAGE_TRIPSTORAGE_ARN
   STORAGE_TRIPSTORAGE_NAME
   STORAGE_TRIPSTORAGE_STREAMARN
Amplify Params - DO NOT EDIT */


const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, DeleteCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');


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

       console.log(`Attempting to delete trip with userID: ${userID}, tripID: ${tripID}`);
       console.log(`Table name: ${process.env.STORAGE_TRIPSTORAGE_NAME}`);
       console.log(`Environment: ${process.env.ENV}`);
       console.log(`Region: ${process.env.REGION}`);

       // First, check if the item exists
       const getParams = {
           TableName: process.env.STORAGE_TRIPSTORAGE_NAME,
           Key: {
               userID: userID,
               tripID: tripID
           }
       };

       const getResult = await docClient.send(new GetCommand(getParams));
       console.log('Get result:', JSON.stringify(getResult));

       if (!getResult.Item) {
           console.log('Item not found in database');
           return {
               success: false,
               message: 'Trip not found',
               deletedTripID: tripID
           };
       }

       console.log('Item found, proceeding with deletion');

       // Now delete the item
       const deleteParams = {
           TableName: process.env.STORAGE_TRIPSTORAGE_NAME,
           Key: {
               userID: userID,
               tripID: tripID
           },
           ReturnValues: 'ALL_OLD'  // This will return the deleted item if successful
       };

       const deleteResult = await docClient.send(new DeleteCommand(deleteParams));
       console.log('Delete result:', JSON.stringify(deleteResult));
       console.log('Delete result has Attributes:', !!deleteResult.Attributes);
       console.log('Delete result Attributes keys:', deleteResult.Attributes ? Object.keys(deleteResult.Attributes) : 'none');

       if (deleteResult.Attributes) {
           console.log('Item successfully deleted');
           
           // Double-check: verify the item is actually gone
           const verifyParams = {
               TableName: process.env.STORAGE_TRIPSTORAGE_NAME,
               Key: {
                   userID: userID,
                   tripID: tripID
               }
           };
           
           const verifyResult = await docClient.send(new GetCommand(verifyParams));
           console.log('Verification check - item still exists:', !!verifyResult.Item);
           
           return {
               success: true,
               message: 'Trip deleted successfully',
               deletedTripID: tripID
           };
       } else {
           console.log('Delete operation completed but no item was returned');
           return {
               success: false,
               message: 'Trip may not have existed',
               deletedTripID: tripID
           };
       }


   } catch (error) {
       console.error('DynamoDB operation error:', error);
       console.error('Error details:', {
           name: error.name,
           message: error.message,
           code: error.Code || error.code,
           statusCode: error.$metadata?.httpStatusCode,
           requestId: error.$metadata?.requestId
       });
       
       throw new Error(`Failed to delete trip: ${error.message}`);
   }
};
