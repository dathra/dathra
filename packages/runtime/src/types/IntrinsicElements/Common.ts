import type { dathraNode } from "@//types/JSX";

/**
 * Common event handler attributes (onXXX) for all HTML elements.
 * These handlers correspond to GlobalEventHandlers in the HTML specification
 * and are available on all HTML elements, Document, and Window objects.
 *
 * @see https://html.spec.whatwg.org/multipage/webappapis.html#globaleventhandlers
 */
interface CommonEventHandlers {
  // Mouse Events
  /** Click event handler */
  onClick?: (event: MouseEvent) => void;
  /** Double click event handler */
  onDblClick?: (event: MouseEvent) => void;
  /** Mouse down event handler */
  onMouseDown?: (event: MouseEvent) => void;
  /** Mouse up event handler */
  onMouseUp?: (event: MouseEvent) => void;
  /** Mouse move event handler */
  onMouseMove?: (event: MouseEvent) => void;
  /** Mouse over event handler */
  onMouseOver?: (event: MouseEvent) => void;
  /** Mouse out event handler */
  onMouseOut?: (event: MouseEvent) => void;
  /** Mouse enter event handler */
  onMouseEnter?: (event: MouseEvent) => void;
  /** Mouse leave event handler */
  onMouseLeave?: (event: MouseEvent) => void;
  /** Auxiliary click event handler (e.g. middle mouse button) */
  onAuxClick?: (event: MouseEvent) => void;
  /** Context menu event handler */
  onContextMenu?: (event: MouseEvent) => void;
  /** Wheel event handler */
  onWheel?: (event: WheelEvent) => void;

  // Keyboard Events
  /** Key down event handler */
  onKeyDown?: (event: KeyboardEvent) => void;
  /** Key up event handler */
  onKeyUp?: (event: KeyboardEvent) => void;
  /** Key press event handler (deprecated but still supported) */
  onKeyPress?: (event: KeyboardEvent) => void;

  // Focus Events
  /** Focus event handler */
  onFocus?: (event: FocusEvent) => void;
  /** Blur event handler */
  onBlur?: (event: FocusEvent) => void;

  // Input Events
  /** Input event handler */
  onInput?: (event: InputEvent) => void;
  /** Change event handler */
  onChange?: (event: Event) => void;
  /** Before input event handler */
  onBeforeInput?: (event: InputEvent) => void;

  // Form Events
  /** Form submission event handler */
  onSubmit?: (event: Event) => void;
  /** Form reset event handler */
  onReset?: (event: Event) => void;
  /** Form validation failed event handler */
  onInvalid?: (event: Event) => void;
  /** Form input event handler */
  onFormData?: (event: Event) => void;

  // Drag & Drop Events
  /** Drag event handler */
  onDrag?: (event: DragEvent) => void;
  /** Drag start event handler */
  onDragStart?: (event: DragEvent) => void;
  /** Drag end event handler */
  onDragEnd?: (event: DragEvent) => void;
  /** Drag enter event handler */
  onDragEnter?: (event: DragEvent) => void;
  /** Drag leave event handler */
  onDragLeave?: (event: DragEvent) => void;
  /** Drag over event handler */
  onDragOver?: (event: DragEvent) => void;
  /** Drop event handler */
  onDrop?: (event: DragEvent) => void;

  // Clipboard Events
  /** Copy event handler */
  onCopy?: (event: ClipboardEvent) => void;
  /** Cut event handler */
  onCut?: (event: ClipboardEvent) => void;
  /** Paste event handler */
  onPaste?: (event: ClipboardEvent) => void;

  // Scroll Events
  /** Scroll event handler */
  onScroll?: (event: Event) => void;
  /** Scroll end event handler */
  onScrollEnd?: (event: Event) => void;

  // Selection Events
  /** Select event handler */
  onSelect?: (event: Event) => void;

  // Animation Events (CSS Animations)
  /** Animation start event handler */
  onAnimationStart?: (event: AnimationEvent) => void;
  /** Animation end event handler */
  onAnimationEnd?: (event: AnimationEvent) => void;
  /** Animation iteration event handler */
  onAnimationIteration?: (event: AnimationEvent) => void;
  /** Animation cancel event handler */
  onAnimationCancel?: (event: AnimationEvent) => void;

  // Transition Events (CSS Transitions)
  /** Transition start event handler */
  onTransitionStart?: (event: TransitionEvent) => void;
  /** Transition end event handler */
  onTransitionEnd?: (event: TransitionEvent) => void;
  /** Transition run event handler */
  onTransitionRun?: (event: TransitionEvent) => void;
  /** Transition cancel event handler */
  onTransitionCancel?: (event: TransitionEvent) => void;

  // Touch Events
  /** Touch start event handler */
  onTouchStart?: (event: TouchEvent) => void;
  /** Touch move event handler */
  onTouchMove?: (event: TouchEvent) => void;
  /** Touch end event handler */
  onTouchEnd?: (event: TouchEvent) => void;
  /** Touch cancel event handler */
  onTouchCancel?: (event: TouchEvent) => void;

  // Pointer Events
  /** Pointer down event handler */
  onPointerDown?: (event: PointerEvent) => void;
  /** Pointer up event handler */
  onPointerUp?: (event: PointerEvent) => void;
  /** Pointer move event handler */
  onPointerMove?: (event: PointerEvent) => void;
  /** Pointer enter event handler */
  onPointerEnter?: (event: PointerEvent) => void;
  /** Pointer leave event handler */
  onPointerLeave?: (event: PointerEvent) => void;
  /** Pointer over event handler */
  onPointerOver?: (event: PointerEvent) => void;
  /** Pointer out event handler */
  onPointerOut?: (event: PointerEvent) => void;
  /** Pointer cancel event handler */
  onPointerCancel?: (event: PointerEvent) => void;
  /** Got pointer capture event handler */
  onGotPointerCapture?: (event: PointerEvent) => void;
  /** Lost pointer capture event handler */
  onLostPointerCapture?: (event: PointerEvent) => void;

  // Media Events
  /** Media can play event handler */
  onCanPlay?: (event: Event) => void;
  /** Media can play through event handler */
  onCanPlayThrough?: (event: Event) => void;
  /** Media duration change event handler */
  onDurationChange?: (event: Event) => void;
  /** Media emptied event handler */
  onEmptied?: (event: Event) => void;
  /** Media ended event handler */
  onEnded?: (event: Event) => void;
  /** Media error event handler */
  onError?: (event: Event) => void;
  /** Media loaded data event handler */
  onLoadedData?: (event: Event) => void;
  /** Media loaded metadata event handler */
  onLoadedMetadata?: (event: Event) => void;
  /** Media load start event handler */
  onLoadStart?: (event: Event) => void;
  /** Media pause event handler */
  onPause?: (event: Event) => void;
  /** Media play event handler */
  onPlay?: (event: Event) => void;
  /** Media playing event handler */
  onPlaying?: (event: Event) => void;
  /** Media progress event handler */
  onProgress?: (event: Event) => void;
  /** Media rate change event handler */
  onRateChange?: (event: Event) => void;
  /** Media seeked event handler */
  onSeeked?: (event: Event) => void;
  /** Media seeking event handler */
  onSeeking?: (event: Event) => void;
  /** Media stalled event handler */
  onStalled?: (event: Event) => void;
  /** Media suspend event handler */
  onSuspend?: (event: Event) => void;
  /** Media time update event handler */
  onTimeUpdate?: (event: Event) => void;
  /** Media volume change event handler */
  onVolumeChange?: (event: Event) => void;
  /** Media waiting event handler */
  onWaiting?: (event: Event) => void;

  // Resource Events
  /** Resource load event handler */
  onLoad?: (event: Event) => void;
  /** Resource load error event handler (fallback if media onError not used) */
  // onError is already defined above in Media Events

  // Other Common Events
  /** Abort event handler */
  onAbort?: (event: Event) => void;
  /** Cancel event handler */
  onCancel?: (event: Event) => void;
  /** Close event handler */
  onClose?: (event: Event) => void;
  /** Before match event handler (hidden=until-found) */
  onBeforeMatch?: (event: Event) => void;
  /** Command event handler (commandfor attribute) */
  onCommand?: (event: Event) => void;
  /** Contextmenu event (deprecated but still in use) */
  onContextLost?: (event: Event) => void;
  /** Context restored event */
  onContextRestored?: (event: Event) => void;
  /** Cue change event handler (for track elements) */
  onCueChange?: (event: Event) => void;
  /** Security policy violation event handler */
  onSecurityPolicyViolation?: (event: SecurityPolicyViolationEvent) => void;
  /** Slot change event handler */
  onSlotChange?: (event: Event) => void;
  /** Toggle event handler */
  onToggle?: (event: Event) => void;
  /** Before toggle event handler */
  onBeforeToggle?: (event: Event) => void;

  // WebKit-prefixed events (for compatibility)
  /** WebKit animation end event handler */
  onWebkitAnimationEnd?: (event: Event) => void;
  /** WebKit animation iteration event handler */
  onWebkitAnimationIteration?: (event: Event) => void;
  /** WebKit animation start event handler */
  onWebkitAnimationStart?: (event: Event) => void;
  /** WebKit transition end event handler */
  onWebkitTransitionEnd?: (event: Event) => void;
}

/**
 * Global attributes that this runtime allows across HTML, SVG, and MathML
 * intrinsic elements.
 */
interface GlobalIntrinsicAttributes {
  // Core Attributes
  /** CSS class names (space-separated if multiple) */
  class?: string;
  /** Specifies a unique id for the element */
  id?: string;
  /** Advisory information for the element (tooltip) */
  title?: string;

  // Language and Direction
  /** Primary language for the element's contents */
  lang?: string;
  /** Text directionality */
  dir?: "ltr" | "rtl" | "auto";
  // Styling
  /** Inline CSS styles */
  style?: Partial<CSSStyleDeclaration>;
  /** Cryptographic nonce for CSP */
  nonce?: string;

  // Shadow DOM
  /** Assigns a slot in a shadow DOM */
  slot?: string;

  // ARIA Attributes (all aria-* attributes)
  /** ARIA role */
  role?: string;
  /** Any aria-* attribute */
  [ariaAttr: `aria-${string}`]: string | undefined;

  // Custom Data Attributes (all data-* attributes)
  /** Any data-* attribute */
  [dataAttr: `data-${string}`]: string | undefined;

  // Children
  /** Children nodes */
  children?: dathraNode;
}

/**
 * HTML-only global attributes. These should not automatically flow into SVG or
 * MathML intrinsic surfaces.
 */
interface HTMLOnlyIntrinsicAttributes {
  // Language and Direction
  /** Whether element's text should be translated */
  translate?: "yes" | "no";

  // User Interaction
  /** Whether the element should be hidden */
  hidden?: boolean | "until-found";
  /** Whether the element and its descendants are inert */
  inert?: boolean;
  /** Keyboard shortcut to activate or focus the element */
  accessKey?: string;
  /** Whether the element is editable */
  contentEditable?: "true" | "false" | "plaintext-only" | "inherit";
  /** Whether the element is draggable */
  draggable?: boolean;
  /** Whether spelling and grammar should be checked */
  spellcheck?: boolean;
  /** Tab order position */
  tabIndex?: number;
  /** Autocapitalization behavior for text input */
  autocapitalize?: "off" | "none" | "on" | "sentences" | "words" | "characters";
  /** Autocorrect behavior for text input */
  autocorrect?: "on" | "off";
  /** Hint for virtual keyboard enter key label */
  enterkeyhint?:
    | "enter"
    | "done"
    | "go"
    | "next"
    | "previous"
    | "search"
    | "send";
  /** Hint for virtual keyboard type */
  inputmode?:
    | "none"
    | "text"
    | "tel"
    | "url"
    | "email"
    | "numeric"
    | "decimal"
    | "search";
  /** Whether to show writing suggestions */
  writingSuggestions?: "true" | "false";
  /** Whether the element should be automatically focused */
  autofocus?: boolean;

  // Popover API
  /** Popover state */
  popover?: "auto" | "manual";

  // Custom Elements
  /** Custom element name for customized built-in elements */
  is?: string;

  // Microdata
  /** Microdata item ID */
  itemid?: string;
  /** Microdata item property */
  itemprop?: string;
  /** Microdata item references */
  itemref?: string;
  /** Microdata item scope */
  itemscope?: boolean;
  /** Microdata item type */
  itemtype?: string;
}

/**
 * Backward-compatible alias for the full HTML attribute surface.
 */
interface CommonAttributes
  extends GlobalIntrinsicAttributes, HTMLOnlyIntrinsicAttributes {}

interface HTMLOnlyColocatedClientHandlers {
  /** Deferred client click hydration on load (MVP) */
  "load:onClick"?: (event: MouseEvent) => void;
  /** Deferred client click hydration on first interaction (MVP) */
  "interaction:onClick"?: (event: MouseEvent) => void;
  /** Deferred client click hydration on idle (phase 2) */
  "idle:onClick"?: (event: MouseEvent) => void;
  /** Deferred client click hydration on visibility (phase 2) */
  "visible:onClick"?: (event: MouseEvent) => void;
}

interface SharedIntrinsicElements
  extends GlobalIntrinsicAttributes, CommonEventHandlers {}

interface CommonIntrinsicElements
  extends SharedIntrinsicElements, HTMLOnlyColocatedClientHandlers {}

export {
  CommonAttributes,
  GlobalIntrinsicAttributes,
  CommonEventHandlers,
  CommonIntrinsicElements,
  HTMLOnlyIntrinsicAttributes,
  HTMLOnlyColocatedClientHandlers,
  SharedIntrinsicElements,
};
