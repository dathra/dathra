= plugin（ビルドツール統合）

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

Vite、webpack 等のビルドツール向けプラグインを提供する。
unplugin を使用して複数のバンドラーに対応し、JSX/TSX ファイルに対して
`\@dathra/transformer` を適用する。

== インターフェース仕様

#interface_spec(
  name: "plugin API",
  summary: [
    unplugin ベースで複数バンドラーに対応し、JSX/TSX ファイルへ `@dathra/transformer` を適用するプラグイン API。
  ],
  format: [
    *エクスポート*:
    - `dathra: UnpluginInstance<PluginOptions | undefined>`
    - `dathraVitePlugin(options?: PluginOptions): VitePlugin`
    - `dathraWebpackPlugin(options?: PluginOptions): WebpackPlugin`
    - `dathraRollupPlugin(options?: PluginOptions): RollupPlugin`
    - `dathraEsbuildPlugin(options?: PluginOptions): EsbuildPlugin`

    *オプション*:
    ```typescript
    type PluginOptions = PluginCommonOptions & (
      | { mode: 'ssr'; ssr?: false | PluginSsrOptions }
      | { mode?: 'csr'; ssr?: false }
    );

    interface PluginCommonOptions {
      include?: string[];
      exclude?: string[];
      runtimeModule?: string;
    }

    interface PluginSsrOptions {
      entry: string;
      outlet?: string;
      renderExport?: string;
    }
    ```
  ],
  constraints: [
    - `include` に一致し `exclude` に一致しないファイルのみ変換する
    - デフォルトで `.tsx` と `.jsx` を対象とする
    - モード判定の優先順位は `options.mode` → `environment.name` → `options.ssr` → CSR
    - `@dathra/transformer` の `transform()` を呼び出し、`filename` と `runtimeModule` を渡す
    - transform 失敗時はファイルパスを付与したエラーとして再スローする
    - Vite plugin は importer から最も近い `tsconfig.json` の `compilerOptions.paths` を参照して path alias import を解決できる
    - Vite plugin は JSX が esbuild に先に変換されないよう `esbuild.jsx = "preserve"` を自動設定する
    - Vite plugin はユーザーが `esbuild: false` を明示した場合、それを保持する
    - TypeScript 型上、`ssr` 設定は `mode: "ssr"` の場合だけ指定できる
    - `ssr.entry` を指定した Vite dev server では拡張子のない GET/HEAD request に対して SSR module を読み込み、`{ request, requestId, url }` を render 関数へ渡す
    - Vite dev SSR render 関数は `string`、`Response`、または `{ html, statusCode?, headers? }` を返せる
    - Vite dev SSR middleware は render 結果の HTML を `<!--ssr-outlet-->` に差し込み、status code と headers を HTTP response に反映する
    - Vite dev SSR middleware は render 結果が HTML 以外の `Response` の場合、`index.html` へ差し込まず body/status/headers をそのまま返す
    - Vite dev SSR middleware は `HEAD` request では status/headers だけを返し、body を返さない
  ],
)

== 機能仕様

#feature_spec(
  name: "plugin integration coverage",
  summary: [
    ファイルフィルタリング、モード判定、transform 呼び出し、エラーハンドリング、各バンドラー向けエクスポートを検証する。
  ],
  test_cases: [
    *基本機能*:
    - JSX/TSX ファイルを変換する
    - 非対象ファイルを無視する
    - 除外パターンに一致するファイルをスキップする
    - カスタム include 拡張子を適用する

    *モード判定*:
    - CSR/SSR モードを正しく判定する
    - 強制モードが SSR フラグより優先される
    - Environment API の edge モードを SSR として扱う

     *オプション*:
     - `runtimeModule` オプションが transformer に正しく渡される
      - `filename` が変換対象ファイルの ID として渡される
      - Vite plugin が最寄り `tsconfig.json` の path alias を使って importer 基準で `.ts` / `.tsx` / `index.ts` まで解決する
      - Vite plugin が既存 `esbuild` 設定を保持しながら `jsx: "preserve"` を自動設定する
      - Vite plugin が `esbuild: false` を明示指定された場合に保持する
      - Vite plugin の `ssr` 設定は `mode: "ssr"` 指定時のみ型上許可される
      - Vite plugin が `ssr.entry` 設定時に dev SSR middleware を登録し `Request` を render 関数へ渡す
      - Vite plugin が render 結果の status code と headers を dev SSR response に反映する
      - Vite plugin が HTML 以外の `Response` render 結果を `index.html` へ差し込まずに返す
      - Vite plugin が `Accept: */*` の API request でも SSR entry の HTML 以外の `Response` を返せる
      - Vite plugin が `HEAD` SSR response で body を送信しない
      - Vite plugin が `ssr.entry` 未設定時は dev SSR middleware を登録しない
      - Vite plugin の dev SSR middleware は HTML render 結果に対する非 HTML request では template を返さず後続 middleware に委譲する
      - 実 transformer を使った integration test で islands metadata contract (`data-dh-island*`, `data-dh-client-*`) が plugin 出力に残る

      *エラーハンドリング*:
      - transform 失敗時にファイル名を含むエラーメッセージをスローする
    - 非 Error オブジェクトがスローされた場合はそのまま再スローする
    - transformer がソースマップを返さない場合は `map` を `undefined` にする

    *unplugin ファクトリ（非 Vite バンドラー向け）*:
    - `transformInclude` で対象ファイルを正しくフィルタリングする
    - unplugin の `transform` フックが変換を正しく実行する
    - unplugin の `transform` フックが edge/ssr 環境名から SSR モードを検出する

    *エクスポート*:
    - 全てのプラグインファクトリ（Vite/webpack/Rollup/esbuild）が正しくエクスポートされる
    - デフォルトエクスポートとして `dathra` が提供される
  ],
)
