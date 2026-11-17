# BM-02.02 — Mẫu thuyết minh nhiệm vụ (có biến)

- File: `BM-02.02_Thuyet_minh_co_bien.docx`
- Loại mẫu hệ thống: `THUYET_MINH` / form code `BM0202`
- Delimiter: `{{ten_bien}}` (docxtemplater)
- Catalog biến: `app/constants/bm0202_template_variables.ts`
- Đổ dữ liệu từ outline: `app/utils/outline_thuyet_minh_merge.ts` → `buildBm0202MergeData(outline)`

## Seed

```bash
node ace db:seed --files=database/seeders/19_contract_template_seeder.ts
```
