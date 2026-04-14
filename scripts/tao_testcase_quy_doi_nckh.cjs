const XLSX = require('xlsx')

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

function tinhGioTheoQd({ B, n, p, laTacGiaChinh, laTacGiaLienHe, tongTacGia }) {
  if (!(B > 0) || n < 1 || p < 1) return 0
  const trongNhomChinh = laTacGiaChinh || laTacGiaLienHe
  const tinhNhuTacGiaChinh = trongNhomChinh || tongTacGia === 1
  if (tinhNhuTacGiaChinh) return B / (3 * n) + (2 * B) / (3 * p)
  return (2 * B) / (3 * p)
}

function taoCaseCongBo({
  ma,
  moTa,
  ruleKind = 'MULTIPLY_A',
  hoursValue = 1800,
  pointsValue = 3,
  hdgsnnScore = null,
  a = 2,
  n = 2,
  p = 2,
  tongTacGia = p,
  laTacGiaChinh = true,
  laTacGiaLienHe = false,
  affiliationType = 'UDN_ONLY',
  kiemNhiemNgoai = false,
  gioiTinh = 'MALE',
  coLoaiKq = true,
  coRule = true,
  coAuthors = true,
}) {
  let B0 = 0
  let P0 = 0
  const canhBao = []

  if (!coLoaiKq) {
    canhBao.push('Thiếu research_output_type_id')
    return {
      ma,
      nhom: 'CÔNG BỐ',
      moTa,
      ruleKind,
      B0: 0,
      a,
      B: 0,
      P0: 0,
      n,
      p,
      gioKyVong: 0,
      diemKyVong: 0,
      canhBaoKyVong: canhBao.join('; '),
    }
  }

  if (!coAuthors) {
    canhBao.push('Publication chưa có authors')
    return {
      ma,
      nhom: 'CÔNG BỐ',
      moTa,
      ruleKind,
      B0: 0,
      a,
      B: 0,
      P0: 0,
      n,
      p,
      gioKyVong: 0,
      diemKyVong: 0,
      canhBaoKyVong: canhBao.join('; '),
    }
  }

  if (!coRule) {
    canhBao.push('Không tìm thấy rule')
    return {
      ma,
      nhom: 'CÔNG BỐ',
      moTa,
      ruleKind,
      B0: 0,
      a,
      B: 0,
      P0: 0,
      n,
      p,
      gioKyVong: 0,
      diemKyVong: 0,
      canhBaoKyVong: canhBao.join('; '),
    }
  }

  const k = String(ruleKind).toUpperCase()
  if (k === 'MULTIPLY_A') {
    B0 = hoursValue * a
    P0 = pointsValue > 0 ? pointsValue : hoursValue
  } else if (k === 'FIXED') {
    B0 = hoursValue
    P0 = pointsValue > 0 ? pointsValue : hoursValue
  } else if (k === 'HDGSNN_POINTS_TO_HOURS') {
    const s = hdgsnnScore != null ? Number(hdgsnnScore) : 0
    B0 = s * 600
    P0 = s
    if (s <= 0) canhBao.push('Thiếu điểm HĐGSNN hợp lệ')
  } else if (k === 'BONUS_ADD') {
    const bonus = 100
    B0 = hoursValue + bonus
    P0 = (pointsValue > 0 ? pointsValue : hoursValue) + bonus
  } else if (k === 'RANGE_REVENUE') {
    canhBao.push('RANGE_REVENUE không áp dụng cho công bố')
    B0 = 0
    P0 = 0
  } else {
    canhBao.push('Rule chưa hỗ trợ')
    B0 = 0
    P0 = 0
  }

  if (n < 1) {
    if (tongTacGia === 1) {
      n = 1
      canhBao.push('Tạm dùng n=1 cho bài 1 tác giả')
    } else {
      canhBao.push('n không hợp lệ')
      return {
        ma,
        nhom: 'CÔNG BỐ',
        moTa,
        ruleKind,
        B0: round2(B0),
        a,
        B: 0,
        P0: round2(P0),
        n,
        p,
        gioKyVong: 0,
        diemKyVong: 0,
        canhBaoKyVong: canhBao.join('; '),
      }
    }
  }

  const daNhanA = k === 'MULTIPLY_A' || k === 'HDGSNN_POINTS_TO_HOURS'
  const B = daNhanA ? B0 : B0 * a
  let gio = 0
  let diem = P0

  if (affiliationType === 'OUTSIDE') {
    canhBao.push('Mục 1.5: OUTSIDE không tính')
    gio = 0
    diem = 0
  } else {
    gio = tinhGioTheoQd({ B, n, p, laTacGiaChinh, laTacGiaLienHe, tongTacGia })
    if (kiemNhiemNgoai) gio /= 2
    if (gioiTinh === 'FEMALE') gio *= 1.2
  }

  return {
    ma,
    nhom: 'CÔNG BỐ',
    moTa,
    ruleKind,
    B0: round2(B0),
    a,
    B: round2(B),
    P0: round2(P0),
    n,
    p,
    gioKyVong: round2(gio),
    diemKyVong: round2(diem),
    canhBaoKyVong: canhBao.join('; '),
  }
}

function taoCaseDeTai({
  ma,
  moTa,
  ruleKind = 'MULTIPLY_C',
  hoursValue = 800,
  pointsValue = 2,
  cFactor = null,
  acceptanceGrade = null,
  coLoaiKq = true,
  coRule = true,
}) {
  const canhBao = []
  if (!coLoaiKq) {
    canhBao.push('Thiếu research_output_type_id')
    return {
      ma,
      nhom: 'ĐỀ TÀI',
      moTa,
      ruleKind,
      B0: 0,
      a: '',
      B: 0,
      P0: 0,
      n: '',
      p: '',
      gioKyVong: 0,
      diemKyVong: 0,
      canhBaoKyVong: canhBao.join('; '),
    }
  }
  if (!coRule) {
    canhBao.push('Không tìm thấy rule')
    return {
      ma,
      nhom: 'ĐỀ TÀI',
      moTa,
      ruleKind,
      B0: 0,
      a: '',
      B: 0,
      P0: 0,
      n: '',
      p: '',
      gioKyVong: 0,
      diemKyVong: 0,
      canhBaoKyVong: canhBao.join('; '),
    }
  }

  const k = String(ruleKind).toUpperCase()
  const basePoints = pointsValue > 0 ? pointsValue : hoursValue

  if (k === 'MULTIPLY_C') {
    let c = cFactor
    if (!(c > 0)) {
      const map = { EXCELLENT: 1.1, PASS_ON_TIME: 1.0, PASS_LATE: 0.5 }
      c = map[String(acceptanceGrade || '').toUpperCase()]
    }
    if (!(c > 0)) {
      canhBao.push('Thiếu c_factor hoặc acceptance_grade hợp lệ')
      return {
        ma,
        nhom: 'ĐỀ TÀI',
        moTa,
        ruleKind,
        B0: hoursValue,
        a: '',
        B: 0,
        P0: basePoints,
        n: '',
        p: '',
        gioKyVong: 0,
        diemKyVong: 0,
        canhBaoKyVong: canhBao.join('; '),
      }
    }
    return {
      ma,
      nhom: 'ĐỀ TÀI',
      moTa,
      ruleKind,
      B0: hoursValue,
      a: '',
      B: round2(hoursValue * c),
      P0: basePoints,
      n: '',
      p: '',
      gioKyVong: round2(hoursValue * c),
      diemKyVong: round2(basePoints * c),
      canhBaoKyVong: '',
    }
  }

  if (k === 'FIXED') {
    return {
      ma,
      nhom: 'ĐỀ TÀI',
      moTa,
      ruleKind,
      B0: hoursValue,
      a: '',
      B: hoursValue,
      P0: basePoints,
      n: '',
      p: '',
      gioKyVong: round2(hoursValue),
      diemKyVong: round2(basePoints),
      canhBaoKyVong: '',
    }
  }

  canhBao.push('Rule kind chưa hỗ trợ')
  return {
    ma,
    nhom: 'ĐỀ TÀI',
    moTa,
    ruleKind,
    B0: hoursValue,
    a: '',
    B: 0,
    P0: basePoints,
    n: '',
    p: '',
    gioKyVong: 0,
    diemKyVong: 0,
    canhBaoKyVong: canhBao.join('; '),
  }
}

function taoCaseDonGian(ma, loai) {
  return {
    ma,
    nhom: 'KHÁC',
    moTa: `Loại ${loai} chưa có nguồn dữ liệu trong hệ thống`,
    ruleKind: '',
    B0: 0,
    a: '',
    B: 0,
    P0: 0,
    n: '',
    p: '',
    gioKyVong: 0,
    diemKyVong: 0,
    canhBaoKyVong: `Loại ${loai}: chưa có nguồn dữ liệu trong hệ thống`,
  }
}

const rows = [
  taoCaseCongBo({
    ma: 'PUB_01',
    moTa: 'MULTIPLY_A, 2 tác giả đều chính, toàn ĐHĐN => a=2, giờ mỗi người 1800, điểm 3',
    a: 2,
    n: 2,
    p: 2,
    tongTacGia: 2,
    laTacGiaChinh: true,
    laTacGiaLienHe: false,
    gioiTinh: 'MALE',
  }),
  taoCaseCongBo({
    ma: 'PUB_02',
    moTa: 'MULTIPLY_A, tương ứng mục 1.1b => a=1.5',
    a: 1.5,
    n: 1,
    p: 2,
    tongTacGia: 2,
    laTacGiaChinh: true,
    laTacGiaLienHe: true,
  }),
  taoCaseCongBo({
    ma: 'PUB_03',
    moTa: 'MULTIPLY_A, toàn ngoài ĐHĐN ở tập tính a => a=1',
    a: 1,
    n: 1,
    p: 3,
    tongTacGia: 3,
    laTacGiaChinh: true,
    laTacGiaLienHe: true,
    affiliationType: 'UDN_ONLY',
  }),
  taoCaseCongBo({
    ma: 'PUB_04',
    moTa: 'Tác giả NCV là đồng tác giả (không chính, không liên hệ)',
    a: 2,
    n: 1,
    p: 3,
    tongTacGia: 3,
    laTacGiaChinh: false,
    laTacGiaLienHe: false,
  }),
  taoCaseCongBo({
    ma: 'PUB_05',
    moTa: 'NCV kiêm nhiệm ngoài (MIXED + chia 2)',
    a: 2,
    n: 1,
    p: 2,
    tongTacGia: 2,
    laTacGiaChinh: true,
    affiliationType: 'MIXED',
    kiemNhiemNgoai: true,
  }),
  taoCaseCongBo({
    ma: 'PUB_06',
    moTa: 'NCV nữ được nhân 1.2',
    a: 2,
    n: 1,
    p: 2,
    tongTacGia: 2,
    laTacGiaChinh: true,
    gioiTinh: 'FEMALE',
  }),
  taoCaseCongBo({
    ma: 'PUB_07',
    moTa: 'NCV nữ + kiêm nhiệm ngoài: chia 2 rồi nhân 1.2',
    a: 2,
    n: 1,
    p: 2,
    tongTacGia: 2,
    laTacGiaChinh: true,
    affiliationType: 'MIXED',
    kiemNhiemNgoai: true,
    gioiTinh: 'FEMALE',
  }),
  taoCaseCongBo({
    ma: 'PUB_08',
    moTa: 'NCV OUTSIDE => giờ=0, điểm=0 (mục 1.5)',
    a: 2,
    n: 1,
    p: 2,
    tongTacGia: 2,
    affiliationType: 'OUTSIDE',
  }),
  taoCaseCongBo({
    ma: 'PUB_09',
    moTa: 'Bài 1 tác giả, n thiếu nhưng được tự suy n=1',
    a: 2,
    n: 0,
    p: 1,
    tongTacGia: 1,
    laTacGiaChinh: false,
    laTacGiaLienHe: false,
  }),
  taoCaseCongBo({
    ma: 'PUB_10',
    moTa: 'n=0 và >1 tác giả => fail an toàn',
    a: 2,
    n: 0,
    p: 2,
    tongTacGia: 2,
    laTacGiaChinh: false,
    laTacGiaLienHe: false,
  }),
  taoCaseCongBo({
    ma: 'PUB_11',
    moTa: 'FIXED: B=B0*a, điểm lấy points_value',
    ruleKind: 'FIXED',
    hoursValue: 900,
    pointsValue: 2.5,
    a: 1.5,
    n: 1,
    p: 2,
    tongTacGia: 2,
  }),
  taoCaseCongBo({
    ma: 'PUB_12',
    moTa: 'FIXED không có points_value => fallback sang hours_value',
    ruleKind: 'FIXED',
    hoursValue: 500,
    pointsValue: 0,
    a: 1.5,
    n: 1,
    p: 2,
    tongTacGia: 2,
  }),
  taoCaseCongBo({
    ma: 'PUB_13',
    moTa: 'HDGSNN_POINTS_TO_HOURS: giờ=score*600, điểm=score',
    ruleKind: 'HDGSNN_POINTS_TO_HOURS',
    hdgsnnScore: 1.75,
    hoursValue: 600,
    pointsValue: 0,
    a: 2,
    n: 1,
    p: 2,
    tongTacGia: 2,
  }),
  taoCaseCongBo({
    ma: 'PUB_14',
    moTa: 'HDGSNN thiếu điểm => 0 và cảnh báo',
    ruleKind: 'HDGSNN_POINTS_TO_HOURS',
    hdgsnnScore: null,
    hoursValue: 600,
    pointsValue: 0,
    a: 2,
    n: 1,
    p: 2,
    tongTacGia: 2,
  }),
  taoCaseCongBo({
    ma: 'PUB_15',
    moTa: 'BONUS_ADD trên công bố',
    ruleKind: 'BONUS_ADD',
    hoursValue: 700,
    pointsValue: 2,
    a: 2,
    n: 1,
    p: 2,
    tongTacGia: 2,
  }),
  taoCaseCongBo({
    ma: 'PUB_16',
    moTa: 'RANGE_REVENUE không áp dụng cho công bố',
    ruleKind: 'RANGE_REVENUE',
    hoursValue: 700,
    pointsValue: 2,
    a: 2,
    n: 1,
    p: 2,
    tongTacGia: 2,
  }),
  taoCaseCongBo({
    ma: 'PUB_17',
    moTa: 'Thiếu type_id',
    coLoaiKq: false,
  }),
  taoCaseCongBo({
    ma: 'PUB_18',
    moTa: 'Thiếu danh sách tác giả',
    coAuthors: false,
  }),
  taoCaseCongBo({
    ma: 'PUB_19',
    moTa: 'Không có rule theo type_id',
    coRule: false,
  }),
  taoCaseDeTai({
    ma: 'PRJ_01',
    moTa: 'MULTIPLY_C dùng c_factor nhập tay',
    ruleKind: 'MULTIPLY_C',
    hoursValue: 1000,
    pointsValue: 3,
    cFactor: 1.2,
  }),
  taoCaseDeTai({
    ma: 'PRJ_02',
    moTa: 'MULTIPLY_C với acceptance_grade=EXCELLENT',
    ruleKind: 'MULTIPLY_C',
    hoursValue: 1000,
    pointsValue: 3,
    acceptanceGrade: 'EXCELLENT',
  }),
  taoCaseDeTai({
    ma: 'PRJ_03',
    moTa: 'MULTIPLY_C với acceptance_grade=PASS_LATE',
    ruleKind: 'MULTIPLY_C',
    hoursValue: 1000,
    pointsValue: 3,
    acceptanceGrade: 'PASS_LATE',
  }),
  taoCaseDeTai({
    ma: 'PRJ_04',
    moTa: 'MULTIPLY_C thiếu cả c_factor và acceptance_grade',
    ruleKind: 'MULTIPLY_C',
    hoursValue: 1000,
    pointsValue: 3,
  }),
  taoCaseDeTai({
    ma: 'PRJ_05',
    moTa: 'MULTIPLY_C acceptance_grade không map',
    ruleKind: 'MULTIPLY_C',
    hoursValue: 1000,
    pointsValue: 3,
    acceptanceGrade: 'UNKNOWN',
  }),
  taoCaseDeTai({
    ma: 'PRJ_06',
    moTa: 'FIXED đề tài dùng points_value',
    ruleKind: 'FIXED',
    hoursValue: 800,
    pointsValue: 2.2,
  }),
  taoCaseDeTai({
    ma: 'PRJ_07',
    moTa: 'FIXED đề tài fallback điểm = hours_value',
    ruleKind: 'FIXED',
    hoursValue: 800,
    pointsValue: 0,
  }),
  taoCaseDeTai({
    ma: 'PRJ_08',
    moTa: 'Rule đề tài chưa hỗ trợ',
    ruleKind: 'BONUS_ADD',
    hoursValue: 800,
    pointsValue: 2,
  }),
  taoCaseDeTai({
    ma: 'PRJ_09',
    moTa: 'Đề tài thiếu type_id',
    coLoaiKq: false,
  }),
  taoCaseDeTai({
    ma: 'PRJ_10',
    moTa: 'Đề tài không có rule',
    coRule: false,
  }),
  taoCaseDonGian('SIMPLE_01', 'BOOK'),
  taoCaseDonGian('SIMPLE_02', 'STUDENT_RESEARCH'),
]

const huongDan = [
  {
    muc: 'Mục tiêu',
    noiDung:
      'Bao quát toàn bộ nhánh logic đang có trong KPI engine: công bố, đề tài, và nhóm loại đơn giản chưa có nguồn dữ liệu.',
  },
  {
    muc: 'Cách dùng',
    noiDung:
      'Mỗi dòng là 1 test case. So sánh output API với cột giờ/điểm kỳ vọng. Cột cảnh báo kỳ vọng dùng để đối chiếu warning.',
  },
  {
    muc: 'Lưu ý 1',
    noiDung:
      'Điểm công bố theo phụ lục: lấy theo điểm loại kết quả (hoặc điểm HĐGSNN), không chia theo n/p và không nhân a.',
  },
  {
    muc: 'Lưu ý 2',
    noiDung:
      'Giờ công bố theo QĐ: nhóm chính nhận B/(3n)+2B/(3p), đồng tác giả nhận 2B/(3p), sau đó xét chia 2 kiêm nhiệm và nhân 1.2 nữ.',
  },
]

const ws1 = XLSX.utils.json_to_sheet(rows)
const ws2 = XLSX.utils.json_to_sheet(huongDan)

const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws1, 'TestCases')
XLSX.utils.book_append_sheet(wb, ws2, 'HuongDan')

const outPath = 'prompts/testcase_quy_doi_gio_diem_nckh.xlsx'
XLSX.writeFile(wb, outPath)
console.log(`Da tao file: ${outPath}`)
