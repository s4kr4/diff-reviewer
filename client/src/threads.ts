import type { CommentItem } from './types';

// UI（レビュアー）からの投稿を表す author。サーバー側の既定値と一致させる
export const USER_AUTHOR = 'user';

// スレッド = ルートコメント 1 件と、それに対する返信（作成順）
export interface CommentThread {
  root: CommentItem;
  replies: CommentItem[];
}

export function isAgentComment(comment: CommentItem): boolean {
  return comment.author !== USER_AUTHOR;
}

// フラットなコメント一覧をスレッドにまとめる。スレッドの順序はルートの出現順（＝作成順）を保つ
export function buildThreads(comments: CommentItem[]): CommentThread[] {
  const byRoot = new Map<string, CommentThread>();
  const threads: CommentThread[] = [];
  for (const c of comments) {
    if (c.parentId === null) {
      const thread = { root: c, replies: [] };
      byRoot.set(c.id, thread);
      threads.push(thread);
    }
  }
  for (const c of comments) {
    if (c.parentId === null) continue;
    const thread = byRoot.get(c.parentId);
    if (thread) {
      thread.replies.push(c);
    } else {
      // ルートが見つからない返信（JSON の手編集等）は単独のスレッドとして表示し、取りこぼさない
      threads.push({ root: c, replies: [] });
    }
  }
  return threads;
}

export function countThreads(comments: CommentItem[]): number {
  return buildThreads(comments).length;
}
