# Module 5–6 — API cho Frontend

Base: `http://localhost:3333`. Mọi API dưới đây cần header `Authorization: Bearer {token}`.

Body JSON. File không gửi multipart vào các API này. Upload trước qua `POST /api/uploads`, rồi gửi object:

```json
{ "fileName": "chung-tu.pdf", "fileUrl": "/storage/...", "fileSize": 120000 }
```

`fileSize` là byte. Vượt hạn thì API trả 422.

Envelope thành công: `{ "success": true, "data": ... }`. Lỗi: `{ "success": false, "message": "..." }` với 403 / 404 / 422.

Hai kiểu tên field:

- Hợp đồng cũ (`/api/project-contracts` trừ `GET /:id/flow`): **snake_case** (`contract_no`, `file_url`).
- `GET /api/project-contracts/:id/flow` và toàn bộ `/api/module56`: **camelCase**.

Sau mỗi nút ký / chuyển trạng thái hợp đồng, gọi lại `GET /:id/flow` để lấy `workflow` và `roles`. Các POST ký chỉ trả bản ghi snake_case, không có `roles`.

Thuyết minh (`GET` outline) đã có `executionStatus`, `contractStatus`, `activeContractId`, `extensionCount`. Vòng đời triển khai đọc `executionStatus`, không đọc `status` thuyết minh.

## Ai thấy nút nào

| Việc | Điều kiện |
|---|---|
| PKH soạn, phân bổ, duyệt phiếu | quyền `project.contract_manage` |
| CNNV | `ownerId` của thuyết minh |
| BGH ký | `project.outline_approve` |
| TC-HC phát hành | `project.contract_publish` |
| KH-TC chứng từ / quyết toán | `project.budget_confirm` |
| CSVC mua sắm | `project.procurement_handle` |
| Gia hạn lần 2 | `project.contract_lead_confirm` |

`GET /:id/flow` trả `roles.canManage`, `roles.canCnnv`, `roles.canBgh`, `roles.canPublish`. Ẩn nút theo các cờ này.

## Trạng thái

Hợp đồng: `HOP_DONG_DRAFT` → `HOP_DONG_CHO_CNNV` → `HOP_DONG_CHO_KY` → `HOP_DONG_CHO_PHAT_HANH` → `HOP_DONG_DA_KY`.

CNNV xác nhận nội dung **không** đổi status. Chỉ set `workflow.cnnvConfirmedAt`. Nút “Trình BGH” bật khi status là `HOP_DONG_CHO_CNNV` và `cnnvConfirmedAt` khác null. Nút “CNNV ký” bật khi `HOP_DONG_CHO_PHAT_HANH` và `workflow.publishedAt` khác null.

Nhiệm vụ (`executionStatus`): `DANG_THUC_HIEN` → `DGCK_DRAFT` → `DGCK_CHO_PKH` → `DGCK_BS` hoặc `DGCK_HOP_HD` → `DGCK_CHINH_SUA` / `DGCK_KHONG_DAT` / `DGCK_CHO_QUYET_TOAN` → `DGCK_CHO_THANH_LY` → `HOAN_THANH`. Dừng hẳn: `DGCK_DINH_CHI`.

10 mục chi: `MUC_01` … `MUC_10` (01 công, 02 vật tư, 03 TSCĐ, 04 hội thảo, 05 thuê ngoài, 06 khảo sát, 07 VPP, 08 họp, 09 quản lý chung ≤ 5%, 10 khác).

## Hợp đồng

| Method | Path | Ai | Body |
|---|---|---|---|
| GET | `/api/project-contracts?page&perPage&status&keyword` | xem | |
| GET | `/api/project-contracts/by-outline/:outlineId` | xem | 404 nếu chưa sinh |
| POST | `/api/project-contracts/by-outline/:outlineId/generate` | PKH | `{ "forceRegen": false }` chỉ khi còn draft. Sinh lại vẫn giữ điều khoản PKH đã sửa |
| GET | `/api/project-contracts/:id/download` | xem | file DOCX |
| GET | `/api/project-contracts/:id/flow` | xem | bản đủ cho màn ký |
| PUT | `/api/project-contracts/:id/external` | PKH | `externalContractNo`, `externalAgency`, `externalFileUrl` |
| PUT | `/api/project-contracts/:id/clauses` | PKH, còn draft | `{ "fields": { "dia_diem_ky": "Hà Nội", "so_hop_dong": "HD-01" } }` |
| PUT | `/api/project-contracts/:id/budget-lines` | PKH, còn draft | `{ "lines": [{ "code": "MUC_01", "amount": 0 }] }` đủ 10 mã, tổng = kinh phí đã duyệt |
| POST | `/api/project-contracts/:id/submit-cnnv` | PKH | |
| POST | `/api/project-contracts/:id/cnnv-confirm` | CNNV | |
| POST | `/api/project-contracts/:id/cnnv-return` | CNNV | `{ "reason" }` |
| POST | `/api/project-contracts/:id/submit-bgh` | PKH | |
| POST | `/api/project-contracts/:id/bgh-sign` | BGH | |
| POST | `/api/project-contracts/:id/bgh-return` | BGH | `{ "reason" }` |
| POST | `/api/project-contracts/:id/publish` | TC-HC | `{ "issueNo" }` |
| POST | `/api/project-contracts/:id/cnnv-sign` | CNNV | `{ "signedFileUrl" }` có thể rỗng |

`GET /:id/flow` → `data` là bản hợp đồng snake_case cộng:

```json
{
  "workflow": {
    "externalContractNo": null,
    "externalAgency": null,
    "externalFileUrl": null,
    "returnReason": null,
    "cnnvConfirmedAt": null,
    "bghSignedAt": null,
    "publishedAt": null,
    "issueNo": null,
    "cnnvSignedAt": null,
    "signedFileUrl": null,
    "effectiveAt": null
  },
  "executionStatus": null,
  "roles": { "canManage": true, "canCnnv": false, "canBgh": false, "canPublish": false },
  "clauseFields": [{ "key": "dia_diem_ky", "label": "Địa điểm ký", "group": "Ký kết", "value": "", "editable": true }]
}
```

`PUT /:id/clauses` trả cùng dạng `GET /:id/flow`. Chỉ sửa được khi `HOP_DONG_DRAFT` và `editable: true`. Các trường tên nhiệm vụ, thời gian, kinh phí, bên B lấy lại từ thuyết minh, không ghi đè bằng API này.

Sổ mục chi: `GET /api/module56/budget/:outlineId`

```json
[{ "code": "MUC_01", "label": "Công lao động trực tiếp", "planned": 0, "advanced": 0, "spent": 0, "settled": 0, "remaining": 0 }]
```

`remaining = planned - spent - advanced`. Số âm hoặc phiếu `overBudget: true` chỉ là cảnh báo, vẫn cho nộp.

## Tạm ứng / thanh toán

`GET /api/module56/payments?outlineId=`

`POST /api/module56/payments`

```json
{
  "id": null,
  "projectOutlineId": 1,
  "submit": true,
  "kind": "TAM_UNG",
  "lineCode": "MUC_01",
  "amount": 1000000,
  "detail": "Nội dung",
  "bankAccount": "0123",
  "bankName": "VCB",
  "attachments": [{ "fileName": "a.pdf", "fileUrl": "/storage/a.pdf", "fileSize": 1000 }]
}
```

`kind`: `TAM_UNG` hoặc `THANH_TOAN`. Mỗi file ≤ 10MB. `submit: false` chỉ lưu nháp. Có `id` thì sửa khi status `YCKT_DRAFT` hoặc `YCKT_BS`.

| POST | Body | Kết quả |
|---|---|---|
| `/payments/:id/pkh` | `{ "action": "accept" \| "return" \| "reject", "reason" }` | accept → `YCKT_TC`. return → `YCKT_BS`. reject → về nháp |
| `/payments/:id/tc` | `{ "accept": true, "voucherNo": "CT-1", "voucherDate": "2026-10-09", "reason": "" }` | accept → `YCKT_DONE` và ghi sổ. Từ chối trả PKH, bắt `reason` |

KH-TC gọi list không truyền `status` thì chỉ thấy `YCKT_TC`.

## Mua sắm

`GET /api/module56/procurements?outlineId=`

`POST /api/module56/procurements`

```json
{
  "projectOutlineId": 1,
  "submit": true,
  "kind": "VAT_TU",
  "lineCode": "MUC_02",
  "purpose": "Mua hóa chất",
  "neededBy": "2026-11-01",
  "overBudgetNote": "",
  "items": [{ "name": "Hóa chất A", "unit": "lọ", "qty": 2, "unitPrice": 50000, "spec": "PA" }],
  "attachments": []
}
```

`kind`: `VAT_TU` | `DUNG_CU` | `THIET_BI` | `THUE_NGOAI`. `lineCode` chỉ `MUC_02`, `MUC_03`, `MUC_05`. Thành tiền do server tính. Vượt dư mà nộp thì bắt `overBudgetNote`.

| POST | Body |
|---|---|
| `/procurements/:id/pkh` | `action`: `accept` (sang CSVC), `return` (bổ sung), `to_bs` (mở lại sau từ chối / đấu thầu hỏng), `close` |
| `/procurements/:id/csvc` | `action`: `supply` \| `reject` \| `bid_fail`. `supply` cần `method`: `MUA_TRUC_TIEP` hoặc `DAU_THAU` |
| `/procurements/:id/receive` | CNNV xác nhận đã nhận. Không body |
| `/procurements/:id/tc` | giống thanh toán: `accept`, `voucherNo`, `voucherDate`, `reason` |

`MS_DONE` ghi sổ `spent`. Dòng `MUC_03` được copy vào tab tài sản của màn thanh lý.

## Báo cáo tiến độ

`GET /api/module56/progress?outlineId=`

`data.finance`: tổng `advanced`, `spent`, `settled` và `lines`. `data.periods[]`: `id`, `title`, `dueOn`, `kind` (`MILESTONE` | `MIDPOINT`), `overdue`, `report`.

`POST /api/module56/progress/periods/:periodId`

```json
{
  "outlineId": 1,
  "submit": true,
  "contentRows": [{ "milestone": "Đúng chữ trên thuyết minh", "progress": "50%", "done": "Đã làm" }],
  "productRows": [{ "name": "Đúng tên sản phẩm", "achieved": "1 bài" }],
  "nextPlan": "Bắt buộc khi nộp",
  "recommendation": "",
  "attachments": []
}
```

Tổng file ≤ 50MB. Kinh phí trên màn này lấy từ `data.finance`, không cho sửa. Sửa được khi `BCTD_DRAFT` hoặc `BCTD_BS`.

`POST /api/module56/progress/:id/pkh` với `{ "accept": true, "note": "" }`. `id` là id báo cáo, không phải id kỳ.

## Điều chỉnh

`GET /api/module56/adjustments?outlineId=`

`POST /api/module56/adjustments`

```json
{
  "projectOutlineId": 1,
  "submit": true,
  "reason": "Bắt buộc",
  "evidenceUrl": "/storage/minh-chung.pdf",
  "changes": {
    "endDate": "2027-06-30",
    "principalUserId": 12,
    "content": "Nội dung mới",
    "milestones": [{ "content": "Mốc 1", "startDate": null, "endDate": "2027-01-01", "expectedResult": null }],
    "budgetLines": [{ "code": "MUC_01", "amount": 0 }]
  }
}
```

Chỉ cần ít nhất một khóa trong `changes`. `budgetLines` nếu có thì đủ 10 mã. Một nhiệm vụ chỉ một phiếu chưa kết thúc.

| POST | Body |
|---|---|
| `/adjustments/:id/lead-confirm` | không body. Bắt buộc trước khi PKH trình BGH nếu đây là gia hạn lần 2 trở đi (`extensionCount >= 1` và có `endDate`) |
| `/adjustments/:id/pkh` | `{ "action": "accept" \| "return", "note" }` |
| `/adjustments/:id/bgh` | `{ "accept": true, "note": "" }`. Duyệt thì response có `appendixFileUrl` (DOCX phụ lục cũ/mới) |

## Đánh giá cuối kỳ

Một nhiệm vụ một hồ sơ. Màn hình đọc `GET /api/module56/final/:outlineId`.

`data` gồm: `executionStatus`, `overdueExplanation`, `dossier`, `council`, `sheets`, `minutes`, `minutesLocked`, `minutesFileUrl`, `classification`, `explanation`, `settlement`, `liquidation`, `finance`, `assets`.

Nộp chính thức chỉ khi PKH đã thông báo (`dossier.notifiedAt`) hoặc còn ≤ 30 ngày tới `endDate`.

| Method | Path | Body chính |
|---|---|---|
| POST | `/final/:outlineId/notify` | PKH gửi thông báo |
| PUT | `/final/:outlineId/dossier` | `submit`, `summaryFile`, `briefFile` (≤ 30MB / 10MB), `resultVi`, `resultEn`, `products: [{ name, fileUrl, link }]`, `councilFile`, `publicationsNote`. `name` đúng sản phẩm thuyết minh. Mỗi sản phẩm cần file hoặc link khi nộp |
| POST | `/final/:outlineId/dossier-review` | `{ "accept": true, "briefPagesOk": true, "note": "" }`. Chuyển họp hội đồng thì `briefPagesOk` phải true |
| PUT | `/final/:outlineId/council` | `{ "meetingAt": "2026-12-01T08:00:00", "location": "Phòng họp", "members": [{ "userId": 1, "role": "CHU_TICH" }] }`. Đúng 1 `CHU_TICH`, 1 `THU_KY`, ≥ 2 `PHAN_BIEN`. `UY_VIEN` tùy chọn. Response có thêm `reviewDeadlineTight` |
| POST | `/final/:outlineId/remind/:userId` | nhắc một phản biện |
| PUT | `/final/:outlineId/sheet` | phản biện đang đăng nhập. `volumeComment`, `qualityComment`, `reportComment`, `generalComment` (≥ 100 ký tự), `productRows: [{ name, actual, comment }]` |
| POST | `/final/:outlineId/minutes` | `{ "presentUserIds": [1,2], "classification": "DAT_YEU_CAU", "discussion": "", "volume": "", "quality": "", "recommendation": "Mỗi kiến nghị một dòng", "productMarks": [{ "name": "Sản phẩm", "met": true }] }`. Xếp loại: `DAT_YEU_CAU` \| `CAN_BO_SUNG` \| `KHONG_DAT`. Có mặt ≥ 2/3. Sau khi lưu, tải `minutesFileUrl` (DOCX) |
| POST | `/final/:outlineId/fail-decision` | `{ "retry": true }` cho làm lại, `false` thì đình chỉ |
| PUT | `/final/:outlineId/explanation` | `{ "submit": true, "items": [{ "response": "..." }], "reportFile": { ... } }`. Số phần tử `items` bằng số dòng kiến nghị |
| POST | `/final/:outlineId/explanation-confirm` | thư ký rồi chủ tịch. `{ "accept": true, "reason": "" }` |
| POST | `/final/:outlineId/explanation-extend` | `{ "deadline": "2026-12-20" }` |
| PUT | `/final/:outlineId/settlement` | `{ "submit": true, "lines": [{ "code": "MUC_01", "declaredAmount": 0 }], "files": [] }` đủ 10 mã |
| POST | `/final/:outlineId/settlement-pkh` | `{ "accept": true, "note": "" }` |
| POST | `/final/:outlineId/variance` | `{ "reason" }` khi số khai khác cột `spent` |
| POST | `/final/:outlineId/settlement-tc` | `{ "accept": true, "date": "2026-12-20", "reason": "" }` |
| PUT | `/final/:outlineId/liquidation` | `{ "surplusHandling": "HOAN_TRA", "recognitionFileUrl": "", "assets": [{ "name": "", "quantity": "1", "amount": 0, "note": "" }] }`. `surplusHandling`: `HOAN_TRA` hoặc `KHONG_PHAT_SINH`. Gửi `assets` là thay cả danh sách |
| POST | `/final/:outlineId/liquidation-submit` | sinh DOCX, trình BGH |
| POST | `/final/:outlineId/liquidation-bgh` | `{ "accept": true, "reason": "" }` |
| POST | `/final/:outlineId/liquidation-publish` | `{ "issueNo" }` |
| POST | `/final/:outlineId/liquidation-cnnv` | CNNV xác nhận. Xong thì `executionStatus = HOAN_THANH` |

`liquidation.surplus` = đã tạm ứng + đã chi − đã quyết toán. `liquidation.fileUrl` là file BM.14.

Hồ sơ khoa học của thành viên, field `completedResearchTasks`, chỉ có thêm dòng sau `HOAN_THANH`.
