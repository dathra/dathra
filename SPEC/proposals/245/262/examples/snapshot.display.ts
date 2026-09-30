/** Read-only inputs used by the same display functions on server and client. */
interface SnapshotDisplay {
  readonly state: {
    readonly count: { readonly value: number };
    readonly theme: { readonly value: string };
  };
}

/** Format the current theme without initializing state or constructing a view. */
function themeText(ctx: SnapshotDisplay): string {
  return `Theme: ${ctx.state.theme.value}`;
}

/** Read the live slot on each invocation so client effects can track it. */
function countText(ctx: SnapshotDisplay): string {
  return `Count: ${ctx.state.count.value}`;
}

export { themeText, countText };
export type { SnapshotDisplay };
