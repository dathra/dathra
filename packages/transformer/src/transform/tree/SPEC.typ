= transform/tree

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 設計判断

#adr(
	header: header("Fragment の dynamicParts は参照渡し配列を返す", Status.Accepted, "2026-03-09"),
	context: [
		Fragment 変換では `processChildren` が `dynamicParts` 配列へ直接 push する。
	],
	decision: [
		Fragment 変換では `children.flatMap` ではなく、`processChildren` へ渡した `dynamicParts` ローカル変数をそのまま返す。
	],
	rationale: [
		- `processChildren` は `dynamicParts` に直接 push する設計である
		- flatMap では動的パーツを取りこぼす可能性がある
	],
)

#adr(
	header: header("コンポーネント子要素は insert プレースホルダに変換", Status.Accepted, "2026-03-09"),
	context: [
		コンポーネント子要素は tree に直接埋め込まず、後段の挿入処理へ渡す必要がある。
	],
	decision: [
		子要素がコンポーネントの場合、tree には `"{insert}"` を置き、`DynamicPart` に `isComponent: true` の insert を記録する。
	],
)

#adr(
	header: header("式コンテナの mode-aware JSX フォールバック", Status.Accepted, "2026-03-09"),
	context: [
		`.map()` / ternary / call 以外にも、式サブツリー内に JSX が埋め込まれるケースがある。
	],
	decision: [
		式サブツリー内に JSX ノードを含む場合は `insert` dynamic part として扱い `transformNestedJSX` を適用する。
	],
	rationale: [
		- 条件分岐や配列・オブジェクト式に JSX が埋め込まれるケースを取りこぼさないため
		- text dynamic part へ誤分類すると JSX ノードの評価が破綻するため
	],
)

#adr(
	header: header("namespaced 属性キーの正規化", Status.Accepted, "2026-03-09"),
	context: [
		`JSXNamespacedName` は JavaScript 識別子へそのまま変換できない。
	],
	decision: [
		`JSXNamespacedName` 属性は `namespace:name` 文字列キーとして扱う。
	],
	rationale: [
		- JavaScript 識別子に変換できない属性名を安全に保持するため
		- SVG 属性（`xlink:href` など）を落とさず変換するため
	],
)

#adr(
	header: header("ローカル static expression は補助変数へ退避しない", Status.Accepted, "2026-03-11"),
	context: [
		`const label = ...` のようなローカル値を属性や text dynamic part に渡したとき、transformer がテンプレート外参照へ持ち上げるとスコープが壊れる。
	],
	decision: [
		JSXExpressionContainer 内の式は、reactive access を検出して dynamic part に分類しても元の式ノードを保持し、補助変数へ hoist しない。
	],
	rationale: [
		- 関数スコープ内ローカル値を安全に参照できる
		- SSR/CSR の両モードで lexical scope を壊さない
	],
)

#adr(
	header: header("非 reactive な式属性は attr dynamic part として初期化する", Status.Accepted, "2026-03-11"),
	context: [
		静的式属性を tree の static props へ直接埋め込むと、テンプレート宣言が関数スコープ外へ hoist されたときにローカル識別子を参照できなくなる。
	],
	decision: [
		reactive access を含まない式属性も `attr` dynamic part として収集し、更新側で `setAttr()` を 1 回だけ実行して初期値を反映する。
	],
	rationale: [
		- lexical scope を壊さずにローカル値を属性へ流せる
		- reactive access を含まないため `templateEffect` は不要で、初期化コストだけで済む
	],
)

#adr(
	header: header("component 上の client:* directive は島 metadata に正規化する", Status.Accepted, "2026-03-15"),
	context: [
		Phase 0 では islands directive の宣言面だけを先に固定し、後続 runtime が読める internal metadata 形式へ落とし込む必要がある。
	],
	decision: [
		component 要素上の `client:*` directive は user props に残さず、`data-dh-island` と `data-dh-island-value` に正規化して `buildComponentCall()` へ注入する。HTML 要素上の directive は transform error にする。`data-dh-island*` の明示 props と islands directive が同居する場合も transform error にする。
	],
	rationale: [
		- CSR / SSR の両モードで同一 metadata key を共有できる
		- runtime 側は JSX 名前空間ルールを知らずに済む
		- user props と compiler-internal metadata を分離できる
	],
)

== 機能仕様

#feature_spec(
	name: "JSX to tree conversion",
	summary: [
		JSX を構造化配列 tree に変換し、動的パーツ（text / attr / event / spread / insert / preserve）を収集する。
	],
	api: [
		- `DynamicPart`, `TreeResult` 型
		- `containsReactiveAccess`
		- `processAttributes`
		- `processChildren`
		- `jsxElementToTree`
		- `jsxToTree`
	],
		test_cases: [
			- 静的 HTML を tree 化できる
			- `signal.value` を含む属性が attr dynamic part になる
			- reactive access を含まない式属性も attr dynamic part として保持される
			- イベント属性が event dynamic part になる
		- `.map()` / ternary / call expression が insert dynamic part になる
		- `logical expression`（`&&` / `||`）が insert dynamic part になる
		- JSX を含む一般式（Array/Object/Binary など）が insert dynamic part になる
		- `JSXSpreadChild` が insert dynamic part になる
		- namespaced 属性（`xlink:href`）が文字列キーとして保持される
		- Fragment 内の動的テキスト・コンポーネント insert を取りこぼさない
		- component の `client:visible` が `data-dh-island="visible"` metadata として props に注入される
		- bare `client:interaction` が `data-dh-island-value="click"` を補完する
		- `client:media` が string literal 以外では例外を投げる
		- `client:visible="foo"` のような値付き valueless directive が例外を投げる
		- HTML 要素上の `client:*` directive は例外を投げる
		- 未知の `client:*` directive 名は例外を投げる
		- islands directive と `data-dh-island*` 明示 props の衝突は例外を投げる
		- HTML 要素上の bare `hydrate:preserve` は preserve dynamic part を記録し、属性としては出力しない
		- 値付き `hydrate:preserve` は例外を投げる
	],
)
