import { useCallback, useEffect, useState } from 'react';

// diff のファイルカードの折りたたみ状態を scope 単位で保持するフック。
// ファイルごとに既定の開閉状態が異なる（変更行数が多いファイルは既定で折りたたむ）ため、
// 保存するのは「ユーザーが明示的に切り替えたファイルの開閉状態」だけで、
// 記録の無いファイルは呼び出し側から渡された既定値に従う。
// sessionStorage に保存するため、タブ切り替えやリロードをまたいで復元される
// （ブラウザのタブを閉じれば消える）。

// ファイルパス → 折りたたみ中なら true
type Overrides = Record<string, boolean>;

function storageKey(scope: string): string {
  return `diff-reviewer:collapsed:${scope}`;
}

function load(scope: string): Overrides {
  try {
    const raw = sessionStorage.getItem(storageKey(scope));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    // 旧形式（折りたたんだパスの配列）が残っていれば読み替える
    if (Array.isArray(parsed)) {
      return Object.fromEntries(parsed.map((path) => [String(path), true]));
    }
    if (parsed && typeof parsed === 'object') return parsed as Overrides;
    return {};
  } catch {
    return {};
  }
}

export interface CollapsedFiles {
  isCollapsed: (path: string, defaultCollapsed: boolean) => boolean;
  toggle: (path: string, defaultCollapsed: boolean) => void;
}

export function useCollapsedFiles(scope: string): CollapsedFiles {
  const [overrides, setOverrides] = useState(() => load(scope));

  // DiffPage は mount したまま scope だけ変わることがある（base / head の変更等）
  useEffect(() => {
    setOverrides(load(scope));
  }, [scope]);

  const toggle = useCallback(
    (path: string, defaultCollapsed: boolean) => {
      setOverrides((prev) => {
        const current = prev[path] ?? defaultCollapsed;
        const next = { ...prev, [path]: !current };
        try {
          sessionStorage.setItem(storageKey(scope), JSON.stringify(next));
        } catch {
          // ストレージが使えない環境ではメモリ上の状態のみで動作させる
        }
        return next;
      });
    },
    [scope],
  );

  const isCollapsed = useCallback(
    (path: string, defaultCollapsed: boolean) => overrides[path] ?? defaultCollapsed,
    [overrides],
  );

  return { isCollapsed, toggle };
}
