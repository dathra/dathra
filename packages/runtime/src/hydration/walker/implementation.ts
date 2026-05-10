/**
 * TreeWalker-based marker exploration for Hydration.
 *
 * Per SPEC.typ (ADR: Hydration 探索戦略):
 * - Linear traversal using TreeWalker
 * - Comment markers: <!--dh:t:ID-->, <!--dh:i:ID-->, <!--dh:b:ID-->
 * - Scope is naturally separated by ShadowRoot
 */

/**
 * Marker types for hydration.
 */
enum HydrationMarkerType {
  Text = "t",
  Insert = "i",
  Block = "b",
  BlockEnd = "/b",
}

/**
 * Parsed marker information.
 */
interface MarkerInfo {
  type: HydrationMarkerType;
  id: number;
  node: Comment;
}

/** Marker prefix */
const MARKER_PREFIX = "dh:";
const BLOCK_END = "/dh:b";

/**
 * Parse a comment node as a marker.
 */
function parseMarker(comment: Comment): MarkerInfo | null {
  const data = comment.data.trim();

  // Block end marker
  if (data === BLOCK_END) {
    return {
      type: HydrationMarkerType.BlockEnd,
      id: -1,
      node: comment,
    };
  }

  // Regular marker: dh:type:id
  if (!data.startsWith(MARKER_PREFIX)) {
    return null;
  }

  const parts = data.slice(MARKER_PREFIX.length).split(":");
  if (parts.length !== 2) {
    return null;
  }

  const [type, idStr] = parts;
  const id = parseInt(idStr, 10);

  if (isNaN(id)) {
    return null;
  }

  const markerType = type as HydrationMarkerType;
  if (
    markerType !== HydrationMarkerType.Text &&
    markerType !== HydrationMarkerType.Insert &&
    markerType !== HydrationMarkerType.Block
  ) {
    return null;
  }

  return { type: markerType, id, node: comment };
}

/**
 * Create a TreeWalker for comment nodes.
 */
function createWalker(root: Node): TreeWalker {
  return document.createTreeWalker(root, NodeFilter.SHOW_COMMENT, null);
}

/**
 * Find all markers in a container.
 */
function findMarkers(container: Node): MarkerInfo[] {
  const markers: MarkerInfo[] = [];
  const walker = createWalker(container);

  let node = walker.nextNode();
  while (node !== null) {
    const marker = parseMarker(node as Comment);
    if (marker !== null) {
      markers.push(marker);
    }
    node = walker.nextNode();
  }

  return markers;
}

/**
 * Find the next marker in the walker.
 */
function findMarker(walker: TreeWalker): MarkerInfo | null {
  let node = walker.nextNode();
  while (node !== null) {
    const marker = parseMarker(node as Comment);
    if (marker !== null) {
      return marker;
    }
    node = walker.nextNode();
  }
  return null;
}

/**
 * Get the text node following a text marker.
 */
function getTextNodeAfterMarker(marker: Comment): Text | null {
  const next = marker.nextSibling;
  if (next !== null && next.nodeType === Node.TEXT_NODE) {
    return next as Text;
  }
  // Create empty text node if not present
  const text = document.createTextNode("");
  marker.parentNode?.insertBefore(text, marker.nextSibling);
  return text;
}

export {
  HydrationMarkerType,
  createWalker,
  findMarker,
  findMarkers,
  getTextNodeAfterMarker,
  parseMarker,
};
export type { MarkerInfo };
