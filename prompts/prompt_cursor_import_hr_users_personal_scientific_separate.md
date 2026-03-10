# Nhiệm vụ
Hãy xây dựng chức năng **import dữ liệu từ file Excel nhân sự** trong dự án **AdonisJS v6 + Lucid + PostgreSQL** theo hướng:

1. đọc file Excel nhân sự
2. map đúng dữ liệu vào **departments** nếu cần
3. tạo hoặc cập nhật **users**
4. tạo hoặc cập nhật **personal_profiles** (Hồ sơ cá nhân)
5. tạo hoặc cập nhật **scientific_profiles** (Hồ sơ khoa học) **chỉ với các field thực sự thuộc hồ sơ khoa học**
6. **không làm đồng bộ chéo** giữa 2 hồ sơ trong bước import
7. log rõ kết quả import

## Mục tiêu tổng quát
Tôi muốn **một luồng import thống nhất**, không tách rời:
- vừa tạo user
- vừa import hồ sơ cá nhân
- vừa import hồ sơ khoa học

Nhưng cần làm **đúng bản chất dữ liệu**:
- **Hồ sơ cá nhân** nhận các trường nhân sự / định danh / tổ chức / công vụ / giấy tờ
- **Hồ sơ khoa học** chỉ nhận các trường học thuật / chuyên môn / danh hiệu phù hợp
- **Không đồng bộ từ hồ sơ cá nhân sang hồ sơ khoa học trong bước import này**
- Field nào thuộc hồ sơ nào thì import thẳng vào hồ sơ đó
- Việc liên kết, suy diễn, đồng bộ dữ liệu giữa 2 hồ sơ sẽ do tôi xử lý riêng sau

---

# Bối cảnh dự án
- Backend dùng **AdonisJS v6 + Lucid + PostgreSQL**
- Dự án đã có hoặc đang xây:
  - `users`
  - `departments`
  - `personal_profiles`
  - `scientific_profiles`

## Yêu cầu rất quan trọng
- **Không tạo lại bảng `users`**
- **Không tạo lại bảng `departments`**
- **Không phá cấu trúc module Hồ sơ cá nhân / Hồ sơ khoa học đã có**
- Nếu field thực tế trong database khác nhẹ so với prompt này, hãy **đọc source hiện tại và map tương thích**
- Chỉ **alter table nếu thực sự cần thêm field hợp lý**
- Không over-engineering

---

# Nguyên tắc import bắt buộc

## 1. Không đồng bộ chéo trong bước import
### Cấm làm:
- import vào `personal_profiles` rồi lấy dữ liệu từ đó sync sang `scientific_profiles`
- ghi đè scientific profile dựa trên personal profile
- dùng personal profile làm nguồn trung gian để lấp dữ liệu scientific profile

### Phải làm:
- đọc Excel 1 lần
- normalize từng dòng
- map field nào thuộc **personal profile** thì import vào `personal_profiles`
- map field nào thuộc **scientific profile** thì import vào `scientific_profiles`

## 2. Có thể liên kết bằng `user_id`, nhưng không đồng bộ dữ liệu
- `users` là tài khoản
- `personal_profiles` gắn với user
- `scientific_profiles` gắn với user
- nhưng **nội dung dữ liệu import vào từng hồ sơ là tách biệt**

## 3. Không bê nguyên HR vào Hồ sơ khoa học
Chỉ import các trường thực sự có ý nghĩa cho CV khoa học / hồ sơ nghiên cứu.

---

# File Excel đầu vào

## Sheet 1: `DanhMucNhanVien`
Đây là sheet nhân sự chính để import.

### Các cột thực tế
1. `nv_hoten`
2. `nv_id`
3. `nv_ngaysinh`
4. `nv_gioitinh`
5. `donvi_name`
6. `donvi_ma`
7. `donvi_name2(nếu có kiêm nhiệm quản lý trung tâm thì chọn tên trung tâm vào giúp em)`
8. `nv_soBHXH`
9. `nv_honnhan`
10. `nv_soCCCD`
11. `nv_noicap`
12. `nv_ngaycap`
13. `nv_quequan`
14. `nv_noisinh`
15. `nv_thuongtru`
16. `nv_noiohiennay`
17. `nv_sdt`
18. `nv_email`
19. `nv_tongiao`
20. `nv_uutienGD`
21. `nv_ngaytuyendung`
22. `nv_ngaybanngach`
23. `nv_coquantiepnhan`
24. `nv_viec_tuyendung`
25. `nv_loaicanbo`
26. `nv_viec_hiennay`
27. `nv_nghiBHXH`
28. `nv_chucvu`
29. `nv_ngaybonhiem`
30. `nv_chucvu_coquankiemnhiem`
31. `nv_chucvu_coquancao nhat`
32. `nv_ngayvaodang`
33. `nv_chucvudang`
34. `nv_doanvien`
35. `nv_chuyenmon`
36. `nv_khoinganh`
37. `nv_linhvuc`
38. `nv_chuyennganh`
39. `nv_chuyenmondaotao`
40. `nv_noidaotao`
41. `nv_hinhthucdaotao_id`
42. `nv_quocgiadaotao`
43. `nv_cosodaotao`
44. `nv_namtotnghiep`
45. `nv_trinhdochinhtri`
46. `nv_trinhdoqlnn`
47. `nv_trinhdotinhoc`
48. `nv_danhhieu`
49. `nv_namcongnhan`
50. `nv_hocham`
51. `nv_chucdanhnghenghiep`
52. `nv_huong85`
53. `nv_loaichucdanh`
54. `nv_batluong`
55. `nv_hsluong`

## Sheet 2: `DanhMucDonVi`
Dùng để hỗ trợ map đơn vị.

### Các cột thực tế
1. `don_vi_ten_vn`
2. `don_vi_ma`
3. `don_vi_trang_thai`
4. `updatestatus_date`

---

# Mục tiêu import chi tiết

## 1. Import vào `departments`
- ưu tiên match theo `code`
- nếu chưa có thì có thể tạo mới hoặc cập nhật nhẹ nếu source hiện tại cho phép
- nếu dự án đã có module Department ổn định thì ưu tiên:
  - match theo `code`
  - fallback theo `name`
- không tạo trùng department

---

## 2. Import vào `users`
Phải tạo hoặc cập nhật user tương ứng từ dữ liệu Excel.

### Quy tắc bắt buộc
- **login account = email trong file Excel**
- nếu bảng `users` có field `username` thì:
  - `username = email`
- `email = email`
- **mật khẩu mặc định = `12345678`**
- **phải hash password theo đúng auth hiện tại**
- không lưu password plain text

### Điều kiện tạo user
- chỉ tạo user nếu có email hợp lệ

### Nếu email đã tồn tại
- không tạo user mới
- dùng user hiện có
- cập nhật các field an toàn nếu cần và chưa có dữ liệu:
  - `full_name` / `fullName`
  - `department_id`
  - `status`
- không ghi đè bừa bãi các field quan trọng

### Nếu không có email
- không tạo user
- vẫn có thể import profile nếu profile đó cho phép tồn tại độc lập
- log rõ `usersSkippedNoEmail`

### Trạng thái user
Nếu bảng `users` có field `status` thì user mới tạo nên là:
- `ACTIVE`

### Role mặc định
- không tự gán role phức tạp nếu chưa có rule chắc chắn
- nếu chưa chắc chắn thì **không gán role trong import này**

---

# 3. Import vào `personal_profiles`
Đây là nơi nhận các trường **thuần nhân sự / hồ sơ cá nhân**.

## Map các field sau vào `personal_profiles`

### Nhóm định danh
- `nv_hoten` -> `full_name`
- `nv_id` -> `staff_code`
- `nv_ngaysinh` -> `date_of_birth`
- `nv_gioitinh` -> `gender`

### Nhóm đơn vị / tổ chức
- `donvi_ma` -> dùng để tìm `department_id`
- `donvi_name` -> `department_name_snapshot` hoặc field tương đương
- `donvi_name2(...)` -> `secondary_unit_name` / `concurrent_unit_name`

### Nhóm giấy tờ / liên hệ
- `nv_soBHXH` -> `social_insurance_number`
- `nv_soCCCD` -> `identity_number`
- `nv_noicap` -> `identity_issue_place`
- `nv_ngaycap` -> `identity_issue_date`
- `nv_sdt` -> `phone`
- `nv_email` -> `email`

### Nhóm địa chỉ / nhân thân
- `nv_quequan` -> `hometown`
- `nv_noisinh` -> `place_of_birth`
- `nv_thuongtru` -> `permanent_address`
- `nv_noiohiennay` -> `current_address`
- `nv_honnhan` -> `marital_status`
- `nv_tongiao` -> `religion`
- `nv_uutienGD` -> `family_policy_priority`

### Nhóm tuyển dụng / công vụ
- `nv_ngaytuyendung` -> `recruitment_date`
- `nv_ngaybanngach` -> `rank_appointment_date`
- `nv_coquantiepnhan` -> `receiving_agency`
- `nv_viec_tuyendung` -> `recruitment_position`
- `nv_loaicanbo` -> `staff_type`
- `nv_viec_hiennay` -> `current_position`
- `nv_nghiBHXH` -> `social_insurance_leave_date`
- `nv_chucvu` -> `administrative_title`
- `nv_ngaybonhiem` -> `appointment_date`
- `nv_chucvu_coquankiemnhiem` -> `concurrent_title`
- `nv_chucvu_coquancao nhat` -> `highest_organization_title`

### Nhóm chính trị / đoàn thể
- `nv_ngayvaodang` -> `party_join_date`
- `nv_chucvudang` -> `party_position`
- `nv_doanvien` -> `union_membership_status`
- `nv_trinhdochinhtri` -> `political_theory_level`

### Nhóm quản lý / kỹ năng nền
- `nv_trinhdoqlnn` -> `state_management_level`
- `nv_trinhdotinhoc` -> `it_level`

### Nhóm lương / chế độ
- `nv_huong85` -> `salary_rule_85_flag` hoặc field tương đương
- `nv_batluong` -> `salary_step`
- `nv_hsluong` -> `salary_coefficient`

### Liên kết
- nếu tìm/ tạo được user -> gán `user_id`
- nếu match được đơn vị -> gán `department_id`

---

# 4. Import vào `scientific_profiles`
Đây là nơi nhận các trường **thuộc hồ sơ khoa học / CV khoa học**.

## Chỉ map các field sau vào `scientific_profiles`

### Nhóm hiển thị cơ bản
- `nv_hoten` -> `full_name`
- `nv_email` -> `email`
- `nv_sdt` -> `phone`
- `donvi_ma` -> dùng để tìm `department_id`

### Nhóm học thuật / chuyên môn
- `nv_chuyenmon` -> `specialization`
- `nv_khoinganh` -> `discipline_group`
- `nv_linhvuc` -> `field`
- `nv_chuyennganh` -> `major`
- `nv_chuyenmondaotao` -> `training_specialization`
- `nv_noidaotao` -> `training_place`
- `nv_hinhthucdaotao_id` -> `training_mode`
- `nv_quocgiadaotao` -> `training_country`
- `nv_cosodaotao` -> `training_institution`
- `nv_namtotnghiep` -> `graduation_year`

### Nhóm học hàm / chức danh / danh hiệu
- `nv_danhhieu` -> `title_award`
- `nv_namcongnhan` -> `title_recognition_year`
- `nv_hocham` -> `academic_rank`
- `nv_chucdanhnghenghiep` -> `professional_title`
- `nv_loaichucdanh` -> `professional_title_type`

### Có thể map nếu module khoa học có field tương ứng rõ ràng
- `nv_viec_hiennay` -> `current_position`
- `nv_chucvu` -> `administrative_title`
- `nv_chucvu_coquankiemnhiem` -> `concurrent_title`

### Liên kết
- nếu tìm/ tạo được user -> gán `user_id`
- nếu match được đơn vị -> gán `department_id`

---

# 5. Các field không được import vào `scientific_profiles`
Tuyệt đối không map các field sau sang Hồ sơ khoa học:

- `nv_soBHXH`
- `nv_soCCCD`
- `nv_noicap`
- `nv_ngaycap`
- `nv_quequan`
- `nv_noisinh`
- `nv_thuongtru`
- `nv_noiohiennay`
- `nv_honnhan`
- `nv_tongiao`
- `nv_uutienGD`
- `nv_ngaytuyendung`
- `nv_ngaybanngach`
- `nv_coquantiepnhan`
- `nv_loaicanbo`
- `nv_nghiBHXH`
- `nv_ngayvaodang`
- `nv_chucvudang`
- `nv_doanvien`
- `nv_trinhdochinhtri`
- `nv_trinhdoqlnn`
- `nv_trinhdotinhoc`
- `nv_huong85`
- `nv_batluong`
- `nv_hsluong`

---

# Rule nhận diện bản ghi để upsert

## 1. Department
### Match key ưu tiên
- `code`
- fallback `name`

## 2. User
### Match key ưu tiên
- `email`

## 3. Personal Profile
### Match key ưu tiên
1. `staff_code` / `nv_id`
2. fallback `user_id`
3. fallback `email`
4. fallback `full_name + date_of_birth`

## 4. Scientific Profile
### Match key ưu tiên
1. `user_id`
2. fallback `email`
3. fallback `full_name + department_id`

---

# Yêu cầu chuẩn hóa dữ liệu

## 1. Ngày tháng
Các field ngày như:
- `nv_ngaysinh`
- `nv_ngaycap`
- `nv_ngaytuyendung`
- `nv_ngaybanngach`
- `nv_ngaybonhiem`
- `nv_ngayvaodang`
- `nv_nghiBHXH`

phải parse an toàn.

### Yêu cầu
- hỗ trợ Excel date và string date
- parse lỗi thì log dòng lỗi, không crash toàn bộ import

## 2. Các field số nhưng mang tính mã
Các field như:
- `nv_id`
- `nv_soBHXH`
- `nv_soCCCD`
- `nv_sdt`

phải giữ dạng string an toàn, không mất số 0 đầu.

## 3. Text
- trim string
- chuỗi rỗng -> null
- bỏ các giá trị text kiểu `"null"`, `"undefined"`, `"None"`

## 4. Email
- trim
- lowercase
- validate cơ bản
- email sai format thì không tạo user, nhưng vẫn có thể import profile nếu dữ liệu profile hợp lệ

---

# Hình thức triển khai

## Ưu tiên
Tạo **API import file upload cho admin**:

- `POST /api/admin/hr-import`

### Body
- multipart/form-data
- file Excel `.xlsx` / `.xls`

## Khuyến nghị thêm
Nếu thuận tiện, tạo thêm command nội bộ dùng chung service:
- để chạy import bằng CLI khi cần

---

# Kết quả trả về sau import
API import nên trả summary đầy đủ:

```json
{
  "success": true,
  "message": "HR import completed",
  "data": {
    "totalRows": 250,
    "departmentsCreated": 3,
    "departmentsUpdated": 5,
    "usersCreated": 180,
    "usersUpdated": 25,
    "usersSkippedNoEmail": 45,
    "personalProfilesCreated": 190,
    "personalProfilesUpdated": 40,
    "scientificProfilesCreated": 170,
    "scientificProfilesUpdated": 35,
    "skippedRows": 20,
    "errors": [
      {
        "row": 18,
        "staffCode": "NV018",
        "reason": "Invalid email format"
      }
    ]
  }
}
```

---

# Logging
Cần log rõ:
- dòng nào tạo user mới
- dòng nào dùng user cũ theo email
- dòng nào thiếu email nên không tạo user
- dòng nào không match được department
- dòng nào tạo/cập nhật personal profile
- dòng nào tạo/cập nhật scientific profile
- dòng nào lỗi parse ngày/tháng

Nếu dự án đã có `audit_logs` hoặc logger thì tận dụng.

---

# Kỹ thuật triển khai

## 1. Tạo service import trung tâm
Ví dụ:
- `hr_excel_import_service.ts`

## 2. Tạo controller import
Ví dụ:
- `admin/hr_import_controller.ts`

## 3. Tạo validator cho upload file
Validate:
- có file
- đúng extension Excel

## 4. Tạo route
Ví dụ:
- `POST /api/admin/hr-import`

## 5. Dùng thư viện đọc Excel phù hợp
Ví dụ:
- `xlsx`
- hoặc thư viện tương đương phù hợp với source hiện tại

---

# Quy trình import đề xuất

## Bước 1
Đọc workbook

## Bước 2
Đọc sheet `DanhMucDonVi`
- build map đơn vị
- hỗ trợ match với `departments`

## Bước 3
Đọc sheet `DanhMucNhanVien`

## Bước 4
Chuẩn hóa từng dòng

## Bước 5
Upsert department nếu cần

## Bước 6
Find or create user
- `email = login account`
- nếu có `username` thì `username = email`
- password mặc định `12345678` đã hash
- `department_id` nếu có
- `status = ACTIVE` nếu có field này

## Bước 7
Upsert personal profile
- gắn `user_id`
- gắn `department_id`
- chỉ map các field thuộc hồ sơ cá nhân

## Bước 8
Upsert scientific profile
- gắn `user_id`
- gắn `department_id`
- chỉ map các field thuộc hồ sơ khoa học
- **không lấy dữ liệu từ personal profile để lấp sang**

## Bước 9
Ghi summary

---

# Không làm những việc sau
- không đồng bộ personal profile sang scientific profile
- không import publications từ file HR
- không import projects từ file HR
- không tự gán role phức tạp nếu chưa rõ
- không tạo lại toàn bộ schema nếu module đã tồn tại
- không overwrite bừa dữ liệu khoa học nâng cao do user đã nhập

---

# Yêu cầu đầu ra
Hãy thực hiện toàn bộ thay đổi cần thiết và trả về:

1. Danh sách file mới / file sửa
2. Giải thích ngắn gọn luồng import
3. Code đầy đủ cho:
   - controller
   - service import
   - validator
   - route
   - helper normalize/parse nếu cần
4. Mapping cột Excel -> `departments`, `users`, `personal_profiles`, `scientific_profiles`
5. Chỉ rõ logic tạo user:
   - login account = email
   - password mặc định = `12345678` (đã hash)
6. Chỉ rõ rằng import vào 2 hồ sơ là **tách biệt**, không đồng bộ chéo
7. Response mẫu sau import
8. Nếu cần package mới, liệt kê package cần cài

Hãy code hoàn chỉnh, nhất quán, chạy được, bám sát source hiện tại.
