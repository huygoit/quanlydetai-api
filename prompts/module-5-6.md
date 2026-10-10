# Module 5 & 6 — Spec đã chốt

Nguồn nghiệp vụ: `UserStory_Module3-7_V4b_Final2608.docx` (phiên bản 4.0).

Ngày chốt: 09/10/2026. Các chỗ tài liệu gốc trống hoặc mâu thuẫn được khóa bằng quyết định `QD-xx` trong mục 2. Khi code, bám mục 2 và mục 3–4. Không mở lại bằng cách đọc phụ lục B của file Word.

Quy ước:

- **[TL]** = có trong user story, giữ nguyên.
- **[QD-xx]** = hướng đã chọn vì tài liệu không đủ hoặc nói hai kiểu. Lý do nằm ở mục 2.

Mã trạng thái không chứa ký tự `&`.

---

## 1. Code hiện có (đối chiếu 09/10/2026)

API nằm dưới `/api/project-contracts` (ký BM.06) và `/api/module56` (các phiếu còn lại). Doc gọi API cho FE: `prompts/module-5-6-fe.md`. Phần còn thiếu: `prompts/module-5-6-con-thieu.md`. Nhắc hạn: `node ace remind:module56`. Quyền mới: `project.contract_publish`, `project.contract_lead_confirm`, `project.procurement_handle` (seeder `20_module56_permissions_seeder`).

| Hạng mục | Trạng thái |
|---|---|
| US-05-01 sinh dự thảo + phân bổ 10 mục + CNNV xác nhận + BGH + phát hành + CNNV ký | Đã có API |
| US-05-02 tạm ứng / thanh toán, sổ kinh phí | Đã có API |
| US-05-03 báo cáo tiến độ theo mốc | Đã có API |
| US-05-04 điều chỉnh, gồm kinh phí và gia hạn lần 2 | Đã có API |
| US-05-05 mua sắm, tài sản mục TSCĐ | Đã có API |
| US-06-01 → US-06-06 hồ sơ, hội đồng, biên bản DOCX, giải trình, quyết toán, BM.14 | Đã có API |
| File biên bản / thanh lý | DOCX. Chưa có máy PDF |
| Ký số nhà cung cấp | Chưa làm, đúng QD-16 |

Lệch đã có trong code, cách xử lý khi làm tiếp:

- Mở Module 5 khi thuyết minh `SAN_SANG_THUC_HIEN` và `module5Opened = true`. Không thêm mã `TM_DUOC_DUYET`.
- Trạng thái thuyết minh (`project_outlines.status`) dừng ở Module 4. Vòng đời Module 5–6 ghi vào cột mới `execution_status` [QD-08].
- `project_contracts.status` chỉ còn các mã hợp đồng. `DANG_THUC_HIEN` nằm ở `execution_status` [QD-08].
- Dự toán thuyết minh đang 4 nhóm (`NHAN_CONG`, `VAT_TU`, `HOI_THAO`, `KHAC`). Không sửa bảng đó. Kinh phí triển khai dùng 10 mục mới [QD-04].
- `products` và `milestones` trên thuyết minh dùng lại cho BM.08 và BM.12a. Không nhập lại.

---

## 2. Quyết định đã chốt

### QD-01 — Một bộ mã Module 6: `DGCK_*`

Tài liệu dùng lẫn `ĐGCK_*`, `NT_*` và phụ lục B. Lưu DB một bộ:

| Việc | Mã |
|---|---|
| CNNV đang soạn | `DGCK_DRAFT` |
| Đã nộp, PKH kiểm tra | `DGCK_CHO_PKH` |
| PKH yêu cầu bổ sung | `DGCK_BS` |
| Đủ hồ sơ, đang hội đồng | `DGCK_HOP_HD` |
| HĐ yêu cầu hoàn thiện | `DGCK_CHINH_SUA` |
| Được quyết toán | `DGCK_CHO_QUYET_TOAN` |
| TC đã xác nhận quyết toán | `DGCK_CHO_THANH_LY` |
| Xong BM.14 | `HOAN_THANH` |
| Xếp loại không đạt, chờ PKH | `DGCK_KHONG_DAT` |
| PKH dừng nhiệm vụ | `DGCK_DINH_CHI` |

`NT_*` và `ĐGCK_*` không ghi DB, không trả API.

Lý do: bảng trạng thái đầu Module 6 đủ vòng đời hơn chữ `NT_` rải trong từng US. Bỏ dấu và `&` cho khớp enum hiện có (`SAN_SANG_THUC_HIEN`, `HOP_DONG_DRAFT`).

### QD-02 — Tạm ứng và mua sắm là hai hồ sơ

- `YCKT_*`: giấy đề nghị tạm ứng / thanh toán (BM.07). PKH chỉ chuyển KH-TC, trả bổ sung, hoặc từ chối.
- `MS_*`: đề nghị mua sắm (US-05-05). CSVC và KH-TC nằm trên phiếu này.
- Không có `YCKT_CSVC`. Không biến một phiếu tạm ứng thành phiếu mua sắm, không có `procurement_request_id` trên phiếu tạm ứng.

Lý do: US-05-05 đã có đủ PKH → CSVC → nhận hàng → KH-TC. Nhét mua sắm vào BM.07 tạo hai lần ghi sổ cho một lần chi. Câu “có mua sắm → YCKT_CSVC” trong US-05-02 được hiểu là CNNV phải lập phiếu mua sắm riêng.

### QD-03 — Actor tài chính

- Duyệt chi, chứng từ, quyết toán: `KH-TC`.
- Phát hành văn bản, lưu file đã ký: `TC-HC`.
- Chữ “TC” trong US-05-02 nghĩa là `KH-TC`.

### QD-04 — 10 mục chi và một sổ

Giữ nguyên `project_outline_budget_lines` cho thẩm định Module 4.

Khi hợp đồng còn `HOP_DONG_DRAFT`, PKH nhập bảng `project_budget_lines`: đúng 10 dòng, mã cố định.

| Mã | Nội dung |
|---|---|
| `MUC_01` | Công lao động trực tiếp |
| `MUC_02` | Vật tư |
| `MUC_03` | TSCĐ |
| `MUC_04` | Hội thảo / công tác phí |
| `MUC_05` | Thuê ngoài |
| `MUC_06` | Điều tra, khảo sát |
| `MUC_07` | Văn phòng phẩm |
| `MUC_08` | Họp hội đồng |
| `MUC_09` | Quản lý chung |
| `MUC_10` | Chi khác |

Ràng buộc lúc trình CNNV xác nhận hợp đồng:

- Đủ 10 dòng, số tiền ≥ 0.
- Tổng 10 dòng = kinh phí BGH đã duyệt trên thuyết minh.
- `MUC_09` ≤ 5% tổng.

Chưa phân bổ thì không sang `HOP_DONG_CHO_CNNV`.

Sổ `project_budget_entries` chỉ ghi khi phiếu hoàn tất (`YCKT_DONE`, `MS_DONE`) hoặc khi KH-TC chốt quyết toán. Số hiển thị đọc từ sổ, không cộng từ nhiều bảng.

| Việc | Cột tăng |
|---|---|
| Tạm ứng `YCKT_DONE` | `advanced` |
| Thanh toán `YCKT_DONE` | `spent` |
| Mua sắm `MS_DONE` | `spent` |
| KH-TC xác nhận quyết toán | `settled` (một lần, theo từng mục) |

`advanced` là tiền đã chuyển cho CNNV, chưa tính là đã chi. `spent` là đã chi. Tồn dự toán = dự toán − `spent` − `advanced`. Vượt tồn thì vẫn cho nộp, gắn `VUOT_DU_TOAN` [TL].

Không đặt trần % tạm ứng. Tài liệu không có số.

Lý do: sửa 4 nhóm Module 4 sẽ đổi dữ liệu đã thẩm định. 10 mục chỉ cần từ lúc có hợp đồng.

### QD-05 — BM.09 gồm kinh phí, duyệt cả phiếu, phụ lục là dữ liệu

Form có 5 mục điều chỉnh và lý do bắt buộc:

1. Thời gian (gia hạn)
2. Chủ nhiệm
3. Nội dung
4. Tiến độ
5. Kinh phí (tăng/giảm từng `MUC_*`, tổng mới vẫn phải bằng tổng hợp đồng mới)

Lý do không tính là một mục điều chỉnh. Ít nhất một trong năm mục phải có giá trị mới thì mới lưu được. AC1 ghi “4 mục” vì form gốc thiếu kinh phí; AC4 bắt báo KH-TC khi đổi kinh phí, nên mục kinh phí được thêm.

BGH duyệt hoặc từ chối cả phiếu. Không duyệt từng mục. Muốn tách việc thì CNNV nộp phiếu khác.

Mã: `DC_DRAFT` → `DC_PENDING_PKH` → (`DC_BS` | `DC_PENDING_BGH`) → (`DC_APPROVED` | `DC_REJECTED`).

Gia hạn lần 2 trở đi: cảnh báo, bắt buộc user có quyền trưởng hoặc phó phòng KH xác nhận trước khi sang BGH. Không chặn cứng.

`DC_APPROVED` thì cập nhật dữ liệu đang chạy (ngày kết thúc, CNNV, mốc, các dòng `project_budget_lines`), ghi phụ lục cũ/mới vào `appliedDiff`, và sinh file DOCX tại `appendixFileUrl`. Không sinh lại file BM.06 đã ký.

Đổi kinh phí: thông báo KH-TC. Đổi CNNV: thông báo CNNV cũ và CNNV mới. CNNV mới phải có tài khoản.

### QD-06 — Xếp loại không đạt

Ba mức giữ đúng BM.12b [TL]:

- Đạt yêu cầu, không phải sửa → `DGCK_CHO_QUYET_TOAN`
- Cần bổ sung, hoàn thiện → `DGCK_CHINH_SUA`
- Không đạt → `DGCK_KHONG_DAT`

Từ `DGCK_KHONG_DAT`, PKH chọn một trong hai:

- Cho làm lại hồ sơ → `DGCK_CHINH_SUA`
- Dừng → `DGCK_DINH_CHI`

`DGCK_DINH_CHI` không sang quyết toán, không sang `HOAN_THANH`.

### QD-07 — Biên bản BM.12b đủ mục 1–10

Thư ký nhập kết quả họp. Không có phiếu bầu từng thành viên. Tài liệu bảo thư ký ghi checkbox xếp loại, không bảo từng ủy viên bỏ phiếu trên hệ thống.

Có mặt ≥ 2/3 số thành viên đã gán thì mới được lưu. Thiếu một phiếu BM.12a của phản biện đã gán thì chưa lưu biên bản. PKH được đổi phản biện trước ngày họp nếu người đó chưa nộp.

| Mục | Nội dung | Nguồn |
|---|---|---|
| 1 | Tên nhiệm vụ, mã, CNNV, đơn vị | Tự điền |
| 2 | Số hợp đồng, ngày hiệu lực | Tự điền |
| 3 | Thời gian, địa điểm họp | Phiên hội đồng |
| 4 | Thành viên, vai trò, có mặt / vắng | Thư ký tick có mặt |
| 5 | Hồ sơ đã nộp (checklist BM.10/11) | Tự điền |
| 6 | Tóm tắt phiếu BM.12a | Tự điền, chỉ nhận xét |
| 7 | Ý kiến thảo luận tại cuộc họp | Thư ký nhập |
| 8 | Từng sản phẩm: theo thuyết minh, thực tế, đáp ứng hoặc không | Cột thuyết minh tự điền; thư ký chọn đáp ứng |
| 9 | 9.1 khối lượng, 9.2 chất lượng, 9.3 xếp loại, 9.4 kiến nghị | Thư ký nhập |
| 10 | Xác nhận thư ký và chủ tịch | Bấm xác nhận trên hệ thống [QD-16] |

Sau khi lưu: khóa. Chỉ ADMIN mở lại, có audit.

### QD-08 — Tách trạng thái hợp đồng và trạng thái nhiệm vụ

`project_contracts.status` chỉ gồm:

`HOP_DONG_DRAFT` → `HOP_DONG_CHO_CNNV` → `HOP_DONG_CHO_KY` → `HOP_DONG_CHO_PHAT_HANH` → `HOP_DONG_DA_KY`

Trả về `HOP_DONG_DRAFT` từ bước CNNV hoặc BGH, bắt buộc có lý do.

`HOP_DONG_CHO_CNNV`: CNNV xác nhận nội dung. `HOP_DONG_CHO_PHAT_HANH`: BGH đã ký, chờ TC-HC phát hành. Hai mã này không có tên trong tài liệu nhưng có đủ bước trong US-05-01.

`execution_status` trên thuyết minh, null đến khi hợp đồng `HOP_DONG_DA_KY`:

`DANG_THUC_HIEN` → các mã `DGCK_*` → `HOAN_THANH` hoặc `DGCK_DINH_CHI`

Không ghi `DANG_THUC_HIEN` vào status hợp đồng.

### QD-09 — Hợp đồng cơ quan chủ quản

Trên hợp đồng, ba trường không bắt buộc: số hợp đồng ngoài, tên cơ quan / quỹ, file đính kèm. Nhập được từ lúc dự thảo đến lúc đã ký. Không chặn ký hợp đồng nhà trường. Không lập danh mục QT-III/IV/V.

### QD-10 — Mỗi mốc thuyết minh một báo cáo

Khi hợp đồng có hiệu lực, mỗi phần tử `milestones` thành một kỳ báo cáo. Nếu không có mốc nào, tạo một kỳ tại giữa `startDate` và `endDate`.

Nhắc email 30, 14, 7, 3 ngày trước hạn [TL]. Quá hạn gắn cờ `QUA_HAN`, vẫn nộp được.

Mỗi kỳ một báo cáo. PKH trả bổ sung thì sửa trên cùng báo cáo, lưu version, không xóa bản đã nộp. Mã: `BCTD_DRAFT` → `BCTD_CHO_PKH` → (`BCTD_BS` | `BCTD_DONE`).

Phần kinh phí trên BM.08 đọc từ sổ [QD-04]. CNNV không sửa số đã tạm ứng, đã chi, đã quyết toán.

### QD-11 — Khi nào được nộp đánh giá cuối kỳ

CNNV nộp chính thức khi một trong hai điều đúng:

- PKH đã bấm thông báo đánh giá cuối kỳ, hoặc
- Ngày hiện tại cách `endDate` hợp đồng không quá 30 ngày, hoặc đã qua `endDate`.

Trước đó chỉ được lưu `DGCK_DRAFT`.

Giới hạn file giữ theo tài liệu: tổng kết ≤ 30MB, tóm tắt PDF ≤ 10MB, minh chứng mua sắm / tạm ứng ≤ 10MB/file, minh chứng tiến độ tổng ≤ 50MB. Không đếm số trang tự động. Mục “tóm tắt ≤ 15 trang” là ô PKH xác nhận khi chuyển `DGCK_HOP_HD`. Thiếu ô này thì không chuyển.

### QD-12 — BM.12a không có điểm

Phiếu chỉ có nhận xét. Chỗ US-06-03 nói “thấy điểm/nhận xét” được hiểu là thấy nhận xét BM.12a.

Thành viên hội đồng (chủ tịch, thư ký, phản biện, ủy viên) không được là thành viên nhiệm vụ.

Tối thiểu: 1 chủ tịch, 1 thư ký, 2 phản biện. Ủy viên không bắt buộc.

Hạn nộp BM.12a = ngày họp trừ 7 ngày. Nếu PKH đặt họp sát hơn 7 ngày, hạn = ngày họp trừ 1 ngày và hệ thống cảnh báo trên phiên.

Nhận xét chung ≥ 100 ký tự [TL]. Bốn mục đều bắt buộc [TL].

### QD-13 — BM.13: thư ký rồi chủ tịch

CNNV nộp → thư ký xác nhận → chủ tịch xác nhận → `DGCK_CHO_QUYET_TOAN`.

Thư ký hoặc chủ tịch trả lại: về CNNV, giữ `DGCK_CHINH_SUA`, bắt buộc lý do. Chỉ đúng hai người của phiên đó có nút [TL].

Hạn 14 ngày kể từ lúc sang `DGCK_CHINH_SUA`. Nhắc ngày thứ 10 và 13 [TL]. Quá hạn gắn `QUA_HAN`. PKH được gia hạn thêm ngày. Không tự khóa nộp.

Giữ file báo cáo lúc nộp đánh giá và file sau hoàn thiện. Cả hai tải được [TL].

### QD-14 — Quyết toán là phiếu con

`execution_status` ở `DGCK_CHO_QUYET_TOAN` suốt lúc lập quyết toán. Phiếu quyết toán có mã riêng:

`QT_DRAFT` → `QT_CHO_PKH` → `QT_CHO_TC` → (`QT_BS` | `QT_DONE`)

`QT_DONE` thì nhiệm vụ sang `DGCK_CHO_THANH_LY`.

KH-TC không được xác nhận nếu số CNNV khai ở một mục khác `spent` của mục đó, trừ khi PKH đã ghi nhận lệch và nhập lý do. Không làm luồng thu hồi tiền. BM.14 Điều 2 chỉ ghi số tồn (đã tạm ứng + đã chi − số được quyết toán) và lựa chọn `HOAN_TRA` hoặc `KHONG_PHAT_SINH`.

### QD-15 — Không có quyết định công nhận riêng

`HOAN_THANH` khi CNNV ký xong BM.14. Câu “QĐ công nhận” ở bảng trạng thái không thành bước. PKH được đính kèm file quyết định nếu có; file này không chặn trạng thái.

Lý do: luồng US-06-06 chỉ có BM.14. Thêm một vòng ký nữa khi chưa có mẫu quyết định.

Trong vòng 5 phút sau `HOAN_THANH` [TL]: ghi vào hồ sơ khoa học của chủ nhiệm và thành viên đã có hồ sơ (tên nhiệm vụ, vai trò, năm, xếp loại, kinh phí). Không có bảng thành tựu và không có API danh sách, nên chưa làm được trang thành tựu. Người chưa có hồ sơ khoa học không được ghi dòng này.

### QD-16 — Xác nhận trên hệ thống, chưa ký số

BGH, TC-HC, CNNV, thư ký, chủ tịch bấm xác nhận. Được upload PDF scan, không bắt buộc. Không tích hợp nhà cung cấp chữ ký số.

Từ chối luôn kèm lý do và trả về bước sửa được gần nhất (`HOP_DONG_DRAFT` hoặc bước CNNV tương ứng).

### QD-17 — Không bịa SLA

Chỉ làm các mốc đã có chữ trong tài liệu: nhắc báo cáo 30/14/7/3 ngày, hạn giải trình 14 ngày, nhắc ngày 10 và 13, cập nhật hồ sơ trong 5 phút sau thanh lý. Ô SLA trống ở các US khác không sinh hạn xử lý cho phòng ban.

### QD-18 — Mua sắm

Điều kiện nộp: `DANG_THUC_HIEN` và phiếu chọn đúng một mục `MUC_02`, `MUC_03` hoặc `MUC_05`. Cảnh báo theo dư của mục đó, không khóa nộp [TL A1].

Mã:

`MS_DRAFT` → `MS_CHO_PKH` → (`MS_BS` | `MS_CHO_CSVC`) → `MS_CHO_NHAN` → `MS_CHO_TC` → `MS_DONE`

- `MS_CHO_NHAN`: CSVC đã xác nhận cung ứng, chờ CNNV xác nhận đã nhận hàng.
- CSVC từ chối: `MS_TU_CHOI`, về PKH, báo CNNV [TL A2].
- Đấu thầu thất bại: `MS_DAU_THAU_THAT_BAI`, báo PKH và CNNV. PKH chuyển về `MS_BS` để CNNV sửa, hoặc đóng `MS_DONG`.
- CSVC ghi cách làm `MUA_TRUC_TIEP` hoặc `DAU_THAU`. Không có ngưỡng tiền.
- Không giao một phần. Một phiếu, một lần nhận.
- KH-TC chỉ thấy `MS_CHO_TC`.
- Dòng thuộc `MUC_03` khi `MS_DONE` được copy vào `project_assets` (tên, số lượng, thành tiền, phiếu mua sắm). PKH sửa danh sách này lúc lập BM.14 Điều 3. Không làm module quản lý tài sản.

### QD-19 — Phụ lục B không phải chuẩn mã

Máy trạng thái Module 5–6 lấy từ mục 3 và 4 của file này. Phụ lục B thiếu bước nháp, bổ sung, từ chối, và dùng `TM_*` / `DEXUAT_*` không trùng code Module 3–4.

---

## 3. Module 5

Vào module khi `status = SAN_SANG_THUC_HIEN` và `module5Opened = true`.

### US-05-01 — Hợp đồng BM.06

Đã có: sinh DOCX từ mẫu mặc định, một bản ghi cho một thuyết minh, sinh lại chỉ khi `HOP_DONG_DRAFT`.

Việc còn lại, theo [QD-04] [QD-08] [QD-09] [QD-16]:

1. PKH nhập 10 mục chi và sửa được dự thảo khi `HOP_DONG_DRAFT`.
2. Trình CNNV xác nhận nội dung.
3. CNNV báo sai thì trả `HOP_DONG_DRAFT` [TL A1].
4. PKH trình BGH. BGH xác nhận. TC-HC phát hành: số văn bản, file lưu trữ.
5. CNNV xác nhận ký. Hợp đồng `HOP_DONG_DA_KY`, `execution_status = DANG_THUC_HIEN`, sinh kỳ báo cáo [QD-10].

Một nhiệm vụ một hợp đồng nội bộ đang hiệu lực. Sau `HOP_DONG_DA_KY` không sửa file hợp đồng; thay đổi đi qua US-05-04. Audit không xóa.

### US-05-02 — Tạm ứng / thanh toán BM.07

Điều kiện: `DANG_THUC_HIEN`, hợp đồng `HOP_DONG_DA_KY`.

Form [TL]: loại Tạm ứng hoặc Thanh toán; số tiền; một mục `MUC_01`–`MUC_10`; nội dung; số tài khoản; ngân hàng; chứng từ PDF/JPG/PNG ≤ 10MB/file, bắt buộc.

Luồng: nộp `YCKT_PKH` → PKH sang `YCKT_TC` hoặc `YCKT_BS` hoặc từ chối. KH-TC đồng ý thì nhập ngày và số chứng từ, `YCKT_DONE`, ghi sổ [QD-04]. Từ chối thì trả PKH, có lý do.

KH-TC chỉ thấy `YCKT_TC` [TL]. Vượt tồn mục: cờ `VUOT_DU_TOAN`, vẫn nộp [TL].

### US-05-03 — Báo cáo tiến độ BM.08

Theo [QD-10] [QD-17].

Form [TL]:

- Phần I tự điền từ nhiệm vụ và hợp đồng.
- Phần II: nội dung và sản phẩm lấy từ thuyết minh, CNNV điền tiến độ và kết quả đã đạt; kinh phí khóa từ sổ.
- Phần III bắt buộc.
- Phần IV kiến nghị, được để trống.
- Minh chứng tổng ≤ 50MB.

### US-05-04 — Điều chỉnh BM.09

Theo [QD-05]. Điều kiện: `DANG_THUC_HIEN`. Gia hạn làm đổi `endDate` và hạn các kỳ báo cáo chưa nộp.

### US-05-05 — Mua sắm

Theo [QD-02] [QD-18]. Form [TL]: loại hàng, bảng hàng hóa, mục kinh phí, lý do, hạn nhận, báo giá.

---

## 4. Module 6

Chỉ khi `execution_status = DANG_THUC_HIEN`, trừ các bước sau của chính Module 6.

### US-06-01 — Nộp hồ sơ BM.10 / BM.11

Theo [QD-11]. Checklist [TL]: báo cáo tổng kết, tóm tắt, kết quả tiếng Việt và tiếng Anh, sản phẩm từng dòng thuyết minh (file hoặc link), BM.11 tùy chọn, danh sách ấn phẩm tùy chọn.

Thiếu mục bắt buộc thì không nộp. PKH thấy đủ và đã tick tóm tắt ≤ 15 trang → `DGCK_HOP_HD`. Thiếu → `DGCK_BS`.

### US-06-02 — Hội đồng và BM.12a

Điều kiện: `DGCK_HOP_HD`. Thành phần và hạn theo [QD-12]. Cột “theo thuyết minh” lấy từ `products`. PKH thấy từng người đã nộp hay chưa và nhắc riêng [TL].

### US-06-03 — BM.12b

Theo [QD-06] [QD-07]. Lưu xong thì khóa, gửi thông báo cho CNNV, sinh PDF từ các mục 1–10.

### US-06-04 — BM.13

Theo [QD-13].

### US-06-05 — Quyết toán

Theo [QD-14]. CNNV thấy dự toán, đã tạm ứng, đã chi, tồn từ sổ. Upload bảng và chứng từ. PKH duyệt chuyên môn rồi KH-TC mới thấy phiếu.

### US-06-06 — BM.14

Điều kiện: `DGCK_CHO_THANH_LY`.

Sinh DOCX từ mẫu `THANH_LY` cùng cách với BM.06:

- Điều 1: xếp loại và sản phẩm từ biên bản đã khóa.
- Điều 2: số từ quyết toán `QT_DONE` và lựa chọn tồn [QD-14].
- Điều 3: `project_assets`, PKH sửa được trước khi trình.

Trình BGH → TC-HC phát hành → CNNV xác nhận → `HOAN_THANH` [QD-15] [QD-16]. CNNV chưa xác nhận thì không hoàn thành.

---

## 5. Việc chưa làm

Mỗi mục ghi việc đó là gì, hệ thống đang giữ phần nào, và vì sao hiện chưa làm được.

### Nhắc hạn — lệnh có sẵn, repo không gắn cron

Đã có lệnh:

```
node ace remind:module56
```

Một lần chạy gửi hai loại, không gửi trùng nhờ cờ đã nhắc:

- Báo cáo tiến độ: đúng 30, 14, 7 hoặc 3 ngày trước hạn. Chỉ khi nhiệm vụ đang `DANG_THUC_HIEN`, báo cáo chưa `BCTD_DONE`, gửi cho chủ nhiệm.
- Giải trình BM.13: ngày thứ 10 và ngày thứ 13 trong hạn 14 ngày. Chỉ khi đang `DGCK_CHINH_SUA` và chưa xong.

Mỗi lần là thông báo trong app cộng email tới địa chỉ user. Email gửi được hay không phụ thuộc cấu hình mail. Quá ngày đúng mốc thì lần chạy sau không bù, vì chỉ khớp đúng số ngày.

Process web còn tự gọi cùng hai hàm đó: 15 giây sau khi khởi động, rồi mỗi 6 giờ. Chỉ khi môi trường `web`. Không thay cron của máy. Repo không có crontab. Muốn chắc mỗi ngày, đặt lịch hệ điều hành chạy lệnh trên một lần mỗi ngày. Chạy cả cron và process web không gửi đôi, vì cờ `remindedDays`, `remindedDay10`, `remindedDay13` đã lưu.

Chưa có nhắc tự động cho hạn nộp phiếu phản biện. Phòng KH bấm nhắc từng người qua API. Không nhắc quá hạn sau ngày hạn báo cáo. Không nhắc hạn xử lý nội bộ của các phòng [QD-17].

### Mở lại biên bản hội đồng đã khóa

Việc này là cho quản trị mở lại BM.12b sau khi thư ký đã lưu, để sửa nội dung họp rồi lưu lại. QD-07 ghi: lưu xong thì khóa, chỉ ADMIN mở lại và phải có audit.

Hiện không làm được. Lúc lưu, hệ thống không chỉ bật `minutesLocked`. Nó còn chuyển `executionStatus` theo xếp loại: đạt thì sang quyết toán và tạo phiếu `QT_DRAFT`, cần bổ sung thì sang chỉnh sửa và bắt đầu hạn 14 ngày, không đạt thì sang chờ phòng KH chọn làm lại hoặc đình chỉ. File Word biên bản cũng đã sinh. Sau đó mọi sửa hội đồng, phiếu nhận xét và biên bản đều bị chặn bằng lỗi `MINUTES_LOCKED`.

Không có API mở khóa. Cũng không có bước kéo trạng thái, phiếu quyết toán, hạn giải trình và file Word về trước lúc lưu. Module 4 có mở lại phiếu chấm kèm lý do. Biên bản cuối kỳ không có đường đó. Nếu chỉ tắt cờ khóa mà không hoàn tác, quyết toán hoặc giải trình sẽ bám vào một biên bản không còn là bản đã chốt.

### Trang thành tựu nghiên cứu

Việc này là một danh sách nhiệm vụ đã hoàn thành, xem theo người, theo năm hoặc theo đơn vị, không phải mở từng hồ sơ khoa học.

Hiện không làm được vì không có bảng thành tựu và không có API danh sách. Khi nhiệm vụ sang `HOAN_THANH`, hệ thống chỉ nối thêm một phần tử vào mảng `completedResearchTasks` của hồ sơ khoa học: mã, tên, vai trò, năm, xếp loại, kinh phí, thời điểm hoàn thành. Chỉ ghi cho chủ nhiệm và thành viên đã có hồ sơ. Người chưa có hồ sơ khoa học bị bỏ qua, không có chỗ chứa dòng đó. Muốn có trang thành tựu thì phải có nguồn danh sách riêng. Dữ liệu hiện tại chỉ đọc được khi mở đúng hồ sơ của người đó.

### Mẫu in biên bản, thanh lý và file PDF

Việc này là đổ BM.12b và BM.14 vào file mẫu in của nhà trường, và xuất PDF.

BM.12b luôn ghi Word theo từng mục 1–10, vì repo không có file mẫu biên bản. BM.14 đổ vào mẫu loại `THANH_LY` nếu quản trị đã tải mẫu lên. Chưa có mẫu thì cũng ghi Word theo mục. Chưa gắn thư viện PDF, nên không xuất được PDF từ các file này.

### Hạn giờ xử lý của từng phòng

Việc này là đếm giờ phòng KH, KH-TC, CSVC, ban giám hiệu phải xử lý phiếu, quá giờ thì nhắc hoặc chuyển trạng thái.

User story để trống ô hạn. Không có số giờ để gắn vào phiếu. Hệ thống chỉ làm các mốc đã có chữ: nhắc báo cáo trước 30, 14, 7, 3 ngày, hạn giải trình 14 ngày và nhắc ngày 10, 13. Không bịa hạn xử lý nội bộ [QD-17].

### Ngưỡng đấu thầu và giao hàng nhiều lần

Việc này là tự chuyển sang đấu thầu khi số tiền vượt một mức, và cho nhận hàng từng đợt.

Không có mức tiền trong tài liệu, và không có bước giao một phần. Phiếu mua sắm chỉ ghi `MUA_TRUC_TIEP` hoặc `DAU_THAU` do phòng cơ sở vật chất chọn. Chủ nhiệm xác nhận đã nhận một lần. Đấu thầu hỏng thì phòng KH mở lại phiếu hoặc đóng [QD-18].

### Cổng ký số

Việc này là ký bằng nhà cung cấp chữ ký số, file có dấu xác thực.

Chưa có nhà cung cấp để nối. Các bước ký hiện là bấm xác nhận trên hệ thống. File scan đính kèm được, không bắt buộc [QD-16].

### Quyết định công nhận tách khỏi thanh lý

Việc này là một vòng ký riêng cho quyết định công nhận, xong vòng đó mới hoàn thành.

Luồng US-06-06 chỉ có BM.14. `HOAN_THANH` khi chủ nhiệm xác nhận thanh lý. Phòng KH được đính `recognitionFileUrl` nếu có file. File này không chặn trạng thái, vì chưa có mẫu quyết định và chưa có vòng ký riêng [QD-15].

### Thu hồi số tiền còn thừa

Việc này là khi số đã cấp lớn hơn số quyết toán thì hệ thống lập phiếu thu hoặc chuyển khoản hoàn trả.

BM.14 chỉ ghi số tồn (đã tạm ứng + đã chi − đã quyết toán) và một lựa chọn: `HOAN_TRA` hoặc `KHONG_PHAT_SINH`. Không có phiếu thu, không có bước chuyển khoản [QD-14].

---

## 6. Thứ tự code

Đã làm xong các bước 1–5 ở API. Nhắc hạn: `node ace remind:module56` (không có crontab trong repo). Process web cũng gọi mỗi 6 giờ. Seeder 20 tạo role `KH_TC`, `TC_HC`, `CSVC`; `DEPARTMENT_STAFF` vẫn giữ quyền cũ để user hiện tại không mất quyền.
