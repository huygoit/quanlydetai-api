/**
 * Đổi HTML của ô soạn thảo thành đoạn Word.
 * Giữ đậm, nghiêng, gạch chân, xuống dòng và danh sách.
 */

type DinhDang = { dam: boolean; nghieng: boolean; gach: boolean }
type Manh = { chu: string; dinhDang: DinhDang; xuong?: boolean }
type LoaiDoan = 'van' | 'cham' | 'so'
type Doan = { loai: LoaiDoan; so: number; manh: Manh[] }

const DINH_DANG_TRONG: DinhDang = { dam: false, nghieng: false, gach: false }

function thoatXml(s: string) {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function giaiThucThe(s: string) {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCharCode(parseInt(n, 16)))
}

function apStyle(style: string, goc: DinhDang): DinhDang {
  const s = style.toLowerCase()
  const tiep = { ...goc }
  if (/font-weight\s*:\s*(bold|[6-9]00)/.test(s)) tiep.dam = true
  if (/font-style\s*:\s*italic/.test(s)) tiep.nghieng = true
  if (/text-decoration[^;]*underline/.test(s)) tiep.gach = true
  return tiep
}

function runChu(chu: string, dinhDang: DinhDang) {
  const rPr = [
    '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>',
  ]
  if (dinhDang.dam) rPr.push('<w:b/>')
  if (dinhDang.nghieng) rPr.push('<w:i/>')
  rPr.push('<w:sz w:val="26"/><w:szCs w:val="26"/>')
  if (dinhDang.gach) rPr.push('<w:u w:val="single"/>')
  return `<w:r><w:rPr>${rPr.join('')}</w:rPr><w:t xml:space="preserve">${thoatXml(chu)}</w:t></w:r>`
}

function xmlDoan(doan: Doan) {
  const runs: string[] = []
  const thuong = DINH_DANG_TRONG
  if (doan.loai === 'cham') runs.push(runChu('– ', thuong))
  if (doan.loai === 'so') runs.push(runChu(`${doan.so}. `, thuong))
  for (const manh of doan.manh) {
    if (manh.xuong) runs.push('<w:r><w:br/></w:r>')
    if (manh.chu) runs.push(runChu(manh.chu, manh.dinhDang))
  }
  const canh =
    doan.loai === 'van'
      ? '<w:ind w:firstLine="567"/><w:jc w:val="both"/>'
      : '<w:ind w:left="567" w:hanging="284"/>'
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="80"/>${canh}</w:pPr>${runs.join('')}</w:p>`
}

function coChu(doan: Doan | null) {
  return !!doan && doan.manh.some((m) => m.chu.trim() || m.xuong)
}

/** HTML soạn thảo → các thẻ w:p. */
export function htmlSangOoxml(html: string) {
  const nguon = (html || '').replace(/<!--[\s\S]*?-->/g, '')
  const token = nguon.match(/<\/?[a-zA-Z][^>]*>|[^<]+/g) || []
  const ketQua: Doan[] = []
  let hienTai: Doan | null = null
  let dinhDang = { ...DINH_DANG_TRONG }
  const nganDinhDang: DinhDang[] = []
  const danhSach: LoaiDoan[] = []
  const demSo: number[] = []

  const loaiHienTai = (): LoaiDoan => {
    const cuoi = danhSach[danhSach.length - 1]
    return cuoi === 'cham' || cuoi === 'so' ? cuoi : 'van'
  }

  const xep = (giuTrong: boolean) => {
    if (!hienTai) return
    if (coChu(hienTai) || giuTrong) ketQua.push(hienTai)
    hienTai = null
  }

  const themChu = (chu: string) => {
    if (!chu) return
    if (!hienTai) {
      const loai = loaiHienTai()
      const so = loai === 'so' ? demSo[demSo.length - 1] || 1 : 0
      hienTai = { loai, so, manh: [] }
    }
    hienTai.manh.push({ chu, dinhDang: { ...dinhDang } })
  }

  for (const raw of token) {
    if (!raw.startsWith('<')) {
      themChu(giaiThucThe(raw).replace(/\u00a0/g, ' '))
      continue
    }
    const dong = /^<\//.test(raw)
    const ten = raw.replace(/^<\/?/, '').replace(/[\s/>].*$/, '').toLowerCase()
    const style = /style\s*=\s*(["'])([\s\S]*?)\1/i.exec(raw)?.[2] || ''
    if (ten === 'br') {
      if (!hienTai) hienTai = { loai: loaiHienTai(), so: 0, manh: [] }
      hienTai.manh.push({ chu: '', dinhDang: { ...dinhDang }, xuong: true })
      continue
    }
    if (ten === 'ul' || ten === 'ol') {
      xep(false)
      if (!dong) {
        danhSach.push(ten === 'ol' ? 'so' : 'cham')
        if (ten === 'ol') demSo.push(0)
      } else {
        const vua = danhSach.pop()
        if (vua === 'so') demSo.pop()
      }
      continue
    }
    if (ten === 'li') {
      if (!dong) {
        xep(false)
        if (danhSach[danhSach.length - 1] === 'so') {
          demSo[demSo.length - 1] = (demSo[demSo.length - 1] || 0) + 1
        }
        const loai = loaiHienTai()
        hienTai = {
          loai: loai === 'van' ? 'cham' : loai,
          so: loai === 'so' ? demSo[demSo.length - 1] || 1 : 0,
          manh: [],
        }
      } else {
        xep(false)
      }
      continue
    }
    if (ten === 'p' || ten === 'div' || /^h[1-6]$/.test(ten)) {
      if (!dong) {
        if (coChu(hienTai)) xep(false)
      } else {
        xep(false)
      }
      continue
    }
    if (['b', 'strong', 'i', 'em', 'u', 'span', 'font', 'a'].includes(ten)) {
      if (!dong) {
        nganDinhDang.push(dinhDang)
        const tiep = apStyle(style, dinhDang)
        if (ten === 'b' || ten === 'strong') tiep.dam = true
        if (ten === 'i' || ten === 'em') tiep.nghieng = true
        if (ten === 'u' || ten === 'a') tiep.gach = true
        dinhDang = tiep
      } else if (nganDinhDang.length) {
        dinhDang = nganDinhDang.pop() || { ...DINH_DANG_TRONG }
      }
    }
  }
  xep(false)
  if (!ketQua.length) return '<w:p><w:pPr><w:spacing w:after="80"/></w:pPr></w:p>'
  return ketQua.map(xmlDoan).join('')
}
