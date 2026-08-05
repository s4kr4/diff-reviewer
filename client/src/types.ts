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
  createdAt: string;
  updatedAt: string;
}

export interface FileTarget {
  ref: string;
  path: string;
  line?: number;
}
