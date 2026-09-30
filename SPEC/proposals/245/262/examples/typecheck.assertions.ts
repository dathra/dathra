import type { ClientContext } from "@dathra/core/client";
import type { Model } from "./snapshot.server";
import type { DetailsState, DetailsRequests } from "./details.server";

declare const snapshot: ClientContext<Model, { meta: { locale: string } }>;
const count: number = snapshot.state.count.value;
// @ts-expect-error The state type does not declare this slot.
snapshot.state.missing;
// @ts-expect-error The boundary value is deeply readonly.
snapshot.values.meta.locale = "en-US";

declare const details: ClientContext<DetailsState, { itemId: string }, DetailsRequests, "details">;
details.request("details", { id: "item-1" });
// @ts-expect-error No request with this name is declared.
details.request("missing", { id: "item-1" });
// @ts-expect-error The request input needs an id string.
details.request("details", { id: 42 });
// @ts-expect-error No creation boundary with this name is declared.
details.create("other", () => ({ environment: "client" }));
export { count };
