#import "../../../functions.typ": *
#import "../../../settings.typ": *
#show: apply-settings

#design_proposal(
  issue: 260,
  name: "server-authoritative framework の実行境界と package 責務",
  summary: [
    本 Proposal は Issue #260 が所有する Epic #246 の残る共有判断を記録する。
    採用済み #253 の最初の slice を前提に、組合せ可能な capability、authority の移転、reactivity の接続境界、物理 package の責務と依存方向を提案する。
    本文の ADR はレビュー提出時点では Proposed であり、GitHub の Proposal Progress が Proposed になっても最終採用を意味しない。
  ],
  scope: [
    - #252 の primary consumer と #253 の採用済み契約に基づく横断設計
    - #247〜#251 が個別の SPEC と test を書ける責務境界
    - 現行 package の維持、分割、廃止と Accepted ADR の変更範囲
  ],
  non_goals: [
    - production code、既存 executable tests、reactivity engine の変更
    - 最終 public API、wire encoding、transport、DOM marker、性能閾値の確定
    - #253 の compiler/JSX 選択の再審議、PR merge、Epic #246 の完了宣言
  ],
  open_questions: [
    - 本 Issue に必要な分類、authority、package 配置、依存方向は本文で選択した。
    - 後続の API と encoding、および production 経路の成立証拠は「後続 owner と blocking status」に割り当てる。Issue #260 の本文にも同じ割当てを記録する。
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/245")[Initiative #245],
    link("https://github.com/dathra/dathra/issues/246")[Epic #246],
    link("https://github.com/dathra/dathra/issues/252")[Task #252],
    link("https://github.com/dathra/dathra/issues/253")[Proposal #253],
    link("https://github.com/dathra/dathra/pull/259")[PR #259],
    link("https://github.com/dathra/dathra/issues/260")[Proposal #260],
  ),
)

== 判断の根拠と適用範囲

#252 の固定 source は c1a30ed86fd2bd79e1c742362f552e9f62ff9f98、承認済み evidence revision は 4e6b91eab9147222cbec2b22b53b257a7474b470 である。
その正準記録は #raw("SPEC/proposals/245/252/252.typ") にある。
最初の consumer は #raw("@playground/e2e") の #raw("/store-snapshot-roundtrip") であり、server は Count 7 と Theme snapshot-midnight を表示し、client の反復 click は Count を更新する。
#252 が観測した五回の click は Count 12 に達したが、切り離した button の listener が残ったこと、欠落または shape 不正の snapshot が client default に落ちたことも baseline の欠落として記録されている。
Docs Copy は実在する比較 consumer であり、初回 slice の primary consumer ではない。
Home route は既存 production の zero-client-root 対照ではない。

#253 の採用済み文書は #raw("SPEC/proposals/245/253/253.typ") で、SHA-256 は bd03998c449ec2021da8ec39eb5ae2792bd7da625c2e0c9ded0519bad765f709 である。
PR #259 は integration branch に 67ad908b7227e5ad0953e616b39fc175108415c1 として merge された。
その決定は専用 compiler と JSX を最初の slice に採用せず、Plain JS/TS の明示的な server/client module と capability declaration を用いる。
server が初期 state と DOM を確定し、client は component、setup、render、初期値取得を再実行せずに response 値を既存 engine の client-local Signal へ復元する。
初期 activation は preflight、単一 admission、段階的な初期 DOM 書込み、preflight 通過後の acquisition/commit 失敗 identity の terminal 化、fresh response による復旧、child を shared state より先に止める cleanup に従う。
成功済み instance の operation retry はこれと別の遷移である。

旧 package SPEC と tests は現在の実装契約を説明するが、#245 の新設計を承認した証拠ではない。
三つの独立調査は、旧 package import の acyclic な静的 scan、capability の組合せ、engine 外の integration 境界を提案した。
静的 scan は revision 49b1adf502dad7de0b4709c1595d87529f0d2ebd における manifest と通常 import/export の一致を見ており、15 個の cross-package source edge と manifest cycle 不在を観測した。
dynamic import 全体や bundler 出力の保証ではない。
旧 prototype の結果は採用済み #253 の evidence summary に帰属する。
旧 #raw("/tmp/dathomir-253-luna") の報告はこの作業環境に存在せず、ここで再実行したとは扱わない。

== 用語と capability の組合せ

#table(
  columns: (1.5fr, 4.8fr),
  table.header([用語], [共有する意味]),
  [server artifact], [一つの response に結び付いた初期 structure、content、value、identity の正本と、その参照先を含む概念。単一ファイルや特定 encoding は要求しない。],
  [declared capability], [author が実行環境、操作または binding、対象、owner を明示した権限。build が扱う静的 capability ID は response 間で同じでもよく、SSR instance identity とは別である。],
  [component instance], [server が一つの response に作った UI 出現。server は出現ごとに新しい SSR instance identity を発行し、同じ宣言の複数出現を区別する。Web Component host の有無に依存しない。],
  [association], [server artifact が発行する不変の対応。instance identity、静的 capability ID、初期論理値、明示された root と target を結び、client preflight が検証する。],
  [activation], [既存 SSR instance の association を検証し、宣言済み client 権限だけを単一 owner に入場させる処理。component 構築、render、tree reconciliation ではない。],
  [execution profile], [検証済み capability 組合せへ #251 の support matrix が付ける任意の名前。profile 名や DOM 形状から権限を生成しない。],
)

server-only は client capability がない結果であり、独立した排他的な profile 値ではない。
stable interaction は既存 SSR target への event operation、client-reactive update は明示的 getter と更新 target、server-owned delivery は明示的な server request、navigation、または server からの応答取得の責務を記述する。
user-created UI は初期 SSR instance と別の creation boundary を必要とする能力である。
一つの instance は event operation と reactive binding を組み合わせられ、必要に応じて明示的な server request または UI creation を加えられる。
最初の slice が要求するのは、capability なしの server-only と、既存 button operation と Count binding の組合せである。
Docs Copy は安定した source と operation、成功 feedback、timer の比較例となるが、この Proposal はそれを第一 consumer へ格上げしない。

#table(
  columns: (1.3fr, 1.8fr, 3.4fr),
  table.header([候補], [結論], [組合せと authority の境界]),
  [server-only], [採用], [client 宣言が空なら Dathra bootstrap、handoff、activation marker、artifact reference をその route の response に送らない。通常の HTML navigation は可能。未知宣言を空集合と解釈しない。],
  [stable interaction], [能力として採用], [既存 target の operation。Count の click は reactive binding と併用する。成功 feedback や timer は宣言 target と child owner に属する。],
  [client-reactive update], [能力として採用], [宣言 getter を admitted Signal と effect へつなぎ、commit 後だけ named target を書く。SSR 中の #raw("text(count.value)") は評価済み値であり、自動 subscription ではない。],
  [server-owned delivery], [能力として採用], [新しい response の値と identity は server が発行する。fetch 型 delivery は宣言済み request が必要で、native navigation は client activation を必要としない。transport 詳細は #248。],
  [user-created UI], [別の能力として採用], [操作後の新 child boundary に作成権限を与える。既存 SSR node の再構築権限は生じない。child の所有と disposal は #249。],
)

== authority と責務の共有契約

server は response ごとに初期 state を一度評価し、DOM と immutable association を発行する。
build は明示された client entry と既知の server-only import を検査し、宣言が空の route へ Dathra client entry を選ばない。
build が arbitrary JS、反射的 import、DOM 形状を完全解析する保証は置かず、確証できない宣言を黙って server-only と分類しない。
client preflight は identity、static ID、必要な値、entry/export、root、host または control を含む宣言 target の存在と一致を acquisition 前に確認する。
誤った root、host、control のいずれも診断付きで拒否し、SSR 表示を保持する。
commit が成功したときだけ、client owner に特定 target の post-commit 書込み、宣言 operation、新 child boundary の作成を許す。
同じ SSR subtree 全体の書換えや server-only initializer の実行権限は渡さない。

#table(
  columns: (1.05fr, 2.05fr, 2.15fr, 2.1fr),
  table.header([主体], [所有する責務], [禁止する責務], [終了または失敗]),
  [author], [server initializer を一度宣言し、client operation、tracked getter、target、creation/request boundary を明示する。], [静的 ID を SSR instance identity として使わず、暗黙 capture や DOM 探索に依存しない。], [有効な宣言と child 境界を提供する。],
  [build], [宣言 entry の graph、既知 server-only import、zero-root 選択を検査する。], [setup/render の client 実行 code を所有権推測で生成しない。], [不足と既知の禁止依存を build diagnostic にする。],
  [server], [request-local state、初期 DOM、fresh identity、association、server request と response commit を所有する。], [送信済み DOM を後から browser で暗黙修復せず、client lifetime を所有しない。], [request resource を終了し、次 response は新 identity を発行する。],
  [client], [preflight、単一 admission、target writer、operation generation、child scope、rollback、disposal を所有する。], [initial initializer/setup/render を再実行せず、未宣言 target を書かず、失敗を hydration/CSR fallback で隠さない。], [preflight 拒否では資源を取得せず、通過後の acquisition/commit 失敗だけ identity を terminal 化して owned resources を逆順解放する。],
  [reactivity], [既存 signal、computed、effect、batch、scope と通知意味論を提供する。], [SSR identity、DOM、wire、request、admission policy を所有しない。], [integration owner が stop/dispose を登録して呼ぶ。],
)

同じ logical state slot の alias は一つの client-local Signal を指す。
server と client は同じ memory object を共有せず、activation は自動的な双方向同期を開始しない。
明示的 server request の戻り値を画面へ反映する場合は、受信側の admitted owner と generation が生きていること、対象への宣言権限があることを確認する。
server response は新しい server authority を持つが、古い SSR identity を再利用する権限は与えない。
明示的 server request が失敗または中断した場合、既存 active instance と表示を保持し、成功状態を通知しない。
古い request generation の応答は新しい操作の結果を上書きせず、server が新しい UI を返す場合は新しい identity と association に対して admission を行う。
response の transport と commit 手順は #248/#249 が具体化する。

== reactivity の維持範囲

#raw("@dathra/reactivity") の Signal 読取り、依存追跡、通知、computed、effect、batch、root cleanup の observable semantics を維持する。
SSR value restoration、association 検証、admission、DOM binding、operation retry、resource 登録、disposal 順序は client integration owner の責務に置く。
この境界なら engine を変更せず、activation adapter や Web Components adapter を置換できる。
現行 test は plain #raw("effect()") が独立 stop を返すこと、#raw("templateEffect") は初回に同期実行すること、#raw("batch()") は callback が throw しても部分更新を flush することを示す。
そのため #raw("createRoot") だけで全 listener と plain effect が登録済みとはみなせず、batch を activation transaction として使えない。
adapter は effect stop、listener、timer、observer、abort handle、async generation を root または child owner に登録する。
initial getter を評価して dependency を収集することは #253 が許すが、initial DOM write は commit まで buffer に留める。
commit-time write 失敗で元の SSR 表示と node を保つ方法は #249 が production 経路で実証しなければならない。

== package の物理配置と依存方向

最初の slice の物理 target は純粋な #raw("@dathra/shared")、維持する #raw("@dathra/reactivity")、任意利用の #raw("@dathra/store")、新しい #raw("@dathra/server") と #raw("@dathra/client")、再編した #raw("@dathra/components") と #raw("@dathra/plugin")、環境別 facade の #raw("@dathra/core") とする。
これは実装名の仮置きではなく、本 Proposal の package 責務判断である。
公開 API の export 名や移行時の一時 path は #247〜#250 が決める。

#table(
  columns: (1.3fr, 1.5fr, 4.1fr),
  table.header([現行 package], [処置], [target responsibility と移行 owner]),
  [shared], [維持し縮小], [純粋な static declaration と response association の型・検証規則だけを共有する。旧 island strategy/marker 契約は #250 が置換する。#247〜#249 が同一 contract を各 SPEC に採用する。],
  [reactivity], [維持], [engine と既存 observable semantics のみ。server/client protocol を import しない。#249 が adapter で利用する。],
  [store], [任意 package として維持], [状態抽象と schema は opt-in。公開 snapshot schema を最初の slice の必須 author 概念にしない。#247/#249 が採否を consumer ごとに決める。],
  [runtime], [server/client に物理分割後に廃止], [#248 が #raw("@dathra/server") で request renderer と response association を所有し、#249 が #raw("@dathra/client") で preflight、owner、target writer を所有する。旧 mixed hydration/runtime root は #250 が production path から除く。],
  [components], [維持し adapter に限定], [server 側 Web Components/DSD adapter は #raw("@dathra/server") の上、browser 側 custom-element adapter は #raw("@dathra/client") の上に別 entry として置く。host lifecycle は既存 SSR identity の setup replay を許さない。#248/#249 が設計し #250 が移行する。],
  [core], [維持し facade に限定], [root barrel と JSX/hydration convenience の新経路への混入を廃し、server/client 別 entry だけで下位契約を組み立てる。#247 が入口を定義し #250 が旧 export を除く。],
  [transformer], [新経路から削除し package を廃止], [専用 JSX/plan lowering を必要としない #253 の選択に従う。通常 TS/bundler 変換は使える。#250 が旧 production import と package を除く。],
  [plugin], [維持し build adapter に再編], [#247 が宣言 entry 選択、既知禁止 import の診断、zero-root omission を所有する。transformer への現行依存を切る。選定環境外の adapter support は #251 の証拠に従う。],
)

依存は #raw("shared") と #raw("reactivity") を leaf とし、#raw("store -> reactivity")、#raw("server -> shared, reactivity, optional store")、#raw("client -> shared, reactivity, optional store")、#raw("components/server -> server")、#raw("components/client -> client")、#raw("core/server -> server, components/server")、#raw("core/client -> client, components/client")、#raw("plugin -> shared") の方向に限定する。
server と client は互いを import せず、両者の接点は shared contract と server が発行する response artifact だけである。
plugin は server renderer と browser runtime を import せず、明示宣言と build graph を検査する。
client graph から server initializer、renderer、request secret、server-only loader への import は禁止し、既知の違反を build で診断する。
author module は環境別入口へ値を渡す source であり、両環境を同じ runtime package へ再結合する理由にはならない。

Web Components の host、Shadow DOM、custom element registration は必要な consumer で引き続き使える。
ただし host の connectedCallback は SSR instance の activation 権限を自動発行しない。
新規 UI は宣言された creation boundary で作り、必要なら components/client adapter が child scope と host lifetime を結ぶ。
server delivery は #raw("@dathra/server") の response と client 側の明示 request integration で扱い、通信が必要という理由で全 root へ bootstrap を追加しない。
これらを実装負担だけを理由に unsupported としない。

== 比較と選択

A は現行 package 境界を保ちながら、#253 の明示宣言、preflight、zero-root 判定を追加し、Count 用に operation と binding を合わせた明示的な複合 profile を設ける案として比較する。
固定 profile は排他的である必要がなく、旧 #raw("SPEC/proposals/103-declarative-ui-execution-partitioning/110.typ:78") も一 route の複数 profile を許す。
B は #raw("@dathra/core") に共通 runtime を統合して server/client 別 entry と明示宣言を置き、build graph で環境別 import と空宣言を検査する案として比較する。
B に DOM 形状からの権限推定、root barrel import、tree shaking だけの zero-root 判定は要求しない。
両案とも #253 の初期正本、再構築禁止、preflight、transaction と明示 server request を実装すれば必須条件を満たせる。

#table(
  columns: (1.2fr, 1.85fr, 1.85fr, 1.85fr),
  table.header([基準], [A: 現行 package と複合 profile], [B: 共通 package と環境別 entry], [C: authority 分割と組合せ能力]),
  [consumer の操作と更新], [Count 用の明示複合 profile が event と binding を同じ owner に置ける。新しい組合せごとに profile の契約と検証を追加する。], [明示宣言で event と binding を同じ owner に置ける。server/client entry の両側で同じ宣言規則を維持する。], [event と binding を同じ owner へ宣言し、検証済み組合せを support matrix に載せる。],
  [SSR と zero root], [旧 fallback を外し、build が空宣言を確認すれば初期 SSR と zero-root を保てる。mixed runtime 内の入口分離を別途検査する。], [環境別 entry と build graph 検査で初期 SSR と zero-root を保てる。単一 package 内の禁止 import を entry 単位で検査する。], [server response が初期正本。空宣言 entry を省き、server/client package 間の禁止依存を package と build の両境界で検査する。],
  [failure と lifetime], [#253 の一 identity 一 owner と transaction を追加できる。既存 host cleanup と owner/child scope の責務変更を mixed runtime に収める。], [共通 runtime 内でも owner/child scope と rollback を定義できる。server request と client lifetime の責務を entry 間で継続して隔離する。], [一 identity 一 owner、preflight、staging、terminal failure、child cleanup を client に置き、response identity は server に置く。],
  [reactivity と依存], [engine を維持できる。旧 transformer 依存と mixed runtime の各入口を #253 に合わせて改修し、禁止 edge を検査する。], [engine を leaf に保てる。共通 package の内部 graph が環境を横断しないことを entry ごとに検査する。], [engine は leaf、server/client は sibling、plugin は宣言 graph のみを扱う。物理 package の依存方向でも環境を分離する。],
  [実用性と費用], [Web Components、通信、新 UI を adapter と複合 profile で扱える。能力の組合せが増すほど profile 契約と mixed runtime の変更範囲が増える。], [環境別 entry で同じ能力を扱える。package 数は少ないが、共通 package 内の entry/export と内部 import の監査が継続的に要る。], [同じ能力を server/client adapter と child boundary で扱える。package 増加、二つの実装と移行作業が必要。],
  [判断], [成立し得るが、組合せ追加と環境隔離を旧 mixed package の中で維持する費用を採らない。], [成立し得るが、環境隔離を単一 package の entry 規律へ集中させる費用を採らない。], [推奨。責務と禁止依存を物理境界にも置く。production 実証は後続。],
)

A と B は #253 と Issue #260 の必須条件に適合させられるため、成立不能という理由では退けない。
C の package 分割は既存 API 互換を設計基準にしない。
選択理由は、server response と client activation の owner を package 境界に一致させ、禁止 import を package graph と build graph の両方で検査できることである。
A は複合 profile の追加と mixed runtime 改修、B は共通 package の entry/export 規律と内部依存監査が継続する。
採用候補 C にも宣言の記述量、build graph 診断、server/client の二つの実装、migration 費用が残る。
これらは #247〜#250 の詳細設計と検証に割り当てる。

Issue #260 の各 acceptance criterion を同じ選択基準で照合する。
A と B も必須の行動契約を実現できるが、責務隔離と継続的な検査費用で C を選ぶ。
文書作成・検証に関する AC9/10 は選択後に共通の gate とする。

#table(
  columns: (0.75fr, 1.95fr, 1.95fr, 2.35fr),
  table.header([AC], [A: 複合 profile], [B: 環境別 entry], [C: authority 分割]),
  [1 用語], [静的複合 profile と response instance を分離できる。], [entry 宣言と response instance を分離できる。], [artifact、capability、instance、activation、profile を分離。],
  [2 分類], [Count 用の複合 profile で併用できる。組合せごとに契約を追加。], [明示宣言の組合せを共通 package の別 entry で扱える。], [四候補を能力として比較し併用。],
  [3 所有と寿命], [#253 の owner/child/transaction を mixed runtime に追加できる。], [#253 の owner/child/transaction を client entry に置ける。], [主体表、identity 状態モデル、失敗/復旧を規定。],
  [4 reactivity], [engine 維持と adapter 分離が可能。], [engine 維持と client entry adapter 分離が可能。], [engine leaf、integration adapter を交換可能。],
  [5 package], [現行 package 維持と entry/transformer 改修の処置を確定できる。], [core 統合と環境別 entry の処置を確定できる。], [現行 package ごとの維持/分割/廃止と方向を確定。],
  [6 Epic 対応], [#246 の各条件を #253 と A の契約へ対応可能。], [#246 の各条件を #253 と B の契約へ対応可能。], [#246 全13条件を #253 または本書へ対応。],
  [7 ADR], [旧 Accepted の変更箇所を A の新 ADR で限定 supersede できる。], [旧 Accepted の変更箇所を B の新 ADR で限定 supersede できる。], [Proposed ADR が適用範囲を指定して supersede。],
  [8 後続 owner], [mixed runtime の担当と各 evidence gate を割り当てられる。], [共通 package の entry 担当と各 evidence gate を割り当てられる。], [#247〜#251 と blocking status を具体化。],
  [9 比較と状態], [同じ scenario 表で成立条件と費用を記録。], [同じ scenario 表で成立条件と費用を記録。], [状態、stress、coverage を本書へ記録。],
  [10 検証と PR], [どの案にも共通の publication gate。], [どの案にも共通の publication gate。], [Typst/whitespace と独立再レビューの後に Draft PR。現時点では再レビュー/PR 未了。],
)

== 共有状態モデルと資源寿命

状態は SSR instance identity ごとに一つの activation owner が管理する。
root、host、control は association 内で明示した場合だけ target となる。
child scope は owner に属し、独立して消えることができる。
同一 identity への同時 admission は一つの予約を共有し、一つだけ commit する。
矛盾した payload または別 owner を同じ identity に結び直す要求は拒否する。
preflight 拒否は owner 予約前の結果であり、identity を failed-terminal にしない。
同じ immutable association を再検証する余地は残すが、自動 retry や成功は保証しない。不正な association を同じ identity のまま書き換える権限はなく、修正済み response が要る場合は server が新しい identity を発行する。
preflight 通過後の acquisition または commit 失敗だけが同 identity の activation retry を禁じる。

#table(
  columns: (1.3fr, 2.2fr, 2.1fr, 2.1fr),
  table.header([状態と owner], [入口と許可 event], [出口], [資源と DOM]),
  [unadmitted / server artifact], [server が identity、DOM、association を発行。client 宣言がなければここで終了。], [宣言ありなら preflight 開始。], [SSR nodes のみ。client listener、effect、Store はない。],
  [preflighting / client validator], [root、host、control、identity、static ID、values、exports、targets を acquisition 前に照合。], [一致なら staging、欠落・矛盾なら preflight-rejected を返して unadmitted に留まる。], [不一致では owner を予約せず何も取得せず SSR node/display を保持する。],
  [staging / 単一 activation owner], [owner 予約後に local Signal、child scope、getter、listener を transaction へ登録。重複要求は同じ予約を待つ。], [全取得と commit 成功で active、途中または commit failure で failed-terminal。], [initial write は buffer、event は遮断。失敗は逆順 cleanup と generation 無効化で SSR を保持する。],
  [active / activation owner], [宣言 operation、binding、server request、child creation。重複 admission は同じ owner を返す。], [child disposal は active 継続。shared owner 終了で disposed。], [named target だけ更新。operation failure は false success にせず、明示 retry を許す。],
  [failed-terminal / identity record], [preflight 通過後の acquisition または commit failure。], [同 identity は再入場不可。fresh response/new identity のみ新しい unadmitted となる。], [owned resource はゼロ、staged write は破棄、元の SSR 表示を保つ。],
  [disposed / owner], [child の個別終了、または shared owner 終了。], [同 identity の再 activation は不可。], [connected child callback/effect/listener/timer を先に止め、shared Store を後で dispose。重複 cleanup は無作用。],
)

late callback は owner と child の生存、および operation generation を確認してから target へ書く。
timer cancellation だけで queue 済み callback が消える保証は置かない。
partial failure の逆順 cleanup は exception を集約しても残る resource の停止を続ける。
commit-time DOM write failure でも元の SSR node と表示を保つ必要があり、単なる #raw("batch()") はその保証を与えない。
この状態モデルは adapter への要求であり、現行 public path が実装済みという主張ではない。

#behavior_spec(
  name: "SSR instance の権限移転",
  summary: [
    server artifact から client owner へは検証済み target の限定権限だけを移す。
  ],
  preconditions: [
    - server が response ごとに新しい identity と immutable association を発行した
    - build が宣言済み client entry を選び、既知の server-only 依存を拒否した
  ],
  steps: [
    1. client validator が association の identity、static ID、値、entry/export、root、host、control と target を取得前に照合する
    2. 単一 owner を予約し、Signal、effect stop、listener、timer、abort handle と child scope を transaction へ登録する
    3. getter の初回値を buffer に置き、成功した一つの commit 後にだけ named target の書込みと operation を許可する
  ],
  postconditions: [
    - component、setup、render、初期取得は client で再実行されない
    - 同一 identity の重複 admission は owner と resource を増やさない
  ],
  errors: [
    - root、host、control または handoff の欠落・矛盾は acquisition 前に preflight-rejected として返し、owner を作らず SSR を保持する。同じ immutable association の再検証は妨げない
    - preflight 通過後の acquisition/commit failure は SSR 表示を保持して identity を terminal 化し、fresh response を要求する
    - disposed owner と古い generation の callback は DOM を書かない
  ],
)

== failure・競合・寿命の比較

#table(
  columns: (1.7fr, 1.8fr, 1.8fr, 2.1fr),
  table.header([scenario], [A: 複合 profile], [B: 環境別 entry], [C: 選択契約と evidence 限界]),
  [Count 7、Theme と反復 click], [明示複合 profile に operation と binding を登録すれば成立。新しい組合せごとに profile を検証する。], [明示宣言を client entry の同じ owner に渡せば成立。entry 間の宣言一致を検査する。], [同じ owner の operation + binding。#252 は baseline、#253 の route-specific adapter は SSR Text 保持を報告。public path 未検証。],
  [zero-client-root], [build が空宣言を証明し server が共通 bootstrap を省けば成立。mixed runtime の入口監査が要る。], [build が空宣言を証明し server entry が script を省けば成立。共通 package 内の import 監査が要る。], [宣言空集合を build/server が配信前に扱う。#253 の adapted HomeRoute は限定 feasibility、production plugin は未検証。],
  [handoff/root/host/control 不一致], [複合 profile でも全 target を preflight で取得前拒否し、SSR を保つ。], [client entry の validator が全 target を取得前拒否し、SSR を保つ。], [preflight-rejected で owner 未作成、SSR 保持。同じ immutable association の再検証を禁じない。#253 の五つの route-specific case は限定観測。],
  [同時二重 admission], [mixed runtime に identity ごとの一予約を追加できる。host と owner の重複起動を抑える。], [client entry に identity ごとの一予約を追加できる。共通 package の server entry は owner を作らない。], [一予約、一 commit。#253 の低水準 adapter 観測は production へ一般化しない。],
  [A 取得後 B 失敗または commit failure], [transaction-owned scope と staged write を mixed runtime に追加すれば rollback できる。], [client entry に同じ transaction を置けば rollback できる。], [全 resource 逆順解放、write 破棄、SSR 同一表示。A/B resource rollback は #253 の限定観測、一般 write staging は未検証。],
  [preflight 拒否、terminal 後 retry と operation retry], [preflight 拒否と通過後の terminal を分け、active operation は再試行できる。profile ごとの診断維持が要る。], [client entry で三つの結果を分けられる。server entry との recovery 接続が要る。], [preflight 拒否は非 terminal。acquisition/commit failure は fresh response/new identity、active operation は明示 retry。fresh-response 回収は未検証。],
  [child removal と late callback], [child scope と generation を mixed runtime に追加すれば sibling を保てる。], [client entry に child scope と generation を置けば sibling を保てる。], [child のみ停止、shared 終了は child 先。generation 確認と timer 等の取消しを #249 が public path で検証。],
  [新 UI と server delivery], [複合 profile に creation と request を明示すれば扱える。組合せ契約が増える。], [client/server entry の明示 creation/request で扱える。環境間契約を監査する。], [新 child boundary と明示 server request を別能力にする。実用 support の API/transport は #247〜#249 が所有。],
  [server request の失敗と古い応答], [generation と target 権限を profile ごとに登録し、失敗時は表示を保てる。], [client entry が generation と target 権限を検査し、失敗時は表示を保てる。], [失敗時は現行表示を保持し、古い generation は無視。新 response は新 identity。具体 transport と commit は #248/#249 の未検証契約。],
)

== Accepted ADR の扱い

本 Proposal の Proposed ADR は旧 Accepted ADR の意味を直接変更しない。
提案が採用される場合、新経路へ適用する範囲で次の supersession を記録し、旧文書を履歴として保持する。
#raw("SPEC/SPEC.typ") の「トップレベル SPEC の境界」と package SPEC/test 正本規則は維持する。
#raw("@dathra/reactivity") の signal/effect/batch/root の既存意味論、request-scoped store option、DSD という HTML 能力自体は互換候補として保持する。
現行 global ComponentRenderer が request 間の mutable registration を持つかは #248 のレビュー対象であり、現時点で直接の矛盾と断定しない。
#raw("defineAtomStoreSnapshot") の public schema は optional abstraction として残せるため、必須 authoring へ昇格させない限り直接の supersession は要らない。
旧 #raw("SPEC/proposals/103-declarative-ui-execution-partitioning/110.typ:164") の論理的な server/client artifact 分離と同 #raw("110.typ:270") の zero-root output の目的は、新方式と整合する部分を残せる。
ただし旧 compiler と固定 profile から生成する手段はこの Proposal の採用対象ではない。
runtime hydration の generic plan と interaction replay に関する Proposed ADR は Accepted ではなく、新しい採用済み前提として継承しない。

#adr(
  header("組合せ可能な capability と限定された authority transfer", Status.Proposed, "2026-09-29"),
  [
    #245 と #253 の server authority を維持しながら、Count の operation と reactive binding、将来の server request と新 UI の組合せを所有権つきで表す必要がある。
  ],
  [
    宣言された能力を SSR instance ごとに組み合わせる。
    response artifact は初期 DOM/state/identity の正本であり、client へは preflight と単一 commit 後の named target 権限だけを渡す。
    support-matrix profile は検証済み組合せの表示名であり、実行権限ではない。
    #253 の preflight 拒否と通過後の terminal failure を区別し、terminal 後の fresh response と child-first cleanup を保持する。
  ],
  [
    #247 は宣言境界を実装し、#248 は artifact と delivery を発行し、#249 は admission と resource を所有する。
    profile 名だけから実行権限を付与する経路、および SSR instance を rerender して activate する経路は新しい production path に入れない。
  ],
  alternatives: [
    - 現行 package と明示複合 profile を維持する A は primary consumer の併用を扱えるが、組合せ追加のたびに profile 契約と mixed runtime の環境境界を保守する。
    - #raw("@dathra/core") の共通 runtime に明示宣言と環境別 entry を置く B も preflight と zero-root を満たせるが、禁止 import と entry/export の隔離を package 内部で継続監査する。
  ],
  supersedes: (
    [#raw("SPEC/proposals/103-declarative-ui-execution-partitioning/106.typ:159") の「DocCodeBlock reactive execution profiles」の固定分類を新経路へ適用する範囲],
    [#raw("SPEC/proposals/103-declarative-ui-execution-partitioning/110.typ:78") の「Component-root classification and route aggregation」の compiler 主導分類を新経路へ適用する範囲],
    [#raw("packages/components/src/defineComponent/SPEC.typ:632") の「DSD 存在時に hydrate なしの場合の再レンダリング」を SSR instance activation へ適用する範囲],
    [#raw("packages/components/src/defineComponent/SPEC.typ:162") の degraded preserve-dom を宣言済み capability の成功扱いにする範囲],
    [#raw("SPEC/SPEC.typ:325") の Accepted「Hydration ミスマッチ方針」が本番で CSR fallback を試みる規則を、新しい SSR instance activation の preflight 拒否と terminal failure に適用する範囲。旧 hydration 経路の判断は履歴として保持する],
    [#raw("SPEC/SPEC.typ:399") の Accepted「状態転送の範囲」が Signal ID を省き DOM 位置から暗黙対応付けする規則を、新しい response association と client-local Signal の対応に適用する範囲。初期値のみを転送する判断と旧経路の記録は保持する],
    [#raw("SPEC/SPEC.typ:226") の Accepted「Web Component の Hydration 責務」が各 host の connectedCallback に ShadowRoot の自律 hydration を任せる規則を、新しい SSR instance activation に適用する範囲。host は adapter の lifetime event として利用でき、旧 hydration 経路の記録は保持する],
    [#raw("SPEC/SPEC.typ:290") の Accepted「Hydration の冪等性保証」が ShadowRoot 単位の WeakMap だけで二重初期化を判定する規則を、新しい SSR instance の重複 admission に適用する範囲。旧 hydration 経路の ShadowRoot 管理は履歴として保持する],
  ),
)

#adr(
  header("server/client 分割 package と engine 外の integration", Status.Proposed, "2026-09-29"),
  [
    旧 package graph は scan 範囲では acyclic だが、mixed runtime、core barrel、plugin から transformer への依存が #253 の環境境界と異なる責務を同じ import 面に置く。
  ],
  [
    runtime を server と client の物理 package に分割し、shared と reactivity を leaf にする。
    components は環境別 Web Components adapter、core は環境別 facade、plugin は宣言 entry の build adapter として維持する。
    transformer の専用 JSX/plan 経路を新 production path から外し、#250 の移行で package を廃止する。
    reactivity engine は保持し、復元・admission・DOM binding・寿命は client integration layer に置く。
  ],
  [
    import direction を package tests と build graph で検査できる。
    Web Components、明示 server delivery、新 UI を後続で実用化する余地を残すが、各 public path は #247〜#251 の証拠を要する。
  ],
  alternatives: [
    - 現行 package と複合 profile の A は #253 に合わせて transformer 依存と旧 fallback を改修できるが、能力の組合せと環境隔離の変更を mixed runtime に集める。
    - 明示宣言と環境別 entry を持つ #raw("@dathra/core") 共通 runtime の B は zero-root を build/server で証明できるが、共通 package 内の禁止 import と entry/export 規律を継続して検査する。
  ],
  supersedes: (
    [#raw("SPEC/SPEC.typ:557") の「Transformer 出力形式」を新 production path の必須形式とする範囲],
    [#raw("SPEC/SPEC.typ:1288") の「Web Components 高レベル API 方式」を唯一の root/activation model とする範囲],
    [#raw("packages/components/src/defineComponent/SPEC.typ:430") の host setup subtree が権限を一括支配する意味を新経路へ適用する範囲],
  ),
)

== Epic #246 の acceptance criteria 対応

#table(
  columns: (0.65fr, 4.25fr, 2.35fr),
  table.header([番号], [Epic #246 の条件], [採用済み #253 または本 Proposal]),
  [1], [compiler と JSX/authoring を独立に比較], [#253 の ADR と方式比較],
  [2], [専用 compiler なし、最小変換、解析生成と各構文を比較], [#253 の比較と不採用理由],
  [3], [再構築禁止と新 UI、更新、server 通信を区別], [#253 の共有契約、本書の capability と authority],
  [4], [最小共有契約を先行し #250/#251 で更新可能], [#253 の第一 slice、本書の Proposed status と後続 gate],
  [5], [artifact、capability、instance、activation、profile を定義], [本書「用語と capability」],
  [6], [author/build/server/client/reactivity の所有・禁止責務], [本書「authority と責務」],
  [7], [四候補分類の評価と組合せ・却下理由], [本書「用語と capability」「比較と選択」],
  [8], [initial authority と許可される transfer], [本書「authority」「状態モデル」],
  [9], [identity、association、寿命、cleanup、failure、retry、resource], [#253 の共有契約と本書「状態モデル」],
  [10], [reactivity 維持範囲と integration], [本書「reactivity の維持範囲」],
  [11], [package 責務、依存方向、現行 package の処置], [本書「package の物理配置」],
  [12], [後続決定、owner、blocking status], [本書「後続 owner と blocking status」と Issue #260 本文],
  [13], [旧 Accepted ADR の supersession], [本書「Accepted ADR の扱い」と Proposed ADR],
)

== 後続 owner と blocking status

この表の具体 API、encoding、transport、production validation は #260 の必須設計判断ではない。
各行の owner と gate は Issue #260 本文の Proposed downstream handoff に同じ意味で記録する。

#table(
  columns: (0.8fr, 3.9fr, 2.55fr),
  table.header([owner], [残る詳細と成果物], [blocking status]),
  [#247], [Plain JS/TS 宣言 API、getter/operation/target/creation/request の型、entry graph 診断、環境別 facade と plugin API。], [設計着手は可能。#248/#249 の production 実装と #250 の統合には採用済み API/SPEC/tests が必要。],
  [#248], [request-local renderer、response association と fresh identity、server delivery、response commit/cancel/fresh-response の具体経路。], [設計着手は可能。#249 の recovery 統合と #250 の配信統合には採用済み SPEC/tests と実装が必要。],
  [#249], [public activation adapter、transactional DOM write/rollback、Web Components child lifetime、新 UI、late callback、operation retry。], [設計着手は可能。#250 の統合と #251 の合否には public-path tests が必要。low-level prototype は代替しない。],
  [#250], [選定 route の新経路統合、旧 runtime/transformer/core root の除去、package migration と docs。], [#247〜#249 の対象 slice の採用済み契約と実装が統合完了の gate。調整開始は可能。],
  [#251], [組合せ fixture、zero-root、behavior/resource/performance の同一 revision 測定、support matrix と承認閾値。], [baseline は #252 済み。最終 pass/fail は #250 の対象 workflow 移行と閾値承認で gate。早期検証は可能。],
)

どの後続行も #260 の capability 分類、authority transfer、engine 境界、package 処置を委譲しない。
本書の public-path staging、fresh-response recovery、server delivery、performance は設計上の要求と後続検証であり、現時点の成立済み保証ではない。

== Issue #260 要件 coverage

この表は collector が取得した requirements の全32候補を一行ずつ対応させる。
Source は候補の source kind、Issue、heading、line をそのまま示す。
Satisfied は本文の設計上の対応を示し、ADR Accepted、Issue 完了、production 実証を意味しない。
AC 最終行の独立再レビューと Draft PR は本修正版では未完了である。

#table(
  columns: (1.35fr, 4.15fr, 1.25fr, 2.1fr),
  table.header([source], [collector candidate], [分類], [対応と状態]),
  [#text(size: 8pt, "issue-body #260 / Decision to make / line 3")], [#text(size: 8pt, "#253 で採用済みの最初の slice を前提に、#246 の残る architecture 判断を統合する。実行 capability の分類と組合せ、authority transfer、reactivity integration boundary、package responsibility と dependency direction を確定し、後続 Epic が詳細設計を進められる共有契約を定める。")], [#text(size: 8pt, "execution ownership")], [#text(size: 8pt, "Satisfied: 用語、authority、package、ADR")],
  [#text(size: 8pt, "issue-body #260 / Context and evidence / line 7")], [#text(size: 8pt, "#245 の server-authoritative 原則と #246 の acceptance criteria を満たす。")], [#text(size: 8pt, "resource and artifact constraint")], [#text(size: 8pt, "Satisfied: 判断の根拠")],
  [#text(size: 8pt, "issue-body #260 / Context and evidence / line 8")], [#text(size: 8pt, "#253 は専用 compiler なし、JSX なし、Plain JS/TS、明示的な server/client 境界を採用済み。PR #259 の merge commit は 67ad908b7227e5ad0953e616b39fc175108415c1。")], [#text(size: 8pt, "resource and artifact constraint")], [#text(size: 8pt, "Satisfied: 判断の根拠")],
  [#text(size: 8pt, "issue-body #260 / Context and evidence / line 9")], [#text(size: 8pt, "#252 の primary consumer は @playground/e2e の /store-snapshot-roundtrip。Docs Copy は比較対象。")], [#text(size: 8pt, "observable behavior")], [#text(size: 8pt, "Satisfied: 判断の根拠")],
  [#text(size: 8pt, "issue-body #260 / Context and evidence / line 10")], [#text(size: 8pt, "3つの独立した Sol 調査は責務分離、組合せ可能な capability、既存 reactivity engine の外側での integration を推奨した。調査結果は Proposal に必要な根拠を取り込み、消失し得る /tmp の資料だけに依存しない。")], [#text(size: 8pt, "resource and artifact constraint")], [#text(size: 8pt, "Satisfied: 判断の根拠、比較")],
  [#text(size: 8pt, "issue-body #260 / Context and evidence / line 11")], [#text(size: 8pt, "既存 package SPEC/tests は旧実装の契約を表す。低水準 prototype の結果と production public path の保証を区別する。")], [#text(size: 8pt, "resource and artifact constraint")], [#text(size: 8pt, "Satisfied: 判断の根拠、failure 比較")],
  [#text(size: 8pt, "issue-body #260 / Options considered / line 15")], [#text(size: 8pt, "現行 package と固定 execution profile を維持し、局所的に修正する。")], [#text(size: 8pt, "module interface and seam")], [#text(size: 8pt, "Rejected: 比較 A")],
  [#text(size: 8pt, "issue-body #260 / Options considered / line 16")], [#text(size: 8pt, "core に統合し、共通 runtime が実行責務を判定する。")], [#text(size: 8pt, "module interface and seam")], [#text(size: 8pt, "Rejected: 比較 B")],
  [#text(size: 8pt, "issue-body #260 / Options considered / line 17")], [#text(size: 8pt, "author/build/server/client/reactivity の authority に従って責務を分け、明示的 capability を組み合わせる。")], [#text(size: 8pt, "module interface and seam")], [#text(size: 8pt, "Satisfied: 比較 C、package 配置")],
  [#text(size: 8pt, "issue-body #260 / Decision criteria / line 21")], [#text(size: 8pt, "実 consumer の更新、通信、新規 UI 生成を実用的に扱えること。")], [#text(size: 8pt, "observable behavior")], [#text(size: 8pt, "Satisfied: capability、比較、failure")],
  [#text(size: 8pt, "issue-body #260 / Decision criteria / line 22")], [#text(size: 8pt, "SSR 初期 DOM/state の authority と再構築禁止、zero-client-root を維持すること。")], [#text(size: 8pt, "execution ownership")], [#text(size: 8pt, "Satisfied: authority、zero-root")],
  [#text(size: 8pt, "issue-body #260 / Decision criteria / line 23")], [#text(size: 8pt, "所有権、failure、retry、cleanup が明示され、未検証の保証を主張しないこと。")], [#text(size: 8pt, "failure and diagnostic behavior")], [#text(size: 8pt, "Satisfied: 状態モデル、evidence 限界")],
  [#text(size: 8pt, "issue-body #260 / Decision criteria / line 24")], [#text(size: 8pt, "reactivity engine を維持し、server/client 間の禁止依存を検証できること。")], [#text(size: 8pt, "module interface and seam")], [#text(size: 8pt, "Satisfied: reactivity、依存方向")],
  [#text(size: 8pt, "issue-body #260 / Decision criteria / line 25")], [#text(size: 8pt, "既存 API との互換性を無条件の判断基準にしないこと。")], [#text(size: 8pt, "non-goal/deferred capability")], [#text(size: 8pt, "Satisfied: 比較、package 配置")],
  [#text(size: 8pt, "issue-body #260 / Acceptance criteria / line 29")], [#text(size: 8pt, "server artifact、declared capability、component instance、activation、execution profile の用語と関係を定義する。")], [#text(size: 8pt, "identity and association")], [#text(size: 8pt, "Satisfied: 用語")],
  [#text(size: 8pt, "issue-body #260 / Acceptance criteria / line 30")], [#text(size: 8pt, "server-only、stable interaction、client-reactive update、server-owned delivery の候補を比較し、必要な組合せ、authority transfer、却下理由を記録する。")], [#text(size: 8pt, "execution ownership")], [#text(size: 8pt, "Satisfied: capability、比較")],
  [#text(size: 8pt, "issue-body #260 / Acceptance criteria / line 31")], [#text(size: 8pt, "author/build/server/client/reactivity の責務と禁止責務、identity、association、lifetime、cleanup、failure、retry、resource ownership の共有原則を確定する。")], [#text(size: 8pt, "lifetime and cleanup")], [#text(size: 8pt, "Satisfied: authority、状態モデル")],
  [#text(size: 8pt, "issue-body #260 / Acceptance criteria / line 32")], [#text(size: 8pt, "reactivity の維持範囲と置換可能な統合境界を確定する。")], [#text(size: 8pt, "module interface and seam")], [#text(size: 8pt, "Satisfied: reactivity")],
  [#text(size: 8pt, "issue-body #260 / Acceptance criteria / line 33")], [#text(size: 8pt, "package 構成と dependency direction を確定し、現行 components/core/runtime/transformer/plugin の維持、統合、削除を明記する。単なる候補列挙で完了にしない。")], [#text(size: 8pt, "module interface and seam")], [#text(size: 8pt, "Satisfied: package 配置")],
  [#text(size: 8pt, "issue-body #260 / Acceptance criteria / line 34")], [#text(size: 8pt, "#246 の各 acceptance criterion を本 Proposal または採用済み #253 へ対応付ける。")], [#text(size: 8pt, "resource and artifact constraint")], [#text(size: 8pt, "Satisfied: Epic #246 対応")],
  [#text(size: 8pt, "issue-body #260 / Acceptance criteria / line 35")], [#text(size: 8pt, "既存 Accepted ADR の変更対象と維持対象を区別し、変更は新しい ADR による supersession として記録する。")], [#text(size: 8pt, "resource and artifact constraint")], [#text(size: 8pt, "Satisfied: Accepted ADR の扱い")],
  [#text(size: 8pt, "issue-body #260 / Acceptance criteria / line 36")], [#text(size: 8pt, "#247 から #251 への決定、未決事項、owner、blocking status を記録する。本 Issue の必須判断は後続へ先送りしない。")], [#text(size: 8pt, "non-goal/deferred capability")], [#text(size: 8pt, "Satisfied: 後続 owner 表と Issue 本文")],
  [#text(size: 8pt, "issue-body #260 / Acceptance criteria / line 37")], [#text(size: 8pt, "比較、状態と寿命のモデル、失敗と競合の検討、要件 coverage を正準 Typst Proposal に残す。")], [#text(size: 8pt, "lifetime and cleanup")], [#text(size: 8pt, "Satisfied: 比較、状態、failure、coverage")],
  [#text(size: 8pt, "issue-body #260 / Acceptance criteria / line 38")], [#text(size: 8pt, "Typst compile と whitespace 検証を行い、独立レビューの必須指摘を解消して Draft PR を作成する。設計上の採用状態と GitHub review 状態は区別する。")], [#text(size: 8pt, "resource and artifact constraint")], [#text(size: 8pt, "Satisfied: 本書が検証対象。独立再レビューと Draft PR は後続 dispatch の gate")],
  [#text(size: 8pt, "issue-body #260 / Dependencies / line 42")], [#text(size: 8pt, "#253 の採用済み authoring と共有実行契約。")], [#text(size: 8pt, "resource and artifact constraint")], [#text(size: 8pt, "Satisfied: 判断の根拠、#253")],
  [#text(size: 8pt, "issue-body #260 / Dependencies / line 43")], [#text(size: 8pt, "#252 の consumer 選定と baseline evidence。")], [#text(size: 8pt, "resource and artifact constraint")], [#text(size: 8pt, "Satisfied: 判断の根拠、#252")],
  [#text(size: 8pt, "issue-body #260 / Dependencies / line 44")], [#text(size: 8pt, "#247 から #251 の完了を本判断の前提にしない。public path の実装検証と performance threshold はそれぞれの owner に残す。")], [#text(size: 8pt, "non-goal/deferred capability")], [#text(size: 8pt, "Deferred: #247〜#251、後続 owner 表に blocking status")],
  [#text(size: 8pt, "issue-body #260 / Non-goals / line 48")], [#text(size: 8pt, "production code と既存 executable tests の変更。")], [#text(size: 8pt, "non-goal/deferred capability")], [#text(size: 8pt, "Non-goal: Scope / Non-goals")],
  [#text(size: 8pt, "issue-body #260 / Non-goals / line 49")], [#text(size: 8pt, "#253 の決定の根拠なく再検討。")], [#text(size: 8pt, "non-goal/deferred capability")], [#text(size: 8pt, "Non-goal: #253 の判断を維持")],
  [#text(size: 8pt, "issue-body #260 / Non-goals / line 50")], [#text(size: 8pt, "全 public API、wire encoding、transport の詳細確定。")], [#text(size: 8pt, "non-goal/deferred capability")], [#text(size: 8pt, "Non-goal: 後続 owner 表")],
  [#text(size: 8pt, "issue-body #260 / Non-goals / line 51")], [#text(size: 8pt, "reactivity engine の再設計。")], [#text(size: 8pt, "non-goal/deferred capability")], [#text(size: 8pt, "Non-goal: reactivity の維持範囲")],
  [#text(size: 8pt, "issue-body #260 / Non-goals / line 52")], [#text(size: 8pt, "PR の merge、#246 の close、未検証の production 保証。")], [#text(size: 8pt, "non-goal/deferred capability")], [#text(size: 8pt, "Non-goal: Scope / Non-goals、evidence 限界")],
)
