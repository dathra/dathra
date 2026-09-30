import { clientExports, occurrence } from "@dathra/core/server";
import { el as browserEl } from "@dathra/core/client";
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
// Name and declared return-role checks do not prove runtime context compatibility.
const refs = clientExports<typeof import("./snapshot.client")>();
refs.bind("countText");
refs.on("click", "increment");
// @ts-expect-error This ordinary export does not exist.
refs.bind("countTexxt");
// @ts-expect-error An operation does not have a text getter return type.
refs.bind("increment");
// @ts-expect-error A text getter is not an operation returning void.
refs.on("click", "countText");
// @ts-expect-error Browser view factories cannot provide the server initial view.
occurrence({ state: {}, view: browserEl("p", {}) });
// @ts-expect-error State slots must be declared Signals, not plain values.
occurrence({ state: { count: 7 }, view: { environment: "server" } });
export { count };
