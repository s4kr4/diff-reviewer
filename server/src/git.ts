import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';

const execFileP = promisify(execFile);
const MAX_BUFFER = 256 * 1024 * 1024;

export interface CommitInfo {
  sha: string;
  parents: string[];
  author: string;
  email: string;
  date: string;
  subject: string;
  body: string;
}

export async function git(
  repo: string,
  args: string[],
  allowExitCodes: number[] = [],
): Promise<string> {
  try {
    const { stdout } = await execFileP('git', ['-C', repo, ...args], {
      maxBuffer: MAX_BUFFER,
    });
    return stdout;
  } catch (err: any) {
    if (typeof err?.code === 'number' && allowExitCodes.includes(err.code)) {
      return err.stdout ?? '';
    }
    throw new Error(err?.stderr?.trim() || err?.message || 'git command failed');
  }
}

async function gitBuffer(repo: string, args: string[]): Promise<Buffer> {
  const { stdout } = await execFileP('git', ['-C', repo, ...args], {
    maxBuffer: MAX_BUFFER,
    encoding: 'buffer',
  });
  return stdout as unknown as Buffer;
}

// refs や path がオプションとして解釈されるのを防ぐ
export function assertSafeRef(ref: string): void {
  if (!ref || ref.startsWith('-')) throw new Error(`invalid ref: ${ref}`);
}

export function assertSafePath(p: string): void {
  if (!p || p.startsWith('-') || p.split('/').includes('..')) {
    throw new Error(`invalid path: ${p}`);
  }
}

export async function repoInfo(repo: string) {
  const root = (await git(repo, ['rev-parse', '--show-toplevel'])).trim();
  const gitDir = (await git(repo, ['rev-parse', '--absolute-git-dir'])).trim();
  const currentBranch = (await git(repo, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
  const branchesOut = await git(repo, [
    'for-each-ref',
    'refs/heads',
    'refs/remotes',
    '--format=%(refname:short)',
    '--sort=-committerdate',
  ]);
  const branches = branchesOut.split('\n').filter(Boolean).filter((b) => !b.endsWith('/HEAD'));
  return { root, gitDir, name: path.basename(root), currentBranch, branches };
}

// 作業ツリー全体の差分（staged + unstaged + untracked）
export async function workingDiff(repo: string): Promise<string> {
  let patch = '';
  try {
    patch = await git(repo, ['diff', 'HEAD', '--no-color', '--find-renames'], [1]);
  } catch {
    // HEAD が無い（コミット0件の）リポジトリ
    patch = await git(repo, ['diff', '--no-color'], [1]);
  }
  const untrackedOut = await git(repo, ['ls-files', '--others', '--exclude-standard', '-z']);
  const untracked = untrackedOut.split('\0').filter(Boolean);
  for (const file of untracked) {
    // --no-index は差分があると exit code 1 を返す
    patch += await git(
      repo,
      ['diff', '--no-color', '--no-index', '--', '/dev/null', file],
      [1],
    );
  }
  return patch;
}

const LOG_FORMAT = '%H%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%b%x1e';

function parseLog(out: string): CommitInfo[] {
  return out
    .split('\x1e')
    .map((s) => s.replace(/^\n/, ''))
    .filter((s) => s.trim())
    .map((rec) => {
      const [sha, parents, author, email, date, subject, body = ''] = rec.split('\x1f');
      return {
        sha,
        parents: parents ? parents.split(' ').filter(Boolean) : [],
        author,
        email,
        date,
        subject,
        body: body.trim(),
      };
    });
}

export async function compare(repo: string, base: string, head: string) {
  assertSafeRef(base);
  assertSafeRef(head);
  const patch = await git(repo, [
    'diff',
    '--no-color',
    '--find-renames',
    `${base}...${head}`,
  ]);
  const commitsOut = await git(repo, [
    'log',
    `--format=${LOG_FORMAT}`,
    `${base}..${head}`,
  ]);
  // 3点ドット比較の old 側スナップショット。unrelated histories では存在しない
  let mergeBase: string | null = null;
  try {
    mergeBase = (await git(repo, ['merge-base', base, head])).trim() || null;
  } catch {}
  return { patch, commits: parseLog(commitsOut), mergeBase };
}

export async function log(repo: string, ref: string, skip: number, limit: number) {
  assertSafeRef(ref);
  const out = await git(repo, [
    'log',
    `--format=${LOG_FORMAT}`,
    `--skip=${skip}`,
    `-n`,
    String(limit),
    ref,
  ]);
  return parseLog(out);
}

export async function commitDetail(repo: string, sha: string) {
  assertSafeRef(sha);
  const metaOut = await git(repo, ['log', '-1', `--format=${LOG_FORMAT}`, sha]);
  const [commit] = parseLog(metaOut);
  const patch = await git(repo, [
    'diff-tree',
    '--patch',
    '--root',
    '--no-commit-id',
    '--find-renames',
    '--no-color',
    '-r',
    sha,
  ]);
  return { commit, patch };
}

// WORKING は「作業ツリーの現状」を表す仮想 ref
export async function listTree(repo: string, ref: string): Promise<string[]> {
  if (ref === 'WORKING') {
    const out = await git(repo, [
      'ls-files',
      '--cached',
      '--others',
      '--exclude-standard',
      '-z',
    ]);
    return [...new Set(out.split('\0').filter(Boolean))].sort();
  }
  assertSafeRef(ref);
  const out = await git(repo, ['ls-tree', '-r', '-z', '--name-only', ref]);
  return out.split('\0').filter(Boolean);
}

export async function fileContent(repo: string, ref: string, filePath: string) {
  assertSafePath(filePath);
  let buf: Buffer;
  if (ref === 'WORKING') {
    const root = (await git(repo, ['rev-parse', '--show-toplevel'])).trim();
    const abs = path.resolve(root, filePath);
    if (!abs.startsWith(root + path.sep)) throw new Error('path escapes repository');
    buf = await fs.readFile(abs);
  } else {
    assertSafeRef(ref);
    buf = await gitBuffer(repo, ['show', `${ref}:${filePath}`]);
  }
  const binary = buf.subarray(0, 8192).includes(0);
  return {
    binary,
    size: buf.length,
    content: binary ? '' : buf.toString('utf8'),
  };
}
