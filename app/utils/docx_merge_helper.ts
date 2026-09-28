import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import env from '#start/env'
import {
  listUploadRootCandidates,
  normalizePathPart,
  normalizePublicBasePath,
  resolveWritableUploadRoot,
} from '#utils/upload_storage_helper'

export const GENERATED_CONTRACTS_DIR = 'project-contracts'

export function buildPublicGeneratedContractUrl(filename: string): string {
  const publicBasePath = normalizePublicBasePath(
    env.get('UPLOAD_PUBLIC_BASE_PATH') || '/storage'
  )
  return `${publicBasePath}/${normalizePathPart(GENERATED_CONTRACTS_DIR)}/${filename}`
}

export async function resolveGeneratedContractDir(): Promise<string> {
  const root = await resolveWritableUploadRoot()
  const dir = path.join(root, GENERATED_CONTRACTS_DIR)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

export async function findGeneratedContractFilePath(filename: string): Promise<string | null> {
  for (const root of listUploadRootCandidates()) {
    const filePath = path.join(root, GENERATED_CONTRACTS_DIR, filename)
    try {
      await fs.access(filePath)
      return filePath
    } catch {
      // tiếp
    }
  }
  return null
}

/**
 * Merge biến {{key}} vào DOCX template → ghi file mới.
 */
export async function mergeDocxTemplate(params: {
  templatePath: string
  data: Record<string, string>
  outputFileName?: string
}): Promise<{
  storedFileName: string
  fileUrl: string
  fileSize: number
  fullPath: string
}> {
  const content = await fs.readFile(params.templatePath, 'binary')
  const zip = new PizZip(content)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
    nullGetter: () => '',
  })

  doc.render(params.data)

  const buf = doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  }) as Buffer

  const dir = await resolveGeneratedContractDir()
  const stored = params.outputFileName || `${Date.now()}-${randomUUID()}.docx`
  const fullPath = path.join(dir, stored)
  await fs.writeFile(fullPath, buf)
  const stat = await fs.stat(fullPath)

  return {
    storedFileName: stored,
    fileUrl: buildPublicGeneratedContractUrl(stored),
    fileSize: stat.size,
    fullPath,
  }
}
