import {
  ApiGatewayManagementApiClient,
  DeleteConnectionCommand,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import {
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  paginateScan,
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
import { ScanCommandInput } from "@aws-sdk/lib-dynamodb";

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

  // securirty start
  // securirty start
  // securirty start
  // securirty start
  const token = `${event?.queryStringParameters?.token || ""}`;

  console.log("[connectionId]", connectionId);

  console.log("token", token);

  // const agentSecret = await prismaDB.agentSecret.findFirstOrThrow({
  //   where: {
  //     //
  //     apiKey: token,
  //   },
  // });

  // const agent = await prismaDB.agentObject.findFirstOrThrow({
  //   where: {
  //     //
  //     id: agentSecret.agentObjectId,
  //   },
  // });

  // console.log(agent, agentSecret);

  // securirty end
  // securirty end
  // securirty end
  // securirty end

  await dynamoClient.send(
    new PutItemCommand({
      TableName: Resource.MyConnectionTable.name,
      Item: marshall({
        //
        itemID: connectionId,
      }),
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
  // //
  // const connectionId = event.requestContext.connectionId;

  // const bodyData = JSON.parse(`${event.body}`);

  // console.log("onDefaultMessage-bodyData", bodyData);

  // const items = await scanAllItems(Resource.MyConnectionTable.name);

  // console.log(items);

  // for (let item of items) {
  //   try {
  //     // // dont send to myself
  //     // if (connectionId === item.itemID) {
  //     //   continue;
  //     // }

  //     await wsClinet.send(
  //       new PostToConnectionCommand({
  //         ConnectionId: item.itemID,
  //         Data: JSON.stringify({
  //           //
  //           ...bodyData,
  //           from: connectionId,
  //           to: item.itemID,
  //           reply: "GOD is gooooood.",
  //           //
  //         }),
  //       }),
  //     );
  //   } catch (e) {
  //     console.error(e);
  //     await dynamoClient
  //       .send(
  //         new DeleteItemCommand({
  //           TableName: Resource.MyConnectionTable.name,
  //           Key: marshall({ itemID: item.itemID }),
  //         }),
  //       )
  //       .catch((e) => {
  //         console.log(e);
  //       });
  //   }
  // }

  return {
    statusCode: 200,
    body: JSON.stringify("success"),
  };
};

export const onJoinRoom = async (event: APIEvent) => {
  //
  const connectionId = event.requestContext.connectionId;
  const body = JSON.parse(`${event.body}`);
  console.log("connectionId", connectionId);
  console.log("onJoinRoom", body);

  const data = await dynamoClient
    .send(
      new GetItemCommand({
        TableName: Resource.MyConnectionTable.name,
        Key: marshall({
          //
          itemID: connectionId,
        }),
      }),
    )
    .then((r) => {
      if (!r.Item) {
        throw new Error("not found");
      }
      return unmarshall(r.Item);
    });

  await dynamoClient.send(
    new PutItemCommand({
      TableName: Resource.MyConnectionTable.name,
      Item: marshall({
        //
        itemID: connectionId,
        ...data,
        //
        signature: body.signature,
        roomID: body.roomID,
        target: body.target || [0, 0, 0],
        position: body.position || [0, 0, 0],
        quaternion: body.quaternion || [0, 0, 0, 1],
        //
      }),
    }),
  );

  const scanParams: ScanCommandInput = {
    TableName: Resource.MyConnectionTable.name,
    // Optional: Limit parameter defines the maximum number of items evaluated in a single request,
    // but the paginator will continue fetching pages until all items are retrieved or an error occurs.
    Limit: 5,

    //
    FilterExpression: "roomID = :roomIDParams",
    ExpressionAttributeValues: {
      ":roomIDParams": {
        S: body?.roomID || "lobby",
      },
    },
  };

  const pages = paginateScan({ client: dynamoClient }, scanParams);
  const list: any[] = [];

  try {
    for await (const page of pages) {
      if (page.Items) {
        const segment = page.Items.map((it) => {
          return unmarshall(it);
        });

        for await (const item of segment) {
          //
          // if (item.itemID === connectionId) {
          //   continue;
          // }

          list.push(item);
        }
      }
    }

    for await (const item of list) {
      try {
        await wsClinet.send(
          new PostToConnectionCommand({
            ConnectionId: item.itemID,
            Data: JSON.stringify({
              //
              players: list.map((r) => {
                return {
                  signature: r.signature,
                  isMe: connectionId === r.itemID,
                  target: r.target,
                  position: r.position,
                  quaternion: r.quaternion,
                  itemID: r.itemID,
                };
              }),
              //
            }),
          }),
        );
        list.push(item);
      } catch (e) {
        await dynamoClient
          .send(
            new DeleteItemCommand({
              //
              TableName: Resource.MyConnectionTable.name,
              Key: marshall({
                itemID: item.itemID,
              }),
            }),
          )
          .catch((er) => {
            console.error(er);
          });
      }
    }

    console.log(`Total items retrieved: ${list.length}`);
  } catch (error) {
    console.error("Error during scan pagination:", error);
    throw error;
  }

  return {
    statusCode: 200,
    body: JSON.stringify("success"),
  };
};

export const onMove = async (event: APIEvent) => {
  //
  const connectionId = event.requestContext.connectionId;
  const body = JSON.parse(`${event.body}`);
  console.log("connectionId", connectionId);
  console.log("onJoinRoom", body);

  const data = await dynamoClient
    .send(
      new GetItemCommand({
        TableName: Resource.MyConnectionTable.name,
        Key: marshall({
          //
          itemID: connectionId,
        }),
      }),
    )
    .then((r) => {
      if (!r.Item) {
        throw new Error("not found");
      }
      return unmarshall(r.Item);
    });

  await dynamoClient.send(
    new PutItemCommand({
      TableName: Resource.MyConnectionTable.name,
      Item: marshall({
        //
        itemID: connectionId,
        ...data,
        signature: body.signature,
        chosenLobster: body.chosenLobster,
        //
        roomID: body.roomID,
        target: body.target || [0, 0, 0],
        position: body.position || [0, 0, 0],
        quaternion: body.quaternion || [0, 0, 0, 1],
        //
      }),
    }),
  );

  const scanParams: ScanCommandInput = {
    TableName: Resource.MyConnectionTable.name,
    FilterExpression: "roomID = :roomIDParams",
    ExpressionAttributeValues: {
      ":roomIDParams": {
        S: body?.roomID || "lobby",
      },
    },

    // Optional: Limit parameter defines the maximum number of items evaluated in a single request,
    // but the paginator will continue fetching pages until all items are retrieved or an error occurs.
    Limit: 5,
  };

  const pages = paginateScan({ client: dynamoClient }, scanParams);
  const list: any[] = [];

  try {
    for await (const page of pages) {
      if (page.Items) {
        const segment = page.Items.map((it) => {
          return unmarshall(it);
        });

        for await (const item of segment) {
          list.push(item);
        }
      }
    }

    console.log(list);

    for await (const item of list) {
      try {
        await wsClinet.send(
          new PostToConnectionCommand({
            ConnectionId: item.itemID,
            Data: JSON.stringify({
              //

              players: list.map((r) => {
                return {
                  signature: r.signature,
                  isMe: connectionId === r.itemID,
                  chosenLobster: r.chosenLobster,
                  target: r.target,
                  position: r.position,
                  quaternion: r.quaternion,
                  itemID: r.itemID,
                };
              }),

              //
            }),
          }),
        );
      } catch (e) {
        console.log("errr", e);
        await dynamoClient
          .send(
            new DeleteItemCommand({
              //
              TableName: Resource.MyConnectionTable.name,
              Key: marshall({
                itemID: item.itemID,
              }),
            }),
          )
          .catch((er) => {
            console.error(er);
          });
      }
    }

    console.log(`Total items retrieved: ${list.length}`);
  } catch (error) {
    console.error("Error during scan pagination:", error);
    throw error;
  }

  return {
    statusCode: 200,
    body: JSON.stringify("success"),
  };
};

export const onLeaveRoom = async (event: APIEvent) => {
  //
  const connectionId = event.requestContext.connectionId;
  const body = JSON.parse(`${event.body}`);
  console.log("connectionId", connectionId);
  console.log("onJoinRoom", body);

  await dynamoClient.send(
    new DeleteItemCommand({
      TableName: Resource.MyConnectionTable.name,
      Key: marshall({
        //
        itemID: connectionId,
      }),
    }),
  );

  const scanParams: ScanCommandInput = {
    TableName: Resource.MyConnectionTable.name,
    // Optional: Limit parameter defines the maximum number of items evaluated in a single request,
    // but the paginator will continue fetching pages until all items are retrieved or an error occurs.
    Limit: 5,
    FilterExpression: "roomID = :roomIDParams",
    ExpressionAttributeValues: {
      ":roomIDParams": {
        S: body?.roomID || "lobby",
      },
    },
  };

  const pages = paginateScan({ client: dynamoClient }, scanParams);
  const list: any[] = [];

  try {
    for await (const page of pages) {
      if (page.Items) {
        const segments = page.Items.map((it) => {
          return unmarshall(it);
        });
        list.push(...segments);
      }
    }

    for await (const item of list) {
      //
      if (item.itemID === connectionId) {
        continue;
      }

      try {
        await wsClinet.send(
          new PostToConnectionCommand({
            ConnectionId: item.itemID,
            Data: JSON.stringify({
              //
              players: list.map((r) => {
                return {
                  signature: r.signature,
                  isMe: connectionId === r.itemID,
                  chosenLobster: r.chosenLobster,
                  target: r.target,
                  position: r.position,
                  quaternion: r.quaternion,
                  itemID: r.itemID,
                };
              }),
              //
            }),
          }),
        );

        //
      } catch (e) {
        await dynamoClient
          .send(
            new DeleteItemCommand({
              //
              TableName: Resource.MyConnectionTable.name,
              Key: marshall({
                itemID: item.itemID,
              }),
            }),
          )
          .catch((er) => {
            console.error(er);
          });
      }
    }

    console.log(`Total items retrieved: ${list.length}`);
  } catch (error) {
    console.error("Error during scan pagination:", error);
    throw error;
  }

  return {
    statusCode: 200,
    body: JSON.stringify("success"),
  };
};

// export const onSendMessage = async (event: APIEvent) => {
//   console.log("onSendMessage", JSON.parse(`${event.body}`));
//   return {
//     statusCode: 200,
//     body: JSON.stringify("success"),
//   };
// };
