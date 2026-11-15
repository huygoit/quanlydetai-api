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
/** Mốc chèn bảng tiến độ / nguồn KP trong hợp đồng BM-02.14 */
export const DAU_BANG_TIEN_DO = '___BANG_TIEN_DO___'
export const DAU_BANG_NGUON_KINH_PHI = '___BANG_NGUON_KINH_PHI___'

export type HangBangNhiemVu = {
  stt: string
  tenNhiemVu: string
  mucTieu: string
  sanPhamDuKien: string
  thoiGianThucHien: string
}

export type HangBangTienDo = {
  stt: string
  noiDung: string
  thoiGian: string
  sanPham: string
}

export type HangBangNguonKinhPhi = {
  nguon: string
  soTien: string
  dam?: boolean
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
        // w:sz tính half-point → 26 = 13pt
        `<w:p><w:pPr><w:spacing w:before="40" w:after="40"/>${jc}</w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>${b}<w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t xml:space="preserve">${thoatXml(line)}</w:t></w:r></w:p>`
    )
    .join('')
}

function oBang(text: string, rong: number, dam: boolean, canGiua: boolean, nen?: string) {
  const shd = nen ? `<w:shd w:val="clear" w:color="auto" w:fill="${nen}"/>` : ''
  const bien = (canh: string) =>
    `<w:${canh} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`
  return `<w:tc><w:tcPr><w:tcW w:w="${rong}" w:type="dxa"/><w:tcBorders>${bien('top')}${bien('left')}${bien('bottom')}${bien('right')}</w:tcBorders>${shd}<w:vAlign w:val="center"/></w:tcPr>${doanTrongO(text, dam, canGiua)}</w:tc>`
}

function xmlKhungBang(cot: number[], hangTieuDe: string, hangDuLieu: string) {
  const tong = cot.reduce((a, b) => a + b, 0)
  const luoi = cot.map((c) => `<w:gridCol w:w="${c}"/>`).join('')
  return `<w:tbl><w:tblPr><w:tblW w:w="${tong}" w:type="dxa"/><w:jc w:val="center"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/></w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${luoi}</w:tblGrid>${hangTieuDe}${hangDuLieu}</w:tbl>`
}

/** Bảng danh mục nhiệm vụ, gồm dòng tiêu đề và các hàng dữ liệu. */
export function xmlBangNhiemVu(hang: HangBangNhiemVu[]): string {
  const cot = [780, 2500, 2500, 2320, 1254]
  const tong = cot.reduce((a, b) => a + b, 0)
  const tieuDe = ['STT', 'Tên nhiệm vụ', 'Mục tiêu', 'Sản phẩm dự kiến', 'Thời gian thực hiện']
  const hangTieuDe = `<w:tr>${tieuDe.map((t, i) => oBang(t, cot[i]!, true, true, 'F2F2F2')).join('')}</w:tr>`
  const hangDuLieu = hang.length
    ? hang
        .map(
          (h) =>
            `<w:tr>${oBang(h.stt, cot[0]!, false, true)}${oBang(h.tenNhiemVu, cot[1]!, false, false)}${oBang(h.mucTieu, cot[2]!, false, false)}${oBang(h.sanPhamDuKien, cot[3]!, false, false)}${oBang(h.thoiGianThucHien, cot[4]!, false, true)}</w:tr>`
        )
        .join('')
    : `<w:tr><w:tc><w:tcPr><w:tcW w:w="${tong}" w:type="dxa"/><w:gridSpan w:val="5"/><w:vAlign w:val="center"/></w:tcPr>${doanTrongO('Chưa có nhiệm vụ.', false, true)}</w:tc></w:tr>`
  return xmlKhungBang(cot, hangTieuDe, hangDuLieu)
}

/** Bảng tiến độ thực hiện hợp đồng (STT | Nội dung | Thời gian | Sản phẩm). */
export function xmlBangTienDo(hang: HangBangTienDo[]): string {
  const cot = [700, 3800, 2200, 2654]
  const tong = cot.reduce((a, b) => a + b, 0)
  const tieuDe = ['STT', 'Nội dung công việc', 'Thời gian thực hiện', 'Sản phẩm/kết quả']
  const hangTieuDe = `<w:tr>${tieuDe.map((t, i) => oBang(t, cot[i]!, true, true, 'F2F2F2')).join('')}</w:tr>`
  const hangDuLieu = hang.length
    ? hang
        .map(
          (h) =>
            `<w:tr>${oBang(h.stt, cot[0]!, false, true)}${oBang(h.noiDung || '—', cot[1]!, false, false)}${oBang(h.thoiGian || '—', cot[2]!, false, true)}${oBang(h.sanPham || '—', cot[3]!, false, false)}</w:tr>`
        )
        .join('')
    : `<w:tr><w:tc><w:tcPr><w:tcW w:w="${tong}" w:type="dxa"/><w:gridSpan w:val="4"/><w:vAlign w:val="center"/></w:tcPr>${doanTrongO('Chưa có tiến độ.', false, true)}</w:tc></w:tr>`
  return xmlKhungBang(cot, hangTieuDe, hangDuLieu)
}

/** Bảng nguồn kinh phí (Nguồn | Số tiền), có dòng tổng. */
export function xmlBangNguonKinhPhi(hang: HangBangNguonKinhPhi[]): string {
  const cot = [6200, 3154]
  const tieuDe = ['Nguồn kinh phí', 'Số tiền']
  const hangTieuDe = `<w:tr>${tieuDe.map((t, i) => oBang(t, cot[i]!, true, true, 'F2F2F2')).join('')}</w:tr>`
  const hangDuLieu = hang
    .map(
      (h) =>
        `<w:tr>${oBang(h.nguon, cot[0]!, !!h.dam, false, h.dam ? 'F8F8F8' : undefined)}${oBang(h.soTien, cot[1]!, !!h.dam, true, h.dam ? 'F8F8F8' : undefined)}</w:tr>`
    )
    .join('')
  return xmlKhungBang(cot, hangTieuDe, hangDuLieu || hangTieuDe)
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

/** Thay đoạn chứa mốc bằng XML bảng. `batBuoc=false` → bỏ qua nếu không có mốc. */
export function chenBangTheoMoc(
  docx: Buffer,
  moc: string,
  xmlBang: string,
  batBuoc = true
): Buffer {
  const zip = new PizZip(docx)
  const file = zip.file('word/document.xml')
  if (!file) {
    if (batBuoc) throw new Error('TEMPLATE_RENDER_FAILED')
    return docx
  }
  const xml = file.asText()
  const viTri = xml.indexOf(moc)
  if (viTri < 0) {
    if (batBuoc) throw new Error('TEMPLATE_RENDER_FAILED')
    return docx
  }
  const dauDoan = timDauDoanVan(xml, viTri)
  const hetDoan = xml.indexOf('</w:p>', viTri)
  if (dauDoan < 0 || hetDoan < 0) {
    if (batBuoc) throw new Error('TEMPLATE_RENDER_FAILED')
    return docx
  }
  const moi = xml.slice(0, dauDoan) + xmlBang + xml.slice(hetDoan + '</w:p>'.length)
  zip.file('word/document.xml', moi)
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer
}

/**
 * Thay đoạn chứa mốc đánh dấu bằng bảng Word.
 * Mốc được đổ qua {{danh_sach_nhiem_vu}} để nằm đúng vị trí trong mẫu.
 */
export function chenBangNhiemVu(docx: Buffer, hang: HangBangNhiemVu[]): Buffer {
  return chenBangTheoMoc(docx, DAU_BANG_NHIEM_VU, xmlBangNhiemVu(hang), true)
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
 * Có thể chèn bảng Word thật tại mốc bang_tien_do / bang_nguon_kinh_phi.
 */
export async function mergeDocxTemplate(params: {
  templatePath: string
  data: Record<string, string>
  outputFileName?: string
  bangTienDo?: HangBangTienDo[]
  bangNguonKinhPhi?: HangBangNguonKinhPhi[]
}): Promise<{
  storedFileName: string
  fileUrl: string
  fileSize: number
  fullPath: string
}> {
  const data = { ...params.data }
  if (params.bangTienDo) data.bang_tien_do = DAU_BANG_TIEN_DO
  if (params.bangNguonKinhPhi) data.bang_nguon_kinh_phi = DAU_BANG_NGUON_KINH_PHI

  let buf = await renderDocxBuffer(params.templatePath, data)
  if (params.bangTienDo) {
    buf = chenBangTheoMoc(buf, DAU_BANG_TIEN_DO, xmlBangTienDo(params.bangTienDo), false)
  }
  if (params.bangNguonKinhPhi) {
    buf = chenBangTheoMoc(
      buf,
      DAU_BANG_NGUON_KINH_PHI,
      xmlBangNguonKinhPhi(params.bangNguonKinhPhi),
      false
    )
  }

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
