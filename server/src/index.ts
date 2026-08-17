import express from 'express';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  commitDetail,
  compare,
  fileContent,
  git,
  listTree,
  log,
  repoInfo,
  workingDiff,
} from './git.js';
import { CommentStore } from './comments.js';

const usage = 'usage: pnpm start [repo-path] [--port <port>] [--open]';

function parseCli() {
  try {
    return parseArgs({
      options: {
        port: { type: 'string', short: 'p' },
        open: { type: 'boolean' },
      },
      allowPositionals: true,
    });
  } catch (err: any) {
    console.error(`error: ${err?.message || String(err)}`);
    console.error(usage);
    process.exit(1);
  }
}
const cli = parseCli();

const PORT = Number(cli.values.port ?? 8080);
if (!Number.isInteger(PORT) || PORT <= 0) {
  console.error(`error: --port の値が不正です: ${cli.values.port}`);
  console.error(usage);
  process.exit(1);
}
// pnpm 経由では cwd がパッケージディレクトリになるため、コマンド実行元（INIT_CWD）を基準に解決する
const invokeDir = process.env.INIT_CWD || process.cwd();
const repo = path.resolve(invokeDir, cli.positionals[0] || '.');
const openBrowser = cli.values.open === true;

// 起動時にリポジトリとして有効かを検証する
let gitDir: string;
try {
  gitDir = (await git(repo, ['rev-parse', '--absolute-git-dir'])).trim();
} catch {
  console.error(`error: ${repo} は git リポジトリではありません`);
  console.error(usage);
  process.exit(1);
}

const comments = new CommentStore(path.join(gitDir, 'diff-reviewer-comments.json'));

const app = express();
app.use(express.json());

type Handler = (req: express.Request, res: express.Response) => Promise<void>;
const wrap =
  (fn: Handler): express.RequestHandler =>
  async (req, res) => {
    try {
      await fn(req, res);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || String(err) });
    }
  };

app.get(
  '/api/repo',
  wrap(async (_req, res) => {
    res.json(await repoInfo(repo));
  }),
);

app.get(
  '/api/working-diff',
  wrap(async (_req, res) => {
    res.json({ patch: await workingDiff(repo) });
  }),
);

app.get(
  '/api/compare',
  wrap(async (req, res) => {
    const base = String(req.query.base || '');
    const head = String(req.query.head || '');
    res.json(await compare(repo, base, head));
  }),
);

app.get(
  '/api/commits',
  wrap(async (req, res) => {
    const ref = String(req.query.ref || 'HEAD');
    const skip = Number(req.query.skip || 0);
    const limit = Math.min(Number(req.query.limit || 50), 200);
    res.json({ commits: await log(repo, ref, skip, limit) });
  }),
);

app.get(
  '/api/commit/:sha',
  wrap(async (req, res) => {
    res.json(await commitDetail(repo, req.params.sha));
  }),
);

app.get(
  '/api/tree',
  wrap(async (req, res) => {
    const ref = String(req.query.ref || 'WORKING');
    res.json({ files: await listTree(repo, ref) });
  }),
);

app.get(
  '/api/file',
  wrap(async (req, res) => {
    const ref = String(req.query.ref || 'WORKING');
    const p = String(req.query.path || '');
    res.json(await fileContent(repo, ref, p));
  }),
);

app.get(
  '/api/comments',
  wrap(async (req, res) => {
    const scope = req.query.scope ? String(req.query.scope) : undefined;
    res.json({ comments: comments.list(scope) });
  }),
);

app.post(
  '/api/comments',
  wrap(async (req, res) => {
    const { scope, file, side, line, body } = req.body ?? {};
    if (!scope || !file || !side || typeof line !== 'number' || !body) {
      res.status(400).json({ error: 'scope, file, side, line, body は必須です' });
      return;
    }
    res.json(comments.add({ scope, file, side, line, body }));
  }),
);

app.put(
  '/api/comments/:id',
  wrap(async (req, res) => {
    const { body } = req.body ?? {};
    if (!body) {
      res.status(400).json({ error: 'body は必須です' });
      return;
    }
    res.json(comments.update(req.params.id, body));
  }),
);

app.delete(
  '/api/comments/:id',
  wrap(async (req, res) => {
    comments.remove(req.params.id);
    res.json({ ok: true });
  }),
);

// ビルド済みクライアントがあれば配信する（本番モード）
const clientDist = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../client/dist',
);
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`diff-reviewer: repo=${repo}`);
  console.log(`diff-reviewer: ${url}`);
  if (!fs.existsSync(clientDist)) {
    console.log('diff-reviewer: client/dist が無いため API のみ提供中（開発時は Vite 側 http://localhost:5173 を開く）');
  }
  // --open のときブラウザで開いてアクティブにする
  // （dev モードは tsx watch が再起動のたびに実行するため既定では開かない）
  if (openBrowser) {
    const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
    spawn(opener, [url], { detached: true, stdio: 'ignore' }).on('error', () => {
      console.log(`diff-reviewer: ブラウザを開けませんでした（${opener} が失敗）`);
    });
  }
});
