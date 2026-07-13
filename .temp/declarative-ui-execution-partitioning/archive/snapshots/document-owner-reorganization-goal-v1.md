現在進行中の作業を安全なcheckpointで一時停止し、宣言的UI実行分割の文書構成を再編してください。

  このrevisionは文書のowner、配置、参照関係を整理するprocess/document decompositionです。
  runtime semantics、既存の設計判断、実装順序、完了済みsliceの判定は変更しません。

  ## 1. 現在の作業を停止する

  最初にworktree、HEAD、tracking branch、実行中または完了済みのcommand/sub-agentを確認してください。

  - 新しい実装、review、ファイル編集、commit、pushを開始しない
  - 実行中のcommandは半端な書き込みを残さない地点で完了または停止する
  - 完了済みsub-agent resultは回収する
  - 実行中のsub-agentは再開に必要な状態を記録して閉じる
  - 既存変更を破棄、revert、上書きしない
  - 停止したsliceのowner、write set、candidate revision、gate、blockerを記録する
  - package変更を今回の文書commitへ混ぜない

  side conversationで変更した次の文書はuser changesとして保持してください。

  - `.temp/declarative-ui-execution-partitioning.md`
  - `.temp/declarative-ui-execution-partitioning-implementation-goal.md`
  - `.temp/declarative-ui-execution-partitioning-implementation-progress.md`
  - `.temp/goal.md`
  - `.temp/declarative-ui-execution-partitioning/`配下の分割文書とarchive

  `.temp`はignoredです。
  未追跡またはignoredであることを理由に削除、再生成、上書きしてはいけません。

  `package.json`と`config/reviewEvidence/`に進行中の変更がある場合は、review evidence bootstrapの変更として保持してください。
  文書整理の差分へ混ぜてはいけません。

  ## 2. 新しい正本構成

  旧モノリス中心の配置を、次のowner中心の構成でsupersedeしてください。

  .temp/declarative-ui-execution-partitioning/
  ├── README.md
  ├── decisions/
  ├── implementation/
  │   ├── README.md
  │   ├── goal.md
  │   ├── workflow.md
  │   ├── roadmap.md
  │   ├── acceptance.md
  │   ├── milestones/
  │   └── progress/
  ├── process/
  │   ├── README.md
  │   ├── design-workflow.md
  │   └── review-policy.md
  └── archive/
      ├── README.md
      ├── snapshots/
      └── goals/

  各文書のownerを次のように固定してください。

  - `implementation/goal.md`: 最終目標、適用範囲、正本の優先順位、完了条件
  - `implementation/workflow.md`: baseline、slice admission、scheduler、SPEC/test/implementation、gate、commit、push、blocker処理
  - `implementation/roadmap.md`: R7、walking skeleton、phase、dependency、実装順序
  - `implementation/acceptance.md`: slice検証、integration gate、全体acceptance、push後監査
  - `implementation/progress/`: 現在地、active/completed slice、review/commit/blocker log
  - `process/design-workflow.md`: 設計上の未決事項を決定する自律手順
  - `process/review-policy.md`: R8のrisk tier、reviewer数、収束上限、evidence規則
  - `archive/`: 現在の作業再開、設計判断、進捗更新に使用しない凍結資料

  同じ規則を複数の正本へ複製してはいけません。
  依存側はcanonical pathとstable headingまたはpolicy IDを参照してください。
  行数だけで分割せず、責務とownerの境界で分割してください。

  ## 3. 旧モノリスを移行する

  `.temp/declarative-ui-execution-partitioning-implementation-goal.md`はアーカイブせず、内容を`implementation/`へ分割してください。

  分割前の内容をbyte-identicalな次のsnapshotとして保存してください。

  - `archive/snapshots/implementation-goal-monolith-v1.md`

  `.temp/goal.md`も`process/`へ責務分割し、分割前の内容を次へ保存してください。

  - `archive/snapshots/design-workflow-monolith-v1.md`

  各snapshotのSHA-256、旧section、移行先、editorial wrapperの有無を移行記録へ残してください。
  既存の設計と進捗のsnapshotは変更しないでください。

  次の旧pathは削除せず、小さなcompatibility indexへ置き換えてください。

  - `.temp/declarative-ui-execution-partitioning.md`
  - `.temp/declarative-ui-execution-partitioning-implementation-goal.md`
  - `.temp/declarative-ui-execution-partitioning-implementation-progress.md`
  - `.temp/goal.md`

  compatibility indexには正本へのリンクと、旧pathへ新しい規則を追記しないことだけを記載してください。

  ## 4. Archiveを整理する

  期限付きGoalは、進捗、commit、milestone evidenceから状態を判定してください。

  - activeなら`implementation/milestones/`へ移す
  - completed、interrupted、supersededなら`archive/goals/`へ凍結する
  - 状態を確認できない場合は移動せずblockerとして記録する
  - 日付だけで完了または失効と判定しない

  active文書からarchiveを実行指示や現在の正本として参照してはいけません。
  archive済み文書は更新せず、訂正は現在の正本へ記録してください。

  既存のreview manifest、attestation、capsule、proposalは今回移動しません。
  過去のevidenceにある旧pathは、そのevidenceが固定したcandidate commit上のGit objectで解決してください。

  ## 5. Review evidence bootstrap

  Review protocol R8では、repository-ownedの`review:evidence` commandを成功経路の証拠生成に使用します。

  bootstrapが進行中なら、その変更を安全に回収してください。
  文書review開始前にbootstrap sliceだけを独立してgreen、review、commit、pushしてください。
  他の停止中sliceは再開しないでください。

  bootstrap sliceはmediumとしてprimary reviewer 1人でreviewします。
  bootstrap自身には手書きmanifestまたはattestationを要求しません。
  bootstrapのpackage変更を文書commitへ含めてはいけません。

  ## 6. Review protocol R8

  R8は以前の逐次レビュー、全変更への複数reviewer割当、無制限反復、成功時の手書きmanifest/attestationをsupersedeします。

  - low: semantic reviewer 0人。deterministic gateだけを実行する
  - medium: primary reviewer 1人
  - high: primary reviewerとrisk-specific reviewerの2人
  - 根拠のあるblockerを修正した場合だけfresh convergence reviewerを1人割り当てる
  - blockerがない場合、status、evidence、参照だけの変更では追加reviewを行わない
  - 同じcandidateへの全面reviewを反復しない
  - 収束後もblockerが残る場合はreviewerを増やさず、review unitまたは責務分割を見直す

  成功経路では手書きmanifest、attestation、OID inventoryを新規作成しないでください。
  `review:evidence` commandでcandidate、対象path、gate結果、review結果を生成または再検証してください。
  内容が変わっていないdependency evidenceは再利用してください。

  今回の文書再構成はmediumとします。
  runtime semanticsは変えませんが、正本、実行手順、完了義務の所在を変更するためです。

  primary reviewerは次だけを確認してください。

  - 旧文書の規則、完了条件、検証義務が失われていない
  - 一つの規則に複数の正本ownerが存在しない
  - 文書間に矛盾または循環参照がない
  - active文書とarchive文書の境界が明確である
  - compatibility indexから現在の正本へ到達できる
  - 新しい文書だけで停止中の作業を再開できる
  - 文書移動によってruntime contractの意味が変化していない
  - package変更や停止中sliceの差分が混入していない

  設計内容そのもの、過去のruntime判断、完了済みsliceを再レビューしてはいけません。
  review対象は今回の文書分割と、そこで維持される義務だけです。

  ## 7. 検証する

  次を機械的に検証してください。

  - 旧文書の各sectionが一つのownerへ移行している
  - snapshotのSHA-256が分割前と一致する
  - 全Markdown相対linkの参照先が存在する
  - code fenceが各ファイル内で閉じている
  - active文書がarchiveを正本として参照していない
  - compatibility indexからcanonical pathへ到達できる
  - 重複または矛盾するnormative ruleがない
  - 一文書が1,000行または独立責務三つ以上にならない
  - `git diff --check`が成功する
  - 文書整理前後で停止中sliceのpackage差分が変化していない

  文書整理だけなのでruntime全体のtestを機械的に要求しません。
  文書検査とreview evidence commandをfocused gateとしてください。

  ## 8. Commit、push、再開

  文書変更だけを独立commitしてください。
  `.temp`はignoredなので、今回の対象pathだけを明示して`git add -f`してください。
  package変更、reviewEvidence bootstrap、停止中sliceを文書commitへ混ぜないでください。

  commit後にtracking branchへpushし、次を確認してください。

  - local HEAD
  - tracking branch OID
  - remote branch OID
  - review済みcandidateとcommit treeの一致

  force pushは禁止します。

  push後、新しい正本pathからgoal、workflow、roadmap、acceptance、progressを読み直してください。
  進捗文書の再開参照を新しいcanonical pathへ更新してください。

  その後、停止していた作業を新しいHEADから再開してください。
  旧モノリスpathを実行正本として使用してはいけません。