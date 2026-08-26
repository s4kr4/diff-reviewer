import { useCallback, useEffect, useState } from 'react';
import { Virtualizer } from '@pierre/diffs/react';
import { api } from '../api';
import { DiffPage } from '../components/DiffPage';

interface Props {
  onOpenFile: (ref: string) => (path: string, line?: number) => void;
}

export function WorkingView({ onOpenFile }: Props) {
  const [patch, setPatch] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const { patch } = await api.workingDiff();
      setPatch(patch);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    reload();
    // 他のウィンドウで編集して戻ってきたときに再取得する
    const onFocus = () => reload();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [reload]);

  if (error) return <div className="empty-state error">{error}</div>;
  if (patch === null) return <div className="empty-state">読み込み中…</div>;

  // Virtualizer は diff のスクロールコンテナ自身である必要があるため、ビューのルートを兼ねる
  return (
    <Virtualizer className="view scroll-root">
      <div className="view-header">
        <h2>作業ツリーの差分（HEAD との比較・未追跡ファイル含む）</h2>
        <button className="btn" onClick={reload}>
          更新
        </button>
      </div>
      <DiffPage
        patch={patch}
        scope="working"
        onOpenFile={onOpenFile('WORKING')}
        emptyMessage="作業ツリーに変更はありません"
        fileRefs={{ old: 'HEAD', new: 'WORKING' }}
      />
    </Virtualizer>
  );
}
