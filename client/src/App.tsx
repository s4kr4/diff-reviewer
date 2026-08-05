import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
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

export default function App() {
  const [repo, setRepo] = useState<RepoInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('working');
  const [compareSel, setCompareSel] = useState<CompareSelection | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [fileTarget, setFileTarget] = useState<FileTarget | null>(null);
  const { pref: themePref, resolved: theme, cycle: cycleTheme } = useTheme();

  useEffect(() => {
    api
      .repo()
      .then((info) => {
        setRepo(info);
        setCompareSel({
          base: guessBase(info),
          head: info.currentBranch !== 'HEAD' ? info.currentBranch : guessBase(info),
        });
      })
      .catch((err) => setError(err.message));
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
    </ThemeContext.Provider>
  );
}
