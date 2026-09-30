import { defineDelivery } from "@dathra/plugin";

export default defineDelivery({
  routes: {
    "/store-snapshot-roundtrip": {
      server: "./snapshot.server.ts",
      client: "./snapshot.client.ts",
    },
    "/store-snapshot-repeat": {
      server: "./snapshot-repeated.server.ts",
      client: "./snapshot.client.ts",
    },
    "/details": {
      server: "./details.server.ts",
      client: "./details.client.ts",
    },
    "/static": { server: "./static.server.ts" },
  },
});
