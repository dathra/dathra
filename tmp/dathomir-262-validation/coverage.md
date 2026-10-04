# 58項目と追加証拠の対応

検証前のレビューにあった58項目を残し、今回の証拠が支える範囲と支えない範囲を対応付ける。
58件の機能が合格したという表ではない。
元の問いと判断の経緯は [検証前の比較資料](design-context/dathomir-262-three-concerns-review.md) に保存した。
個別suiteの件数と実行環境は各READMEを参照する。
型/buildおよびDOM/inputの行は担当の最終受領後に確定する。

| 項目 | 問い | 証拠の種類 | 範囲と限界 |
|---|---|---|---|
| R2-A01 | 今回何を採用するか | [採用待ち](review-summary.md) | 実験の保存とAPI採用を分離。①は未完了。 |
| R2-A02 | server/client はどこで実行するか | [build実験の範囲](types-build/README.md) | server/clientのbundleとsentinel。実public admission全体は別。 |
| R2-A03 | ordinary Signal の判別を何にするか | [限定kernel](state-lifetime/README.md) | structural recognitionは真正性やpeekの純粋性を証明しない。 |
| R2-A04 | record と slot の何を書けるか | [型と限定kernel](state-lifetime/README.md) | owned payloadはnative Signalと全面同等ではない。構造的な型代入にも抜け道がある。 |
| R2-A05 | nested alias を保持するか | [限定kernel](state-lifetime/README.md) | same-slot、nested owned sharing、invocation内alias。任意のcross-owner heap共有は未証明。 |
| R2-A06 | transfer できる値は何か | [限定codec](state-lifetime/README.md) | finite data、path error。NaN、record順序、rich dataの扱いは未採用。untrusted wire decoderではない。 |
| R2-A07 | DOM と snapshot をいつ採るか | [限定kernel](state-lifetime/README.md) | one-peekと同じcaptured graph。global instantaneous cutの反例を保存。 |
| R2-A08 | bind/on の候補は役割別か | [型と限定kernel](types-build/README.md) | all-name候補と書込みphase拒否は別の責務として検査。 |
| R2-A09 | client parameter はどう型付けするか | [型実験](types-build/README.md) | 独立関数が後から宣言されるregistry全名を自動推論する保証はない。 |
| R2-A10 | type/runtime path を二度書くか | [型とbuild実験](types-build/README.md) | 二重記載を維持。型の一致だけで実module同一性を保証しない。 |
| R2-A11 | type witness と actual module をどう照合するか | [build実験](types-build/README.md) | 明示inventoryの範囲とsource rewriteの採用判断を分ける。 |
| R2-A12 | deployment 後の reference はどう解決するか | [build実験](types-build/README.md) | file配置の移動とHTTP public pathを区別。adapter全般の証明ではない。 |
| R2-A13 | package/graph と再現性は何を保証するか | [source比較と反例](source-provenance.json) | source hash一致とbrowser engine実体の共有は別。独立engineのcomputed staleを再現。 |
| R2-A14 | bind の content category は固定か | [DOM実験の範囲](dom-input/README.md) | text/DOM切替と保持を検査。全content grammarは別。 |
| R2-A15 | 接続直後の異なる結果はいつ出すか | [DOM実験の範囲](dom-input/README.md) | admissionとpost-commit初回refreshを分離。全failure pathの保証ではない。 |
| R2-A16 | preflight/producer/operation の違いは何か | [複数の限定実験](review-summary.md) | preflight、acquisition、active updateの結果を一つのrollback保証にまとめない。 |
| R2-A17 | event は何を読み取るか | [部分観測](native-controls/README.md) | native submitterは観測。提案event snapshotの全propertyとsource権限は未証明。 |
| R2-A18 | event options と scheduling は何か | [一部kernel](state-lifetime/README.md) | parallel/replaceとleaseの一部。join/queue、全event optionの実装は未証明。 |
| R2-A19 | attribute と property はどう分けるか | [型とnative観測](types-build/README.md) | boolean placementとnative value/defaultの差。全property serializerは未証明。 |
| R2-A20 | 接続前 input の書き戻しはどこか | [input実験の範囲](dom-input/README.md) | native editとsink/revisionの限定経路。全controlの統合ではない。 |
| R2-A21 | IME の不明な開始状態はどう扱うか | [input実験の範囲](dom-input/README.md) | 合成eventを実OSのIME実証へ読み替えない。bootstrap前履歴は未知。 |
| R2-A22 | caret/selection は何を保つか | [input実験の範囲](dom-input/README.md) | same-valueとselectionの限定観測。任意formatterのcaret mappingは未証明。 |
| R2-A23 | native form/reset は何を残すか | [native観測](native-controls/README.md) | submitter、validation、reset/defaultを観測。提案form adapterの完成ではない。 |
| R2-A24 | accessibility と focus はどう指定するか | [設計と部分観測](dom-input/README.md) | focus保持の限定経路。読み上げ、全keyboard操作、a11y全体は未証明。 |
| R2-A25 | numeric draft を domain state にいつ変えるか | [native観測](native-controls/README.md) | numberの途中入力はvalueだけでは復元できない。domain parse policyは未採用。 |
| R2-A26 | checkbox/radio/select は文字列だけか | [native観測](native-controls/README.md) | radioのcross-region作用、select複数entryを確認。専用adapterは未実装。 |
| R2-A27 | file はどう扱うか | [native観測](native-controls/README.md) | FileをFormDataで保持、JSONとfile.valueの制約。実upload serverは未証明。 |
| R2-A28 | _key の scope は何か | [DOM実験の範囲](dom-input/README.md) | keyの型と局所scope。業務IDや全nested ownerの扱いは別。 |
| R2-A29 | same key の changed tag はどうなるか | [DOM実験の範囲](dom-input/README.md) | identityとcompatible descriptionの区別。全tag/namespace/profileの交換は別。 |
| R2-A30 | reorder で host/native state は保つか | [DOM実験の範囲](dom-input/README.md) | 同じNodeであることとhost lifecycleやfocusの維持を区別する。 |
| R2-A31 | 複数要素の一項目はどう書くか | [DOM実験の範囲](dom-input/README.md) | persistent extentの限定検証。fragmentの公開表記は未採用。 |
| R2-A32 | empty 表示は capability を失うか | [buildとDOM実験](types-build/README.md) | empty bindとzero responseを区別。build artifactの不存在とは別。 |
| R2-A33 | new child の state はいつ作るか | [DOM実験の範囲](dom-input/README.md) | SSR adoptionとnew lifetimeだけのfactory実行を区別。 |
| R2-A34 | SSR child と factory をどう許可するか | [型/build/DOMの個別実験](review-summary.md) | 同default/profile/parserの限定証拠。三kernelを統合したpublic pathではない。 |
| R2-A35 | receive は何回実行するか | [限定kernel](state-lifetime/README.md) | seed同値、latest pending、failed input再試行。production schedulerは未証明。 |
| R2-A36 | new child construction が失敗したらどうするか | [DOM実験の範囲](dom-input/README.md) | provisional childの失敗とactive sibling保持。全資源のrollbackではない。 |
| R2-A37 | 別 package panels は状態をどう共有するか | [設計のみ](design-context/dathomir-262-three-concerns-review.md) | 別packageの実cartと二つのownership案はconsumer実証が必要。 |
| R2-A38 | reused/independent component の差は何か | [設計と部分kernel](state-lifetime/README.md) | code再利用と状態ownerを区別。実独立panelの統合は未証明。 |
| R2-A39 | mutable cross-owner sharing は暗黙か | [限定kernel](state-lifetime/README.md) | cross-owner alias診断とcopy境界。共有serviceの採用と実装は別。 |
| R2-A40 | 親が独立 child を移動/除去できるか | [DOM実験の範囲](dom-input/README.md) | explicit containmentの限定経路。delivery modelのtargetは独立であり祖先競合を証明しない。 |
| R2-A41 | resource は Promise return で終わるか | [限定kernelと実consumer観測](state-lifetime/README.md) | operation完了、timer、callback pinを分離。Docs移行の完成ではない。 |
| R2-A42 | late work/parallel/join をどう守るか | [限定kernel](state-lifetime/README.md) | late writeとsource token。join/queue全体や任意native handleは未証明。 |
| R2-A43 | 外部 DOM damage/native widget をどう扱うか | [設計と部分DOM実験](dom-input/README.md) | damaged extentの限定検知。任意widgetへの所有権推測を許可しない。 |
| R2-A44 | active partial failure の利用者回復は何か | [限定kernel](state-lifetime/README.md) | failed receiveのpublication gate。model部分変更と後のhealthy refreshを明示。 |
| R2-A45 | server operation はどう宣言するか | [設計のみ](design-context/dathomir-262-three-concerns-review.md) | request/deliveryの完全な型、auth、実server operationは未証明。 |
| R2-A46 | 競合 completion の勝者は何か | [状態モデルとkernel](delivery-races/README.md) | channelだけの反例、表示先の世代。実transportや祖先targetは未証明。 |
| R2-A47 | cancel は何を保証するか | [限定kernel](state-lifetime/README.md) | cancel後のwrite拒否とabort通知。既に行ったserver mutationのundoではない。 |
| R2-A48 | retry はどれが安全か | [一部モデル/設計](delivery-races/README.md) | immutable preflight retryのみ限定検証。server mutationのidempotencyとunknown outcomeは未証明。 |
| R2-A49 | server delivery の権限はどこから来るか | [限定状態モデル](delivery-races/README.md) | fresh identityとdestination検証。実responseの認証とwire validatorは未証明。 |
| R2-A50 | navigation の失敗前に何を終了するか | [限定状態モデル](delivery-races/README.md) | prepare中source維持、commit時権限失効、history/cleanup失敗を分離。全面rollbackなし。 |
| R2-A51 | Back は disposed owner を復活するか | [状態モデルとnative観測](native-history/README.md) | BackはDOMを自動復元せず、historyはclone。draft policyとBFCacheは未決定/未証明。 |
| R2-A52 | async SSR/streamは何を約束するか | [build fixtureの限定範囲](types-build/README.md) | awaited renderと実server bundle。stream、実request資源、partial responseは未証明。 |
| R2-A53 | static route の code を何で選ぶか | [build実験](types-build/README.md) | 明示static routeの選択。任意JS解析でzeroと推測しない。 |
| R2-A54 | zero response は何を省略するか | [response fixture](types-build/README.md) | zero responseの送信省略とpotential artifactを区別。production transportの証明ではない。 |
| R2-A55 | diagnostic は何を示すか | [限定負例群](review-summary.md) | 実行した診断とcounterexampleを保存。全diagnostic UIやerror taxonomyの完成ではない。 |
| R2-A56 | rich data/widget の修正経路は何か | [設計のみ](design-context/dathomir-262-three-concerns-review.md) | codec/adapterの明示ownerへ残す。実用的な要件を検証不足だけで削らない。 |
| R2-A57 | 七 witness は何を証明するか | [七つを別々に評価](review-summary.md) | counterは七witnessの代替ではない。全consumerの実装完成を主張しない。 |
| R2-A58 | 今回は何を実行しないか | [利用者の追加許可で変更](README.md) | 旧資料の実験0は過去snapshot。今回は限定実験を実行し、production/API採用/mergeは行わない。 |

各行のownerは元資料に保持し、新しい実装Taskや採用状態をこの表で作らない。
採用は #262、証拠保存は #264、実装とconsumerは #247 配下の該当Issueで扱う。
