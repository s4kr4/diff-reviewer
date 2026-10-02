// 文字列の内容ハッシュ（cyrb53）。
// @pierre/diffs は diff やファイル内容の同一性を cacheKey で判定し、Worker Pool の
// ハイライト結果もこのキーで保持する。ファイルパスだけをキーにすると内容が変わっても
// 同じ diff と見なされ、古い描画結果が使われ続けるため、内容から導出したキーを付ける。
// 暗号学的な強度は不要で、同期的に高速に計算できることを優先している。

export interface Hasher {
  update(chunk: string): Hasher;
  digest(): string;
}

export function createHasher(seed = 0): Hasher {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  const hasher: Hasher = {
    update(chunk) {
      for (let i = 0; i < chunk.length; i++) {
        const ch = chunk.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
      }
      return hasher;
    },
    digest() {
      let a = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
      a ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
      let b = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
      b ^= Math.imul(a ^ (a >>> 13), 3266489909);
      return (4294967296 * (2097151 & b) + (a >>> 0)).toString(36);
    },
  };
  return hasher;
}

export function hashString(str: string): string {
  return createHasher().update(str).digest();
}
