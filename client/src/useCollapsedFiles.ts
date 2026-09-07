import { useCallback, useEffect, useState } from 'react';

// diff のファイルカードの折りたたみ状態を scope 単位で保持するフック。
// sessionStorage に保存するため、タブ切り替えやリロードをまたいで復元される
// （ブラウザのタブを閉じれば消える）。

function storageKey(scope: string): string {
  return `diff-reviewer:collapsed:${scope}`;
}

function load(scope: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(storageKey(scope));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export interface CollapsedFiles {
  isCollapsed: (path: string) => boolean;
  toggle: (path: string) => void;
}

export function useCollapsedFiles(scope: string): CollapsedFiles {
  const [collapsed, setCollapsed] = useState(() => load(scope));

  // DiffPage は mount したまま scope だけ変わることがある（base / head の変更等）
  useEffect(() => {
    setCollapsed(load(scope));
  }, [scope]);

  const toggle = useCallback(
    (path: string) => {
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        try {
          sessionStorage.setItem(storageKey(scope), JSON.stringify([...next]));
        } catch {
          // ストレージが使えない環境ではメモリ上の状態のみで動作させる
        }
        return next;
      });
    },
    [scope],
  );

  const isCollapsed = useCallback((path: string) => collapsed.has(path), [collapsed]);

  return { isCollapsed, toggle };
}
