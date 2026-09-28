import env from '#start/env'
import fs from 'node:fs/promises'
import path from 'node:path'
import {
  DEFAULT_UPLOAD_STORAGE_ROOT,
  listUploadRootCandidates,
  normalizePathPart,
  normalizePublicBasePath,
  resolveWritableUploadRoot,
} from '#utils/upload_storage_helper'

export const CONTRACT_TEMPLATES_DIR = 'contract-templates'

export function contractTemplateDirPath(rootDir: string) {
  return path.join(rootDir, CONTRACT_TEMPLATES_DIR)
}

export async function resolveContractTemplateDir(): Promise<string> {
  const root = await resolveWritableUploadRoot()
  const dir = contractTemplateDirPath(root)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

export async function findContractTemplateFilePath(filename: string): Promise<string | null> {
  for (const root of listUploadRootCandidates()) {
    const filePath = path.join(root, CONTRACT_TEMPLATES_DIR, filename)
    try {
      await fs.access(filePath)
      return filePath
    } catch {
      // thử path tiếp
    }
  }
  return null
}

export function buildPublicContractTemplateUrl(filename: string): string {
  const publicBasePath = normalizePublicBasePath(
    env.get('UPLOAD_PUBLIC_BASE_PATH') || '/storage'
  )
  return `${publicBasePath}/${normalizePathPart(CONTRACT_TEMPLATES_DIR)}/${filename}`
}

export function getDefaultStorageRootLabel() {
  return env.get('UPLOAD_STORAGE_ROOT') || DEFAULT_UPLOAD_STORAGE_ROOT
}
