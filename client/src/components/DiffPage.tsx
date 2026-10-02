import { useMemo, useState } from 'react';
import { processPatch } from '@pierre/diffs';
import type { FileDiffMetadata } from '@pierre/diffs';
import { createHasher } from '../contentHash';
import { countThreads } from '../threads';
import { useComments } from '../useComments';
import { useCollapsedFiles } from '../useCollapsedFiles';
import { buildFileTree, isFileNode, type FileTreeNode } from '../fileTree';
import type { CommentItem } from '../types';
import {
  DiffFileCard,
  commentPath,
  countChanges,
  displayPath,
  isLargeDiff,
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

// @pierre/diffs は cacheKey の無い diff にファイルパスをキーとして自動付与し、
// 同じキーの diff は内容が変わっていても再描画・再ハイライトしない
// （Worker Pool のハイライト結果もこのキーで保持される）。
// 再取得した patch で内容が変わったことを検知できるよう、内容から導出したキーを付ける
function fileDiffCacheKey(file: FileDiffMetadata): string {
  const hasher = createHasher();
  hasher.update(`${file.type}\0${file.prevName ?? ''}\0${file.name}\0`);
  for (const hunk of file.hunks) {
    hasher.update(
      `@${hunk.deletionStart},${hunk.deletionCount},${hunk.additionStart},${hunk.additionCount}\0`,
    );
  }
  for (const line of file.deletionLines) hasher.update(line).update('\0');
  hasher.update('\x01');
  for (const line of file.additionLines) hasher.update(line).update('\0');
  return `${file.name}#${hasher.digest()}`;
}

export function DiffPage({ patch, scope, onOpenFile, emptyMessage, fileRefs }: Props) {
  const [viewType, setViewType] = useState<DiffViewType>('split');
  const [wrap, setWrap] = useState(true);
  const commentActions = useComments(scope);
  const collapsedFiles = useCollapsedFiles(scope);

  const files = useMemo<FileDiffMetadata[]>(() => {
    if (!patch.trim()) return [];
    try {
      const { files } = processPatch(patch);
      for (const file of files) file.cacheKey = fileDiffCacheKey(file);
      return files;
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
          <label className="wrap-toggle">
            <input
              type="checkbox"
              checked={wrap}
              onChange={(e) => setWrap(e.target.checked)}
            />
            折り返し
          </label>
          <span className="hint">行番号をクリックでコメント追加</span>
        </div>
        {files.map((file, i) => (
          <DiffFileCard
            key={`${file.prevName ?? ''}:${file.name}`}
            file={file}
            viewType={viewType}
            wrap={wrap}
            collapsed={collapsedFiles.isCollapsed(commentPath(file), isLargeDiff(file))}
            onToggleCollapsed={() => collapsedFiles.toggle(commentPath(file), isLargeDiff(file))}
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
    const count = countThreads(comments.filter((c) => c.file === commentPath(file)));
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
