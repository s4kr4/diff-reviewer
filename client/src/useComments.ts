import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { CommentItem } from './types';

export interface CommentActions {
  comments: CommentItem[];
  add: (input: Pick<CommentItem, 'file' | 'side' | 'line' | 'body'>) => Promise<void>;
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

  const add = useCallback(
    async (input: Pick<CommentItem, 'file' | 'side' | 'line' | 'body'>) => {
      await api.addComment({ scope, ...input });
      await reload();
    },
    [scope, reload],
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

  return { comments, add, update, remove };
}
