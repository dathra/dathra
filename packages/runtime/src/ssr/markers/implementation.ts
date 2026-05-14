/**
 * SSR Marker Protocol implementation.
 *
 * Per SPEC.typ:
 * - Comment markers for boundaries: <!--dh:t:ID-->, <!--dh:i:ID-->, <!--dh:b:ID-->...<!--/dh:b-->
 * - Attribute markers for elements: data-dh="ID"
 * - State script: <script type="application/json" data-dh-state>
 */

/**
 * Marker types for dynamic content.
 */
enum MarkerType {
  /** Dynamic text node */
  Text = "t",
  /** Child insertion point */
  Insert = "i",
  /** Control flow block (if/each) */
  Block = "b",
}

/**
 * Create a comment marker for SSR.
 */
function createMarker(type: MarkerType, id: number | string): string {
  return `<!--dh:${type}:${id}-->`;
}

/**
 * Create a block end marker.
 */
function createBlockEndMarker(): string {
  return `<!--/dh:b-->`;
}

/**
 * Create an insert end marker.
 */
function createInsertEndMarker(): string {
  return `<!--/dh:i-->`;
}

/**
 * Create a data attribute marker for elements.
 */
function createDataMarker(id: number | string): string {
  return `data-dh="${id}"`;
}

/**
 * Create a state script element for SSR.
 * Contains serialized Signal initial values.
 */
function createStateScript(serializedState: string): string {
  return `<script type="application/json" data-dh-state>${serializedState}</script>`;
}

/**
 * Create a store snapshot script element for SSR.
 */
function createStoreScript(serializedSnapshot: string): string {
  return `<script type="application/json" data-dh-store>${serializedSnapshot}</script>`;
}

export {
  createBlockEndMarker,
  createDataMarker,
  createInsertEndMarker,
  createMarker,
  createStateScript,
  createStoreScript,
  MarkerType,
};
