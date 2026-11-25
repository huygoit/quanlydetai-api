# -*- coding: utf-8 -*-
"""
Sinh BM-05.10 Biên bản nghiệm thu & thanh lý có biến {{...}} từ mẫu giấy gốc.
Mỗi đoạn / ô chỉ còn 1 <w:t> chứa placeholder — khớp docxtemplater delimiters {{ }}.
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
    """Giữ pPr + rPr đầu; 1 run / 1 w:t — tránh tách {{ }}."""
    p_pr = get_pPr(p_xml)
    r_pr = first_rPr(p_xml)
    return (
        f"<w:p>{p_pr}<w:r>{r_pr}"
        f'<w:t xml:space="preserve">{esc(new_text)}</w:t></w:r></w:p>'
    )


def compact(t: str) -> str:
    return re.sub(r"\s+", " ", t).strip()


def has_blank(t: str) -> bool:
    return ("…" in t) or (".." in t) or ("…" in t) or ("...." in t)


# --- Thay đoạn văn theo nội dung ---
def rewrite_para_text(text: str) -> str | None:
    c = compact(text)

    if c.startswith("Mã biểu mẫu:"):
        return "Mã biểu mẫu: BM-05.10 | Phiên bản: 1.0 | Ngày áp dụng: {{ngay_ap_dung}}"

    if c.startswith("(Loại hình nhiệm vụ"):
        return "(Loại hình nhiệm vụ/cụm nhiệm vụ/chuỗi nhiệm vụ: {{loai_hinh}})"

    if c.startswith("Số:") and "TL-KHCN" in c:
        return "Số: {{so_bien_ban}}/TL-KHCNĐMST/ĐHSP"

    if c.startswith("Căn cứ Hợp đồng giao thực hiện") and "ký ngày" in c:
        return (
            "Căn cứ Hợp đồng giao thực hiện nhiệm vụ khoa học, công nghệ và đổi mới sáng tạo số: "
            "{{so_hop_dong}} ký ngày {{ngay_ky_hd}} giữa Trường Đại học Sư phạm - Đại học Đà Nẵng và Bên B;"
        )

    if "về việc công nhận kết quả đánh giá" in c or (
        c.startswith("Căn cứ Quyết định số") and "nghiệm thu nhiệm vụ" in c
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

    if c.startswith("Đại diện:") and "Chức vụ" in c and has_blank(text):
        return "Đại diện: {{dai_dien_ben_b}} Chức vụ: {{chuc_vu_ben_b}}"

    if c.startswith("(Ủy quyền theo Quyết định số") and has_blank(text):
        return "(Ủy quyền theo Quyết định số {{uy_quyen_ben_b}})"

    if c.startswith("Chủ nhiệm nhiệm vụ:"):
        return "Chủ nhiệm nhiệm vụ: {{chu_nhiem}}"
    if c.startswith("Chức vụ/chức danh:"):
        return "Chức vụ/chức danh: {{chuc_vu_chu_nhiem}}"
    if c.startswith("Đơn vị công tác chuyên môn:"):
        return "Đơn vị công tác chuyên môn: {{don_vi_chu_nhiem}}"

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


FINANCE_CELL_MAP = {
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


def is_finance_table(tbl_xml: str) -> bool:
    text = norm(get_text(tbl_xml)).lower()
    return "nội dung xác nhận tài chính" in text and "số tiền" in text


def is_sign_table(tbl_xml: str) -> bool:
    text = norm(get_text(tbl_xml)).lower()
    return "đại diện bên a" in text and "chủ nhiệm nhiệm vụ" in text


def rewrite_cell_text(tc_xml: str, new_text: str) -> str:
    """
    Giữ <w:tcPr>, thay toàn bộ đoạn trong ô bằng 1 đoạn text.
    Không xóa tcPr — tránh DOCX hỏng khi mở Word.
    """
    tc_pr = ""
    m = re.search(r"<w:tcPr>.*?</w:tcPr>", tc_xml, re.DOTALL)
    if m:
        tc_pr = m.group(0)

    # Lấy style từ đoạn đầu (nếu có)
    first_p = re.search(r"<w:p[\s>][\s\S]*?</w:p>", tc_xml)
    style_from = first_p.group(0) if first_p else "<w:p></w:p>"
    new_p = rebuild_p(style_from, new_text)
    return f"<w:tc>{tc_pr}{new_p}</w:tc>"


def rewrite_finance_table(tbl_xml: str) -> str:
    rows = list(re.finditer(r"<w:tr[\s>][\s\S]*?</w:tr>", tbl_xml))
    if not rows:
        return tbl_xml
    parts: list[str] = [tbl_xml[: rows[0].start()]]
    last = 0
    for ri, rm in enumerate(rows):
        if ri > 0:
            parts.append(tbl_xml[last : rm.start()])
        elif last == 0:
            parts[0] = tbl_xml[: rm.start()]
        row = rm.group(0)
        cells = list(re.finditer(r"<w:tc[\s>][\s\S]*?</w:tc>", row))
        if not cells:
            parts.append(row)
            last = rm.end()
            continue
        rparts = [row[: cells[0].start()]]
        for ci, cm in enumerate(cells):
            tc = cm.group(0)
            key = (ri, ci)
            if key in FINANCE_CELL_MAP:
                tc = rewrite_cell_text(tc, FINANCE_CELL_MAP[key])
            rparts.append(tc)
        rparts.append(row[cells[-1].end() :])
        parts.append("".join(rparts))
        last = rm.end()
    parts.append(tbl_xml[last:])
    return "".join(parts)


def rewrite_sign_table(tbl_xml: str) -> str:
    rows = list(re.finditer(r"<w:tr[\s>][\s\S]*?</w:tr>", tbl_xml))
    if not rows:
        return tbl_xml
    row = rows[0].group(0)
    cells = list(re.finditer(r"<w:tc[\s>][\s\S]*?</w:tc>", row))
    if len(cells) < 3:
        return tbl_xml
    maps = {
        1: "CHỦ NHIỆM NHIỆM VỤ (Ký xác nhận trách nhiệm chuyên môn, ghi rõ họ tên) {{chu_nhiem}}",
        2: (
            "ĐẠI DIỆN BÊN B THỦ TRƯỞNG ĐƠN VỊ CHỦ TRÌ "
            "(Ký, ghi rõ họ tên, chức vụ và đóng dấu) {{dai_dien_ben_b}}"
        ),
    }
    rparts = [row[: cells[0].start()]]
    for ci, cm in enumerate(cells):
        tc = cm.group(0)
        if ci in maps:
            tc = rewrite_cell_text(tc, maps[ci])
        rparts.append(tc)
    rparts.append(row[cells[-1].end() :])
    new_row = "".join(rparts)
    return tbl_xml[: rows[0].start()] + new_row + tbl_xml[rows[0].end() :]


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Thiếu file nguồn: {SRC}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(SRC) as zin:
        xml = zin.read("word/document.xml").decode("utf-8")

        # Thứ tự Điện thoại/Email: Bên B rồi CNNV
        pe_idx = {"phone": 0, "email": 0}

        def repl_para(m: re.Match[str]) -> str:
            p = m.group(0)
            text = norm(get_text(p))
            if not text.strip():
                return p
            c = compact(text)

            # Tài khoản Bên B (có chỗ trống) — không đụng tài khoản Bên A cố định
            if (
                c.startswith("Tài khoản:")
                and "ngân hàng" in c.lower()
                and has_blank(text)
            ):
                return rebuild_p(
                    p, "Tài khoản: {{tai_khoan_ben_b}} tại ngân hàng {{ngan_hang_ben_b}}"
                )

            if c.startswith("Địa chỉ:") and has_blank(text):
                return rebuild_p(p, "Địa chỉ: {{dia_chi_ben_b}}")

            if c.startswith("Điện thoại:") and has_blank(text):
                pe_idx["phone"] += 1
                if pe_idx["phone"] == 1:
                    return rebuild_p(p, "Điện thoại: {{dien_thoai_ben_b}}")
                return rebuild_p(p, "Điện thoại: {{dien_thoai_chu_nhiem}}")

            if c.startswith("Email:") and has_blank(text):
                pe_idx["email"] += 1
                if pe_idx["email"] == 1:
                    return rebuild_p(p, "Email: {{email_ben_b}}")
                return rebuild_p(p, "Email: {{email_chu_nhiem}}")

            new = rewrite_para_text(text)
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

        # Preview + biến
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
                        vals = [norm(get_text(c))[:120] for c in cells]
                        lines.append(f"  R{ri}: " + " | ".join(vals))
                else:
                    t = norm(get_text(chunk)).strip()
                    if t:
                        lines.append(t)

        preview = OUT_DIR / "TEMPLATE_preview.txt"
        preview.write_text("\n".join(lines), encoding="utf-8")

        vars_found = sorted(set(re.findall(r"\{\{(\w+)\}\}", new_xml)))
        # Đảm bảo không còn {{ tách run
        bad = 0
        for m in re.finditer(r"<w:t[^>]*>([^<]*)</w:t>", new_xml):
            t = m.group(1)
            if ("{{" in t and "}}" not in t) or ("}}" in t and "{{" not in t):
                bad += 1
                print("SPLIT_TAG", repr(t[:80]))

        tmp = OUT.with_suffix(".tmp.docx")
        with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if item.filename == "word/document.xml":
                    data = new_xml.encode("utf-8")
                zout.writestr(item, data)
        os.replace(tmp, OUT)
        print("wrote", str(OUT), OUT.stat().st_size)
        print("vars", len(vars_found), ",".join(vars_found))
        print("split_tags", bad)
        print("preview", str(preview))


if __name__ == "__main__":
    main()
