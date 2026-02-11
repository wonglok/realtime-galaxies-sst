import {
  ApiGatewayManagementApiClient,
  DeleteConnectionCommand,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import {
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";

import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  APIGatewayAuthorizerEvent,
  ClientContextClient,
  LambdaFunctionURLCallback,
  LambdaFunctionURLEvent,
  LambdaFunctionURLHandler,
  LambdaFunctionURLResult,
} from "aws-lambda";

import { dynamoClient, scanAllItems } from "../db/dynamodb";
import { Resource } from "sst";
import { prismaDB } from "../db/mongo";

//
type APIEvent = LambdaFunctionURLEvent & {
  requestContext: { connectionId: string };
} & {
  queryStringParameters: { token: string };
};

const wsClinet = new ApiGatewayManagementApiClient({
  endpoint: Resource.MySocket.managementEndpoint,
});

//
export const onConnect = async (event: APIEvent) => {
  const connectionId = event.requestContext.connectionId;

  const queryToken = `${event.queryStringParameters.token || ""}`;
  const token = queryToken;

  console.log("[connectionId]", connectionId);

  console.log("token", token);

  const agentSecret = await prismaDB.agentSecret.findFirstOrThrow({
    where: {
      //
      apiKey: token,
    },
  });

  const agent = await prismaDB.agentObject.findFirstOrThrow({
    where: {
      //
      id: agentSecret.agentObjectId,
    },
  });

  console.log(agent, agentSecret);

  await dynamoClient.send(
    new PutItemCommand({
      TableName: Resource.MyConnectionTable.name,
      Item: marshall({ itemID: connectionId }),
    }),
  );

  return {
    statusCode: 200,
    body: JSON.stringify("success"),
  };
};

export const onDisconnect = async (event: APIEvent) => {
  //
  const connectionId = event.requestContext.connectionId;
  console.log("[disconnectionId]", connectionId);

  await dynamoClient.send(
    new DeleteItemCommand({
      TableName: Resource.MyConnectionTable.name,
      Key: marshall({ itemID: connectionId }),
    }),
  );

  return {
    statusCode: 200,
    body: JSON.stringify("success"),
  };
};

export const onDefaultMessage = async (event: APIEvent) => {
  //
  const connectionId = event.requestContext.connectionId;

  const bodyData = JSON.parse(`${event.body}`);

  console.log("onDefaultMessage-bodyData", bodyData);

  const items = await scanAllItems(Resource.MyConnectionTable.name);

  console.log(items);

  for (let item of items) {
    try {
      // dont send to myself
      if (connectionId === item.itemID) {
        continue;
      }
      await wsClinet.send(
        new PostToConnectionCommand({
          ConnectionId: item.itemID,
          Data: JSON.stringify({
            //
            ...bodyData,
            abc: "123",
            //
          }),
        }),
      );
    } catch (e) {
      console.error(e);
      await dynamoClient
        .send(
          new DeleteItemCommand({
            TableName: Resource.MyConnectionTable.name,
            Key: marshall({ itemID: item.itemID }),
          }),
        )
        .catch((e) => {
          console.log(e);
        });
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify("success"),
  };
};

export const onJoinRoom = async (event: APIEvent) => {
  //
  const connectionId = event.requestContext.connectionId;
  console.log("connectionId", connectionId);
  console.log("onJoinRoom", JSON.parse(`${event.body}`));

  return {
    statusCode: 200,
    body: JSON.stringify("success"),
  };
};

export const onLeaveRoom = async (event: APIEvent) => {
  //
  const connectionId = event.requestContext.connectionId;
  console.log("onLeaveRoom", JSON.parse(`${event.body}`));
  console.log("connectionId", connectionId);

  return {
    statusCode: 200,
    body: JSON.stringify("success"),
  };
};

export const onSendMessage = async (event: APIEvent) => {
  //

  console.log("onSendMessage", JSON.parse(`${event.body}`));

  //

  return {
    statusCode: 200,
    body: JSON.stringify("success"),
  };
};
