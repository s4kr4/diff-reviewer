import WorkerUrl from '@pierre/diffs/worker/worker.js?worker&url';

// @pierre/diffs の Worker Pool 用ファクトリー。
// シンタックスハイライトをメインスレッドから Web Worker に移して UI の固まりを防ぐ
export function workerFactory(): Worker {
  return new Worker(WorkerUrl, { type: 'module' });
}
