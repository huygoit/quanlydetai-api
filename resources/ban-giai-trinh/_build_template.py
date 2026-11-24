# -*- coding: utf-8 -*-
"""
Sinh BM-05.07 bản giải trình tiếp thu có biến {{...}} từ mẫu giấy gốc.
- Thông tin nhiệm vụ: biến từng dòng.
- Bảng nội dung tiếp thu: một biến {{bang_noi_dung}} (cả bảng).
"""
from __future__ import annotations

import os
import re
import zipfile
from pathlib import Path

SRC = Path(r"c:\quanlydetai\tailieu\bieu-mau-chung\ban-giai-trinh-tiep-thu-y-kien.docx")
OUT_DIR = Path(__file__).resolve().parent
OUT = OUT_DIR / "BM-05.07_Ban_giai_trinh_tiep_thu_co_bien.docx"

PARA_REPLACES = {
    "Đà Nẵng, ngày …… tháng …… năm ……": "Đà Nẵng, {{ngay_lap}}",
    "Tên nhiệm vụ: ........................................................................................": (
        "Tên nhiệm vụ: {{ten_nhiem_vu}}"
    ),
    "Mã số: .......................... Chủ nhiệm nhiệm vụ: ............................................": (
        "Mã số: {{ma_so}} Chủ nhiệm nhiệm vụ: {{chu_nhiem}}"
    ),
    "Ngày đánh giá: ....................... Hội đồng/Tổ chuyên gia/chuyên gia: ...................": (
        "Ngày đánh giá: {{ngay_danh_gia}} Hội đồng/Tổ chuyên gia/chuyên gia: {{ten_hoi_dong}}"
    ),
}


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


def para_with_text(text: str, style_from: str | None = None) -> str:
    p_pr = get_pPr(style_from) if style_from else ""
    r_pr = first_rPr(style_from) if style_from else ""
    return (
        f"<w:p>{p_pr}<w:r>{r_pr}"
        f'<w:t xml:space="preserve">{esc(text)}</w:t></w:r></w:p>'
    )


def rebuild_p(p_xml: str, new_text: str) -> str:
    return para_with_text(new_text, p_xml)


def is_noi_dung_table(tbl_xml: str) -> bool:
    """Bảng có cột Ý kiến / Nội dung tiếp thu / Minh chứng."""
    text = norm(get_text(tbl_xml)).lower()
    return (
        "ý kiến" in text
        and "tiếp thu" in text
        and ("minh chứng" in text or "vị trí" in text)
    )


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(SRC) as zin:
        xml = zin.read("word/document.xml").decode("utf-8")

        def repl_tbl(m: re.Match[str]) -> str:
            tbl = m.group(0)
            if is_noi_dung_table(tbl):
                return para_with_text("{{bang_noi_dung}}")
            return tbl

        new_xml = re.sub(r"<w:tbl[\s>][\s\S]*?</w:tbl>", repl_tbl, xml)

        def repl_para(m: re.Match[str]) -> str:
            p = m.group(0)
            text = norm(get_text(p))
            compact = re.sub(r"\s+", " ", text).strip()
            for old, new in PARA_REPLACES.items():
                if compact == re.sub(r"\s+", " ", old).strip() or text == old:
                    return rebuild_p(p, new)
            if text.startswith("Đà Nẵng, ngày") and "tháng" in text and "năm" in text:
                return rebuild_p(p, "Đà Nẵng, {{ngay_lap}}")
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


if __name__ == "__main__":
    main()
