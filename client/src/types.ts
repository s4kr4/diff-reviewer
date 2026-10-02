export interface RepoInfo {
  root: string;
  gitDir: string;
  name: string;
  currentBranch: string;
  branches: string[];
}

export interface CommitInfo {
  sha: string;
  parents: string[];
  author: string;
  email: string;
  date: string;
  subject: string;
  body: string;
}

export interface CommentItem {
  id: string;
  scope: string;
  file: string;
  side: 'old' | 'new';
  line: number;
  body: string;
  // スレッドのルートコメントの id。ルートコメント自身は null。返信も位置情報（scope 〜 line）をルートと同じ値で持つ
  parentId: string | null;
  // 投稿者。UI からの投稿は 'user'、エージェントからの返信は任意のラベル（例: 'Claude'）
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface FileTarget {
  ref: string;
  path: string;
  line?: number;
}
