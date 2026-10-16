import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// UI（レビュアー）からの投稿を表す author。エージェントの返信は任意のラベル（例: "Claude"）を使う
export const USER_AUTHOR = 'user';

export interface CommentItem {
  id: string;
  scope: string;
  file: string;
  side: 'old' | 'new';
  line: number;
  body: string;
  // スレッドのルートコメントの id。ルートコメント自身は null。
  // 返信は scope / file / side / line をルートから複製して持つため、位置での絞り込みはルートと同じ扱いでよい
  parentId: string | null;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export class CommentNotFoundError extends Error {
  readonly status = 404;
  constructor(id: string) {
    super(`comment not found: ${id}`);
  }
}

export class CommentStore {
  private listeners = new Set<() => void>();
  private watcher: fs.FSWatcher | null = null;
  private notifyTimer: NodeJS.Timeout | null = null;

  constructor(private filePath: string) {}

  // コメントの変更通知を購読する。戻り値の関数で解除する。
  // 自身の save に加えて、エージェント等が JSON を直接編集した場合も fs.watch で検知する
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    if (!this.watcher) this.startWatching();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stopWatching();
    };
  }

  private startWatching(): void {
    // ファイルは最初のコメントまで存在しないため、ディレクトリを監視してファイル名で絞る
    const dir = path.dirname(this.filePath);
    const name = path.basename(this.filePath);
    try {
      this.watcher = fs.watch(dir, (_event, filename) => {
        if (filename === name) this.notify();
      });
    } catch {
      // 監視できない環境では save 時の通知だけになる
      this.watcher = null;
    }
  }

  private stopWatching(): void {
    this.watcher?.close();
    this.watcher = null;
  }

  // 連続した書き込み（save と fs.watch の二重検知を含む）をまとめて 1 回の通知にする
  private notify(): void {
    if (this.notifyTimer) return;
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null;
      for (const listener of this.listeners) listener();
    }, 100);
  }

  private load(): CommentItem[] {
    try {
      const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      if (!Array.isArray(raw.comments)) return [];
      // スレッド対応前に保存されたコメントには parentId / author が無いため補う
      return raw.comments.map((c: Partial<CommentItem>) => ({
        ...c,
        parentId: c.parentId ?? null,
        author: c.author || USER_AUTHOR,
      })) as CommentItem[];
    } catch {
      return [];
    }
  }

  private save(comments: CommentItem[]): void {
    fs.writeFileSync(this.filePath, JSON.stringify({ comments }, null, 2) + '\n');
    this.notify();
  }

  list(scope?: string): CommentItem[] {
    const all = this.load();
    return scope ? all.filter((c) => c.scope === scope) : all;
  }

  add(
    input: Pick<CommentItem, 'scope' | 'file' | 'side' | 'line' | 'body'> & { author?: string },
  ): CommentItem {
    const now = new Date().toISOString();
    const { author, ...rest } = input;
    const item: CommentItem = {
      id: crypto.randomUUID(),
      ...rest,
      parentId: null,
      author: author || USER_AUTHOR,
      createdAt: now,
      updatedAt: now,
    };
    const all = this.load();
    all.push(item);
    this.save(all);
    return item;
  }

  // スレッドへの返信。返信に対する返信も同じルートにぶら下げる（階層は 1 段のみ）
  reply(parentId: string, body: string, author?: string): CommentItem {
    const all = this.load();
    const parent = all.find((c) => c.id === parentId);
    if (!parent) throw new CommentNotFoundError(parentId);
    const root = (parent.parentId && all.find((c) => c.id === parent.parentId)) || parent;
    const now = new Date().toISOString();
    const item: CommentItem = {
      id: crypto.randomUUID(),
      scope: root.scope,
      file: root.file,
      side: root.side,
      line: root.line,
      body,
      parentId: root.id,
      author: author || USER_AUTHOR,
      createdAt: now,
      updatedAt: now,
    };
    all.push(item);
    this.save(all);
    return item;
  }

  update(id: string, body: string): CommentItem {
    const all = this.load();
    const item = all.find((c) => c.id === id);
    if (!item) throw new CommentNotFoundError(id);
    item.body = body;
    item.updatedAt = new Date().toISOString();
    this.save(all);
    return item;
  }

  // ルートコメントを削除した場合はスレッド内の返信もまとめて削除する
  remove(id: string): void {
    const all = this.load();
    this.save(all.filter((c) => c.id !== id && c.parentId !== id));
  }
}
