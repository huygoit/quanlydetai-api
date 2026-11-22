# -*- coding: utf-8 -*-
"""Sinh BM-05.01_Don_de_nghi_danh_gia_ket_qua_co_bien.docx từ mẫu giấy gốc."""
from __future__ import annotations

import os
import re
import zipfile
from pathlib import Path

SRC = Path(r"c:\quanlydetai\tailieu\bieu-mau-chung\bm-don-de-nghi.docx")
OUT_DIR = Path(__file__).resolve().parent
OUT = OUT_DIR / "BM-05.01_Don_de_nghi_danh_gia_ket_qua_co_bien.docx"

REPLACES = {
    "Đà Nẵng, ngày …… tháng …… năm ……": "Đà Nẵng, {{ngay_lap}}",
    "Tên nhiệm vụ: ...................................................................................................": "Tên nhiệm vụ: {{ten_nhiem_vu}}",
    "Mã số (nếu có): .............................. Cấp quản lý: ................................................": (
        "Mã số (nếu có): {{ma_so}}     Cấp quản lý: {{cap_quan_ly}}"
    ),
    "Quyết định phê duyệt/Hợp đồng số: ........................ ngày .................................": (
        "Quyết định phê duyệt/Hợp đồng số: {{so_qd_hd}} ngày {{ngay_qd_hd}}"
    ),
    "Chủ nhiệm nhiệm vụ: .............................. Tổ chức/đơn vị chủ trì: ........................": (
        "Chủ nhiệm nhiệm vụ: {{chu_nhiem}}     Tổ chức/đơn vị chủ trì: {{to_chuc_chu_tri}}"
    ),
    "Thời gian thực hiện: từ ........................ đến ........................ (gia hạn nếu có: ............)": (
        "Thời gian thực hiện: từ {{thoi_gian_tu}} đến {{thoi_gian_den}} (gia hạn nếu có: {{gia_han}})"
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


def get_text(p_xml: str) -> str:
    return "".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", p_xml))


def get_pPr(p_xml: str) -> str:
    m = re.search(r"<w:pPr>.*?</w:pPr>", p_xml, re.DOTALL)
    return m.group(0) if m else ""


def first_rPr(p_xml: str) -> str:
    m = re.search(r"<w:rPr>.*?</w:rPr>", p_xml, re.DOTALL)
    return m.group(0) if m else ""


def rebuild_p(p_xml: str, new_text: str) -> str:
    p_pr = get_pPr(p_xml)
    r_pr = first_rPr(p_xml)
    body = f'<w:r>{r_pr}<w:t xml:space="preserve">{esc(new_text)}</w:t></w:r>'
    return f"<w:p>{p_pr}{body}</w:p>"


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(SRC) as zin:
        xml = zin.read("word/document.xml").decode("utf-8")

        def repl_para(m: re.Match[str]) -> str:
            p = m.group(0)
            text = norm(get_text(p))
            if text in REPLACES:
                return rebuild_p(p, REPLACES[text])
            return p

        new_xml = re.sub(r"<w:p[\s>][\s\S]*?</w:p>", repl_para, xml)

        preview = OUT_DIR / "TEMPLATE_preview.txt"
        lines: list[str] = []
        for m in re.finditer(r"<w:p[\s>][\s\S]*?</w:p>", new_xml):
            t = norm(get_text(m.group(0)))
            if t.strip():
                lines.append(t)
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
