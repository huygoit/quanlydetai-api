import fs from 'node:fs/promises'
import zlib from 'node:zlib'
import { promisify } from 'node:util'

const inflateRaw = promisify(zlib.inflateRaw)

/**
 * Đọc word/document.xml từ file DOCX (ZIP) — không thêm dependency.
 * Hỗ trợ nén store (0) và deflate (8).
 */
export async function readDocxDocumentXml(filePath: string): Promise<string> {
  const data = await fs.readFile(filePath)
  const target = 'word/document.xml'
  let offset = 0

  while (offset < data.length - 30) {
    if (data.readUInt32LE(offset) !== 0x04034b50) {
      offset += 1
      continue
    }

    const compression = data.readUInt16LE(offset + 8)
    const compressedSize = data.readUInt32LE(offset + 18)
    const nameLen = data.readUInt16LE(offset + 26)
    const extraLen = data.readUInt16LE(offset + 28)
    const name = data.subarray(offset + 30, offset + 30 + nameLen).toString('utf8')
    const dataStart = offset + 30 + nameLen + extraLen

    if (name === target) {
      if (!compressedSize) {
        throw new Error('DOCX dùng data descriptor — không đọc được kích thước nén.')
      }
      const compressed = data.subarray(dataStart, dataStart + compressedSize)
      if (compression === 0) return compressed.toString('utf8')
      if (compression === 8) {
        const inflated = await inflateRaw(compressed)
        return inflated.toString('utf8')
      }
      throw new Error(`Phương thức nén DOCX không hỗ trợ: ${compression}`)
    }

    offset = dataStart + (compressedSize || 1)
  }

  throw new Error('Không tìm thấy word/document.xml trong file DOCX.')
}

/** Ghép mọi <w:t> để biến {{...}} không bị Word tách XML. */
export function extractPlainTextFromDocumentXml(xml: string): string {
  const parts: string[] = []
  const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    parts.push(decodeXmlEntities(m[1] || ''))
  }
  return parts.join('')
}

function decodeXmlEntities(s: string): string {
  return s
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
}

/** Quét {{ten_bien}} trong DOCX. */
export async function detectDocxPlaceholders(filePath: string): Promise<string[]> {
  const xml = await readDocxDocumentXml(filePath)
  const text = extractPlainTextFromDocumentXml(xml)
  const keys = new Set<string>()
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    keys.add(m[1]!)
  }
  return [...keys].sort()
}
