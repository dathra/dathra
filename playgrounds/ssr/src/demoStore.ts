import { atom, createAtomStore } from "@dathra/core";

type DemoTheme = "light" | "mint" | "amber" | "night";

const themeOrder: readonly DemoTheme[] = ["light", "mint", "amber", "night"];

const countAtom = atom<number>("count", 3);
const themeAtom = atom<DemoTheme>("theme", "light");

function createDemoStore(options: {
  appId: string;
  count?: number;
  theme?: DemoTheme;
}) {
  return createAtomStore({
    appId: options.appId,
    values: [
      [countAtom, options.count ?? 3],
      [themeAtom, options.theme ?? "light"],
    ],
  });
}

function nextTheme(currentTheme: DemoTheme): DemoTheme {
  const currentIndex = themeOrder.indexOf(currentTheme);
  return themeOrder[(currentIndex + 1) % themeOrder.length] ?? themeOrder[0];
}

export { countAtom, createDemoStore, nextTheme, themeAtom };
export type { DemoTheme };
