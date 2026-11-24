# -*- coding: utf-8 -*-
"""Sinh BM-05.06 biên bản ĐGCK có biến {{...}} từ mẫu giấy gốc."""
from __future__ import annotations

import os
import re
import zipfile
from pathlib import Path

SRC = Path(r"c:\quanlydetai\tailieu\bieu-mau-chung\bb-danh-gia-thuc-hien-nv.docx")
OUT_DIR = Path(__file__).resolve().parent
OUT = OUT_DIR / "BM-05.06_Bien_ban_danh_gia_ket_qua_co_bien.docx"

REPLACES = {
    "Tên nhiệm vụ: .........................................................................................": "Tên nhiệm vụ: {{ten_nhiem_vu}}",
    "Mã số: .......................... Chủ nhiệm nhiệm vụ: ..............................................": (
        "Mã số: {{ma_so}} Chủ nhiệm nhiệm vụ: {{chu_nhiem}}"
    ),
    "Tổ chức/đơn vị chủ trì: ...............................................................................": (
        "Tổ chức/đơn vị chủ trì: {{to_chuc_chu_tri}}"
    ),
    "Quyết định thành lập Hội đồng/Tổ chuyên gia số: ..........................................": (
        "Quyết định thành lập Hội đồng/Tổ chuyên gia số: {{so_qd_hd}}"
    ),
    "Thời gian, địa điểm/hình thức họp: ..............................................................": (
        "Thời gian, địa điểm/hình thức họp: {{thoi_gian_dia_diem}}"
    ),
    "Chủ tịch/Tổ trưởng: ............................... Thư ký: ......................................": (
        "Chủ tịch/Tổ trưởng: {{chu_tich}} Thư ký: {{thu_ky}}"
    ),
    "Tổng số thành viên: …………; số tham dự hợp lệ: …………": (
        "Tổng số thành viên: {{tong_tv}}; số tham dự hợp lệ: {{so_tham_du}}"
    ),
    "........................................................................................................................": "{{dong_trong}}",
    "Kết quả biểu quyết: Đạt …… phiếu; Cần bổ sung, hoàn thiện …… phiếu; Không đạt …… phiếu.": (
        "Kết quả biểu quyết: Đạt {{phieu_dat}} phiếu; Cần bổ sung, hoàn thiện {{phieu_bo_sung}} phiếu; Không đạt {{phieu_khong_dat}} phiếu."
    ),
    "Số thành viên có quyền biểu quyết: …………; điều kiện thông qua thực hiện theo Phụ lục 01.": (
        "Số thành viên có quyền biểu quyết: {{so_quyen_bieu_quyet}}; điều kiện thông qua thực hiện theo Phụ lục 01."
    ),
    "Kết luận: ☐ Đạt     ☐ Cần bổ sung, hoàn thiện để đủ cơ sở kết luận     ☐ Không đạt": (
        "Kết luận: {{ket_luan}}"
    ),
    "Nội dung cần hoàn thiện (nếu có): ....................................................................": (
        "Nội dung cần hoàn thiện (nếu có): {{noi_dung_hoan_thien}}"
    ),
    "Thời hạn: ................................ Người kiểm tra, xác nhận: .................................": (
        "Thời hạn: {{thoi_han}} Người kiểm tra, xác nhận: {{nguoi_kiem_tra}}"
    ),
    "Xử lý tiếp theo: ☐ Xác nhận hoàn thiện hồ sơ     ☐ Đề nghị đánh giá lại": (
        "Xử lý tiếp theo: {{xu_ly_tiep_theo}}"
    ),
    "Kiến nghị khác, gồm xử lý rủi ro nghiên cứu hoặc khai thác kết quả (nếu có): ....................": (
        "Kiến nghị khác, gồm xử lý rủi ro nghiên cứu hoặc khai thác kết quả (nếu có): {{kien_nghi_khac}}"
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
        blank_used = 0

        def repl_para(m: re.Match[str]) -> str:
            nonlocal blank_used
            p = m.group(0)
            text = norm(get_text(p))
            if text == "........................................................................................................................":
                blank_used += 1
                # 2.2 rồi 2.3 — hai dòng chấm giống nhau
                if blank_used == 1:
                    return rebuild_p(p, "{{noi_dung_lam_ro}}")
                if blank_used == 2:
                    return rebuild_p(p, "{{giai_trinh_y_kien}}")
                return rebuild_p(p, "{{dong_trong}}")
            if text in REPLACES:
                return rebuild_p(p, REPLACES[text])
            # 2.1 nhận xét chung — đoạn mô tả cố định → thay bằng biến
            if text.startswith("Tổng hợp nhận xét về mức độ hoàn thành"):
                return rebuild_p(p, "{{nhan_xet_chung}}")
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


if __name__ == "__main__":
    main()
