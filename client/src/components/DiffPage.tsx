import { useMemo, useState } from 'react';
import { processPatch } from '@pierre/diffs';
import type { FileDiffMetadata } from '@pierre/diffs';
import { useComments } from '../useComments';
import { buildFileTree, isFileNode, type FileTreeNode } from '../fileTree';
import type { CommentItem } from '../types';
import {
  DiffFileCard,
  commentPath,
  countChanges,
  displayPath,
  type DiffViewType,
  type FileRefs,
} from './DiffFileCard';

// ファイル一覧ツリーの葉に載せる情報。index は diff 本体側のアンカー ID と対応する
interface DiffFileEntry {
  file: FileDiffMetadata;
  index: number;
}

interface Props {
  patch: string;
  scope: string;
  onOpenFile?: (path: string, line?: number) => void;
  emptyMessage?: string;
  // 指定すると diff の未変更行（ハンク間の折りたたみ部分）を展開できるようになる
  fileRefs?: FileRefs;
}

export function DiffPage({ patch, scope, onOpenFile, emptyMessage, fileRefs }: Props) {
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

  const tree = useMemo(
    () =>
      buildFileTree(
        files.map((file, index): DiffFileEntry => ({ file, index })),
        (e) => e.file.name,
        { compactDirs: true },
      ),
    [files],
  );

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
        <div className="diff-file-tree">
          <DiffFileTreeEntry node={tree} depth={0} comments={commentActions.comments} />
        </div>
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
            fileRefs={fileRefs}
          />
        ))}
      </div>
    </div>
  );
}

function DiffFileTreeEntry({
  node,
  depth,
  comments,
}: {
  node: FileTreeNode<DiffFileEntry>;
  depth: number;
  comments: CommentItem[];
}) {
  // 差分のファイル数は限られるため、ディレクトリは初期状態で全て展開する
  const [open, setOpen] = useState(true);

  if (isFileNode(node)) {
    const { file, index } = node.item;
    const { additions, deletions } = countChanges(file);
    const count = comments.filter((c) => c.file === commentPath(file)).length;
    // リネームは旧ファイル名（ベース名）を添えて表示する。フルパスは title で確認できる
    const prevBase =
      file.prevName && file.prevName !== file.name ? basename(file.prevName) : null;
    return (
      <a
        href={`#file-${index}`}
        title={displayPath(file)}
        style={{ paddingLeft: depth * 12 + 12 }}
      >
        <span className="file-list-path">
          {prevBase !== null && <span className="muted">{prevBase} → </span>}
          {node.name}
        </span>
        <span className="file-list-stats">
          {count > 0 && <span className="badge badge-comment">{count}</span>}
          <span className="stat-add">+{additions}</span>
          <span className="stat-del">−{deletions}</span>
        </span>
      </a>
    );
  }

  const isRoot = node.path === '';
  return (
    <div>
      {!isRoot && (
        <button
          className="diff-file-tree-dir"
          style={{ paddingLeft: (depth - 1) * 12 + 12 }}
          onClick={() => setOpen((o) => !o)}
          title={node.path}
        >
          {open ? '▾ ' : '▸ '}
          {node.name}/
        </button>
      )}
      {open &&
        node.children.map((child) => (
          <DiffFileTreeEntry
            key={child.path}
            node={child}
            depth={isRoot ? depth : depth + 1}
            comments={comments}
          />
        ))}
    </div>
  );
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}
