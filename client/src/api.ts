import type { CommentItem, CommitInfo, RepoInfo } from './types';

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data as T;
}

async function send<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  repo: () => get<RepoInfo>('/api/repo'),
  workingDiff: () => get<{ patch: string }>('/api/working-diff'),
  compare: (base: string, head: string) =>
    get<{ patch: string; commits: CommitInfo[] }>(
      `/api/compare?base=${encodeURIComponent(base)}&head=${encodeURIComponent(head)}`,
    ),
  commits: (ref: string, skip: number, limit: number) =>
    get<{ commits: CommitInfo[] }>(
      `/api/commits?ref=${encodeURIComponent(ref)}&skip=${skip}&limit=${limit}`,
    ),
  commit: (sha: string) =>
    get<{ commit: CommitInfo; patch: string }>(`/api/commit/${encodeURIComponent(sha)}`),
  tree: (ref: string) =>
    get<{ files: string[] }>(`/api/tree?ref=${encodeURIComponent(ref)}`),
  file: (ref: string, path: string) =>
    get<{ binary: boolean; size: number; content: string }>(
      `/api/file?ref=${encodeURIComponent(ref)}&path=${encodeURIComponent(path)}`,
    ),
  comments: (scope?: string) =>
    get<{ comments: CommentItem[] }>(
      scope ? `/api/comments?scope=${encodeURIComponent(scope)}` : '/api/comments',
    ),
  addComment: (input: Pick<CommentItem, 'scope' | 'file' | 'side' | 'line' | 'body'>) =>
    send<CommentItem>('POST', '/api/comments', input),
  updateComment: (id: string, body: string) =>
    send<CommentItem>('PUT', `/api/comments/${id}`, { body }),
  deleteComment: (id: string) => send<{ ok: boolean }>('DELETE', `/api/comments/${id}`),
};
