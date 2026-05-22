# SPEC — API tổng giờ NCKH / điểm quy đổi theo `profile_id`

> **Phạm vi:** Backend AdonisJS v6 (`quanlydetai-api`). Frontend chỉ gọi một endpoint.  
> **Đã sửa:** `app/services/kpi_engine_service.ts` — `calculateTeacherKpi` dùng `PublicationAccessService.accessiblePublicationsQuery` (không chỉ `publications.profile_id`).  
> **Liên quan UI:** `ProfileHeader` — Số giờ NCKH, Điểm quy đổi (`khoahocconnghe` → `src/pages/profile/me/index.tsx`).

---

## 1. Vấn đề hiện tại

| API | Hành vi quan sát được |
|-----|------------------------|
| `GET /api/profile/me/publications` | Trả **đủ** KQNC mà NCV là tác giả (kể cả NCV khác tạo bản ghi rồi gắn `profile_id` vào danh sách tác giả). |
| `GET /api/kpis/publications/:id/breakdown` | Tính đúng **phần** giờ/điểm của NCV đang xem trên từng bài. |
| `GET /api/kpis/teachers/:profileId` | `totalHours` / `totalPoints` **thiếu** phần từ các KQNC mà NCV **không phải người tạo** bản ghi (chỉ được link tác giả). |

→ Header hồ sơ lệch so với danh sách KQNC + modal quy đổi từng bài.

**Không có quy tắc nghiệp vụ** “bài link không được tính điểm”. Đây là lỗi **cách lọc dữ liệu khi aggregate** (thường gặp: chỉ cộng publication `created_by = profile_id` hoặc `owner_profile_id`).

---

## 2. Nguyên tắc nghiệp vụ (CHỐT)

1. Tính tổng theo **`profile_id` của NCV**, không phân biệt:
   - tự thêm KQNC;
   - được NCV khác thêm và chọn từ lookup tác giả (`profile_id` trên dòng tác giả).
2. Tập KQNC tham gia tính **phải trùng** tập hiển thị ở `GET /api/profile/me/publications` (cùng điều kiện tác giả + năm học nếu có lọc).
3. Với mỗi KQNC: dùng **cùng engine** như `GET /api/kpis/publications/:id/breakdown` — lấy `totalConvertedHours` / `totalConvertedPoints` **của NCV có `profileId` truy vấn** (không lấy tổng pool B/P của cả công trình).
4. Lọc theo **năm học** query `academic_year` (mặc định: năm học hiện tại, tháng 9 chuyển năm — khớp `getDefaultAcademicYear()` FE).

---

## 3. API (contract giữ nguyên)

### Request

```http
GET /api/kpis/teachers/{profileId}?academic_year=2025-2026
```

| Tham số | Bắt buộc | Mô tả |
|---------|----------|--------|
| `profileId` | Có (path) | ID hồ sơ khoa học NCV |
| `academic_year` | Không | `YYYY-YYYY+1`; mặc định năm học hiện tại |

### Response (không đổi schema)

```json
{
  "success": true,
  "data": {
    "profileId": 42,
    "academicYear": "2025-2026",
    "totalHours": 120.5,
    "totalPoints": 0.2008,
    "metQuota": true,
    "quota": 300,
    "breakdown": [],
    "allWarnings": [],
    "cachedAt": "2026-05-22T10:00:00Z"
  }
}
```

**Thay đổi duy nhất:** cách tính `totalHours` và `totalPoints` bên trong service.

---

## 4. Gợi ý triển khai BE

### 4.1 Tập publication cần tính

```sql
-- Pseudocode: KQNC trong năm học mà NCV là tác giả (có profile_id)
SELECT DISTINCT p.id
FROM publications p
INNER JOIN publication_authors pa ON pa.publication_id = p.id
WHERE pa.profile_id = :profileId
  AND p.academic_year = :academicYear   -- hoặc suy ra từ published_at giống FE/BE hiện có
```

**Không** thêm điều kiện kiểu:

- `p.created_by_profile_id = :profileId`
- `p.owner_id = :profileId`
- chỉ publication do user hiện tại POST

Trừ khi có quy tắc nghiệp vụ khác đã được product xác nhận (hiện **không**).

### 4.2 Cộng dồn

```text
totalHours  = SUM( converted_hours_for_profile(profileId, publicationId) )
totalPoints = SUM( converted_points_for_profile(profileId, publicationId) )
```

Trong đó `converted_*_for_profile` = output viewer row của service breakdown (cùng hàm với endpoint `/api/kpis/publications/:id/breakdown`).

### 4.3 Trường hợp bỏ qua / cảnh báo

- Thiếu nhóm chính (không có tác giả đầu hoặc liên hệ): giờ = 0 cho bài đó, ghi warning vào `allWarnings` (giống breakdown).
- `profile_id` null trên dòng tác giả (chỉ gõ tên): **không** tính cho NCV đó cho đến khi được gắn `profile_id` (thống nhất với lookup tác giả).

### 4.4 Cache

Nếu có `cachedAt`: invalidate khi:

- Lưu/sửa/xóa publication hoặc authors;
- Đổi loại KQNC / điểm HĐGSNN / năm học ảnh hưởng quy đổi.

---

## 5. Đồng bộ với FE

| Thành phần FE | Sau khi BE sửa |
|---------------|----------------|
| `getTeacherKpi(profileId)` | Nguồn duy nhất cho header |
| `profile/me` `useEffect` | Gọi `getTeacherKpi` khi `profile.id` hoặc `profile.publications` đổi (reload sau lưu KQNC) |
| **Không** gọi N lần `/api/kpis/publications/:id/breakdown` để cộng tổng header |

File service: `src/services/api/kpis.ts` (comment trỏ spec này).

---

## 6. Kịch bản kiểm thử (bắt buộc pass)

### TC-1 — NCV chỉ là đồng tác giả (link)

1. NCV **A** tạo KQNC, thêm NCV **B** (`profile_id` = B) vào authors, lưu.
2. Đăng nhập **B** → `GET /api/profile/me/publications` có bài đó.
3. `GET /api/kpis/publications/{id}/breakdown` (context B): ví dụ `totalConvertedHours = h1`, `totalConvertedPoints = p1`.
4. `GET /api/kpis/teachers/{profileId_B}?academic_year=...` → `totalHours` **bao gồm** `h1` (và `totalPoints` bao gồm `p1`).

### TC-2 — NCV tự tạo (regression)

1. NCV **A** tự tạo KQNC, A là tác giả chính.
2. Tổng teachers(A) = phần breakdown của A trên bài đó (+ các bài khác cùng năm học).

### TC-3 — Nhiều bài, hỗn hợp

1. B có: 1 bài tự tạo, 2 bài chỉ được link từ A/C.
2. `totalHours` = tổng 3 phần breakdown viewer của B (cùng năm học).

### TC-4 — Khác năm học

1. Bài thuộc `academic_year` khác query → không cộng vào tổng.

### TC-5 — Khớp UI header

1. Mở hồ sơ B trên FE → Số giờ NCKH / Điểm quy đổi khớp `GET /api/kpis/teachers/{id}` (sai số làm tròn ≤ 0.01 giờ / 0.0001 điểm nếu FE round 2 chữ số).

---

## 7. Checklist BE trước khi bàn giao

- [ ] Aggregate theo `publication_authors.profile_id`, không theo người tạo publication.
- [ ] Cùng logic quy đổi với breakdown từng bài.
- [ ] Lọc `academic_year` thống nhất với danh sách publications.
- [ ] TC-1 … TC-5 pass.
- [ ] FE không cần workaround cộng N request breakdown.

---

## 8. Tham chiếu code FE

- Header: `src/components/ProfileHeader/index.tsx`
- Gọi API: `src/pages/profile/me/index.tsx` → `getTeacherKpi`
- Breakdown từng bài (đối chiếu): `src/services/api/profilePublications.ts` → `previewPublicationConvertedHours`
- Spec UI quy đổi: `specs/update-ui-quy-doi-gio-nckh.md`
