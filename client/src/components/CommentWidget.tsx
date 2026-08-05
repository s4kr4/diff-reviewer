import { useState } from 'react';
import type { CommentItem } from '../types';

interface Props {
  comments: CommentItem[];
  formOpen: boolean;
  onSubmit: (body: string) => void;
  onUpdate: (id: string, body: string) => void;
  onDelete: (id: string) => void;
  onCloseForm: () => void;
}

function CommentEntry({
  comment,
  onUpdate,
  onDelete,
}: {
  comment: CommentItem;
  onUpdate: (id: string, body: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);

  if (editing) {
    return (
      <div className="comment-entry">
        <textarea
          className="comment-textarea"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
        />
        <div className="comment-actions">
          <button
            className="btn btn-primary"
            disabled={!draft.trim()}
            onClick={() => {
              onUpdate(comment.id, draft.trim());
              setEditing(false);
            }}
          >
            保存
          </button>
          <button className="btn" onClick={() => setEditing(false)}>
            キャンセル
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="comment-entry">
      <div className="comment-meta">
        <span>{new Date(comment.createdAt).toLocaleString('ja-JP')}</span>
        <span className="comment-meta-actions">
          <button className="link-btn" onClick={() => setEditing(true)}>
            編集
          </button>
          <button className="link-btn danger" onClick={() => onDelete(comment.id)}>
            削除
          </button>
        </span>
      </div>
      <div className="comment-body">{comment.body}</div>
    </div>
  );
}

export function CommentWidget({
  comments,
  formOpen,
  onSubmit,
  onUpdate,
  onDelete,
  onCloseForm,
}: Props) {
  const [draft, setDraft] = useState('');

  return (
    <div className="comment-widget">
      {comments.map((c) => (
        <CommentEntry key={c.id} comment={c} onUpdate={onUpdate} onDelete={onDelete} />
      ))}
      {formOpen && (
        <div className="comment-form">
          <textarea
            className="comment-textarea"
            placeholder="コメントを入力…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />
          <div className="comment-actions">
            <button
              className="btn btn-primary"
              disabled={!draft.trim()}
              onClick={() => {
                onSubmit(draft.trim());
                setDraft('');
              }}
            >
              コメント追加
            </button>
            <button
              className="btn"
              onClick={() => {
                setDraft('');
                onCloseForm();
              }}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
