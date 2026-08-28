import { useEffect, useMemo, useRef, useState } from 'react';

interface Props {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
}

// 入力欄でブランチ名をインクリメンタルサーチして選択するコンボボックス
export function BranchPicker({ value, options, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return options;
    return options.filter((o) => terms.every((t) => o.toLowerCase().includes(t)));
  }, [options, query]);

  // ハイライト中の候補がリストの表示範囲外に出たら追従してスクロールする
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const openList = () => {
    if (open) return;
    setQuery('');
    setActive(Math.max(0, options.indexOf(value)));
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const select = (branch: string) => {
    if (branch !== value) onChange(branch);
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) openList();
        else setActive((i) => Math.min(filtered.length - 1, i + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (open) setActive((i) => Math.max(0, i - 1));
        break;
      case 'Enter':
        if (open && filtered[active] !== undefined) {
          e.preventDefault();
          select(filtered[active]);
        }
        break;
      case 'Escape':
        if (open) {
          e.preventDefault();
          close();
        }
        break;
    }
  };

  return (
    <div className="branch-picker">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        spellCheck={false}
        placeholder={placeholder}
        title={value}
        // 閉じている間は選択中のブランチ名、開いている間は検索文字列を表示する
        value={open ? query : value}
        onFocus={openList}
        onClick={openList}
        onBlur={close}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul className="branch-picker-list" role="listbox" ref={listRef}>
          {filtered.length === 0 && (
            <li className="branch-picker-empty">一致するブランチがありません</li>
          )}
          {filtered.map((branch, i) => (
            <li
              key={branch}
              role="option"
              aria-selected={branch === value}
              className={[
                i === active ? 'active' : '',
                branch === value ? 'selected' : '',
              ].join(' ')}
              title={branch}
              // 入力欄の blur より先に選択を確定させる（blur で閉じてクリックが無効になるのを防ぐ）
              onMouseDown={(e) => {
                e.preventDefault();
                select(branch);
              }}
              onMouseEnter={() => setActive(i)}
            >
              {branch}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
