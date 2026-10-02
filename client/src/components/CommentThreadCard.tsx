import { useState } from 'react';
import type { ReactNode } from 'react';
import type { CommentItem } from '../types';
import { isAgentComment, type CommentThread } from '../threads';

interface FormProps {
  initial?: string;
  placeholder?: string;
  submitLabel: string;
  onSubmit: (body: string) => void;
  onCancel: () => void;
}

// 新規コメント・返信・編集で共用する入力フォーム。アンマウントで下書きが破棄される
export function CommentForm({ initial = '', placeholder, submitLabel, onSubmit, onCancel }: FormProps) {
  const [draft, setDraft] = useState(initial);
  return (
    <div className="comment-form">
      <textarea
        className="comment-textarea"
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        autoFocus
      />
      <div className="comment-actions">
        <button
          className="btn btn-primary"
          disabled={!draft.trim()}
          onClick={() => onSubmit(draft.trim())}
        >
          {submitLabel}
        </button>
        <button className="btn" onClick={onCancel}>
          キャンセル
        </button>
      </div>
    </div>
  );
}

function CommentEntry({
  comment,
  isReply,
  deleteLabel,
  onUpdate,
  onDelete,
}: {
  comment: CommentItem;
  isReply?: boolean;
  deleteLabel?: string;
  onUpdate: (id: string, body: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const agent = isAgentComment(comment);
  const className = [
    'comment-entry',
    isReply ? 'comment-reply' : '',
    agent ? 'comment-by-agent' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (editing) {
    return (
      <div className={className}>
        <CommentForm
          initial={comment.body}
          submitLabel="保存"
          onSubmit={(body) => {
            onUpdate(comment.id, body);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="comment-meta">
        <span className="comment-meta-author">
          {agent && <span className="badge badge-author">{comment.author}</span>}
          <span>{new Date(comment.createdAt).toLocaleString('ja-JP')}</span>
        </span>
        <span className="comment-meta-actions">
          <button className="link-btn" onClick={() => setEditing(true)}>
            編集
          </button>
          <button className="link-btn danger" onClick={() => onDelete(comment.id)}>
            {deleteLabel ?? '削除'}
          </button>
        </span>
      </div>
      <div className="comment-body">{comment.body}</div>
    </div>
  );
}

interface Props {
  thread: CommentThread;
  // コメントタブでの位置表示などに使う、スレッド上部の任意の要素
  header?: ReactNode;
  onReply: (parentId: string, body: string) => void;
  onUpdate: (id: string, body: string) => void;
  onDelete: (id: string) => void;
}

export function CommentThreadCard({ thread, header, onReply, onUpdate, onDelete }: Props) {
  const [replying, setReplying] = useState(false);
  const { root, replies } = thread;

  return (
    <div className="comment-thread">
      {header}
      <CommentEntry
        comment={root}
        deleteLabel={replies.length > 0 ? 'スレッドを削除' : undefined}
        onUpdate={onUpdate}
        onDelete={(id) => {
          // ルートの削除はサーバー側で返信も一括削除されるため、返信がある場合は確認を挟む
          if (
            replies.length > 0 &&
            !window.confirm(`返信 ${replies.length} 件を含むスレッド全体を削除します。よろしいですか？`)
          ) {
            return;
          }
          onDelete(id);
        }}
      />
      {replies.map((r) => (
        <CommentEntry key={r.id} comment={r} isReply onUpdate={onUpdate} onDelete={onDelete} />
      ))}
      <div className="comment-thread-footer">
        {replying ? (
          <CommentForm
            placeholder="返信を入力…"
            submitLabel="返信"
            onSubmit={(body) => {
              onReply(root.id, body);
              setReplying(false);
            }}
            onCancel={() => setReplying(false)}
          />
        ) : (
          <button className="link-btn" onClick={() => setReplying(true)}>
            返信
          </button>
        )}
      </div>
    </div>
  );
}
