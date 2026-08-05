import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { DiffPage } from '../components/DiffPage';
import type { CommitInfo } from '../types';

const PAGE_SIZE = 50;

interface Props {
  selectedSha: string | null;
  onSelect: (sha: string | null) => void;
  onOpenFile: (ref: string) => (path: string, line?: number) => void;
}

export function HistoryView({ selectedSha, onSelect, onOpenFile }: Props) {
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [detail, setDetail] = useState<{ commit: CommitInfo; patch: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMore = useCallback(async (skip: number) => {
    try {
      const { commits: page } = await api.commits('HEAD', skip, PAGE_SIZE);
      setCommits((prev) => (skip === 0 ? page : [...prev, ...page]));
      setHasMore(page.length === PAGE_SIZE);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadMore(0);
  }, [loadMore]);

  useEffect(() => {
    if (!selectedSha) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetail(null);
    api
      .commit(selectedSha)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err) => setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [selectedSha]);

  if (error) return <div className="empty-state error">{error}</div>;

  return (
    <div className="history-view">
      <aside className="commit-list">
        {commits.map((c) => (
          <button
            key={c.sha}
            className={`commit-item ${c.sha === selectedSha ? 'selected' : ''}`}
            onClick={() => onSelect(c.sha)}
          >
            <div className="commit-subject">
              {c.parents.length > 1 && <span className="badge badge-merge">merge</span>}
              {c.subject}
            </div>
            <div className="commit-meta">
              <code>{c.sha.slice(0, 7)}</code> {c.author} ·{' '}
              {new Date(c.date).toLocaleString('ja-JP')}
            </div>
          </button>
        ))}
        {hasMore && (
          <button className="btn load-more" onClick={() => loadMore(commits.length)}>
            さらに読み込む
          </button>
        )}
      </aside>
      <div className="commit-detail">
        {!selectedSha && <div className="empty-state">コミットを選択してください</div>}
        {selectedSha && detail === null && <div className="empty-state">読み込み中…</div>}
        {selectedSha && detail !== null && (
          <>
            <div className="commit-detail-header">
              <h2>{detail.commit.subject}</h2>
              {detail.commit.body && <pre className="commit-body">{detail.commit.body}</pre>}
              <div className="commit-meta">
                <code>{detail.commit.sha}</code>
                <br />
                {detail.commit.author} &lt;{detail.commit.email}&gt; ·{' '}
                {new Date(detail.commit.date).toLocaleString('ja-JP')}
              </div>
              {detail.commit.parents.length > 1 && (
                <div className="muted">
                  マージコミットのため差分表示は省略されます（first-parent との差分は表示されません）
                </div>
              )}
            </div>
            <DiffPage
              patch={detail.patch}
              scope={`commit:${detail.commit.sha}`}
              onOpenFile={onOpenFile(detail.commit.sha)}
              emptyMessage="このコミットに差分はありません"
            />
          </>
        )}
      </div>
    </div>
  );
}
