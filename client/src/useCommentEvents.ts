import { useEffect, useRef } from 'react';

// サーバーからのコメント変更通知（Server-Sent Events）を購読し、変更のたびに onChange を呼ぶ。
// 切断後の再接続時にも onChange を呼び、切断中の変更を取りこぼさないようにする
export function useCommentEvents(onChange: () => void): void {
  // 最新のコールバックを参照しつつ、購読自体はマウント中 1 回だけにする
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const source = new EventSource('/api/comments/events');
    let connectedBefore = false;
    source.onopen = () => {
      if (connectedBefore) onChangeRef.current();
      connectedBefore = true;
    };
    source.onmessage = () => onChangeRef.current();
    return () => source.close();
  }, []);
}
