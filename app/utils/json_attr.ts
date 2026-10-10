/** Cột JSON của Lucid. fallback không bị sửa tại chỗ. */
export function jsonAttr<T>(fallback: T) {
  return {
    prepare: (v: T | null) => JSON.stringify(v == null ? fallback : v),
    consume: (v: unknown): T => {
      if (typeof v === 'string') {
        try {
          return JSON.parse(v) as T
        } catch {
          return structuredClone(fallback)
        }
      }
      if (v == null) return structuredClone(fallback)
      return v as T
    },
  }
}
