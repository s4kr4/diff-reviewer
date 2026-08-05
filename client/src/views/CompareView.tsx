import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { DiffPage } from '../components/DiffPage';
import type { CommitInfo, RepoInfo } from '../types';

export interface CompareSelection {
  base: string;
  head: string;
}

interface Props {
  repo: RepoInfo;
  selection: CompareSelection;
  onChangeSelection: (sel: CompareSelection) => void;
  onOpenFile: (ref: string) => (path: string, line?: number) => void;
}

export function CompareView({ repo, selection, onChangeSelection, onOpenFile }: Props) {
  const [result, setResult] = useState<{ patch: string; commits: CommitInfo[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCommits, setShowCommits] = useState(false);

  const { base, head } = selection;

  const reload = useCallback(async () => {
    if (!base || !head) return;
    setResult(null);
    try {
      setResult(await api.compare(base, head));
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  }, [base, head]);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="view">
      <div className="view-header compare-header">
        <label>
          base:
          <select
            value={base}
            onChange={(e) => onChangeSelection({ base: e.target.value, head })}
          >
            {repo.branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <span className="compare-arrow">←</span>
        <label>
          compare:
          <select
            value={head}
            onChange={(e) => onChangeSelection({ base, head: e.target.value })}
          >
            {repo.branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn"
          title="base と compare を入れ替え"
          onClick={() => onChangeSelection({ base: head, head: base })}
        >
          ⇄
        </button>
        {result && (
          <button className="link-btn" onClick={() => setShowCommits((s) => !s)}>
            {result.commits.length} コミット {showCommits ? '▾' : '▸'}
          </button>
        )}
      </div>
      {showCommits && result && (
        <ul className="compare-commits">
          {result.commits.map((c) => (
            <li key={c.sha}>
              <code>{c.sha.slice(0, 7)}</code> {c.subject}{' '}
              <span className="muted">
                {c.author} · {new Date(c.date).toLocaleDateString('ja-JP')}
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && <div className="empty-state error">{error}</div>}
      {!error && result === null && <div className="empty-state">読み込み中…</div>}
      {!error && result !== null && (
        <DiffPage
          patch={result.patch}
          scope={`compare:${base}...${head}`}
          onOpenFile={onOpenFile(head)}
          emptyMessage={`${base} と ${head} に差分はありません`}
        />
      )}
    </div>
  );
}
