/**
 * Chuẩn hoá trường link chứng chỉ (tuỳ chọn) trước khi ghi DB:
 * - Chuỗi rỗng => bỏ (undefined).
 * - Giới hạn độ dài để khớp validator `maxLength` và cột `text` trên DB.
 *
 * Lưu ý: không ép rule “phải là URL” ở đây vì presigned URL / link nội bộ có thể rất dài
 * hoặc có ký tự đặc biệt; phía giao diện vẫn nên ưu tiên link `https://...` hợp lệ.
 */
export function normalizeOptionalHttpUrl(value: unknown): string | undefined {
  if (value == null) return undefined
  const raw = String(value).trim()
  if (!raw) return undefined
  return raw.length > 2000 ? raw.slice(0, 2000) : raw
}
