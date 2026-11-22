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

function doanTrongO(text: string, dam: boolean, canGiua: boolean, coChu = 26) {
  const jc = canGiua ? '<w:jc w:val="center"/>' : ''
  const b = dam ? '<w:b/><w:bCs/>' : ''
  const sz = String(coChu)
  const dong = (text || '').split('\n')
  if (!dong.length) dong.push('')
  return dong
    .map(
      (line) =>
        // w:sz tính half-point → 26 = 13pt
        `<w:p><w:pPr><w:spacing w:before="20" w:after="20"/>${jc}</w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/>${b}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${thoatXml(line)}</w:t></w:r></w:p>`
    )
    .join('')
}

function oBang(
  text: string,
  rong: number,
  dam: boolean,
  canGiua: boolean,
  nen?: string,
  coChu = 26
) {
  const shd = nen ? `<w:shd w:val="clear" w:color="auto" w:fill="${nen}"/>` : ''
  const bien = (canh: string) =>
    `<w:${canh} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`
  return `<w:tc><w:tcPr><w:tcW w:w="${rong}" w:type="dxa"/><w:tcBorders>${bien('top')}${bien('left')}${bien('bottom')}${bien('right')}</w:tcBorders>${shd}<w:vAlign w:val="center"/></w:tcPr>${doanTrongO(text, dam, canGiua, coChu)}</w:tc>`
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

export type OBangTuyChinh = {
  text: string
  dam?: boolean
  canGiua?: boolean
  nen?: string
}

const TONG_RONG_BANG = 9354

/** Chia đều bề rộng cột (dxa) theo số cột. */
export function chiaCotBang(soCot: number, tong = TONG_RONG_BANG): number[] {
  const n = Math.max(1, soCot)
  const base = Math.floor(tong / n)
  const cot = Array.from({ length: n }, () => base)
  cot[n - 1] = tong - base * (n - 1)
  return cot
}

/**
 * Sinh bảng Word từ tiêu đề + hàng dữ liệu (dùng chung BM-02.02 / hợp đồng).
 * Ô nhận chuỗi hoặc { text, dam, canGiua, nen }.
 */
export function xmlBangTuDuLieu(params: {
  headers: string[]
  rows: Array<Array<string | OBangTuyChinh>>
  colWidths?: number[]
  emptyText?: string
  /** Cột căn giữa (0-based); mặc định cột STT đầu tiên nếu header là STT/TT */
  centerCols?: number[]
  /** Cỡ chữ half-point (26 = 13pt). Ma trận kinh phí dùng ~16–18. */
  coChu?: number
  /** Nền dòng tiêu đề */
  nenTieuDe?: string
}): string {
  const headers = params.headers || []
  const coChu = params.coChu ?? 26
  const nenTd = params.nenTieuDe || 'D9E2F3'
  const cot = params.colWidths?.length === headers.length ? params.colWidths : chiaCotBang(headers.length)
  const tong = cot.reduce((a, b) => a + b, 0)
  const center = new Set(
    params.centerCols ??
      (headers[0] && /^(STT|TT)$/i.test(headers[0]) ? [0] : [])
  )
  // Cột số tiền thường căn giữa nếu header gợi ý
  headers.forEach((h, i) => {
    if (/số lượng|số tiền|đơn vị|thời gian|tổng số/i.test(h)) center.add(i)
  })

  const hangTieuDe = `<w:tr>${headers
    .map((t, i) => oBang(t, cot[i]!, true, true, nenTd, coChu))
    .join('')}</w:tr>`

  let hangDuLieu = ''
  if (!params.rows.length) {
    hangDuLieu = `<w:tr><w:tc><w:tcPr><w:tcW w:w="${tong}" w:type="dxa"/><w:gridSpan w:val="${headers.length}"/><w:vAlign w:val="center"/></w:tcPr>${doanTrongO(params.emptyText || 'Chưa có dữ liệu.', false, true, coChu)}</w:tc></w:tr>`
  } else {
    hangDuLieu = params.rows
      .map((row) => {
        const cells = headers
          .map((_, i) => {
            const raw = row[i]
            if (raw && typeof raw === 'object') {
              return oBang(
                raw.text ?? '',
                cot[i]!,
                !!raw.dam,
                raw.canGiua ?? center.has(i),
                raw.nen,
                coChu
              )
            }
            return oBang(String(raw ?? ''), cot[i]!, false, center.has(i), undefined, coChu)
          })
          .join('')
        return `<w:tr>${cells}</w:tr>`
      })
      .join('')
  }
  return xmlKhungBang(cot, hangTieuDe, hangDuLieu)
}

/** Mốc chèn bảng theo tên biến merge (vd bang_tien_do → ___BANG_bang_tien_do___). */
export function taoMocBang(bien: string) {
  return `___BANG_${bien}___`
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
 * Tìm vị trí mốc trong document.xml.
 * Word đôi khi tách chữ thành nhiều <w:t> — vẫn khớp bằng cách bỏ qua thẻ XML.
 */
function timViTriMoc(xml: string, moc: string): number {
  const thang = xml.indexOf(moc)
  if (thang >= 0) return thang
  let mi = 0
  let start = -1
  for (let i = 0; i < xml.length; i++) {
    const ch = xml[i]
    if (ch === '<') {
      const gt = xml.indexOf('>', i)
      if (gt < 0) break
      i = gt
      continue
    }
    if (ch === moc[mi]) {
      if (mi === 0) start = i
      mi++
      if (mi === moc.length) return start
    } else if (mi > 0) {
      i = start
      mi = 0
      start = -1
    }
  }
  return -1
}

/** Lấy chữ thuần từ mảnh OOXML (bỏ thẻ). */
function textThuanTuXml(xmlFrag: string): string {
  return xmlFrag
    .replace(/<w:tab[^/]*\/>/g, '\t')
    .replace(/<w:br[^/]*\/>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
}

/**
 * Giữ nhãn đứng trước mốc trong cùng đoạn (vd «Mục tiêu: {{muc_tieu}}»).
 * Trước đây thay cả <w:p> → mất nhãn, nội dung trông như thiếu/vỡ.
 */
function xmlDoanNhanTruocMoc(chu: string): string {
  const t = chu.replace(/\s+/g, ' ').trim()
  if (!t) return ''
  // Nhãn mục (Mục tiêu / Nội dung…): đậm + đủ bCs để Word locale VN hiện đúng
  return `<w:p><w:pPr><w:spacing w:before="120" w:after="40"/><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:b/><w:bCs/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t xml:space="preserve">${thoatXml(t)}</w:t></w:r></w:p>`
}

/** Thay đoạn chứa mốc bằng XML bảng/HTML. `batBuoc=false` → bỏ qua nếu không có mốc. */
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
  const viTri = timViTriMoc(xml, moc)
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
  // Giữ chữ trước mốc trong cùng đoạn (nhãn «Mục tiêu:», «Nội dung thực hiện:», …)
  const tienTo = textThuanTuXml(xml.slice(dauDoan, viTri))
  const chen = xmlDoanNhanTruocMoc(tienTo) + xmlBang
  const moi = xml.slice(0, dauDoan) + chen + xml.slice(hetDoan + '</w:p>'.length)
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
  return chenBangTheoMoc(docx, DAU_NOI_DUNG, htmlSangOoxml(html), true)
}

/**
 * Chèn nhiều khối HTML (editor) vào các mốc ___HTML_xxx___ sau khi docxtemplater render.
 * Mỗi mốc thay cả đoạn <w:p> chứa mốc bằng các đoạn Word giữ định dạng.
 */
export function chenNhieuHtmlTheoMoc(
  docx: Buffer,
  blocks: Record<string, string | null | undefined>
): Buffer {
  let buf = docx
  for (const [moc, html] of Object.entries(blocks)) {
    if (!moc) continue
    const xml = htmlSangOoxml(html || '')
    buf = chenBangTheoMoc(buf, moc, xml, false)
  }
  return buf
}

/** Tạo mốc chèn HTML theo tên biến merge (vd tinh_cap_thiet → ___HTML_tinh_cap_thiet___). */
export function taoMocHtml(bien: string) {
  return `___HTML_${bien}___`
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
  /** Mốc → HTML editor; sau render sẽ chèn OOXML giữ định dạng */
  htmlBlocks?: Record<string, string | null | undefined>
  /** key = tên biến {{bang_tien_do}} → XML <w:tbl>… sau render */
  tableBlocks?: Record<string, string | null | undefined>
}): Promise<{
  storedFileName: string
  fileUrl: string
  fileSize: number
  fullPath: string
}> {
  const data = { ...params.data }
  if (params.bangTienDo) data.bang_tien_do = DAU_BANG_TIEN_DO
  if (params.bangNguonKinhPhi) data.bang_nguon_kinh_phi = DAU_BANG_NGUON_KINH_PHI

  // tableBlocks: {{bang_*}} → mốc rồi thay bằng <w:tbl>
  const bangTheoMoc: Record<string, string> = {}
  if (params.tableBlocks) {
    for (const [bien, xml] of Object.entries(params.tableBlocks)) {
      if (!bien || !xml) continue
      const moc = bien.startsWith('___BANG_') ? bien : taoMocBang(bien)
      const tenBien = bien.startsWith('___BANG_')
        ? bien.replace(/^___BANG_/, '').replace(/___$/, '')
        : bien
      data[tenBien] = moc
      bangTheoMoc[moc] = xml
    }
  }

  // htmlBlocks: key = tên biến {{tinh_cap_thiet}} → đặt mốc rồi chèn OOXML sau render
  const htmlTheoMoc: Record<string, string | null | undefined> = {}
  if (params.htmlBlocks) {
    for (const [bien, html] of Object.entries(params.htmlBlocks)) {
      const moc = bien.startsWith('___HTML_') ? bien : taoMocHtml(bien)
      const tenBien = bien.startsWith('___HTML_')
        ? bien.replace(/^___HTML_/, '').replace(/___$/, '')
        : bien
      data[tenBien] = moc
      htmlTheoMoc[moc] = html
    }
  }

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
  for (const [moc, xml] of Object.entries(bangTheoMoc)) {
    buf = chenBangTheoMoc(buf, moc, xml, false)
  }
  if (Object.keys(htmlTheoMoc).length) {
    buf = chenNhieuHtmlTheoMoc(buf, htmlTheoMoc)
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
