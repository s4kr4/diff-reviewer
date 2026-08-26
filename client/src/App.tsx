import { useCallback, useEffect, useState } from 'react';
import { WorkerPoolContextProvider } from '@pierre/diffs/react';
import { api } from './api';
import { workerFactory } from './diffWorker';
import { DIFF_THEMES } from './components/DiffFileCard';
import { ThemeContext, useTheme, type ThemePref } from './useTheme';
import type { FileTarget, RepoInfo } from './types';
import { WorkingView } from './views/WorkingView';
import { CompareView, type CompareSelection } from './views/CompareView';
import { HistoryView } from './views/HistoryView';
import { FilesView } from './views/FilesView';
import { CommentsView } from './views/CommentsView';

type Tab = 'working' | 'compare' | 'history' | 'files' | 'comments';

const TABS: { id: Tab; label: string }[] = [
  { id: 'working', label: '作業ツリー' },
  { id: 'compare', label: 'ブランチ比較' },
  { id: 'history', label: '履歴' },
  { id: 'files', label: 'ファイル' },
  { id: 'comments', label: 'コメント' },
];

const THEME_LABEL: Record<ThemePref, string> = {
  auto: '🌓 自動',
  light: '☀️ ライト',
  dark: '🌙 ダーク',
};

function guessBase(repo: RepoInfo): string {
  for (const cand of ['main', 'master', 'origin/main', 'origin/master']) {
    if (repo.branches.includes(cand)) return cand;
  }
  return repo.branches[0] ?? 'HEAD';
}

interface UrlState {
  tab: Tab;
  compareSel: CompareSelection | null;
  selectedCommit: string | null;
  fileTarget: FileTarget | null;
}

function parseUrlState(): UrlState {
  const params = new URLSearchParams(location.search);
  const rawTab = params.get('tab');
  const tab: Tab = TABS.some((t) => t.id === rawTab) ? (rawTab as Tab) : 'working';
  const base = params.get('base');
  const head = params.get('head');
  const path = params.get('path');
  const ref = params.get('ref');
  const line = Number(params.get('line'));
  return {
    tab,
    compareSel: base && head ? { base, head } : null,
    selectedCommit: params.get('commit'),
    fileTarget:
      ref && path ? { ref, path, line: Number.isInteger(line) && line > 0 ? line : undefined } : null,
  };
}

// アクティブなタブの状態だけを URL クエリに載せる
function buildSearch(state: UrlState): string {
  const params = new URLSearchParams();
  if (state.tab !== 'working') params.set('tab', state.tab);
  if (state.tab === 'compare' && state.compareSel) {
    params.set('base', state.compareSel.base);
    params.set('head', state.compareSel.head);
  }
  if (state.tab === 'history' && state.selectedCommit) {
    params.set('commit', state.selectedCommit);
  }
  if (state.tab === 'files' && state.fileTarget?.path) {
    params.set('ref', state.fileTarget.ref);
    params.set('path', state.fileTarget.path);
    if (state.fileTarget.line) params.set('line', String(state.fileTarget.line));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export default function App() {
  const [initialUrlState] = useState(parseUrlState);
  const [repo, setRepo] = useState<RepoInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(initialUrlState.tab);
  const [compareSel, setCompareSel] = useState<CompareSelection | null>(
    initialUrlState.compareSel,
  );
  const [selectedCommit, setSelectedCommit] = useState<string | null>(
    initialUrlState.selectedCommit,
  );
  const [fileTarget, setFileTarget] = useState<FileTarget | null>(initialUrlState.fileTarget);
  const { pref: themePref, resolved: theme, cycle: cycleTheme } = useTheme();

  useEffect(() => {
    api
      .repo()
      .then((info) => {
        setRepo(info);
        // URL から比較対象が復元済みならそちらを優先する
        setCompareSel(
          (prev) =>
            prev ?? {
              base: guessBase(info),
              head: info.currentBranch !== 'HEAD' ? info.currentBranch : guessBase(info),
            },
        );
      })
      .catch((err) => setError(err.message));
  }, []);

  // 画面状態 → URL（履歴に積む）。popstate 直後は URL と一致するので何もしない
  useEffect(() => {
    const next =
      location.pathname + buildSearch({ tab, compareSel, selectedCommit, fileTarget });
    const current = location.pathname + location.search;
    if (next !== current) {
      history.pushState(null, '', next + location.hash);
    }
  }, [tab, compareSel, selectedCommit, fileTarget]);

  // ブラウザバック / フォワード → URL から画面状態を復元
  useEffect(() => {
    const onPopState = () => {
      const state = parseUrlState();
      setTab(state.tab);
      // compareSel は null にするとデフォルト解決前の状態に戻ってしまうため、値がある場合のみ反映
      if (state.compareSel) setCompareSel(state.compareSel);
      setSelectedCommit(state.selectedCommit);
      setFileTarget(state.fileTarget);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // diff 内の「ファイルを開く」→ ファイルビューへジャンプ
  const openFileAt = useCallback(
    (ref: string) => (path: string, line?: number) => {
      setFileTarget({ ref, path, line });
      setTab('files');
    },
    [],
  );

  const jumpToScope = useCallback((scope: string) => {
    if (scope === 'working') {
      setTab('working');
    } else if (scope.startsWith('compare:')) {
      const [base, head] = scope.slice('compare:'.length).split('...');
      if (base && head) setCompareSel({ base, head });
      setTab('compare');
    } else if (scope.startsWith('commit:')) {
      setSelectedCommit(scope.slice('commit:'.length));
      setTab('history');
    }
  }, []);

  if (error) {
    return (
      <div className="app-error">
        <h1>diff-reviewer</h1>
        <p className="error">{error}</p>
        <p>サーバー（server workspace）が起動しているか確認してください。</p>
      </div>
    );
  }

  if (!repo || !compareSel) {
    return <div className="empty-state">読み込み中…</div>;
  }

  return (
    <ThemeContext.Provider value={theme}>
    <WorkerPoolContextProvider
      poolOptions={{ workerFactory }}
      highlighterOptions={{ theme: DIFF_THEMES }}
    >
    <div className="app">
      <header className="app-header">
        <span className="app-logo">diff-reviewer</span>
        <span className="repo-name">
          {repo.name} <code className="branch-chip">{repo.currentBranch}</code>
        </span>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? 'active' : ''}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <button className="btn btn-small theme-btn" onClick={cycleTheme} title="テーマ切り替え">
          {THEME_LABEL[themePref]}
        </button>
      </header>
      <main className="app-main">
        {tab === 'working' && <WorkingView onOpenFile={openFileAt} />}
        {tab === 'compare' && (
          <CompareView
            repo={repo}
            selection={compareSel}
            onChangeSelection={setCompareSel}
            onOpenFile={openFileAt}
          />
        )}
        {tab === 'history' && (
          <HistoryView
            selectedSha={selectedCommit}
            onSelect={setSelectedCommit}
            onOpenFile={openFileAt}
          />
        )}
        {tab === 'files' && (
          <FilesView repo={repo} target={fileTarget} onChangeTarget={setFileTarget} />
        )}
        {tab === 'comments' && <CommentsView onJumpToScope={jumpToScope} />}
      </main>
    </div>
    </WorkerPoolContextProvider>
    </ThemeContext.Provider>
  );
}
