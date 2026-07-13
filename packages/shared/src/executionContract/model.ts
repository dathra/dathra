/** One segment in a source-local parameter or return value path. */
type SemanticPathSegment =
  | { readonly kind: "property"; readonly key: string }
  | { readonly kind: "tuple-index"; readonly index: number }
  | { readonly kind: "element" };

/** A source-local location to which a semantic fact applies. */
type SemanticSubject =
  | { readonly kind: "module-evaluation" }
  | { readonly kind: "export-value"; readonly exportName: string }
  | { readonly kind: "receiver"; readonly exportName: string }
  | {
      readonly kind: "parameter";
      readonly exportName: string;
      readonly index: number;
      readonly path: readonly SemanticPathSegment[];
    }
  | {
      readonly kind: "return";
      readonly exportName: string;
      readonly path: readonly SemanticPathSegment[];
    }
  | {
      readonly kind: "callback-invocation";
      readonly exportName: string;
      readonly parameterIndex: number;
      readonly path: readonly SemanticPathSegment[];
    }
  | {
      readonly kind: "allocated-resource";
      readonly exportName: string;
      readonly allocationSiteId: string;
    };

export type { SemanticPathSegment, SemanticSubject };
