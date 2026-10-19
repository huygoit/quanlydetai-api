import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import { htmlSangOoxml } from '#utils/html_sang_ooxml'
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

const DAU_BANG_NHIEM_VU = '___BANG_NHIEM_VU___'
const DAU_NOI_DUNG = '___NOI_DUNG_HTML___'

export type HangBangNhiemVu = {
  stt: string
  tenNhiemVu: string
  mucTieu: string
  sanPhamDuKien: string
  thoiGianThucHien: string
}

function thoatXml(s: string) {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function doanTrongO(text: string, dam: boolean, canGiua: boolean) {
  const jc = canGiua ? '<w:jc w:val="center"/>' : ''
  const b = dam ? '<w:b/>' : ''
  const dong = (text || '').split('\n')
  if (!dong.length) dong.push('')
  return dong
    .map(
      (line) =>
        `<w:p><w:pPr><w:spacing w:before="40" w:after="40"/>${jc}</w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>${b}<w:sz w:val="21"/></w:rPr><w:t xml:space="preserve">${thoatXml(line)}</w:t></w:r></w:p>`
    )
    .join('')
}

function oBang(text: string, rong: number, dam: boolean, canGiua: boolean, nen?: string) {
  const shd = nen ? `<w:shd w:val="clear" w:color="auto" w:fill="${nen}"/>` : ''
  const bien = (canh: string) =>
    `<w:${canh} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`
  return `<w:tc><w:tcPr><w:tcW w:w="${rong}" w:type="dxa"/><w:tcBorders>${bien('top')}${bien('left')}${bien('bottom')}${bien('right')}</w:tcBorders>${shd}<w:vAlign w:val="center"/></w:tcPr>${doanTrongO(text, dam, canGiua)}</w:tc>`
}

/** Bảng danh mục nhiệm vụ, gồm dòng tiêu đề và các hàng dữ liệu. */
export function xmlBangNhiemVu(hang: HangBangNhiemVu[]): string {
  const cot = [780, 2500, 2500, 2320, 1254]
  const tong = cot.reduce((a, b) => a + b, 0)
  const tieuDe = ['STT', 'Tên nhiệm vụ', 'Mục tiêu', 'Sản phẩm dự kiến', 'Thời gian thực hiện']
  const hangTieuDe = `<w:tr>${tieuDe.map((t, i) => oBang(t, cot[i], true, true, 'F2F2F2')).join('')}</w:tr>`
  const hangDuLieu = hang.length
    ? hang
        .map(
          (h) =>
            `<w:tr>${oBang(h.stt, cot[0], false, true)}${oBang(h.tenNhiemVu, cot[1], false, false)}${oBang(h.mucTieu, cot[2], false, false)}${oBang(h.sanPhamDuKien, cot[3], false, false)}${oBang(h.thoiGianThucHien, cot[4], false, true)}</w:tr>`
        )
        .join('')
    : `<w:tr><w:tc><w:tcPr><w:tcW w:w="${tong}" w:type="dxa"/><w:gridSpan w:val="5"/><w:vAlign w:val="center"/></w:tcPr>${doanTrongO('Chưa có nhiệm vụ.', false, true)}</w:tc></w:tr>`
  const luoi = cot.map((c) => `<w:gridCol w:w="${c}"/>`).join('')
  return `<w:tbl><w:tblPr><w:tblW w:w="${tong}" w:type="dxa"/><w:jc w:val="center"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/></w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${luoi}</w:tblGrid>${hangTieuDe}${hangDuLieu}</w:tbl>`
}

/** `<w:p` thật, không nhầm với `<w:pPr`. */
function timDauDoanVan(xml: string, viTri: number) {
  let i = viTri
  while (i >= 0) {
    const j = xml.lastIndexOf('<w:p', i)
    if (j < 0) return -1
    const sau = xml[j + 4]
    if (sau === '>' || sau === ' ' || sau === '/' || sau === '\n' || sau === '\r' || sau === '\t') {
      return j
    }
    i = j - 1
  }
  return -1
}

/**
 * Thay đoạn chứa mốc đánh dấu bằng bảng Word.
 * Mốc được đổ qua {{danh_sach_nhiem_vu}} để nằm đúng vị trí trong mẫu.
 */
export function chenBangNhiemVu(docx: Buffer, hang: HangBangNhiemVu[]): Buffer {
  const zip = new PizZip(docx)
  const file = zip.file('word/document.xml')
  if (!file) throw new Error('TEMPLATE_RENDER_FAILED')
  const xml = file.asText()
  const viTri = xml.indexOf(DAU_BANG_NHIEM_VU)
  if (viTri < 0) throw new Error('TEMPLATE_RENDER_FAILED')
  const dauDoan = timDauDoanVan(xml, viTri)
  const hetDoan = xml.indexOf('</w:p>', viTri)
  if (dauDoan < 0 || hetDoan < 0) throw new Error('TEMPLATE_RENDER_FAILED')
  const moi = xml.slice(0, dauDoan) + xmlBangNhiemVu(hang) + xml.slice(hetDoan + '</w:p>'.length)
  zip.file('word/document.xml', moi)
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer
}

/**
 * Thay đoạn {{noi_dung}} bằng các đoạn Word giữ đậm, nghiêng, gạch chân và danh sách.
 */
export function chenNoiDungHtml(docx: Buffer, html: string): Buffer {
  const zip = new PizZip(docx)
  const file = zip.file('word/document.xml')
  if (!file) throw new Error('TEMPLATE_RENDER_FAILED')
  const xml = file.asText()
  const viTri = xml.indexOf(DAU_NOI_DUNG)
  if (viTri < 0) throw new Error('TEMPLATE_RENDER_FAILED')
  const dauDoan = timDauDoanVan(xml, viTri)
  const hetDoan = xml.indexOf('</w:p>', viTri)
  if (dauDoan < 0 || hetDoan < 0) throw new Error('TEMPLATE_RENDER_FAILED')
  const moi = xml.slice(0, dauDoan) + htmlSangOoxml(html) + xml.slice(hetDoan + '</w:p>'.length)
  zip.file('word/document.xml', moi)
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer
}

export { DAU_BANG_NHIEM_VU, DAU_NOI_DUNG }

/** Đổ biến {{key}} vào DOCX, trả về nội dung file (chưa ghi đĩa). */
export async function renderDocxBuffer(
  templatePath: string,
  data: Record<string, string>
): Promise<Buffer> {
  const content = await fs.readFile(templatePath, 'binary')
  const zip = new PizZip(content)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
    nullGetter: () => '',
  })
  doc.render(data)
  return doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  }) as Buffer
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
  const buf = await renderDocxBuffer(params.templatePath, params.data)

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
