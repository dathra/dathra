> [!CAUTION]
> Historical, provisional design from reverted PR #80. It is not a current specification or implementation plan. Embedded revision, slice, review, owner, branch, commit, push, and write-set instructions are non-operative historical context. Current `SPEC.typ` files and executable tests are authoritative; see [RFC 0001](../README.md).

# DocCodeBlock partition

## DocCodeBlock の期待分割

`docs/src/components/DocCodeBlock/DocCodeBlock.tsx` は、受け入れ例として使う。

server artifact に残す処理は次の通りである。

- source の取得と整形
- syntax highlight
- highlighted HTML と DSD の生成
- static style と static code subtree

client artifact に入れる処理は次の通りである。

- `copied` state の client initializer
- button class と text の binding
- click listener
- clipboard operation
- reset timer
- timer と listener の cleanup

`copied = false` は client-owned initializer であり、server payload に serialize しない。
`source` は click handler が clipboard write に必要とする場合だけ server snapshot として transfer する。
highlighted HTML と highlight dependency は client graph から到達しないため、client artifact に入れない。

highlighted subtree は static DOM として保持する。
`hydrate:preserve` のような directive で server code を除外するのではなく、ExecutionGraph の reachability と transfer plan で除外する。

期待する artifact は次の通りである。

```txt
server renderer
  -> source と highlighted HTML
  -> DSD と static styles
  -> button の initial DOM

request projection
  -> source snapshot（copy handler が必要な場合だけ）
  -> host、marker、binding identity

client artifact
  -> copied state initializer
  -> click handler
  -> class/text binding
  -> timer cleanup
```

client activation は highlighted subtree を再構築せず、button の既存 node に behavior を接続する。
