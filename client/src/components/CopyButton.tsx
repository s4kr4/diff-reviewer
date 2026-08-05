import { useEffect, useRef, useState } from 'react';

interface Props {
  text: string;
  title?: string;
}

export function CopyButton({ text, title = 'パスをコピー' }: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <button
      className={`copy-btn ${copied ? 'copied' : ''}`}
      title={title}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? '✓' : '⧉'}
    </button>
  );
}
