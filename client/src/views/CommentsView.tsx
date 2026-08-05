import { useEffect, useState } from 'react';
import { api } from '../api';
import type { CommentItem } from '../types';

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

  useEffect(() => {
    reload();
  }, []);

  if (error) return <div className="empty-state error">{error}</div>;
  if (comments.length === 0) {
    return <div className="empty-state">コメントはまだありません（diff の行番号クリックで追加できます）</div>;
  }

  const byScope = new Map<string, CommentItem[]>();
  for (const c of comments) {
    const list = byScope.get(c.scope) ?? [];
    list.push(c);
    byScope.set(c.scope, list);
  }

  return (
    <div className="view comments-view">
      {[...byScope.entries()].map(([scope, list]) => (
        <section key={scope} className="comment-scope">
          <h2>
            <button className="link-btn" onClick={() => onJumpToScope(scope)}>
              {scopeLabel(scope)}
            </button>
            <span className="muted">（{list.length} 件）</span>
          </h2>
          {list.map((c) => (
            <div key={c.id} className="comment-row">
              <div className="comment-row-loc">
                <code>
                  {c.file}:{c.line}
                </code>
                <span className="muted"> [{c.side === 'old' ? '旧' : '新'}]</span>
                <button
                  className="link-btn danger"
                  onClick={async () => {
                    await api.deleteComment(c.id);
                    reload();
                  }}
                >
                  削除
                </button>
              </div>
              <div className="comment-body">{c.body}</div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
