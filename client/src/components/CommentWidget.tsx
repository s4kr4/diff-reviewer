import { useMemo } from 'react';
import type { CommentItem } from '../types';
import { buildThreads } from '../threads';
import { CommentForm, CommentThreadCard } from './CommentThreadCard';

interface Props {
  // この行に紐づくコメント（ルートと返信の両方を含む）
  comments: CommentItem[];
  formOpen: boolean;
  onSubmit: (body: string) => void;
  onReply: (parentId: string, body: string) => void;
  onUpdate: (id: string, body: string) => void;
  onDelete: (id: string) => void;
  onCloseForm: () => void;
}

export function CommentWidget({
  comments,
  formOpen,
  onSubmit,
  onReply,
  onUpdate,
  onDelete,
  onCloseForm,
}: Props) {
  const threads = useMemo(() => buildThreads(comments), [comments]);

  return (
    <div className="comment-widget">
      {threads.map((t) => (
        <CommentThreadCard
          key={t.root.id}
          thread={t}
          onReply={onReply}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
      {formOpen && (
        <div className="comment-new">
          <CommentForm
            placeholder="コメントを入力…"
            submitLabel="コメント追加"
            onSubmit={onSubmit}
            onCancel={onCloseForm}
          />
        </div>
      )}
    </div>
  );
}
