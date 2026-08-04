# TÀI LIỆU USER STORY

---

# US-03-02 — Giảng viên nộp hồ sơ đề xuất đề tài trực tuyến

## 1. User Story

Là **Giảng viên (GV)**, tôi muốn xây dựng và nộp hồ sơ đề xuất đề tài trực tuyến thay cho hình thức Word/Email hiện tại, để **Phòng Khoa học (PKH)** tiếp nhận tập trung và tôi có thể theo dõi trạng thái hồ sơ của mình.

## 2. Actor

- Giảng viên
- Khoa

## 3. Hiện trạng

Giảng viên soạn hồ sơ bằng Word hoặc biểu mẫu, sau đó:

1. Gửi qua email hoặc nộp trực tiếp cho Khoa.
2. Khoa tổng hợp và gửi về Trường.
3. Thời gian xử lý khoảng 10–15 ngày.
4. Hồ sơ phân tán, khó quản lý và theo dõi trạng thái.

## 4. Preconditions

- Thông báo tuyển chọn đề tài đã được phát hành.
- Kỳ tiếp nhận hồ sơ đang mở.
- Giảng viên đã đăng nhập vào hệ thống.

## 5. Main Flow

### Bước 1: Tạo đề xuất

Giảng viên truy cập:

`Đề xuất đề tài → Chọn kỳ tuyển chọn đang mở → Tạo đề xuất mới`

### Bước 2: Nhập thông tin đề xuất

Form đề xuất gồm các trường:

| Trường | Bắt buộc | Ghi chú |
|---|---:|---|
| Tên đề tài | Có | |
| Mục tiêu tổng quát | Có | |
| Sản phẩm dự kiến | Có | |
| Phân cấp đề tài | Có | |
| Hướng nghiên cứu chính | Không | |
| Kinh phí dự kiến | Có | Đơn vị: VNĐ |
| Thời gian thực hiện | Có | Đơn vị: tháng |
| Danh sách thành viên | Không | Cho phép thêm/xóa thành viên |
| File biểu mẫu đề xuất | Có | PDF hoặc DOCX, tối đa 10MB |

### Bước 3: Lưu nháp

- Giảng viên có thể lưu nháp nhiều lần.
- Trạng thái hồ sơ: `DRAFT`.

### Bước 4: Gửi hồ sơ lên Khoa

- Giảng viên nhấn nút **Gửi lên Khoa**.
- Trưởng Khoa nhận được thông báo.
- Trạng thái hồ sơ chuyển thành: `CHO_KHOA`.

### Bước 5: Khoa rà soát hồ sơ

Khoa có thể thực hiện một trong hai hành động:

- **Xác nhận hồ sơ**
  - Trạng thái chuyển thành: `CHO_PKH`.
- **Trả lại hồ sơ**
  - Kèm theo nội dung yêu cầu chỉnh sửa.
  - Giảng viên được phép chỉnh sửa và gửi lại.

### Bước 6: Tổng hợp đề xuất

Hệ thống tự động tổng hợp danh sách đề xuất theo từng đơn vị để PKH tiếp nhận và xử lý.

## 6. Alternative Flow

### A1. Khoa trả lại hồ sơ

1. Khoa nhập nội dung yêu cầu chỉnh sửa.
2. Hồ sơ được trả lại cho Giảng viên.
3. Giảng viên chỉnh sửa hồ sơ cũ.
4. Giảng viên gửi lại hồ sơ.
5. Hệ thống không tạo hồ sơ mới mà cập nhật trên hồ sơ hiện tại.

### A2. Nộp hồ sơ ngoài thời hạn

Khi kỳ tiếp nhận đã hết hạn:

- Nút **Gửi lên Khoa** bị vô hiệu hóa.
- Hệ thống hiển thị thông báo kỳ tiếp nhận đã hết hạn.
- Giảng viên chỉ được xem hồ sơ, không được gửi hồ sơ mới.

## 7. Acceptance Criteria

### AC1 — Hiển thị kỳ tiếp nhận

- Giảng viên chỉ được tạo và gửi đề xuất trong kỳ tiếp nhận đang mở.
- Các kỳ đã đóng chỉ được phép xem.

### AC2 — Kiểm tra file đính kèm

- Chỉ chấp nhận định dạng `PDF` và `DOCX`.
- Dung lượng file tối đa là `10MB`.
- Hệ thống phải kiểm tra định dạng và dung lượng trước khi lưu.

### AC3 — Gửi thông báo cho Trưởng Khoa

Sau khi Giảng viên gửi hồ sơ lên Khoa:

- Trưởng Khoa phải nhận được email thông báo.
- Thời gian gửi thông báo tối đa là `2 phút`.

### AC4 — Quản lý danh sách đề xuất của Khoa

Khoa được xem tất cả đề xuất thuộc đơn vị mình và có thể:

- Tìm kiếm theo tên Giảng viên.
- Tìm kiếm theo tên đề tài.
- Lọc danh sách theo trạng thái hồ sơ.

### AC5 — Hiển thị số lượng hồ sơ chờ xử lý

Dashboard của Khoa phải hiển thị badge số lượng đề xuất đang chờ xác nhận.

### AC6 — Theo dõi lịch sử trạng thái

- Giảng viên và Khoa đều có thể xem lịch sử trạng thái của từng đề xuất.
- Lịch sử được hiển thị dưới dạng timeline.
- Mỗi lần thay đổi cần thể hiện:
  - Trạng thái trước.
  - Trạng thái sau.
  - Người thực hiện.
  - Thời gian thực hiện.
  - Nội dung phản hồi hoặc yêu cầu chỉnh sửa nếu có.

## 8. Luồng trạng thái

```text
DRAFT
  ↓ Giảng viên gửi lên Khoa
CHO_KHOA
  ├── Khoa trả lại → Quay về trạng thái cho phép Giảng viên chỉnh sửa
  └── Khoa xác nhận
          ↓
       CHO_PKH
```

## 9. SLA

| Công việc | Thời gian |
|---|---:|
| Giảng viên xây dựng hồ sơ | 10–15 ngày |
| Khoa rà soát và xác nhận | 1 ngày |

---

# US-03-03 — PKH kiểm tra, tổng hợp và chuẩn bị họp Hội đồng xét chọn

## 1. User Story

Là **Phòng Khoa học (PKH)**, tôi muốn:

- Kiểm tra tính đầy đủ và hợp lệ của hồ sơ đề xuất.
- Tổng hợp danh mục hồ sơ.
- Chuẩn bị hồ sơ trình Hội đồng xét chọn.
- Thay thế việc kiểm tra và tổng hợp thủ công trên Excel hiện tại.

## 2. Actor

- Phòng Khoa học — `PKH`

## 3. Hiện trạng

Quy trình hiện tại:

1. PKH nhận hồ sơ qua email.
2. PKH kiểm tra hồ sơ thủ công bằng Excel.
3. Khi hồ sơ thiếu hoặc chưa hợp lệ, PKH yêu cầu Giảng viên bổ sung qua email.
4. PKH tổng hợp danh sách bằng Word để trình Hội đồng.

### Vấn đề hiện tại

- Có nguy cơ bỏ sót hồ sơ.
- Dữ liệu hồ sơ phân tán.
- Việc tổng hợp thủ công dễ xảy ra sai sót.
- Khó theo dõi quá trình yêu cầu và bổ sung hồ sơ.

## 4. Preconditions

Chức năng được thực hiện khi:

- Kỳ tiếp nhận hồ sơ đã đóng.
- Có ít nhất một hồ sơ ở trạng thái `CHO_PKH`.
- Người dùng đã đăng nhập với vai trò `PKH`.

## 5. Main Flow

### Bước 1: Xem danh sách hồ sơ

PKH truy cập:

`Danh mục hồ sơ → Chọn kỳ tiếp nhận`

Hệ thống hiển thị toàn bộ hồ sơ đề xuất thuộc kỳ đã chọn đang ở trạng thái:

```text
CHO_PKH
```

### Bước 2: Kiểm tra hồ sơ

PKH mở từng hồ sơ và kiểm tra các nội dung:

- Các trường bắt buộc đã được nhập đầy đủ.
- File đính kèm đúng định dạng và hợp lệ.
- Kinh phí đề xuất nằm trong ngưỡng cho phép.
- Các thông tin khác đáp ứng quy định của kỳ tiếp nhận.

### Bước 2A: Hồ sơ hợp lệ

Khi hồ sơ hợp lệ:

1. PKH chọn chức năng **Xác nhận hợp lệ**.
2. Hệ thống cập nhật trạng thái hồ sơ thành:

```text
HOP_LE
```

> Trạng thái trong tài liệu gốc được ghi là `HOPILE`. Nên chuẩn hóa thành `HOP_LE` khi triển khai.

### Bước 2B: Hồ sơ chưa hợp lệ

Khi hồ sơ chưa hợp lệ:

1. PKH nhập nội dung yêu cầu Giảng viên bổ sung.
2. PKH gửi yêu cầu bổ sung.
3. Hệ thống lưu nội dung yêu cầu.
4. Hệ thống gửi email thông báo cho Giảng viên.
5. Hệ thống cập nhật trạng thái hồ sơ thành:

```text
YEU_CAU_BS
```

### Bước 3: Giảng viên bổ sung hồ sơ

Sau khi nhận được yêu cầu:

1. Giảng viên cập nhật hồ sơ hiện tại.
2. Giảng viên gửi lại hồ sơ cho PKH.
3. Hệ thống cập nhật trạng thái hồ sơ về:

```text
CHO_PKH
```

4. PKH thực hiện kiểm tra lại hồ sơ.

Hệ thống không tạo hồ sơ mới khi Giảng viên bổ sung. Nội dung được cập nhật trên hồ sơ hiện tại và phải lưu lịch sử thay đổi.

### Bước 4: Tổng hợp danh mục hồ sơ

PKH nhấn nút **Tổng hợp danh mục**.

Hệ thống tự động tạo file Excel danh sách hồ sơ hợp lệ để trình Hội đồng.

File Excel tối thiểu gồm các cột:

| STT | Thông tin |
|---:|---|
| 1 | Tên đề tài |
| 2 | Giảng viên chủ nhiệm |
| 3 | Đơn vị |
| 4 | Phân cấp đề tài |
| 5 | Kinh phí đề xuất |

File Excel được sử dụng để:

- Kiểm tra danh mục.
- Trình Hội đồng xét chọn.
- In hoặc lưu trữ theo quy định.

### Bước 5: Tạo phiên xét chọn

PKH nhấn nút **Tạo phiên xét chọn**.

PKH nhập các thông tin:

| Trường | Bắt buộc |
|---|:---:|
| Ngày họp | Có |
| Địa điểm họp | Có |

Sau khi tạo phiên xét chọn:

1. Hệ thống lưu thông tin phiên họp.
2. Hệ thống xác định danh sách thành viên Hội đồng.
3. Hệ thống gửi thư mời đến các thành viên Hội đồng.

## 6. Alternative Flow

### A1. Giảng viên không bổ sung đúng hạn

Nếu Giảng viên không bổ sung hồ sơ trong vòng `3 ngày` kể từ thời điểm PKH gửi yêu cầu:

1. Hệ thống tự động gắn nhãn **Quá hạn bổ sung**.
2. Hồ sơ vẫn giữ được lịch sử yêu cầu bổ sung.
3. PKH được phép lựa chọn một trong các phương án:
   - Loại hồ sơ.
   - Gia hạn thời gian bổ sung.

### A2. PKH gia hạn bổ sung

Khi PKH chọn gia hạn:

1. PKH nhập thời hạn bổ sung mới.
2. PKH có thể nhập lý do gia hạn.
3. Hệ thống lưu lịch sử gia hạn.
4. Hệ thống gửi thông báo cho Giảng viên.
5. Nhãn **Quá hạn bổ sung** được cập nhật theo thời hạn mới.

### A3. PKH loại hồ sơ

Khi PKH quyết định loại hồ sơ:

1. PKH phải nhập lý do loại.
2. Hệ thống cập nhật trạng thái hồ sơ thành:

```text
DA_LOAI
```

3. Hệ thống gửi thông báo cho Giảng viên.
4. Hồ sơ không được đưa vào danh mục trình Hội đồng.

## 7. Acceptance Criteria

### AC1 — Hiển thị số liệu tổng hợp

PKH phải xem được các số liệu:

- Tổng số hồ sơ đã nhận.
- Số hồ sơ hợp lệ.
- Số hồ sơ đang chờ bổ sung.
- Số hồ sơ đã bị loại.

Số liệu phải được cập nhật theo kỳ tiếp nhận được chọn.

### AC2 — Gửi email yêu cầu bổ sung

Khi PKH gửi yêu cầu bổ sung:

- Email phải được gửi cho Giảng viên trong vòng tối đa `2 phút`.
- Nội dung email phải thể hiện rõ yêu cầu bổ sung.
- Hệ thống phải ghi nhận kết quả gửi email vào log.
- Trường hợp gửi thất bại phải có trạng thái hoặc thông báo để PKH biết.

### AC3 — Xuất file Excel

File Excel tổng hợp phải:

- Đúng cấu trúc và định dạng quy định.
- Có đầy đủ các hồ sơ hợp lệ.
- Không chứa hồ sơ đang chờ bổ sung hoặc đã bị loại.
- Sử dụng mã hóa `UTF-8 BOM` khi cần xuất dữ liệu dạng CSV hoặc dữ liệu văn bản.
- Không bị lỗi font tiếng Việt.
- Hiển thị chính xác tên đề tài, Giảng viên, đơn vị, phân cấp và kinh phí.

### AC4 — Gửi thư mời Hội đồng

Thư mời Hội đồng phải được gửi trước ngày họp ít nhất `5 ngày làm việc`.

Nếu thời gian từ lúc tạo phiên xét chọn đến ngày họp ít hơn 5 ngày làm việc, hệ thống phải:

- Hiển thị cảnh báo cho PKH.
- Không gửi thư tự động hoặc yêu cầu PKH xác nhận ngoại lệ, tùy theo quy định nghiệp vụ.

### AC5 — Phân quyền

- Chỉ người dùng có vai trò `PKH` được thao tác trên màn hình này.
- Giảng viên chỉ được xem trạng thái hồ sơ của mình.
- Giảng viên không được xác nhận hợp lệ, loại hồ sơ, tổng hợp danh mục hoặc tạo phiên xét chọn.
- Người dùng không thuộc PKH không được truy cập dữ liệu hồ sơ ngoài phạm vi được phân quyền.

## 8. Luồng trạng thái hồ sơ

```text
CHO_PKH
   │
   ├── PKH xác nhận hợp lệ
   │        ↓
   │      HOP_LE
   │
   └── PKH yêu cầu bổ sung
            ↓
        YEU_CAU_BS
            │
            ├── GV bổ sung và gửi lại
            │        ↓
            │      CHO_PKH
            │
            └── Quá hạn 3 ngày
                     ↓
              Gắn nhãn "Quá hạn bổ sung"
                     │
                     ├── PKH gia hạn → YEU_CAU_BS
                     └── PKH loại → DA_LOAI
```

## 9. Quy tắc tổng hợp hồ sơ

Chỉ các hồ sơ thỏa mãn toàn bộ điều kiện sau mới được đưa vào danh mục trình Hội đồng:

- Thuộc đúng kỳ tiếp nhận được chọn.
- Có trạng thái `HOP_LE`.
- Chưa bị loại.
- Không còn yêu cầu bổ sung chưa hoàn thành.
- Có đầy đủ thông tin cần thiết để trình Hội đồng.

## 10. SLA

| Công việc | Thời gian xử lý |
|---|---:|
| PKH kiểm tra hồ sơ | 1 ngày |
| Chờ Giảng viên bổ sung | 1 ngày |
| PKH tổng hợp danh mục | 1 ngày |
| Tổng thời gian dự kiến | Khoảng 3 ngày |
