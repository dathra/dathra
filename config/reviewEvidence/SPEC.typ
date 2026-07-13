#import "../../SPEC/functions.typ": *

= Review evidence command

== Purpose

`review:evidence`は、semantic reviewへ渡すcandidateと検証証拠の機械的なbindingを一つのdeterministic commandへ集約する。
reviewerはhashやGit objectを個別に再計算せず、意味上のcorrectnessへ集中する。

== Interface specification

#interface_spec(
  name: "Root review evidence CLI",
  summary: [
    rootから`pnpm review:evidence -- generate --input <json> --output <json>`と`verify`を実行できる。
    入力と出力はUTF-8 JSONとし、出力はmachine-readableなmanifestとattestationを一つのdocumentに持つ。
  ],
  format: [
    - inputは`schemaVersion`、`reviewId`、`base`、`candidate`、`proposal`、`writeSet`、`dependencies`、`decisionAnchors`、`gates`を持つ
    - `proposal`はrepository-relative pathを一つ持つ
    - dependencyはexact revisionとcandidateで不変な一個以上のpathを持つ
    - decision anchorはexact revision、source path、開始行、終了行を持つ
    - gateはID、argv配列、exit code、summaryを持つ
    - outputはresolved commit OID、tree、path status、mode、SHA-256、Git blob OID、anchor excerpt、gate結果、canonical manifest hashを持つ
  ],
  constraints: [
    - candidateはbaseを唯一のparentに持つ
    - write setはbaseとcandidateの`--no-renames` diff inventoryとexactに一致する
    - pathはrepository-relativeで重複せず、repository外を参照しない
    - dependency revisionはcandidateのancestorであり、列挙pathのmodeとblobはcandidateで同一である
    - anchorの開始行と終了行はsource内で一意に決定できる
    - 全gateのexit codeは0である
    - outputへ時刻、temporary path、branchのmutableな現在値を含めない
  ],
)

== Behavior specification

#behavior_spec(
  name: "Evidence generation",
  summary: [
    同じrepository stateと意味的に同じinputからbyte-identicalなcanonical JSONを生成する。
  ],
  preconditions: [
    - current directoryがGit worktree内である
    - input JSONがinterface specificationを満たす
  ],
  steps: [
    1. base、candidate、dependency、anchor revisionをexact commit OIDへ解決する
    2. candidate parentとexact write setを検査する
    3. proposal、変更前後のpath、dependency path、anchor sourceとexcerptをSHA-256とGit blob OIDへ変換し、proposalとexcerptのblobをGit object databaseへ保存する
    4. gate resultがsuccessであることを検査する
    5. keyと集合をcanonical orderへ正規化し、manifest SHA-256へ束縛したattestationを生成する
    6. output指定時は同じdirectoryのtemporary fileからatomic renameする
  ],
  postconditions: [
    - stdoutとoutput fileは同じcanonical JSONを表す
    - 同じinputによる再生成はbyte-identicalである
    - proposalとanchor excerptは出力されたblob OIDから取得できる
    - branch、index、Git refを変更しない
  ],
  errors: [
    - invalid schema、unresolved revision、parent mismatch、write-set mismatch、dependency mismatch、anchor mismatch、failed gateではnon-zeroで終了する
    - failure時にpartial output fileを残さない
  ],
)

#behavior_spec(
  name: "Evidence verification",
  summary: [
    `verify`はrepositoryからevidenceを再計算し、保存済みcanonical evidenceと完全一致する場合だけ成功する。
  ],
  steps: [
    1. `generate`と同じvalidationとnormalizationを実行する
    2. expected evidenceをparseしてcanonical JSONへ正規化する
    3. 再計算結果とexpected resultをbyte比較する
  ],
  postconditions: [
    - 一致時はexit code 0になる
    - mismatch時はexpected evidenceを変更せずnon-zeroになる
  ],
  errors: [
    - expected evidenceの欠落、invalid JSON、改変、stale candidate、stale dependency、stale anchor、stale proposalを拒否する
  ],
)

== Feature specification

#feature_spec(
  name: "Bootstrap fixture",
  summary: [
    disposable Git repositoryでidempotent generation、successful verification、tampered evidence、wrong write set、failed gateを直接検証する。
  ],
  test_cases: [
    - 同じinputから二回生成したoutputがbyte-identicalである
    - candidate、write set、dependency、anchor、proposal、gateがmanifestとattestationへ固定される
    - tampered evidenceのverifyがnon-zeroになる
    - diffと異なるwrite setのgenerateがnon-zeroになる
    - non-zero gateを含むgenerateがnon-zeroになる
  ],
)
