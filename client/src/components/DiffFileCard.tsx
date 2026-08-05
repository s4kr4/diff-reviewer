import { useCallback, useMemo, useState } from 'react';
import { FileDiff } from '@pierre/diffs/react';
import type {
  DiffLineAnnotation,
  FileDiffMetadata,
  OnDiffLineClickProps,
} from '@pierre/diffs';
import { useResolvedTheme } from '../useTheme';
import type { CommentActions } from '../useComments';
import { CommentWidget } from './CommentWidget';
import { CopyButton } from './CopyButton';

export type DiffViewType = 'unified' | 'split';

export const DIFF_THEMES = { light: 'github-light', dark: 'github-dark' } as const;

interface Props {
  file: FileDiffMetadata;
  viewType: DiffViewType;
  commentActions: CommentActions;
  onOpenFile?: (path: string, line?: number) => void;
  anchorId: string;
}

// annotation の metadata に載せる、コメント位置の識別子
interface AnnotationMeta {
  side: 'old' | 'new';
  line: number;
}

export function displayPath(file: FileDiffMetadata): string {
  if (file.prevName && file.prevName !== file.name) {
    return `${file.prevName} → ${file.name}`;
  }
  return file.name;
}

// コメントの保存キーになるファイルパス
export function commentPath(file: FileDiffMetadata): string {
  return file.name;
}

export function countChanges(file: FileDiffMetadata): {
  additions: number;
  deletions: number;
} {
  return file.hunks.reduce(
    (acc, hunk) => ({
      additions: acc.additions + hunk.additionLines,
      deletions: acc.deletions + hunk.deletionLines,
    }),
    { additions: 0, deletions: 0 },
  );
}

const TYPE_LABEL: Record<string, { label: string; className: string }> = {
  new: { label: '追加', className: 'badge-add' },
  deleted: { label: '削除', className: 'badge-delete' },
  change: { label: '変更', className: 'badge-modify' },
  'rename-pure': { label: '移動', className: 'badge-rename' },
  'rename-changed': { label: '移動+変更', className: 'badge-rename' },
};

function toPierreSide(side: 'old' | 'new'): 'deletions' | 'additions' {
  return side === 'old' ? 'deletions' : 'additions';
}

export function DiffFileCard({ file, viewType, commentActions, onOpenFile, anchorId }: Props) {
  const theme = useResolvedTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [formTarget, setFormTarget] = useState<AnnotationMeta | null>(null);

  const filePath = commentPath(file);
  const fileComments = commentActions.comments.filter((c) => c.file === filePath);

  const annotations = useMemo(() => {
    const result: DiffLineAnnotation<AnnotationMeta>[] = [];
    const seen = new Set<string>();
    const push = (side: 'old' | 'new', line: number) => {
      const key = `${side}:${line}`;
      if (seen.has(key)) return;
      seen.add(key);
      result.push({
        side: toPierreSide(side),
        lineNumber: line,
        metadata: { side, line },
      });
    };
    for (const c of fileComments) push(c.side, c.line);
    if (formTarget) push(formTarget.side, formTarget.line);
    return result;
  }, [fileComments, formTarget]);

  const renderAnnotation = useCallback(
    (annotation: DiffLineAnnotation<AnnotationMeta>) => {
      const meta = annotation.metadata;
      if (!meta) return null;
      const matched = fileComments.filter(
        (c) => c.side === meta.side && c.line === meta.line,
      );
      const formOpen = formTarget?.side === meta.side && formTarget?.line === meta.line;
      return (
        <CommentWidget
          comments={matched}
          formOpen={formOpen}
          onSubmit={(body) => {
            commentActions.add({ file: filePath, side: meta.side, line: meta.line, body });
            setFormTarget(null);
          }}
          onUpdate={(id, body) => commentActions.update(id, body)}
          onDelete={(id) => commentActions.remove(id)}
          onCloseForm={() => setFormTarget(null)}
        />
      );
    },
    [fileComments, formTarget, filePath, commentActions],
  );

  const onLineNumberClick = useCallback((props: OnDiffLineClickProps) => {
    const side: 'old' | 'new' = props.annotationSide === 'deletions' ? 'old' : 'new';
    const target = { side, line: props.lineNumber };
    setFormTarget((prev) =>
      prev && prev.side === target.side && prev.line === target.line ? null : target,
    );
  }, []);

  const options = useMemo(
    () => ({
      diffStyle: viewType,
      theme: DIFF_THEMES,
      themeType: theme,
      disableFileHeader: true,
      onLineNumberClick,
    }),
    [viewType, theme, onLineNumberClick],
  );

  const { additions, deletions } = countChanges(file);
  const typeInfo = TYPE_LABEL[file.type] ?? TYPE_LABEL.change;
  const commentCount = fileComments.length;

  return (
    <section className="diff-card" id={anchorId}>
      <header className="diff-card-header">
        <button
          className="collapse-btn"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? '展開' : '折りたたみ'}
        >
          {collapsed ? '▸' : '▾'}
        </button>
        <span className={`badge ${typeInfo.className}`}>{typeInfo.label}</span>
        <span className="diff-card-path">{displayPath(file)}</span>
        <CopyButton text={filePath} />
        {commentCount > 0 && <span className="badge badge-comment">💬 {commentCount}</span>}
        <span className="diff-card-stats">
          <span className="stat-add">+{additions}</span>
          <span className="stat-del">−{deletions}</span>
        </span>
        {onOpenFile && file.type !== 'deleted' && (
          <button
            className="btn btn-small"
            onClick={() => {
              const firstHunk = file.hunks[0];
              onOpenFile(file.name, firstHunk?.additionStart);
            }}
          >
            ファイルを開く
          </button>
        )}
      </header>
      {!collapsed &&
        (file.hunks.length > 0 ? (
          <FileDiff<AnnotationMeta>
            fileDiff={file}
            options={options}
            lineAnnotations={annotations}
            renderAnnotation={renderAnnotation}
            disableWorkerPool
          />
        ) : (
          <div className="diff-empty">差分を表示できません（バイナリファイル等）</div>
        ))}
    </section>
  );
}
