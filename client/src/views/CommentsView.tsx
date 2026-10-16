import { useEffect, useState } from 'react';
import { api } from '../api';
import type { CommentItem } from '../types';
import { buildThreads, type CommentThread } from '../threads';
import { useCommentEvents } from '../useCommentEvents';
import { CommentThreadCard } from '../components/CommentThreadCard';

interface Props {
  onJumpToScope: (scope: string) => void;
}

function scopeLabel(scope: string): string {
  if (scope === 'working') return '作業ツリー';
  if (scope.startsWith('compare:')) return `比較 ${scope.slice('compare:'.length)}`;
  if (scope.startsWith('commit:')) return `コミット ${scope.slice('commit:'.length, 'commit:'.length + 7)}`;
  return scope;
}

export function CommentsView({ onJumpToScope }: Props) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = () =>
    api
      .comments()
      .then(({ comments }) => setComments(comments))
      .catch((err) => setError(err.message));

  // 変更系 API の後に一覧を読み直す
  const mutate = (p: Promise<unknown>) => p.then(reload).catch((err) => setError(err.message));

  useEffect(() => {
    reload();
  }, []);

  useCommentEvents(reload);

  if (error) return <div className="empty-state error">{error}</div>;
  if (comments.length === 0) {
    return <div className="empty-state">コメントはまだありません（diff の行番号クリックで追加できます）</div>;
  }

  // スレッドはルートと返信で scope が同じなので、scope ごとに分けてからスレッドにまとめる
  const byScope = new Map<string, CommentItem[]>();
  for (const c of comments) {
    const list = byScope.get(c.scope) ?? [];
    list.push(c);
    byScope.set(c.scope, list);
  }
  const threadsByScope = [...byScope.entries()].map(
    ([scope, list]): [string, CommentThread[]] => [scope, buildThreads(list)],
  );

  return (
    <div className="view comments-view">
      {threadsByScope.map(([scope, threads]) => (
        <section key={scope} className="comment-scope">
          <h2>
            <button className="link-btn" onClick={() => onJumpToScope(scope)}>
              {scopeLabel(scope)}
            </button>
            <span className="muted">（{threads.length} 件）</span>
          </h2>
          {threads.map((t) => (
            <CommentThreadCard
              key={t.root.id}
              thread={t}
              header={
                <div className="comment-thread-header">
                  <code>
                    {t.root.file}:{t.root.line}
                  </code>
                  <span className="muted">[{t.root.side === 'old' ? '旧' : '新'}]</span>
                </div>
              }
              onReply={(parentId, body) => mutate(api.replyComment(parentId, body))}
              onUpdate={(id, body) => mutate(api.updateComment(id, body))}
              onDelete={(id) => mutate(api.deleteComment(id))}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
