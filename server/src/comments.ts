import fs from 'node:fs';
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
  constructor(private filePath: string) {}

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
