/*
Copyright 2017 - 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
    http://aws.amazon.com/apache2.0/
or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and limitations under the License.
*/



const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");

const ddbClient = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(ddbClient);

let tableName = "Trips";
if (process.env.ENV && process.env.ENV !== "NONE") {
  tableName = tableName + '-' + process.env.ENV;
}

exports.handler = async (event) => {
  const userID = event.arguments.userID;
  if (!userID) {
    throw new Error("userID is required");
  }

  const params = {
    TableName: tableName,
    KeyConditionExpression: "#userID = :userID",
    ExpressionAttributeNames: {
      "#userID": "userID",
    },
    ExpressionAttributeValues: {
      ":userID": userID,
    },
  };

  try {
    const data = await docClient.send(new QueryCommand(params));
    return data.Items || [];
  } catch (err) {
    console.error("DynamoDB query error:", err);
    throw new Error("Could not retrieve trips");
  }
};
