Bạn đang làm việc trong codebase backend hiện tại của tôi (AdonisJS + PostgreSQL). Hãy thực hiện đầy đủ việc bổ sung module sinh viên và import dữ liệu sinh viên từ file Excel, bám sát schema hiện có trong project, không tự ý phá cấu trúc cũ.

## Bối cảnh hiện tại
Tôi đã có sẵn:
- bảng đơn vị: `departments`
- bảng người dùng / hồ sơ cán bộ / hồ sơ khoa học cho giảng viên
- module quản lý đề tài cho cán bộ
- dữ liệu Excel sinh viên

Tôi CHƯA có bảng sinh viên.

## File dữ liệu đầu vào
File Excel nằm trong thư mục làm việc, cần dùng sheet:
- `SinhVien`
- `DonVi_Nganh`
- có thể tham chiếu thêm `DonVi` nếu cần

### Ghi chú dữ liệu
1. Sheet `SinhVien` có các cột quan trọng:
- `Mã sinh viên`
- `Họ lót sinh viên`
- `Tên sinh viên`
- `Full Name`
- `Ngày sinh`
- `Giới tính`
- `Mã lớp`
- `Ghi chú tên lớp`
- `Tên khóa học`
- `Tình trạng`
- `Tên đơn vị`
- `Đơn vị mã`
- `Mã chuyên ngành`
- `Email cá nhân`
- `Email Trương`
- `Điện thoại cá nhân`
- `Số CCCD`
- `Nơi cấp CCCD`
- `Ngày cấp CCCD`
- `Dân tộc`
- các cột địa chỉ khác

2. Trong sheet `SinhVien`, hai cột:
- `Tên đơn vị`
- `Đơn vị mã`
đang bị lỗi `#ERROR!`, KHÔNG được dùng trực tiếp để map đơn vị.

3. Cần suy ra đơn vị từ sheet `DonVi_Nganh`:
- `Mã chuyên ngành` trong sheet `SinhVien` có dạng ví dụ: `31101-Sư phạm Toán học`
- cần tách phần tên ngành phía sau dấu `-`, ví dụ: `Sư phạm Toán học`
- sau đó map với cột `nganh` trong sheet `DonVi_Nganh`
- lấy `don_vi_ma_chuan` tương ứng
- dùng `don_vi_ma_chuan` để map sang bảng `departments` hiện có trong database

4. Bảng `departments` đã tồn tại, cần dò xem cột nào đang lưu mã đơn vị chuẩn (`code` nhiều khả năng là ứng viên đúng), KHÔNG được hard-code mù quáng. Hãy đọc model/migration hiện có để xác nhận chính xác.

## Mục tiêu
Hãy làm trọn gói các việc sau:

### 1. Phân tích schema hiện tại
- đọc migration/model hiện có
- xác định cách project đang tổ chức module, naming, Lucid model, validator, service, command
- xác định bảng `departments` đang dùng cột nào để lưu mã đơn vị chuẩn
- tuyệt đối không giả định khi chưa kiểm tra code

### 2. Thiết kế bảng sinh viên mới
Tạo bảng `students` phù hợp với schema hiện tại.

Yêu cầu tối thiểu bảng `students` nên có:
- `id`
- `student_code` (unique, not null)  // từ `Mã sinh viên`
- `first_name` hoặc `middle_name`    // từ `Họ lót sinh viên`
- `last_name` hoặc `given_name`      // từ `Tên sinh viên`
- `full_name`                        // ưu tiên từ `Full Name`
- `gender`
- `date_of_birth`
- `place_of_birth`
- `class_code`                       // từ `Mã lớp`
- `class_name`                       // từ `Ghi chú tên lớp`
- `course_name` hoặc `academic_year` // từ `Tên khóa học`
- `status`                           // từ `Tình trạng`
- `major_code_raw`                   // lưu nguyên giá trị `Mã chuyên ngành`
- `major_name`
- `department_id`                    // FK tới `departments.id`
- `personal_email`
- `school_email`
- `phone`
- `identity_card_number`
- `identity_card_issue_place`
- `identity_card_issue_date`
- `ethnicity`
- `permanent_address`
- `contact_address`
- `temporary_address`
- `note`
- `raw_payload` hoặc `source_data` JSONB để lưu dữ liệu gốc nếu cần
- `created_at`
- `updated_at`

Yêu cầu:
- thêm index hợp lý
- `student_code` phải unique
- `department_id` là foreign key tới `departments`
- nullable ở các field nào dữ liệu Excel hay thiếu
- đặt tên cột nhất quán với convention hiện tại của project

### 3. Tạo migration + model
- viết migration tạo bảng `students`
- viết Lucid model `Student`
- nếu codebase có pattern repository/service thì follow pattern đó
- nếu project đang dùng enum hoặc catalog cho giới tính / trạng thái thì tái sử dụng tối đa

### 4. Viết script import dữ liệu sinh viên từ Excel
Tạo command/import script rõ ràng, ví dụ:
- `node ace import:students`
hoặc theo convention hiện có của project

Yêu cầu import:
- đọc Excel bằng package phù hợp đang có trong project; nếu chưa có thì thêm package nhẹ, phổ biến
- chỉ import từ sheet `SinhVien`
- dùng sheet `DonVi_Nganh` để suy ra `don_vi_ma_chuan`
- từ `don_vi_ma_chuan` map sang `departments`
- nếu không map được department thì KHÔNG crash toàn bộ job:
  - log lỗi
  - bỏ qua record hoặc đưa vào file lỗi
- import theo kiểu idempotent:
  - nếu `student_code` đã tồn tại thì update
  - nếu chưa có thì create
- xử lý transaction theo batch hợp lý
- in summary cuối cùng:
  - total rows
  - inserted
  - updated
  - skipped
  - failed

### 5. Rule xử lý dữ liệu
Bắt buộc chuẩn hóa dữ liệu trước khi ghi DB:

#### Mã sinh viên
- trim
- bỏ dòng không có `Mã sinh viên`

#### Họ tên
- ưu tiên `Full Name`
- nếu thiếu thì ghép `Họ lót sinh viên` + `Tên sinh viên`

#### Giới tính
- map:
  - `Nam` -> `male`
  - `Nữ` -> `female`
  - giá trị khác -> `other` hoặc `null` tùy schema hiện có

#### Ngày sinh / ngày cấp CCCD
- parse được cả dạng:
  - `24/07/2004`
  - `19-04-2021`
  - các giá trị lỗi kiểu `--1968` thì bỏ qua, lưu null
- dùng format date an toàn

#### Email
- `Email Trương` có thể là typo dữ liệu, map vào `school_email`
- `Email cá nhân` map vào `personal_email`

#### Số điện thoại
- ưu tiên `Điện thoại cá nhân`
- normalize về chuỗi

#### Địa chỉ
- `Địa chỉ hộ khẩu 1` -> `permanent_address`
- `Địa chỉ liên lạc 1` -> `contact_address`
- `Địa chỉ tạm trú 1` -> `temporary_address`

#### Mã chuyên ngành
- lưu nguyên bản vào `major_code_raw`
- tách `major_name` từ phần sau dấu `-`
- ví dụ `31101-Sư phạm Toán học` -> `major_name = Sư phạm Toán học`

### 6. Map department
Viết hàm map department theo thứ tự ưu tiên:
1. lấy `major_name` từ `Mã chuyên ngành`
2. tìm trong sheet `DonVi_Nganh.nganh`
3. lấy `don_vi_ma_chuan`
4. tìm bản ghi trong DB `departments` theo mã đó
5. nếu không thấy:
   - thử fallback bằng tên đơn vị chuẩn nếu schema support
   - nếu vẫn không thấy thì ghi lỗi vào log

Yêu cầu:
- so sánh chuỗi có normalize trim
- hạn chế sai khác khoảng trắng
- không được map mơ hồ nếu có nhiều kết quả

### 7. Logging lỗi import
Tạo cơ chế log lỗi rõ ràng:
- có thể là file JSON/CSV trong thư mục `storage/import-logs`
- mỗi lỗi cần có:
  - row number
  - student_code
  - full_name
  - reason
  - source row data

Ví dụ các lỗi:
- thiếu mã sinh viên
- không parse được department
- không tìm thấy department trong DB
- duplicate bất thường
- parse ngày lỗi

### 8. Seed / test / verify
- viết test hoặc ít nhất script verify sau import
- kiểm tra số lượng sinh viên import thành công
- kiểm tra random một số bản ghi đã link đúng `department_id`
- thêm hướng dẫn chạy command trong README ngắn hoặc comment cuối file

### 9. Giữ an toàn cho codebase
- không sửa bừa các bảng cũ
- không đổi schema `departments`
- không tạo quan hệ thừa nếu chưa cần
- code phải sạch, tách hàm rõ ràng:
  - parse row
  - extract major
  - map department
  - normalize gender
  - normalize date
  - upsert student
  - write error log

## Yêu cầu output
Sau khi làm xong, hãy cung cấp:
1. migration đã tạo
2. model đã tạo
3. command/import script
4. helper/service dùng để parse & map dữ liệu
5. mô tả ngắn cách chạy import
6. liệt kê các giả định đã dùng
7. nếu phát hiện điểm nào trong schema hiện tại không khớp, hãy dừng ở đúng chỗ đó và nêu rõ cần chỉnh gì

## Lưu ý rất quan trọng
- Phải đọc schema thực tế trong codebase trước rồi mới code
- Không giả định tên cột FK hay tên bảng nếu chưa kiểm tra
- Ưu tiên code chạy được thực tế hơn là viết khung chung chung
- Mọi thao tác import phải idempotent và có log lỗi