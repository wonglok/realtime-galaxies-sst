import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  paginateScan,
  ScanCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

export const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export async function scanAllItems(
  tableName: string,
  params?: ScanCommandInput,
) {
  const scanParams: ScanCommandInput = params || {
    TableName: tableName,
    // Optional: Limit parameter defines the maximum number of items evaluated in a single request,
    // but the paginator will continue fetching pages until all items are retrieved or an error occurs.
    Limit: 250,
  };

  const pages = paginateScan({ client: docClient }, scanParams);
  const allItems: any[] = [];

  try {
    for await (const page of pages) {
      if (page.Items) {
        allItems.push(...page.Items);
      }
    }
    console.log(`Total items retrieved: ${allItems.length}`);
    return allItems;
  } catch (error) {
    console.error("Error during scan pagination:", error);
    throw error;
  }
}

//
