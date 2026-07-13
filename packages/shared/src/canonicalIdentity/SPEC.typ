= canonical identity

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

compiler、server runtime、browser runtime が同じ preimage と exact bytes から同じ identity を生成するための共通 primitive を提供する。

== 設計判断

#adr(
  header("Canonical JSON の入力を副作用のない closed value に制限する", Status.Accepted, "2026-07-12"),
  [
    content-addressed identity は property insertion order や host object の暗黙変換に依存できない。
    getter、`toJSON`、custom prototype を実行すると canonicalization 自体が観測可能な副作用を持つ。
  ],
  [
    RFC 8785 JSON Canonicalization Scheme を使い、入力を JSON primitive、current-realm plain object、null-prototype record、standard array に制限する。
    accessor、hidden property、symbol property、custom prototype、sparse array、cycle、lone surrogate、非有限 number、negative zero、JSON 外の値を拒否する。
    shared reference は alias identity を保持しない value として出現箇所ごとに encode する。
  ],
  [
    - canonicalizer は author callback を意図的に実行しない
    - hidden state と JSON 表現の衝突を拒否できる
    - Proxy の trap を標準 JavaScript だけで副作用なく検出できないため、Proxy は caller が渡してはならない
    - parse 済み object から duplicate JSON key は復元できないため、untrusted wire text は別の strict parser を先に通す必要がある
  ],
  references: (
    link("https://www.rfc-editor.org/rfc/rfc8785.html")[RFC 8785],
  ),
)

#adr(
  header("Digest は browser-compatible な非同期 WebCrypto で生成する", Status.Accepted, "2026-07-12"),
  [
    shared primitive は build、server-request、browser のすべてから利用される。
    Node.js 専用 `node:crypto` と `Buffer` を共通 entry に含めると browser artifact が host polyfill に依存する。
  ],
  [
    `globalThis.crypto.subtle.digest("SHA-256", bytes)` を使う。
    digest 開始時に input bytes を同期 copy し、呼び出し後の caller mutation が結果を変えないようにする。
    host が WebCrypto を提供しない場合は typed failure とし、暗黙の弱い hash や Node.js fallback を使わない。
  ],
  [
    - build と browser で同じ algorithm と byte contract を共有できる
    - digest API は非同期になる
    - supported host は WebCrypto を提供する必要がある
  ],
  references: (
    link("https://www.w3.org/TR/WebCryptoAPI/#SubtleCrypto-method-digest")[Web Cryptography API],
  ),
)

#adr(
  header("Canonical JSON builder を反復処理と明示的な上限で構成する", Status.Accepted, "2026-07-13"),
  [
    canonicalization は後続の hostile-input boundary でも使われるため、host の sort 実装と JavaScript call stack の深さへ依存できない。
    一方、ID01 は standalone canonicalizer であり、execution contract の budget API や byte meter を公開しない。
  ],
  [
    record key は raw UTF-16 code unit comparator を使う bottom-up stable merge sort で並べる。
    property count を `p`、最大 key 長を `m`、`levels = ceil(log2(max(1, p)))` とするとき、comparison は `p * levels` 以下、一 comparison の code unit scan は `2 * m + 1` 以下、move は `2 * p * levels` 以下とする。
    serialization は明示的な frame stack と chunk list で構成し、data node occurrence、property occurrence、array slot occurrence、string code unit の合計に対して linear step とする。
    active ancestor だけを cycle として拒否し、leave 後の shared alias は出現箇所ごとに再 serialize する。
  ],
  [
    - public `canonicalizeJson()` の signature、failure code、path、prototype と descriptor の規則、text、bytes は変わらない
    - native `Array.prototype.sort()` と recursive value serialization に依存しない
    - counter instrumentation は internal focused test だけから参照し、shared root へ公開しない
    - canonical byte/work budget と allocation-free meter は後続 revision の責務とする
  ],
)

#adr(
  header("反復builderのactive scratchとfailure precedenceを追加制約する", Status.Accepted, "2026-07-13"),
  [
    前のADRが定めた反復serializationを実装するとき、frameごとにfull pathを保持すると深い単項入力のactive storageとpath copyが二次増加する。
    また、arrayの全sparse slotを子処理前に検査すると、既存canonicalizerのfailure codeとpathの優先順位が変わる。
  ],
  [
    前のADRを継承し、成功経路のpathはparent-linked cursorとしてsegmentを一つずつ保持し、failure時だけ反復的にfull pathをmaterializeする。
    record entry、merge scratch、array descriptorをactive property scratchへ含める。
    array slotはindex順の子処理直前に検査し、先行childのfailureを後続sparse slotより先に報告する。
  ],
  [
    - active pathのsegment数とproperty scratchをinternal instrumentationで別々に検査する
    - 通常のcall stack限界を超える単項入力でもactive pathとproperty scratchをlinearに保つ
    - public signature、failure、canonical text、bytes、budgetとmeterのownerは変更しない
  ],
)

#adr(
  header("Qualified ID は domain-separated preimage の digest とする", Status.Accepted, "2026-07-12"),
  [
    namespace、semantic kind、local ID を delimiter で連結すると escaping と別表現の問題が生じる。
    qualified ID の文字列構文は設計正本で固定されていない。
  ],
  [
    `dathra.qualified-id/1`、namespace digest、kind、local ID を持つ canonical preimage 全体の SHA-256 digest を qualified ID とする。
    qualified ID の runtime 表記は通常の SHA-256 digest と同じにし、TypeScript brand で semantic kind を保持する。
    kind は non-empty string とし、local ID の追加字句制約は registry や execution contract の担当仕様で定義する。
  ],
  [
    - field 境界が hash preimage に含まれ、delimiter collision がない
    - namespace、kind、local ID のどれかが異なる identity は別 digest になる
    - runtime では qualified ID と通常 digest を文字列形状だけで区別せず、schema と typed context で区別する
  ],
)

#adr(
  header("production consumer が確定するまで package root export を追加しない", Status.Accepted, "2026-07-13"),
  [
    Canonical Identity は複数環境で再利用できる基盤だが、default branch の production code はまだこの API を消費しない。
    consumer がない段階で `@dathra/shared` の package root へ公開すると、将来の利用経路を検証しないまま公開互換性を固定する。
  ],
  [
    実装は `canonicalIdentity` directory の internal foundation として保持し、`packages/shared/src/index.ts` から export しない。
    最初の production consumer は、必要な API、環境境界、artifact を同じ変更で検証してから、公開または package-local import の境界を決定する。
  ],
  [
    - canonicalization と identity の仕様、テスト、実装を先に再利用可能な形で保持できる
    - 現在の `@dathra/shared` 公開 API は増えない
    - 別 package から利用するには、consumer と同時に export 境界を追加する必要がある
  ],
)

#adr(
  header("Module Graph consumer の導入時に Canonical Identity を package root へ公開する", Status.Accepted, "2026-07-13"),
  [
    前の ADR は production consumer がない間の root export を延期した。
    immutable Module Graph は canonical JSON、digest、qualified identity の exact contract を production source から直接消費し、別 package から package-private path を参照できない。
  ],
  [
    前の ADR の延期条件が満たされたものとして、Canonical Identity の公開 implementation API を `@dathra/shared` の package root から export する。
    builder と instrumentation は internal のまま維持し、Module Graph は別の stacked change で transformer root 非公開を維持する。
  ],
  [
    - Module Graph は公開された同一の canonical identity contract を build、server、browser 向け解析で共有できる
    - `@dathra/shared` の公開 API に Canonical Identity が追加される
    - builder implementation detail は published artifact に含めても公開 export には含めない
  ],
)

== 機能仕様

#feature_spec(
  name: "Canonical JSON encoding",
  summary: [
    side-effect-free な closed JSON value を RFC 8785 JCS text と UTF-8 bytes へ同期変換する。
  ],
  api: [
    ```typescript
    type CanonicalJsonValue =
      | null
      | boolean
      | number
      | string
      | readonly CanonicalJsonValue[]
      | { readonly [key: string]: CanonicalJsonValue }

    type CanonicalJsonText = string & CanonicalJsonTextBrand

    interface CanonicalJsonEncoding {
      readonly text: CanonicalJsonText
      readonly bytes: Uint8Array
    }

    function canonicalizeJson(value: unknown): CanonicalJsonEncoding
    ```
  ],
  edge_cases: [
    - object key は未 escape の UTF-16 code unit 昇順に並べる
    - key sort は iterative stable merge sort、value serialization は iterative frame/chunk builder で行う
    - array order と Unicode code point sequence は変更しない
    - current-realm `Object.prototype` と null prototype の record を受理する
    - standard `Array.prototype` を持つ dense array だけを受理する
    - accessor は descriptor から検出し、getter と setter を実行しない
    - Proxy は入力契約外であり、untrusted text の duplicate key 検査は strict parser の責務とする
  ],
  test_cases: [
    - insertion order が異なる同値 object が同じ text と bytes になる
    - RFC 8785 の number、string、property order 規則に従う
    - property count の2冪境界、reverse insertion、最大長 common-prefix で sort work bound を満たす
    - depth 64 と通常のcall stack限界を超えるrecordまたはarrayを再帰なし、linear active scratchでencodeする
    - invalidな先行elementと後続sparse slotが共存しても既存failure優先順位を維持する
    - shared reference を許可し、direct cycle と indirect cycle を拒否する
    - unsupported primitive、number、Unicode、object property、array shape を typed error と path 付きで拒否する
    - accessor を拒否するとき getter を実行しない
  ],
)

#feature_spec(
  name: "SHA-256 digest",
  summary: [
    exact bytes または canonical JSON bytes の SHA-256 digest を canonical text 表記で生成する。
  ],
  api: [
    ```typescript
    type Sha256Digest = string & Sha256DigestBrand

    function sha256Digest(bytes: Uint8Array): Promise<Sha256Digest>
    function digestCanonicalJson(value: unknown): Promise<Sha256Digest>
    function isSha256Digest(value: unknown): value is Sha256Digest
    ```
  ],
  edge_cases: [
    - 表記は `sha-256:<padding なし base64url>` とする
    - digest 部分は43文字で、最後の base64url character の未使用 bit は0とする
    - `=`, `+`, `/`, whitespace、別 prefix、別長、non-zero pad bit を拒否する
    - `sha256Digest()` は caller の `Uint8Array` を同期 copy し、上書き可能な iterator や method を実行しない
  ],
  test_cases: [
    - empty bytes と `abc` の既知 SHA-256 vector に一致する
    - 呼び出し直後に input bytes または preimage を変更しても開始時 snapshot の digest になる
    - input bytes の iterator を上書きしても実行せず、typed array の exact bytes を hash する
    - canonical digest guard が canonical 表記だけを受理する
  ],
)

#feature_spec(
  name: "Qualified identity",
  summary: [
    namespace、kind、local ID を versioned canonical preimage に束縛した content-addressed ID を生成する。
  ],
  api: [
    ```typescript
    type QualifiedId<Kind extends string> =
      Sha256Digest & QualifiedIdBrand<Kind>

    interface QualifiedIdInput<Kind extends string> {
      readonly namespaceId: Sha256Digest
      readonly kind: Kind
      readonly localId: string
    }

    interface QualifiedIdPreimage<Kind extends string>
      extends QualifiedIdInput<Kind> {
      readonly schema: "dathra.qualified-id/1"
    }

    function createQualifiedId<Kind extends string>(
      input: QualifiedIdInput<Kind>
    ): Promise<QualifiedId<Kind>>
    ```
  ],
  edge_cases: [
    - input は current-realm plain object または null-prototype record とし、`namespaceId`、`kind`、`localId` の own enumerable data property だけを持つ closed record とする
    - accessor、missing field、extra field、symbol property、custom prototype、malformed root を hash 前に typed failure として拒否する
    - 各 field は descriptor から一度だけ snapshot し、検証した snapshot と hash する snapshot を同一にする
    - Proxy は canonical JSON input と同様に caller が渡してはならない
    - namespace は canonical SHA-256 digest でなければならない
    - kind は non-empty かつ lone surrogate を含まない string とする
    - local ID は empty string と Unicode を許可するが lone surrogate を拒否する
    - schema field は API が生成し、caller に差し替えさせない
  ],
  test_cases: [
    - qualified ID が公開 preimage の canonical digest と一致する
    - namespace、kind、local ID の domain separation を検証する
    - invalid namespace、empty kind、invalid Unicode を拒否する
    - accessor を実行せず拒否し、malformed root と closed record 違反を stable code と path で拒否する
  ],
)

#feature_spec(
  name: "Canonical identity failure",
  summary: [
    canonicalization と identity 生成の失敗を stable code と value path で報告する。
  ],
  api: [
    ```typescript
    type CanonicalIdentityPathSegment = string | number

    type CanonicalIdentityErrorCode =
      | "unsupported-value"
      | "invalid-number"
      | "invalid-unicode"
      | "unsupported-object"
      | "unsupported-property"
      | "sparse-array"
      | "cyclic-value"
      | "invalid-digest"
      | "invalid-qualified-id"
      | "crypto-unavailable"

    class CanonicalIdentityError extends TypeError {
      readonly code: CanonicalIdentityErrorCode
      readonly path: readonly CanonicalIdentityPathSegment[]
    }
    ```
  ],
  test_cases: [
    - nested failure が root から failure value までの path を持つ
    - error code と path は caller が変更できない snapshot である
  ],
)
