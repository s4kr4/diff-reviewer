# diff-reviewer

ローカル開発用の diff / 変更履歴レビューツール。GitHub の Pull Request 風の UI で、任意のローカル git リポジトリを閲覧できる。

## 機能

- **作業ツリー**: HEAD と作業ツリーの差分（staged / unstaged / 未追跡ファイルを含む）
- **ブランチ比較**: `git diff base...head`（GitHub PR と同じ 3 点ドット比較）とコミット一覧
- **履歴**: コミット一覧から選択して各コミットの差分を閲覧
- **ファイル**: 任意の ref（作業ツリー / ブランチ / コミット）のファイルツリーとシンタックスハイライト付きビューア。diff の「ファイルを開く」から該当行へジャンプ可能
- **行コメント**: diff の行番号クリックでコメントを追加。対象リポジトリの `.git/diff-reviewer-comments.json` にローカル保存（作業ツリーを汚さない）
- Unified / Split 表示切り替え、シンタックスハイライト付き diff
- ハンク間で折りたたまれた未変更行の展開（GitHub PR と同様の展開ボタン）
- 変更行数が多いファイル（追加 + 削除が 500 行以上）は既定で diff 本体を省略表示し、「差分を表示」で展開。ファイルごとの開閉状態はブラウザのタブを閉じるまで保持

## セットアップ

pnpm を使用する（未導入なら `corepack enable pnpm` で有効化できる）。

```sh
pnpm install
```

## 使い方

### 開発モード（このツール自体を開発するとき）

```sh
pnpm dev /path/to/target-repo
```

- Vite dev サーバー: http://localhost:5173 （こちらを開く）
- API サーバー: http://localhost:8080

### 通常利用

```sh
pnpm build   # 初回とクライアント更新時のみ
pnpm start /path/to/target-repo --open
```

`--open` を付けると起動時にブラウザが自動で開く（Chromium 系 / Firefox が既定ブラウザなら新規ウィンドウ、それ以外はブラウザ既定の挙動）。付けない場合は http://localhost:8080 を手動で開く。

コマンドライン引数（`pnpm dev` / `pnpm start` 共通）:

| 引数 | 既定値 | 説明 |
| --- | --- | --- |
| `[repo-path]` | カレントディレクトリ | 対象リポジトリのパス |
| `--port <port>`（`-p`） | 8080 | API サーバーのポート |
| `--open` | （無効） | 起動時にブラウザで開いてアクティブにする |

注意: 開発モードで `--port` を変える場合は、Vite の API プロキシ先（`client/vite.config.ts`）も合わせて変更が必要。

## 構成

```
diff-reviewer/
├── server/   Express + git CLI ラッパー（API とビルド済みクライアントの配信）
└── client/   Vite + React + @pierre/diffs（Shiki ベースの diff レンダリング）
```

サーバーは git コマンドの薄い HTTP ラッパーで、リポジトリの状態は一切変更しない（読み取り専用）。コメントの書き込み先も `.git/` 配下の JSON のみ。

## コメントデータ

行コメントは対象リポジトリの `<git dir>/diff-reviewer-comments.json` に保存される（`git rev-parse --absolute-git-dir` で場所を特定できる）。エージェント等が機械的に読む場合はこのファイルを直接読むか、サーバー起動中なら `GET /api/comments` を使う。各コメントは `scope`（`working` / `compare:<base>...<head>` / `commit:<sha>`）・`file`・`side`（`new`=変更後 / `old`=変更前）・`line`・`body` を持つ。

## 既知の制限

- マージコミットの差分は表示されない（`git diff-tree` の既定挙動）
- シンボル定義へのジャンプ（LSP 相当）は未対応。ファイル名絞り込みと行ジャンプのみ
- コメントは「ファイル + 行番号 + スコープ」に紐づくため、その後の編集で行がずれると diff 上に表示されなくなる（コメントタブには残る）
