import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Virtualizer } from '@pierre/diffs/react';
import { DiffPage } from '../components/DiffPage';
import { BranchPicker } from '../components/BranchPicker';
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
  const [result, setResult] = useState<{
    patch: string;
    commits: CommitInfo[];
    mergeBase: string | null;
  } | null>(null);
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

  // Virtualizer は diff のスクロールコンテナ自身である必要があるため、ビューのルートを兼ねる
  return (
    <Virtualizer className="view scroll-root">
      <div className="view-header compare-header">
        <label>
          base:
          <BranchPicker
            value={base}
            options={repo.branches}
            onChange={(v) => onChangeSelection({ base: v, head })}
            placeholder="ブランチ名で検索…"
          />
        </label>
        <span className="compare-arrow">←</span>
        <label>
          compare:
          <BranchPicker
            value={head}
            options={repo.branches}
            onChange={(v) => onChangeSelection({ base, head: v })}
            placeholder="ブランチ名で検索…"
          />
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
          // 3点ドット比較（base...head）の old 側は merge-base のスナップショット
          fileRefs={result.mergeBase ? { old: result.mergeBase, new: head } : undefined}
        />
      )}
    </Virtualizer>
  );
}
