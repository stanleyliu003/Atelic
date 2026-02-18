/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_SAVEDPLACESSTORAGE_ARN
	STORAGE_SAVEDPLACESSTORAGE_NAME
	STORAGE_SAVEDPLACESSTORAGE_STREAMARN
Amplify Params - DO NOT EDIT */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  console.log('[deleteSavedCity] Full event:', JSON.stringify(event));

  const { userID, city, country } = event.arguments;
  const tableName = process.env.STORAGE_SAVEDPLACESSTORAGE_NAME;

  console.log('[deleteSavedCity] Parsed arguments:', { userID, city, country });
  console.log('[deleteSavedCity] Table name:', tableName);

  // Support both deleteSavedCity (city) and deleteSavedCountry (country) mutations
  const filterByCountry = typeof country === 'string' && country.trim().length > 0;
  const filterByCity = typeof city === 'string' && city.trim().length > 0;

  if (!filterByCountry && !filterByCity) {
    console.error('[deleteSavedCity] Neither city nor country provided');
    throw new Error('Either city or country is required');
  }
  if (filterByCountry && filterByCity) {
    console.error('[deleteSavedCity] Both city and country provided');
    throw new Error('Provide either city or country, not both');
  }

  const filterField = filterByCountry ? 'country' : 'city';
  const filterValue = filterByCountry ? country : city;
  // The other attribute that must exist to keep the item alive
  const otherField = filterByCountry ? 'city' : 'country';

  console.log('[deleteSavedCity] Filter:', { filterField, filterValue, otherField });

  try {
    // 1. Query all items for this user matching the city or country
    let matchingItems = [];
    let lastEvaluatedKey = undefined;

    do {
      const params = {
        TableName: tableName,
        KeyConditionExpression: 'userID = :uid',
        FilterExpression: `${filterField} = :val`,
        ExpressionAttributeValues: {
          ':uid': userID,
          ':val': filterValue
        },
        ExclusiveStartKey: lastEvaluatedKey
      };
      console.log('[deleteSavedCity] Query params:', JSON.stringify(params));

      const data = await docClient.send(new QueryCommand(params));
      console.log('[deleteSavedCity] Query returned:', {
        itemCount: (data.Items || []).length,
        hasMorePages: !!data.LastEvaluatedKey
      });

      matchingItems = [...matchingItems, ...(data.Items || [])];
      lastEvaluatedKey = data.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log('[deleteSavedCity] Total matching items:', matchingItems.length);

    if (matchingItems.length === 0) {
      console.log('[deleteSavedCity] No items found, returning count: 0');
      return { success: true, count: 0 };
    }

    // Log the items we're processing
    console.log('[deleteSavedCity] Items to process:', matchingItems.map(item => ({
      userID: item.userID,
      savedPlaceId: item.savedPlaceId,
      city: item.city,
      country: item.country
    })));

    // 2. For each item: soft-delete (remove attribute) or full delete
    let softDeleteCount = 0;
    let fullDeleteCount = 0;

    for (const item of matchingItems) {
      const key = { userID: item.userID, savedPlaceId: item.savedPlaceId };

      // If the other field exists, just remove the current field (soft delete)
      if (item[otherField]) {
        try {
          await docClient.send(new UpdateCommand({
            TableName: tableName,
            Key: key,
            UpdateExpression: `REMOVE ${filterField}`,
            ConditionExpression: `attribute_exists(${otherField})`
          }));
          softDeleteCount++;
          console.log(`[deleteSavedCity] Soft-deleted ${filterField} from:`, item.savedPlaceId);
        } catch (err) {
          if (err.name === 'ConditionalCheckFailedException') {
            // Race condition: other field was removed between query and update, full delete
            await docClient.send(new DeleteCommand({ TableName: tableName, Key: key }));
            fullDeleteCount++;
            console.log('[deleteSavedCity] Condition failed, full-deleted:', item.savedPlaceId);
          } else {
            throw err;
          }
        }
      } else {
        // No other field, full delete
        await docClient.send(new DeleteCommand({ TableName: tableName, Key: key }));
        fullDeleteCount++;
        console.log('[deleteSavedCity] Full-deleted:', item.savedPlaceId);
      }
    }

    console.log('[deleteSavedCity] Done:', { softDeleteCount, fullDeleteCount, total: matchingItems.length });
    return { success: true, count: matchingItems.length };

  } catch (err) {
    console.error('[deleteSavedCity] Error:', err);
    throw new Error(err.message);
  }
};
