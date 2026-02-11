/// <reference path="./.sst/platform/config.d.ts" />
/// <reference path="./sst-env.d.ts" />

const REGION = "ap-east-1"; // sydney
const AWS_PROFILE = "personal";
const APP_NAME = "wonglok-2025-realtime-service";

// const FRONT_END_DOMAIN = ``;
// const FRONT_END_LOCALHOST = `http://localhost:3000`;
// const SENDGRID_FROM = ``;

// export default $config({
//     app(input) {
//         return {
//             name: APP_NAME,
//             removal: input?.stage === 'production' ? 'retain' : 'remove',
//             home: 'aws',
//             providers: {
//                 aws: {
//                     region: REGION,
//                     profile: AWS_PROFILE,
//                 },
//             },
//         }
//     },

export default $config({
  app(input) {
    return {
      name: APP_NAME,
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
      providers: {
        aws: {
          region: REGION,
          profile: AWS_PROFILE,
        },
      },
    };
  },
  async run() {
    const MyConnectionTable = new sst.aws.Dynamo("MyConnectionTable", {
      fields: {
        itemID: "string",
      },
      primaryIndex: { hashKey: "itemID" },
    });

    const DATABASE_URL_DEVELOPER = new sst.Secret("DATABASE_URL_DEVELOPER");
    const DATABASE_URL_PRODUCTION = new sst.Secret("DATABASE_URL_PRODUCTION");

    const socket = new sst.aws.ApiGatewayWebSocket("MySocket", {
      //
    });

    const getRoomsLinks = () => {
      return [
        socket,
        MyConnectionTable,
        DATABASE_URL_PRODUCTION,
        DATABASE_URL_DEVELOPER,
      ];
    };

    const getEnvironmentData = () => {
      if ($app.stage === "development") {
        return {
          APP_STAGE: $app.stage,
          DATABASE_URL: `${process.env.DATABASE_URL_DEVELOPER}`,
        };
      } else if ($app.stage === "staging") {
        return {
          APP_STAGE: $app.stage,
          DATABASE_URL: `${process.env.DATABASE_URL_DEVELOPER}`,
        };
      } else {
        return {
          APP_STAGE: $app.stage,
          DATABASE_URL: `${process.env.DATABASE_URL_PRODUCTION}`,
        };
      }
    };

    socket.route("$connect", {
      link: getRoomsLinks(),
      environment: getEnvironmentData(),
      handler: "src/wss/WebSocketService.onConnect",
    });

    socket.route("$disconnect", {
      link: getRoomsLinks(),
      environment: getEnvironmentData(),
      handler: "src/wss/WebSocketService.onDisconnect",
    });

    socket.route("$default", {
      link: getRoomsLinks(),
      environment: getEnvironmentData(),
      handler: "src/wss/WebSocketService.onDefaultMessage",
    });

    socket.route("onSendMessage", {
      link: getRoomsLinks(),
      environment: getEnvironmentData(),
      handler: "src/wss/WebSocketService.onSendMessage",
    });

    return {
      socket: socket.url,
    };
  },
});
