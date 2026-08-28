// パス文字列の一覧からディレクトリツリーを構築する共通ロジック

export interface FileTreeNode<T> {
  /** 表示名。ディレクトリ圧縮時は "a/b" のように複数階層を含む */
  name: string;
  /** ルートからのパス（ルートは空文字） */
  path: string;
  /** ディレクトリ優先・名前順にソート済みの子ノード */
  children: FileTreeNode<T>[];
  /** ファイルノードの場合に元の要素を保持する。ディレクトリでは undefined */
  item?: T;
}

export interface BuildFileTreeOptions {
  /** 子がディレクトリ1つだけのディレクトリを "a/b" のようにまとめる */
  compactDirs?: boolean;
}

interface MutableNode<T> {
  name: string;
  path: string;
  children: Map<string, MutableNode<T>>;
  item?: T;
}

export function isFileNode<T>(node: FileTreeNode<T>): node is FileTreeNode<T> & { item: T } {
  return node.item !== undefined;
}

export function buildFileTree<T>(
  items: readonly T[],
  getPath: (item: T) => string,
  options: BuildFileTreeOptions = {},
): FileTreeNode<T> {
  const root: MutableNode<T> = { name: '', path: '', children: new Map() };
  for (const item of items) {
    const parts = getPath(item).split('/');
    let node = root;
    parts.forEach((part, i) => {
      let child = node.children.get(part);
      if (!child) {
        child = { name: part, path: parts.slice(0, i + 1).join('/'), children: new Map() };
        node.children.set(part, child);
      }
      if (i === parts.length - 1) child.item = item;
      node = child;
    });
  }
  return finalize(root, options.compactDirs ?? false);
}

function finalize<T>(node: MutableNode<T>, compactDirs: boolean): FileTreeNode<T> {
  let name = node.name;
  let current = node;
  // ルート以外のディレクトリで、子がディレクトリ1つだけなら表示名を連結して1階層にまとめる
  if (compactDirs && node.path !== '') {
    while (current.item === undefined && current.children.size === 1) {
      const only = current.children.values().next().value as MutableNode<T>;
      if (only.item !== undefined) break;
      name = `${name}/${only.name}`;
      current = only;
    }
  }
  const children = [...current.children.values()].map((c) => finalize(c, compactDirs));
  children.sort((a, b) => {
    const aFile = a.item !== undefined;
    const bFile = b.item !== undefined;
    if (aFile !== bFile) return aFile ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
  return { name, path: current.path, children, item: current.item };
}
