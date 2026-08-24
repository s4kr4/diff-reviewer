import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';

const execFileP = promisify(execFile);

// LaunchServices 設定から既定ブラウザ（https ハンドラー）の bundle ID を取得する
async function defaultBrowserBundleId(): Promise<string | null> {
  const plist = path.join(
    os.homedir(),
    'Library/Preferences/com.apple.LaunchServices/com.apple.launchservices.secure.plist',
  );
  try {
    const { stdout } = await execFileP('plutil', ['-p', plist]);
    // plutil -p の出力はブロック内のキーがアルファベット順のため、
    // LSHandlerRoleAll は同一ブロックの LSHandlerURLScheme より先に現れる
    let roleAll: string | null = null;
    for (const line of stdout.split('\n')) {
      const role = line.match(/"LSHandlerRoleAll" => "([^"]+)"/);
      if (role) roleAll = role[1];
      if (line.includes('"LSHandlerURLScheme" => "https"')) return roleAll;
    }
  } catch {}
  return null;
}

// 新規ウィンドウで開くためのブラウザ固有フラグ。未知のブラウザは null
function newWindowFlag(bundleId: string): string | null {
  const id = bundleId.toLowerCase();
  if (id.startsWith('org.mozilla.firefox')) return '-new-window';
  const chromiumPrefixes = [
    'com.google.chrome',
    'com.vivaldi.vivaldi',
    'com.microsoft.edgemac',
    'com.brave.browser',
    'company.thebrowser.browser', // Arc
    'com.operasoftware.opera',
  ];
  if (chromiumPrefixes.some((p) => id.startsWith(p))) return '--new-window';
  return null;
}

// URL をブラウザで開く。macOS では既定ブラウザを判別し、フラグが分かる
// ブラウザ（Chromium 系 / Firefox）なら新規ウィンドウで開く。
// 判別できない場合（Safari 等）はブラウザ既定の挙動（通常はタブ）になる
export async function openInBrowser(url: string): Promise<void> {
  if (process.platform !== 'darwin') {
    await execFileP('xdg-open', [url]);
    return;
  }
  const bundleId = await defaultBrowserBundleId();
  const flag = bundleId ? newWindowFlag(bundleId) : null;
  if (bundleId && flag) {
    try {
      // open -n で --args 以降がブラウザに渡る。Chromium 系は起動済みでも
      // 既存プロセスへ転送されて新規ウィンドウが開く
      await execFileP('open', ['-n', '-b', bundleId, '--args', flag, url]);
      return;
    } catch {
      // アプリが見つからない等。既定の open にフォールバック
    }
  }
  await execFileP('open', [url]);
}
