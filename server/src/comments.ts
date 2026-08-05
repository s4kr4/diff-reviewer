import fs from 'node:fs';
import crypto from 'node:crypto';

export interface CommentItem {
  id: string;
  scope: string;
  file: string;
  side: 'old' | 'new';
  line: number;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export class CommentStore {
  constructor(private filePath: string) {}

  private load(): CommentItem[] {
    try {
      const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      return Array.isArray(raw.comments) ? raw.comments : [];
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

  add(input: Pick<CommentItem, 'scope' | 'file' | 'side' | 'line' | 'body'>): CommentItem {
    const now = new Date().toISOString();
    const item: CommentItem = {
      id: crypto.randomUUID(),
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    const all = this.load();
    all.push(item);
    this.save(all);
    return item;
  }

  update(id: string, body: string): CommentItem {
    const all = this.load();
    const item = all.find((c) => c.id === id);
    if (!item) throw new Error(`comment not found: ${id}`);
    item.body = body;
    item.updatedAt = new Date().toISOString();
    this.save(all);
    return item;
  }

  remove(id: string): void {
    const all = this.load();
    this.save(all.filter((c) => c.id !== id));
  }
}
