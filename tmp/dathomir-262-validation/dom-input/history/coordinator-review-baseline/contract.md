# P04/P05 の実験契約

これは #262/PR263 の未採用案を検証する一時 kernel である。
Accepted #253/#260、利用者が選んだ flat defineClient、kind を持たない bind、_key、server/client の分離を変更しない。
SSR association は fixture が発行した明示的な node reference と extent として渡し、DOM の形から ownership を発行しない。
同じ sibling list の明示 extent は重ならず、outer marker 内の node はいずれかの明示 extent に含まれることを provisional preflight 条件とする。
同じ association object の重複 admission は active owner を共有する。
preflight rejection は acquisition 記録を作らず、required acquisition 後の failure は同じ association object について terminal とする。

P04 は初期 admission と commit 後の一回の自動 refresh を別々に観測する。
初期 admission は既存 node と snapshot を検証して復元するだけで、initializer、server template、browser creation template、factory を呼ばない。
initialRefresh が指定された実験では、admission 成功後に kernel が一回の microtask refresh を予約する。
active update では absent key または明示的に incompatible な entry だけを新しく作る。
同じ key の削除と再追加には fresh lifetime を使う。
parent は明示 containment の outer extent を移動または除去できるが、child の private slot は更新できない。
new child の準備失敗は、その provisional child だけを終了し、独立して active な child の更新を戻さない。

P05 は text input の explicit sink と native draft の比較に限定する。
controlled admission は preflight、listener staging、latest native read、provisional model-only sink、revision と live value の再照合、commit、自動 refresh の順で進む。
失敗では provisional model と resource を捨て、その時点の native draft を保存する。
異なる二つの pre-admission draft は conflict hold とする。
接続前の composition 履歴は不明であり、最初の異なる formatter 結果を blur、change、観測した compositionend まで保留する。
同値 assign を省き、uncanceled reset が native property を変更した後に sink を呼ぶ。
trusted reset の microtask は native reset 完了より早かったため、実験では次の task で cancellation と revision を照合する。
異なる reset default を持つ同一 scalar group と、compositionend 後の非冪等 formatter は反例として残しており、一般化した保護契約を立証していない。

各 test は assertion と browser observation を残す。
synthetic CompositionEvent と InputEvent は state machine の証拠であり、OS の日本語 IME を操作した証拠ではない。
同じ node と logical lifetime の保持から focus、connectedCallback、実 IME の保持を導かない。
失敗する単純案は counterexample として残し、production API や package SPEC/tests は変更しない。
