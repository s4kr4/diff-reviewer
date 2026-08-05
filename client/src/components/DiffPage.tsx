import { useMemo, useState } from 'react';
import { processPatch } from '@pierre/diffs';
import type { FileDiffMetadata } from '@pierre/diffs';
import { useComments } from '../useComments';
import {
  DiffFileCard,
  commentPath,
  countChanges,
  displayPath,
  type DiffViewType,
} from './DiffFileCard';

interface Props {
  patch: string;
  scope: string;
  onOpenFile?: (path: string, line?: number) => void;
  emptyMessage?: string;
}

export function DiffPage({ patch, scope, onOpenFile, emptyMessage }: Props) {
  const [viewType, setViewType] = useState<DiffViewType>('unified');
  const commentActions = useComments(scope);

  const files = useMemo<FileDiffMetadata[]>(() => {
    if (!patch.trim()) return [];
    try {
      return processPatch(patch).files;
    } catch (err) {
      console.error('diff parse error', err);
      return [];
    }
  }, [patch]);

  if (files.length === 0) {
    return <div className="empty-state">{emptyMessage ?? '差分はありません'}</div>;
  }

  const totals = files.reduce(
    (acc, f) => {
      const { additions, deletions } = countChanges(f);
      return { additions: acc.additions + additions, deletions: acc.deletions + deletions };
    },
    { additions: 0, deletions: 0 },
  );

  return (
    <div className="diff-page">
      <aside className="diff-file-list">
        <div className="diff-file-list-header">
          {files.length} ファイル
          <span className="diff-card-stats">
            <span className="stat-add">+{totals.additions}</span>
            <span className="stat-del">−{totals.deletions}</span>
          </span>
        </div>
        <ul>
          {files.map((file, i) => {
            const { additions, deletions } = countChanges(file);
            const count = commentActions.comments.filter(
              (c) => c.file === commentPath(file),
            ).length;
            return (
              <li key={`${file.prevName ?? ''}:${file.name}`}>
                <a href={`#file-${i}`} title={displayPath(file)}>
                  <span className="file-list-path">{displayPath(file)}</span>
                  <span className="file-list-stats">
                    {count > 0 && <span className="badge badge-comment">{count}</span>}
                    <span className="stat-add">+{additions}</span>
                    <span className="stat-del">−{deletions}</span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </aside>
      <div className="diff-main">
        <div className="diff-toolbar">
          <div className="view-toggle">
            <button
              className={viewType === 'unified' ? 'active' : ''}
              onClick={() => setViewType('unified')}
            >
              Unified
            </button>
            <button
              className={viewType === 'split' ? 'active' : ''}
              onClick={() => setViewType('split')}
            >
              Split
            </button>
          </div>
          <span className="hint">行番号をクリックでコメント追加</span>
        </div>
        {files.map((file, i) => (
          <DiffFileCard
            key={`${file.prevName ?? ''}:${file.name}`}
            file={file}
            viewType={viewType}
            commentActions={commentActions}
            onOpenFile={onOpenFile}
            anchorId={`file-${i}`}
          />
        ))}
      </div>
    </div>
  );
}
