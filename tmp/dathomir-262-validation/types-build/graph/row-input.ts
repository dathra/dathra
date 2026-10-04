type RowInput = { id: string; label: string };
function parseRow(raw: unknown): RowInput {
  if (
    !raw ||
    typeof raw !== "object" ||
    !("id" in raw) ||
    typeof raw.id !== "string" ||
    !("label" in raw) ||
    typeof raw.label !== "string"
  )
    throw new Error("E_ROW_INPUT: string id and label required");
  return { id: raw.id, label: raw.label };
}
function otherParser(raw: unknown): RowInput {
  return parseRow(raw);
}
export type { RowInput };
export { parseRow, otherParser };
