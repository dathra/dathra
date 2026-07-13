### request graph-table payload

request ごとの materialization data は、versioned な **graph-table payload** で送る。
payload は executable script と data attribute store にしない。

HTML carrier は、次の non-executable template とする。

```html
<template data-dh-payload="projection-instance-id">{"schema":"dathra.graph/1","build":"...","projection":"..."}</template>
```

payload encoder は HTML text context に対して `&`、`<`、`>` を escape し、template content が element または executable content として解釈されないようにする。
runtime は HTML parser が document encoding から復号した `template.content.textContent` を取得し、strict JSON parser で解釈する。
digest 検証では parse result を JCS で canonical UTF-8 bytes に再 encode する。

response writer は document encoding を UTF-8 に固定し、carrier を送る前に rawByteLength、rawDigest、decodedCodeUnits、decodedTextDigest を計算して GraphTableBudget を適用する。
raw fields は canonical opener、HTML-escaped text content、closer を含む template carrier 全体の exact response bytes、decoded fields は HTML parser 復号後の `template.content.textContent` DOMString とその UTF-8 encoding の SHA-256 digest を表す。
opener の attribute order、引用符、projection instance ID の encoding、closer は `dathra.payload-carrier/1` の固定 template で生成し、任意の HTML printer に委ねない。
BootAuthority はこの host-side PayloadCarrier attestation を TrustedBootRecord の一部として認証する。
browser runtime は raw response bytes を再取得できるとは仮定せず、attestation と decoded DOMString の code-unit length と digest を照合する。

envelope は、少なくとも次の field を持つ。

- `schema`
- `build`
- `projection`
- `instance`
- `digest`
- `symbols`
- `nodes`
- `cells`
- `subscriptions`
- `roots`

table record は次の discriminated schema を持つ。

```ts
type WireScalar = null | boolean | number | string;

type WireSpecial =
  | { readonly $undefined: true }
  | { readonly $bigint: string }
  | { readonly $number: "-0" | "NaN" | "+Infinity" | "-Infinity" }
  | { readonly $bytes: string };

type WellKnownSymbolName =
  | "asyncDispose"
  | "asyncIterator"
  | "dispose"
  | "hasInstance"
  | "isConcatSpreadable"
  | "iterator"
  | "match"
  | "matchAll"
  | "replace"
  | "search"
  | "species"
  | "split"
  | "toPrimitive"
  | "toStringTag"
  | "unscopables";

type WireSymbol =
  | { readonly $symbol: "local"; readonly id: string }
  | { readonly $symbol: "global"; readonly key: string }
  | { readonly $symbol: "well-known"; readonly name: WellKnownSymbolName };

type WireValue =
  | WireScalar
  | WireSpecial
  | WireSymbol
  | { readonly $ref: string }
  | { readonly $cell: string }
  | { readonly $subscription: string };

type WireKey = string | WireSymbol;

type CodecWireValue =
  | WireScalar
  | WireSpecial
  | readonly CodecWireValue[]
  | { readonly [key: string]: CodecWireValue };

type GraphNodeRecord =
  | {
      readonly id: string;
      readonly kind: "object";
      readonly prototype: "object" | "null";
      readonly entries: readonly (readonly [WireKey, WireValue])[];
    }
  | {
      readonly id: string;
      readonly kind: "array";
      readonly length: number;
      readonly entries: readonly (readonly [number, WireValue])[];
    }
  | {
      readonly id: string;
      readonly kind: "map";
      readonly entries: readonly (readonly [WireValue, WireValue])[];
    }
  | { readonly id: string; readonly kind: "set"; readonly items: readonly WireValue[] }
  | {
      readonly id: string;
      readonly kind: "codec";
      readonly codec: {
        readonly qualifiedId: QualifiedRegistryId<"codec">;
        readonly version: string;
      };
      readonly payload: CodecWireValue;
    }
  | {
      readonly id: string;
      readonly kind: "reference";
      readonly resolverQualifiedId: QualifiedRegistryId<"resolver">;
      readonly locator: CodecWireValue;
      readonly capabilityRef: string | null;
    };

interface LocalSymbolRecord {
  readonly id: string;
  readonly description: string | null;
}

interface CellRecord {
  readonly id: string;
  readonly mode: "immutable" | "mutable";
  readonly initial: WireValue;
}

interface SubscriptionRecord {
  readonly id: string;
  readonly sourceQualifiedId: QualifiedRegistryId<"subscription-source">;
  readonly locator: CodecWireValue;
  readonly capabilityRef: string | null;
  readonly transportContinuityId: string;
  readonly sequenceNamespaceId: string;
  readonly sequenceEpochId: string;
  readonly sequenceNamespaceAttestationDigest: Sha256Digest;
  readonly initialSnapshot: WireValue;
  readonly snapshotRevision: string;
  readonly logBoundaryCursor: CodecWireValue;
}

type GraphPathWitnessStep =
  | { readonly kind: "capture"; readonly captureName: string }
  | { readonly kind: "cell-initial"; readonly cellId: string }
  | { readonly kind: "cell-value"; readonly cellId: string; readonly revisionId: string }
  | { readonly kind: "object-entry"; readonly nodeId: string; readonly key: WireKey }
  | { readonly kind: "array-index"; readonly nodeId: string; readonly index: number }
  | { readonly kind: "map-key"; readonly nodeId: string; readonly ordinal: number }
  | { readonly kind: "map-value"; readonly nodeId: string; readonly ordinal: number }
  | { readonly kind: "set-item"; readonly nodeId: string; readonly ordinal: number }
  | {
      readonly kind: "codec-slot";
      readonly nodeId: string;
      readonly name: string;
      readonly ordinal: number;
    }
  | { readonly kind: "subscription-initial"; readonly subscriptionId: string }
  | {
      readonly kind: "subscription-revision";
      readonly subscriptionId: string;
      readonly revisionId: string;
    };

interface GraphPathWitness {
  readonly schema: "dathra.graph-path/1";
  readonly rootBindingSchemaId: string;
  readonly rootInstanceId: string;
  readonly steps: readonly GraphPathWitnessStep[];
  readonly terminal:
    | { readonly kind: "reference"; readonly referenceNodeId: string }
    | { readonly kind: "subscription"; readonly subscriptionId: string };
  readonly digest: Sha256Digest;
}

interface RootBindingRecord {
  readonly bindingSchemaId: string;
  readonly rootInstanceId: string;
  readonly definitionId: string;
  readonly activationGroupDefinitionId: string;
  readonly ownerDefinitionId: string;
  readonly ownerInstanceId: string;
  readonly captureLayoutDigest: Sha256Digest;
  readonly captures: Readonly<Record<string, WireValue>>;
  readonly domTargets: readonly {
    readonly definitionId: string;
    readonly instanceId: string;
    readonly markerRangeId: string;
  }[];
  readonly referenceUses: readonly {
    readonly referenceNodeId: string;
    readonly pathWitness: GraphPathWitness;
    readonly referenceUseSchemaId: string;
  }[];
  readonly subscriptionUses: readonly {
    readonly subscriptionId: string;
    readonly pathWitness: GraphPathWitness;
    readonly subscriptionUseSchemaId: string;
  }[];
}

interface GraphTableEnvelope {
  readonly schema: "dathra.graph/1";
  readonly build: string;
  readonly projection: string;
  readonly instance: string;
  readonly digest: Sha256Digest;
  readonly symbols: readonly LocalSymbolRecord[];
  readonly nodes: readonly GraphNodeRecord[];
  readonly cells: readonly CellRecord[];
  readonly subscriptions: readonly SubscriptionRecord[];
  readonly roots: readonly RootBindingRecord[];
}
```

`$bytes` は padding なしの base64url、`$bigint` は canonical decimal string とする。
finite JSON number 以外は `$number` tag で表す。
WireScalar の number は有限かつ negative zero ではない値に限定する。

local symbol の `id` は envelope 内 identity であり、同じ ID は symbols table の一 record と同じ新規 Symbol を参照する。
WireSymbol 自体に description を重複して持たせない。
symbols table は ID 昇順で、ID と description の組を一意にする。
global symbol は ProjectionManifestCore の allowedGlobalSymbolKeys に含まれる key だけを `Symbol.for(key)` で materialize する。
allowlist は environment-permanent、principal-independent、tenant-independent、public identity として contract された key に限定する。
payload は allowlist にない global symbol registry entry を作れない。
well-known symbol は `dathra.well-known-symbol/1` の closed name list から host の対応する `Symbol` static property を参照する。
host profile が宣言しない well-known symbol は materialize 前に失敗させ、local symbol や global registry symbol へ代替しない。

built-in object snapshot は、`Object.prototype` または null prototype を持ち、accessor、non-default data descriptor、non-enumerable property、custom internal slot を観測する必要がない ordinary object に限定する。
built-in array snapshot は標準 Array prototype、`length`、既定 descriptor の indexed data property だけを扱う。
array entry がない index は hole であり、`$undefined` entry と区別する。
array length は safe integer かつ `0 <= length <= 2^32 - 1` とする。
array index は重複のない昇順整数で、`0 <= index <= 2^32 - 2` かつ `index < length` を満たさなければならない。

Map と Set は標準 prototype、insertion order、custom own property を観測しない場合だけ built-in snapshot を使う。
prototype、descriptor、accessor、subclass、class brand、internal slot の観測が必要な値は、codec、reference、target-native ownership、diagnostic のいずれかで扱う。

codec は versioned な CodecWireValue schema を所有する。
alias と cycle が必要な codec は、自身の payload 内に ID table を定義し、`validateWire` と materializer で検証する。
framework は codec payload を一般 JavaScript object として introspect しない。
codec payload から framework graph edge を公開する場合は CodecGraphEdgeSlotTable を descriptor に含める。
slot table は slot name 順、wire path は property、exact array index、単一の array-each から成る closed path とし、edge kind と one/optional/many cardinality を固定する。
slot name と canonical wire path は重複できず、array-each は cardinality `many` の slot に一度だけ使える。
runtime は materialization 前に canonical wire path を反復走査し、抽出した edge を stable ordinal 順に並べて GraphPathWitness の codec-slot name/ordinal と照合する。
path 不一致、cardinality 違反、宣言 edge kind と WireValue tag の不一致を codec invocation 前に拒否する。
graphEdgeSlots が null の codec では codec-slot witness を禁止し、payload 内の `$ref`、`$cell`、`$subscription` という形の object を framework edge として解釈しない。
GraphNodeRecord の codec qualifiedId と resolverQualifiedId は RegistryEnvironmentCatalogEntry の qualifiedId であり、source-local ID を wire へ出さない。

canonical JSON は RFC 8785 の JSON Canonicalization Scheme を使う。
`symbols` は symbol ID、`nodes` は node ID、`cells` は cell ID、`subscriptions` は subscription ID、`roots` は root instance ID の昇順に並べる。
object entry は ECMAScript の `OwnPropertyKeys` order、Map と Set は insertion order、array entry は index order を保つ。
host raw path は strict UTF-8 を検証し、browser JSON decoder は duplicate JSON property、lone surrogate、I-JSON number、framework record schema にない field を canonicalization 前に拒否する。
codec payload の field は、closed-declarative codec では framework validator、host-attested codec では attested `validateWire` が codec schema に従って検証する。
table ID、object key、Map key、Set item、array index の重複も、各 schema の identity rule に従って拒否する。
decoded DOMString は JCS が生成する canonical JSON text と code point 単位で完全一致しなければならず、leading、trailing、inter-token whitespace を許さない。
parser は maxJsonDepth を iterative preflight で検証してから recursive value を構築する。
GraphTableBudget の全 field は正の safe integer とし、raw carrier byte、canonical byte、decoded code unit、JSON depth、symbol、node、cell、subscription、root、entry、array length、codec payload、materialized object、retained materialized byte、codec work unit の上限を shell allocation 前に検証する。
closed-declarative codec は framework validator で wire schema を検証し、CodecMaterializationProgram から objectCount、retainedBytes、workUnits の上限を静的に計算する。
host-attested codec だけが executable な `validateWire`、`preflight`、`materialize` を提供できる。
この codec は host private allowlist の implementation digest、実行 realm、metering または同等の resource enforcement、conformance vector に束縛し、`defineTransferCodec()` を呼んだだけの author object を attested と扱わない。
runtime は built-in shell と全 codec estimate を saturation 加算し、budget 内であることを確認するまで shell allocation と codec materialization を開始しない。
host-attested codec preflight 自体は maxCodecPayloadBytes 内の wire tree だけを反復走査し、host read、network、capability use、author callback、materialized value allocation を行えないことを host enforcement boundary で保証する。
host がこの enforcement を提供できない executable codec は materialization candidate にせず、closed declarative DTO、reference、target-native ownership のいずれかを要求する。
maxArrayLength は `2^32 - 1` 以下とし、runtime host profile の hard ceiling を超える budget を manifest 自体の検証で拒否する。

digest 表記は `sha-256:<padding なし base64url>` とする。
envelope の `digest` は、digest field を空 string にした canonical UTF-8 JSON の SHA-256 digest である。
この自己 digest だけを authenticity の根拠にしない。
manifestDigest は canonical JCS manifest bytes、artifact digest は host decoder が module parser または WebAssembly compiler へ渡す exact bytes の SHA-256 digest とする。

plan-independent な ProjectionManifestCore は、次の mapping を持つ。
