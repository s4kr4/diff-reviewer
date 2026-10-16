import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { CommentItem } from './types';
import { useCommentEvents } from './useCommentEvents';

export interface CommentActions {
  comments: CommentItem[];
  add: (input: Pick<CommentItem, 'file' | 'side' | 'line' | 'body'>) => Promise<void>;
  reply: (parentId: string, body: string) => Promise<void>;
  update: (id: string, body: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useComments(scope: string): CommentActions {
  const [comments, setComments] = useState<CommentItem[]>([]);

  const reload = useCallback(async () => {
    const { comments } = await api.comments(scope);
    setComments(comments);
  }, [scope]);

  useEffect(() => {
    reload().catch(console.error);
  }, [reload]);

  // エージェント等が API や JSON 経由で変更した分もリロード無しで反映する
  useCommentEvents(() => {
    reload().catch(console.error);
  });

  const add = useCallback(
    async (input: Pick<CommentItem, 'file' | 'side' | 'line' | 'body'>) => {
      await api.addComment({ scope, ...input });
      await reload();
    },
    [scope, reload],
  );

  const reply = useCallback(
    async (parentId: string, body: string) => {
      await api.replyComment(parentId, body);
      await reload();
    },
    [reload],
  );

  const update = useCallback(
    async (id: string, body: string) => {
      await api.updateComment(id, body);
      await reload();
    },
    [reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await api.deleteComment(id);
      await reload();
    },
    [reload],
  );

  return { comments, add, reply, update, remove };
}
