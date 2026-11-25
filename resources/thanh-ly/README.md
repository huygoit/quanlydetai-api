# BM-05.10 — Biên bản nghiệm thu và thanh lý hợp đồng

- Nguồn giấy: `tailieu/bieu-mau-chung/bb-nghiem-thu-thanh-ly.docx`
- Bản gốc copy: `bb-nghiem-thu-thanh-ly_goc.docx`
- File có biến: `BM-05.10_Bien_ban_nghiem_thu_thanh_ly_co_bien.docx` (47 biến `{{...}}`)
- Loại mẫu Admin: `THANH_LY` (formCode `BM0510`)
- Sinh lại: `python resources/thanh-ly/_build_template.py`
- Seed DB: `node ace db:seed --files=database/seeders/19_contract_template_seeder.ts`
- Kiểm tra merge: docxtemplater delimiters `{{` `}}` — không được tách tag giữa các run

Xuất khi PKH lưu / trình / phát hành thanh lý — `ProjectFinalService.writeLiquidationFile`.
