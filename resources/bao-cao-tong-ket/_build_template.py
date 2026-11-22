# -*- coding: utf-8 -*-
"""
Sinh BM-05.02_Bao_cao_tong_ket_co_bien.docx từ mẫu giấy gốc.
- Bảng thông tin chung: giữ cấu trúc, mỗi dòng giá trị = một {{biến}}.
- Bảng sản phẩm: một biến {{bang_san_pham}} (cả bảng).
"""
from __future__ import annotations

import os
import re
import zipfile
from pathlib import Path

SRC = Path(r"c:\quanlydetai\tailieu\bieu-mau-chung\bao-cao-tong-ket.docx")
OUT_DIR = Path(__file__).resolve().parent
OUT = OUT_DIR / "BM-05.02_Bao_cao_tong_ket_co_bien.docx"

# Bảng sản phẩm (thứ tự bảng trong file) → một biến cả bảng
TABLE_AS_ONE_VAR = {
    3: "bang_san_pham",
}

# Nhãn dòng (ô trái) → biến ô phải trong bảng thông tin chung
THONG_TIN_CHUNG_BY_LABEL = {
    "tên nhiệm vụ": "ten_nhiem_vu",
    "mã số, cấp quản lý": "ma_so_cap_quan_ly",
    "chủ nhiệm nhiệm vụ": "chu_nhiem",
    "tổ chức/đơn vị chủ trì": "to_chuc_chu_tri",
    "quyết định phê duyệt/hợp đồng": "so_qd_hd",
    "thời gian thực hiện (gia hạn nếu có)": "thoi_gian_thuc_hien",
    "tổng kinh phí được phê duyệt": "tong_kinh_phi",
    "đơn vị phối hợp, đối tác (nếu có)": "don_vi_phoi_hop",
}

PARA_REPLACES = {
    "Đà Nẵng, ngày …… tháng …… năm ……": "Đà Nẵng, {{ngay_lap}}",
    "Tóm tắt mục tiêu, phương pháp, kết quả chính, sản phẩm và những đóng góp nổi bật của nhiệm vụ (khuyến nghị không quá 02 trang).": "{{tom_tat_ket_qua}}",
    "Trình bày tổng quan các nghiên cứu trong và ngoài nước có liên quan; cập nhật những kết quả mới, làm rõ khoảng trống nghiên cứu và cơ sở khoa học của nhiệm vụ.": "{{tong_quan_van_de}}",
    "Trình bày mục tiêu đối tượng và phạm vi nghiên cứu theo thuyết minh đã được phê duyệt và các điều chỉnh (nếu có).": "{{muc_tieu_doi_tuong_pham_vi}}",
    "Trình bày nội dung nghiên cứu theo thuyết minh đã được phê duyệt và các điều chỉnh (nếu có).": "{{noi_dung_nghien_cuu}}",
    "Trình bày phương pháp, quy trình và kỹ thuật nghiên cứu đã sử dụng.": "{{phuong_phap_nghien_cuu}}",
    "Trình bày, phân tích và thảo luận kết quả theo các nội dung nghiên cứu; đối chiếu với những nghiên cứu có liên quan, làm rõ giá trị khoa học và những hạn chế của kết quả.": "{{ket_qua_nghien_cuu}}",
    "Đối với sản phẩm chưa hoàn thành hoặc có thay đổi so với thuyết minh, nêu rõ nguyên nhân.": "{{ghi_chu_san_pham}}",
    "Trình bày giá trị khoa học, đào tạo, khả năng ứng dụng, chuyển giao, thương mại hóa hoặc tác động thực tiễn của kết quả, phù hợp với loại hình nhiệm vụ.": "{{hieu_qua_ung_dung}}",
    "Khái quát những kết quả chủ yếu, đóng góp mới và mức độ đáp ứng mục tiêu nghiên cứu.": "{{ket_luan}}",
    "Đề xuất việc sử dụng, ứng dụng, chuyển giao kết quả hoặc định hướng nghiên cứu tiếp theo (nếu có).": "{{kien_nghi}}",
    "Liệt kê các tài liệu được trích dẫn trong báo cáo theo một chuẩn thống nhất.": "{{tai_lieu_tham_khao}}",
    "Kèm theo các tài liệu, số liệu, hình ảnh, sản phẩm hoặc minh chứng cần thiết; có thể dẫn chiếu đến hồ sơ điện tử đã được lưu trữ trên hệ thống.": "{{phu_luc_minh_chung}}",
}


def norm(t: str) -> str:
    return (
        t.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .strip()
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


def para_with_text(text: str, style_from: str | None = None) -> str:
    p_pr = get_pPr(style_from) if style_from else ""
    r_pr = first_rPr(style_from) if style_from else ""
    return (
        f"<w:p>{p_pr}<w:r>{r_pr}"
        f'<w:t xml:space="preserve">{esc(text)}</w:t></w:r></w:p>'
    )


def rebuild_cell_with_text(tc_xml: str, text: str) -> str:
    """Giữ tcPr, thay toàn bộ nội dung ô bằng một đoạn text."""
    tc_pr = ""
    m = re.search(r"<w:tcPr>.*?</w:tcPr>", tc_xml, re.DOTALL)
    if m:
        tc_pr = m.group(0)
    # lấy style từ đoạn đầu trong ô (nếu có)
    p0 = re.search(r"<w:p[\s>][\s\S]*?</w:p>", tc_xml)
    style = p0.group(0) if p0 else None
    return f"<w:tc>{tc_pr}{para_with_text(text, style)}</w:tc>"


def fill_thong_tin_chung_table(tbl_xml: str) -> str:
    """Ô phải mỗi dòng → {{biến}} theo nhãn ô trái."""

    def repl_row(m: re.Match[str]) -> str:
        tr = m.group(0)
        cells = list(re.finditer(r"<w:tc[\s>][\s\S]*?</w:tc>", tr))
        if len(cells) < 2:
            return tr
        label = norm(get_text(cells[0].group(0))).lstrip("-–— ").strip().lower()
        label = re.sub(r"\s+", " ", label)
        var = THONG_TIN_CHUNG_BY_LABEL.get(label)
        if not var:
            return tr
        # thay ô thứ 2
        c2 = cells[1]
        new_c2 = rebuild_cell_with_text(c2.group(0), "{{" + var + "}}")
        return tr[: c2.start()] + new_c2 + tr[c2.end() :]

    return re.sub(r"<w:tr[\s>][\s\S]*?</w:tr>", repl_row, tbl_xml)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(SRC) as zin:
        xml = zin.read("word/document.xml").decode("utf-8")

        tbl_idx = 0

        def repl_tbl(m: re.Match[str]) -> str:
            nonlocal tbl_idx
            tbl_idx += 1
            # Bảng sản phẩm → một biến cả bảng
            one = TABLE_AS_ONE_VAR.get(tbl_idx)
            if one:
                return para_with_text("{{" + one + "}}")
            # Bảng thông tin chung (thường là bảng thứ 2)
            if tbl_idx == 2:
                return fill_thong_tin_chung_table(m.group(0))
            return m.group(0)

        new_xml = re.sub(r"<w:tbl[\s>][\s\S]*?</w:tbl>", repl_tbl, xml)

        def repl_para(m: re.Match[str]) -> str:
            p = m.group(0)
            text = norm(get_text(p))
            compact = re.sub(r"\s+", " ", text).strip()
            for old, new in PARA_REPLACES.items():
                if compact == re.sub(r"\s+", " ", old).strip() or text == old:
                    return para_with_text(new, p)
            if text.startswith("Đà Nẵng, ngày") and "tháng" in text and "năm" in text:
                return para_with_text("Đà Nẵng, {{ngay_lap}}", p)
            return p

        new_xml = re.sub(r"<w:p[\s>][\s\S]*?</w:p>", repl_para, new_xml)

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
                        vals = [norm(get_text(c))[:80] for c in cells]
                        lines.append(f"  R{ri}: " + " | ".join(vals))
                else:
                    t = norm(get_text(chunk))
                    if t:
                        lines.append(t)
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


if __name__ == "__main__":
    main()
