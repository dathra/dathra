import { atom, createAtomStore, defineAtomStoreSnapshot } from "@dathra/store";

const countAtom = atom("fixture-count", 0);
const themeAtom = atom("fixture-theme", "mint");
const fixtureStoreSnapshotSchema = defineAtomStoreSnapshot({
  count: countAtom,
  theme: themeAtom,
});

function createFixtureStore(options?: {
  appId?: string;
  count?: number;
  theme?: string;
}) {
  const store = createAtomStore({
    appId: options?.appId ?? "playground-e2e-store",
  });

  store.set(countAtom, options?.count ?? 0);
  store.set(themeAtom, options?.theme ?? "mint");
  return store;
}

export { countAtom, createFixtureStore, fixtureStoreSnapshotSchema, themeAtom };
