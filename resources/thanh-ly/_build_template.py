# -*- coding: utf-8 -*-
"""
Sinh BM-05.10 Biên bản nghiệm thu và thanh lý HĐ có biến {{...}} từ mẫu giấy gốc.
"""
from __future__ import annotations

import os
import re
import zipfile
from pathlib import Path

SRC = Path(r"c:\quanlydetai\tailieu\bieu-mau-chung\bb-nghiem-thu-thanh-ly.docx")
OUT_DIR = Path(__file__).resolve().parent
OUT = OUT_DIR / "BM-05.10_Bien_ban_nghiem_thu_thanh_ly_co_bien.docx"


def norm(t: str) -> str:
    return (
        t.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
    )


def esc(t: str) -> str:
    return (
        t.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def get_text(xml: str) -> str:
    return "".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", xml))


def get_pPr(p_xml: str) -> str:
    m = re.search(r"<w:pPr>.*?</w:pPr>", p_xml, re.DOTALL)
    return m.group(0) if m else ""


def first_rPr(p_xml: str) -> str:
    m = re.search(r"<w:rPr>.*?</w:rPr>", p_xml, re.DOTALL)
    return m.group(0) if m else ""


def rebuild_p(p_xml: str, new_text: str) -> str:
    p_pr = get_pPr(p_xml)
    r_pr = first_rPr(p_xml)
    return (
        f"<w:p>{p_pr}<w:r>{r_pr}"
        f'<w:t xml:space="preserve">{esc(new_text)}</w:t></w:r></w:p>'
    )


def compact(t: str) -> str:
    return re.sub(r"\s+", " ", t).strip()


def rewrite_para(text: str) -> str | None:
    """Trả về text mới nếu cần thay; None nếu giữ nguyên."""
    t = text
    c = compact(t)

    if c.startswith("Mã biểu mẫu:"):
        return "Mã biểu mẫu: BM-05.10 | Phiên bản: 1.0 | Ngày áp dụng: {{ngay_ap_dung}}"

    if c.startswith("(Loại hình nhiệm vụ"):
        return "(Loại hình nhiệm vụ/cụm nhiệm vụ/chuỗi nhiệm vụ: {{loai_hinh}})"

    if c.startswith("Số:") and "TL-KHCN" in c:
        return "Số: {{so_bien_ban}}/TL-KHCNĐMST/ĐHSP"

    if "Hợp đồng giao thực hiện nhiệm vụ" in c and "ký ngày" in c and c.startswith("Căn cứ"):
        return (
            "Căn cứ Hợp đồng giao thực hiện nhiệm vụ khoa học, công nghệ và đổi mới sáng tạo số: "
            "{{so_hop_dong}} ký ngày {{ngay_ky_hd}} giữa Trường Đại học Sư phạm - Đại học Đà Nẵng và Bên B;"
        )

    if "về việc công nhận kết quả đánh giá" in c or (
        "Quyết định số" in c and "nghiệm thu nhiệm vụ" in c
    ):
        return (
            "Căn cứ Quyết định số {{so_qd_cong_nhan}} ngày {{ngay_qd_cong_nhan}} của Hiệu trưởng "
            "Trường Đại học Sư phạm - Đại học Đà Nẵng về việc công nhận kết quả đánh giá, nghiệm thu "
            "nhiệm vụ khoa học, công nghệ và đổi mới sáng tạo (hoặc Biên bản họp Hội đồng tư vấn "
            "đánh giá cuối kỳ nghiệm thu nhiệm vụ ngày {{ngay_hop_hd}});"
        )

    if c.startswith("Căn cứ Biên bản xác nhận kết quả"):
        return "Căn cứ Biên bản xác nhận kết quả ngày {{ngay_bb_xac_nhan}};"

    if c.startswith("Hôm nay, ngày") and "chúng tôi gồm có" in c:
        return (
            "Hôm nay, {{ngay_lap}}, tại Trường Đại học Sư phạm - Đại học Đà Nẵng, "
            "chúng tôi gồm có:"
        )

    # Bên B
    if c.startswith("Địa chỉ:") and "…" in t:
        return "Địa chỉ: {{dia_chi_ben_b}}"
    if c.startswith("Điện thoại:") and "…" in t and "Email" not in c:
        # Có thể là Bên B hoặc CNNV — phân biệt bằng context khó; dùng biến riêng qua thứ tự
        return None  # xử lý theo thứ tự bên dưới bằng counter nếu cần
    if c.startswith("Email:") and "…" in t:
        return None
    if (
        c.startswith("Tài khoản:")
        and "ngân hàng" in c.lower()
        and ("…" in t or ".." in t or "…" in t)
    ):
        return "Tài khoản: {{tai_khoan_ben_b}} tại ngân hàng {{ngan_hang_ben_b}}"
    if c.startswith("Đại diện:") and "Chức vụ" in c and ("…" in t or ".." in t):
        return "Đại diện: {{dai_dien_ben_b}} Chức vụ: {{chuc_vu_ben_b}}"
    if c.startswith("(Ủy quyền theo Quyết định số") and ("…" in t or ".." in t):
        return "(Ủy quyền theo Quyết định số {{uy_quyen_ben_b}})"

    if c.startswith("Chủ nhiệm nhiệm vụ:"):
        return "Chủ nhiệm nhiệm vụ: {{chu_nhiem}}"
    if c.startswith("Chức vụ/chức danh:"):
        return "Chức vụ/chức danh: {{chuc_vu_chu_nhiem}}"
    if c.startswith("Đơn vị công tác chuyên môn:"):
        return "Đơn vị công tác chuyên môn: {{don_vi_chu_nhiem}}"
    if c.startswith("Điện thoại:") and "…" in t:
        return "Điện thoại: {{dien_thoai_lien_he}}"
    if c.startswith("Email:") and ("…" in t or ".." in t):
        return "Email: {{email_lien_he}}"

    # Mục 1
    if c.startswith("- Tên nhiệm vụ:"):
        return '- Tên nhiệm vụ: "{{ten_nhiem_vu}}"'
    if c.startswith("- Mã số nhiệm vụ:"):
        return "- Mã số nhiệm vụ: {{ma_nhiem_vu}}  Cấp quản lý: {{cap_quan_ly}}"
    if "Thời gian thực hiện theo HĐ" in c:
        return (
            "- Thời gian thực hiện theo HĐ: Từ ngày {{thoi_gian_tu}} đến ngày {{thoi_gian_den}} "
            "(Thời gian: {{thoi_gian_thang}} tháng)"
        )
    if "Thời gian gia hạn/điều chỉnh" in c:
        return (
            "- (Thời gian gia hạn/điều chỉnh: Đến ngày {{gia_han_den}} theo Quyết định số: "
            "{{so_qd_gia_han}})"
        )
    if "Đánh giá mức độ hoàn thành" in c:
        return (
            "- Đánh giá mức độ hoàn thành: Bên B đã triển khai đầy đủ các nội dung nghiên cứu theo đúng "
            "Thuyết minh được phê duyệt và Hợp đồng số: {{so_hop_dong}}; Hội đồng đánh giá cuối kỳ họp "
            "ngày {{ngay_hop_hd}} đã nghiệm thu, xếp loại mức: {{xep_loai}}"
        )

    if c.startswith("- Bên có nghĩa vụ cam kết thanh toán"):
        return (
            "- Bên có nghĩa vụ cam kết thanh toán dứt điểm/hoàn trả số kinh phí chênh lệch tại Mục 5 "
            "hoặc Mục 6 trước ngày {{han_thanh_toan}}."
        )

    # Điều khoản thi hành — số HĐ
    if "không còn bất kỳ khiếu nại" in c:
        return (
            "1. Hai bên xác nhận đã thực hiện đầy đủ, nghiêm túc toàn bộ các điều khoản đã cam kết "
            "trong Hợp đồng giao thực hiện nhiệm vụ KH,CN&ĐMST số: {{so_hop_dong}} ký ngày "
            "{{ngay_ky_hd}} và không còn bất kỳ khiếu nại, khiếu kiện nào khác."
        )
    if "chính thức chấm dứt và hết hiệu lực" in c:
        return (
            "2. Hợp đồng số: {{so_hop_dong}} chính thức chấm dứt và hết hiệu lực thi hành kể từ ngày "
            "Biên bản thanh lý này được các bên ký tên, đóng dấu hợp lệ."
        )

    return None


# Thứ tự các dòng Điện thoại / Email / Địa chỉ Bên B vs CNNV
PHONE_EMAIL_SEQ = [
    ("Điện thoại:", "dien_thoai_ben_b"),
    ("Email:", "email_ben_b"),
    ("Điện thoại:", "dien_thoai_chu_nhiem"),
    ("Email:", "email_chu_nhiem"),
]


def is_finance_table(tbl_xml: str) -> bool:
    text = norm(get_text(tbl_xml)).lower()
    return "nội dung xác nhận tài chính" in text and "số tiền" in text


def is_sign_table(tbl_xml: str) -> bool:
    text = norm(get_text(tbl_xml)).lower()
    return "đại diện bên a" in text and "chủ nhiệm nhiệm vụ" in text


FINANCE_CELL_MAP = {
    # row, col -> new text
    (1, 1): (
        "Tổng kinh phí thực hiện theo Hợp đồng (Giá trị hợp đồng): "
        "- Kinh phí giao khoán chi: {{kp_giao_khoan}} đồng "
        "- Kinh phí không giao khoán chi: {{kp_khong_khoan}} đồng"
    ),
    (1, 2): "{{kp_theo_hd}}",
    (2, 1): (
        "Nguồn kinh phí bố trí: "
        "- Nguồn kinh phí từ Trường Đại học Sư phạm: {{nguon_truong}} đồng "
        "- Nguồn kinh phí từ bên ngoài / đối ứng (nếu có): {{nguon_doi_ung}} đồng"
    ),
    (2, 2): "{{tong_nguon}}",
    (3, 1): (
        "Tổng kinh phí Bên A đã tạm ứng/cấp cho Bên B lũy kế: "
        "- Đợt 1 (Tạm ứng ban đầu): {{tam_ung_dot_1}} đồng "
        "- Đợt 2 (Cấp sau đánh giá trong kỳ): {{tam_ung_dot_2}} đồng"
    ),
    (3, 2): "{{tam_ung_luy_ke}}",
    (4, 1): (
        "Giá trị khối lượng đủ điều kiện nghiệm thu, quyết toán: "
        "(Căn cứ Báo cáo quyết toán tài chính)"
    ),
    (4, 2): "{{gia_tri_quyet_toan}}",
    (5, 1): (
        "Số kinh phí Bên A tiếp tục thanh toán bổ sung cho Bên B: "
        "(Bằng chữ: {{thanh_toan_bo_sung_chu}})"
    ),
    (5, 2): "{{thanh_toan_bo_sung}}",
    (6, 1): (
        "Số kinh phí Bên B có nghĩa vụ hoàn trả về Trường / NSNN: "
        "(Bằng chữ: {{hoan_tra_chu}})"
    ),
    (6, 2): "{{hoan_tra}}",
}


def rebuild_cell_paras(tc_xml: str, new_text: str) -> str:
    """Thay toàn bộ nội dung đoạn trong ô bằng 1 đoạn text mới, giữ pPr/rPr đầu."""
    paras = list(re.finditer(r"<w:p[\s>][\s\S]*?</w:p>", tc_xml))
    if not paras:
        # chèn trước </w:tc>
        return tc_xml.replace(
            "</w:tc>",
            f'<w:p><w:r><w:t xml:space="preserve">{esc(new_text)}</w:t></w:r></w:p></w:tc>',
            1,
        )
    first = paras[0].group(0)
    new_p = rebuild_p(first, new_text)
    # Xóa hết paragraph cũ, chèn 1 cái mới sau tcPr nếu có
    without_p = re.sub(r"<w:p[\s>][\s\S]*?</w:p>", "", tc_xml)
    if "</w:tcPr>" in without_p:
        return without_p.replace("</w:tcPr>", f"</w:tcPr>{new_p}", 1)
    return without_p.replace("<w:tc>", f"<w:tc>{new_p}", 1)


def rewrite_finance_table(tbl_xml: str) -> str:
    def repl_row(ri: int, row_xml: str) -> str:
        cells = list(re.finditer(r"<w:tc[\s>][\s\S]*?</w:tc>", row_xml))
        out = row_xml
        # thay từ cuối để không lệch offset — rebuild toàn row
        parts: list[str] = []
        last = 0
        # giữ phần trước cell đầu
        if not cells:
            return row_xml
        parts.append(row_xml[: cells[0].start()])
        for ci, cm in enumerate(cells):
            tc = cm.group(0)
            key = (ri, ci)
            if key in FINANCE_CELL_MAP:
                tc = rebuild_cell_paras(tc, FINANCE_CELL_MAP[key])
            parts.append(tc)
            last = cm.end()
        parts.append(row_xml[last:])
        return "".join(parts)

    rows = list(re.finditer(r"<w:tr[\s>][\s\S]*?</w:tr>", tbl_xml))
    parts: list[str] = []
    last = 0
    parts.append(tbl_xml[: rows[0].start()] if rows else tbl_xml)
    for ri, rm in enumerate(rows):
        if ri == 0:
            parts.append(tbl_xml[last : rm.start()] if ri == 0 and last == 0 else "")
            if not parts[-1] and ri == 0:
                parts[-1] = tbl_xml[: rm.start()]
        else:
            parts.append(tbl_xml[last : rm.start()])
        parts.append(repl_row(ri, rm.group(0)))
        last = rm.end()
    parts.append(tbl_xml[last:])
    return "".join(parts)


def rewrite_sign_table(tbl_xml: str) -> str:
    """Chèn tên CNNV / đại diện Bên B vào cột ký."""

    def cell_text(ci: int, old: str) -> str | None:
        if ci == 1:
            return (
                "CHỦ NHIỆM NHIỆM VỤ (Ký xác nhận trách nhiệm chuyên môn, ghi rõ họ tên) "
                "{{chu_nhiem}}"
            )
        if ci == 2:
            return (
                "ĐẠI DIỆN BÊN B THỦ TRƯỞNG ĐƠN VỊ CHỦ TRÌ "
                "(Ký, ghi rõ họ tên, chức vụ và đóng dấu) {{dai_dien_ben_b}}"
            )
        return None

    rows = list(re.finditer(r"<w:tr[\s>][\s\S]*?</w:tr>", tbl_xml))
    if not rows:
        return tbl_xml
    row = rows[0].group(0)
    cells = list(re.finditer(r"<w:tc[\s>][\s\S]*?</w:tc>", row))
    parts = [row[: cells[0].start()]] if cells else [row]
    last = 0
    new_cells: list[str] = []
    for ci, cm in enumerate(cells):
        tc = cm.group(0)
        nt = cell_text(ci, norm(get_text(tc)))
        if nt:
            tc = rebuild_cell_paras(tc, nt)
        new_cells.append(tc)
        last = cm.end()
    new_row = row[: cells[0].start()] + "".join(new_cells) + row[last:]
    return tbl_xml[: rows[0].start()] + new_row + tbl_xml[rows[0].end() :]


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(SRC) as zin:
        xml = zin.read("word/document.xml").decode("utf-8")

        pe_idx = 0

        def repl_para(m: re.Match[str]) -> str:
            nonlocal pe_idx
            p = m.group(0)
            text = norm(get_text(p))
            if not text.strip():
                return p

            # Điện thoại / Email theo thứ tự xuất hiện (Bên B rồi CNNV)
            c = compact(text)
            if c.startswith("Điện thoại:") and ("…" in text or ".." in text):
                if pe_idx == 0:
                    pe_idx += 1
                    return rebuild_p(p, "Điện thoại: {{dien_thoai_ben_b}}")
                if pe_idx == 2:
                    pe_idx += 1
                    return rebuild_p(p, "Điện thoại: {{dien_thoai_chu_nhiem}}")
            if c.startswith("Email:") and ("…" in text or ".." in text):
                if pe_idx == 1:
                    pe_idx += 1
                    return rebuild_p(p, "Email: {{email_ben_b}}")
                if pe_idx >= 2:
                    pe_idx += 1
                    return rebuild_p(p, "Email: {{email_chu_nhiem}}")

            if c.startswith("Địa chỉ:") and ("…" in text or ".." in text):
                return rebuild_p(p, "Địa chỉ: {{dia_chi_ben_b}}")

            new = rewrite_para(text)
            if new is not None:
                return rebuild_p(p, new)
            return p

        new_xml = re.sub(r"<w:p[\s>][\s\S]*?</w:p>", repl_para, xml)

        def repl_tbl(m: re.Match[str]) -> str:
            tbl = m.group(0)
            if is_finance_table(tbl):
                return rewrite_finance_table(tbl)
            if is_sign_table(tbl):
                return rewrite_sign_table(tbl)
            return tbl

        new_xml = re.sub(r"<w:tbl[\s>][\s\S]*?</w:tbl>", repl_tbl, new_xml)

        # Preview
        lines: list[str] = []
        body = re.search(r"<w:body>([\s\S]*)</w:body>", new_xml)
        if body:
            for m in re.finditer(
                r"(<w:tbl[\s>][\s\S]*?</w:tbl>|<w:p[\s>][\s\S]*?</w:p>)", body.group(1)
            ):
                chunk = m.group(0)
                if chunk.startswith("<w:tbl"):
                    rows = re.findall(r"<w:tr[\s>][\s\S]*?</w:tr>", chunk)
                    lines.append(f"[BẢNG {len(rows)} dòng]")
                    for ri, r in enumerate(rows):
                        cells = re.findall(r"<w:tc[\s>][\s\S]*?</w:tc>", r)
                        vals = [norm(get_text(c))[:100] for c in cells]
                        lines.append(f"  R{ri}: " + " | ".join(vals))
                else:
                    t = norm(get_text(chunk))
                    if t.strip():
                        lines.append(t.strip())

        preview = OUT_DIR / "TEMPLATE_preview.txt"
        preview.write_text("\n".join(lines), encoding="utf-8")

        tmp = OUT.with_suffix(".tmp.docx")
        with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if item.filename == "word/document.xml":
                    data = new_xml.encode("utf-8")
                zout.writestr(item, data)
        os.replace(tmp, OUT)
        print("wrote", str(OUT), OUT.stat().st_size)
        print("preview", str(preview))
        # liệt kê biến
        vars_found = sorted(set(re.findall(r"\{\{(\w+)\}\}", new_xml)))
        print("vars", len(vars_found), ",".join(vars_found))


if __name__ == "__main__":
    main()
