# User Story: Nộp hồ sơ đề xuất đề tài trực tuyến

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

## 4. Precondition

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

### AC1. Hiển thị kỳ tiếp nhận

- Giảng viên chỉ được tạo và gửi đề xuất trong kỳ tiếp nhận đang mở.
- Các kỳ đã đóng chỉ được phép xem.

### AC2. Kiểm tra file đính kèm

- Chỉ chấp nhận định dạng `PDF` và `DOCX`.
- Dung lượng file tối đa là `10MB`.
- Hệ thống phải kiểm tra định dạng và dung lượng trước khi lưu.

### AC3. Gửi thông báo cho Trưởng Khoa

Sau khi Giảng viên gửi hồ sơ lên Khoa:

- Trưởng Khoa phải nhận được email thông báo.
- Thời gian gửi thông báo tối đa là `2 phút`.

### AC4. Quản lý danh sách đề xuất của Khoa

Khoa được xem tất cả đề xuất thuộc đơn vị mình và có thể:

- Tìm kiếm theo tên Giảng viên.
- Tìm kiếm theo tên đề tài.
- Lọc danh sách theo trạng thái hồ sơ.

### AC5. Hiển thị số lượng hồ sơ chờ xử lý

Dashboard của Khoa phải hiển thị badge số lượng đề xuất đang chờ xác nhận.

### AC6. Theo dõi lịch sử trạng thái

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