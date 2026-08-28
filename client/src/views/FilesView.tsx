import { useEffect, useMemo, useRef, useState } from 'react';
import { File } from '@pierre/diffs/react';
import { api } from '../api';
import { CopyButton } from '../components/CopyButton';
import { DIFF_THEMES } from '../components/DiffFileCard';
import { useResolvedTheme } from '../useTheme';
import type { FileTarget, RepoInfo } from '../types';
import { buildFileTree, isFileNode, type FileTreeNode } from '../fileTree';

interface Props {
  repo: RepoInfo;
  target: FileTarget | null;
  onChangeTarget: (target: FileTarget | null) => void;
}

function TreeEntry({
  node,
  depth,
  selectedPath,
  onSelectFile,
}: {
  node: FileTreeNode<string>;
  depth: number;
  selectedPath: string | undefined;
  onSelectFile: (path: string) => void;
}) {
  // 選択中ファイルの祖先ディレクトリは初期展開する
  const containsSelection = !!selectedPath && selectedPath.startsWith(node.path + '/');
  const [open, setOpen] = useState(depth === 0 || containsSelection);

  useEffect(() => {
    if (containsSelection) setOpen(true);
  }, [containsSelection]);

  if (isFileNode(node)) {
    return (
      <button
        className={`tree-item ${node.path === selectedPath ? 'selected' : ''}`}
        style={{ paddingLeft: depth * 14 + 8 }}
        onClick={() => onSelectFile(node.path)}
      >
        {node.name}
      </button>
    );
  }

  return (
    <div>
      {depth > 0 && (
        <button
          className="tree-item tree-dir"
          style={{ paddingLeft: (depth - 1) * 14 + 8 }}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? '▾ ' : '▸ '}
          {node.name}/
        </button>
      )}
      {open && (
        <div>
          {node.children.map((child) => (
            <TreeEntry
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FileViewer({ target }: { target: FileTarget }) {
  const theme = useResolvedTheme();
  const [file, setFile] = useState<{ binary: boolean; size: number; content: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  // 同じターゲットに対して初回描画時のみスクロールする
  const scrolledFor = useRef<string | null>(null);
  const targetKey = `${target.ref}:${target.path}:${target.line ?? ''}`;

  useEffect(() => {
    let cancelled = false;
    setFile(null);
    setError(null);
    api
      .file(target.ref, target.path)
      .then((f) => {
        if (!cancelled) setFile(f);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [target.ref, target.path]);

  const options = useMemo(
    () => ({
      theme: DIFF_THEMES,
      themeType: theme,
      disableFileHeader: true,
      // ハイライト描画が完了したタイミングで対象行へスクロールする
      onPostRender: (node: HTMLElement) => {
        if (!target.line || scrolledFor.current === targetKey) return;
        const el = node.querySelector(`[data-line="${target.line}"]`);
        if (el) {
          scrolledFor.current = targetKey;
          el.scrollIntoView({ block: 'center' });
        }
      },
    }),
    [theme, target.line, targetKey],
  );

  const fileContents = useMemo(
    () => (file && !file.binary ? { name: target.path, contents: file.content } : null),
    [file, target.path],
  );

  if (error) return <div className="empty-state error">{error}</div>;
  if (!file) return <div className="empty-state">読み込み中…</div>;
  if (file.binary || !fileContents) {
    return <div className="empty-state">バイナリファイルです（{file.size} bytes）</div>;
  }

  return (
    <File
      file={fileContents}
      options={options}
      selectedLines={target.line ? { start: target.line, end: target.line } : null}
    />
  );
}

export function FilesView({ repo, target, onChangeTarget }: Props) {
  const ref = target?.ref ?? 'WORKING';
  const [files, setFiles] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .tree(ref)
      .then(({ files }) => {
        if (!cancelled) setFiles(files);
      })
      .catch((err) => setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [ref]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return files;
    const terms = filter.toLowerCase().split(/\s+/).filter(Boolean);
    return files.filter((f) => terms.every((t) => f.toLowerCase().includes(t)));
  }, [files, filter]);

  const tree = useMemo(() => buildFileTree(filtered, (p) => p), [filtered]);
  const refOptions = ['WORKING', 'HEAD', ...repo.branches];

  return (
    <div className="files-view">
      <aside className="files-sidebar">
        <select
          value={ref}
          onChange={(e) =>
            onChangeTarget(
              target
                ? { ...target, ref: e.target.value, line: undefined }
                : { ref: e.target.value, path: '' },
            )
          }
        >
          {refOptions.map((r) => (
            <option key={r} value={r}>
              {r === 'WORKING' ? '作業ツリー' : r}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder="ファイル名で絞り込み…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="tree">
          {error && <div className="error">{error}</div>}
          {filter.trim() ? (
            // 絞り込み中はフラットな一覧の方が見通しがよい
            filtered.slice(0, 500).map((f) => (
              <button
                key={f}
                className={`tree-item ${f === target?.path ? 'selected' : ''}`}
                onClick={() => onChangeTarget({ ref, path: f })}
                title={f}
              >
                {f}
              </button>
            ))
          ) : (
            <TreeEntry
              node={tree}
              depth={0}
              selectedPath={target?.path}
              onSelectFile={(path) => onChangeTarget({ ref, path })}
            />
          )}
        </div>
      </aside>
      <div className="file-content">
        {target?.path ? (
          <>
            <div className="file-content-header">
              <code>{target.path}</code>
              <CopyButton text={target.path} />
              <span className="muted">@ {ref === 'WORKING' ? '作業ツリー' : ref}</span>
            </div>
            <FileViewer target={target} />
          </>
        ) : (
          <div className="empty-state">ファイルを選択してください</div>
        )}
      </div>
    </div>
  );
}
