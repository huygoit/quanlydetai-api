import env from '#start/env'
import fs from 'node:fs/promises'
import path from 'node:path'

export const DEFAULT_UPLOAD_STORAGE_ROOT = 'storage'
export const DEFAULT_UPLOAD_PROFILE_ATTACHMENTS_DIR = 'profile-attachments'
export const DEFAULT_UPLOAD_PUBLIC_BASE_PATH = '/storage'

export function normalizePathPart(value: string) {
  return value.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '')
}

export function normalizePublicBasePath(value: string) {
  const v = value.replaceAll('\\', '/').replace(/\/+$/g, '')
  return v.startsWith('/') ? v : `/${v}`
}

export function getUploadEnvConfig() {
  return {
    storageRoot: env.get('UPLOAD_STORAGE_ROOT') || DEFAULT_UPLOAD_STORAGE_ROOT,
    attachmentsDir:
      env.get('UPLOAD_PROFILE_ATTACHMENTS_DIR') || DEFAULT_UPLOAD_PROFILE_ATTACHMENTS_DIR,
    publicBasePath: normalizePublicBasePath(
      env.get('UPLOAD_PUBLIC_BASE_PATH') || DEFAULT_UPLOAD_PUBLIC_BASE_PATH
    ),
  }
}

/**
 * Các thư mục gốc có thể chứa file (upload có thể ghi cwd/build, GET phải dò đủ).
 */
export function listUploadRootCandidates(): string[] {
  const { storageRoot } = getUploadEnvConfig()
  if (path.isAbsolute(storageRoot)) {
    return [path.resolve(storageRoot)]
  }

  const cwd = process.cwd()
  const raw = [
    path.join(cwd, storageRoot),
    path.join(cwd, 'quanlydetai-api', storageRoot),
    path.join(cwd, '..', storageRoot),
    path.join(cwd, '..', 'quanlydetai-api', storageRoot),
  ]

  const seen = new Set<string>()
  const unique: string[] = []
  for (const c of raw) {
    const resolved = path.resolve(c)
    if (!seen.has(resolved)) {
      seen.add(resolved)
      unique.push(resolved)
    }
  }
  return unique
}

/** Thư mục gốc dùng khi ghi file mới (ưu tiên thư mục đã tồn tại / tạo được). */
export async function resolveWritableUploadRoot(): Promise<string> {
  const candidates = listUploadRootCandidates()
  for (const root of candidates) {
    try {
      await fs.mkdir(root, { recursive: true })
      await fs.access(root)
      return root
    } catch {
      // thử candidate tiếp
    }
  }
  return candidates[0]!
}

export function attachmentDirPath(rootDir: string): string {
  const { attachmentsDir } = getUploadEnvConfig()
  return path.join(rootDir, attachmentsDir)
}

export async function findAttachmentFilePath(filename: string): Promise<string | null> {
  const { attachmentsDir } = getUploadEnvConfig()
  for (const root of listUploadRootCandidates()) {
    const filePath = path.join(root, attachmentsDir, filename)
    try {
      await fs.access(filePath)
      return filePath
    } catch {
      // thử path tiếp
    }
  }
  return null
}

export function buildPublicAttachmentUrl(filename: string): string {
  const { publicBasePath, attachmentsDir } = getUploadEnvConfig()
  return `${publicBasePath}/${normalizePathPart(attachmentsDir)}/${filename}`
}
