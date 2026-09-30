import { defineDelivery } from "@dathra/plugin";

export default defineDelivery({
  routes: {
    "/store-snapshot-roundtrip": {
      server: "./snapshot.server.ts",
      clients: { counter: "./snapshot.client.ts" },
    },
    "/store-snapshot-repeat": {
      server: "./snapshot-repeated.server.ts",
      clients: { counter: "./snapshot.client.ts" },
    },
    "/cart": {
      server: "./cart.server.ts",
      clients: { cart: "./cart.client.ts", counter: "./snapshot.client.ts" },
    },
    "/details": {
      server: "./details.server.ts",
      clients: { details: "./details.client.ts" },
    },
    "/static": { server: "./static.server.ts" },
  },
});
