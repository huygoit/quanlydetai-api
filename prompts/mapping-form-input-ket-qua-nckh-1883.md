# Mapping form nhập liệu kết quả NCKH theo QĐ 1883

Mục tiêu: chuẩn hóa đầu vào để API tính giờ/điểm đúng theo phụ lục 1883.

## 1) Trường dùng chung cho mọi loại

- `researchOutputTypeId` (id mục lá trong cây danh mục)
- `title` (tên kết quả)
- `academicYear` (định dạng `YYYY-YYYY`)
- `completedAt` hoặc `publishedAt` (thời điểm hoàn thành/công bố)
- `evidenceFiles[]` (tệp minh chứng)

Nếu loại có nhiều người tham gia:
- `contributors[]`:
  - `fullName`
  - `profileId` (nếu là hồ sơ nội bộ)
  - `isMainAuthor`
  - `isCorresponding`
  - `affiliationType` (`UDN_ONLY | MIXED | OUTSIDE`)
  - `isMultiAffiliationOutsideUdn`
  - `contributionPercent` (khi áp dụng chia theo tỷ lệ)

## 2) Mapping theo nhóm/mục

## Nhóm I. Công bố khoa học và xuất bản sách

### Mục 1, 2 (bài báo WOS/Scopus/ESCI)

Trường bắt buộc:
- `researchOutputTypeId` (lá `PUB_WOS_*` hoặc `PUB_SCOPUS_*`)
- `quartile` (`Q1 | Q2 | Q3 | Q4 | NO_Q`)
- `contributors[]` đầy đủ

Kiểm tra:
- Có ít nhất 1 người thuộc nhóm chính (`isMainAuthor` hoặc `isCorresponding`)
- `p = tổng số tác giả >= 1`
- `authorOrder` duy nhất

Công thức:
- `a` theo điều 1.1
- `B = B0 × a`
- Nhóm chính: `B/(3n) + 2B/(3p)`
- Đồng tác giả: `2B/(3p)`
- Điều 1.5, 1.7: chia 2 nếu `isMultiAffiliationOutsideUdn`, nữ nhân `1.2`

---

### Mục 4 (tạp chí tính điểm HĐGSNN)

Trường bắt buộc:
- `researchOutputTypeId = PUB_DOMESTIC_HDGNN`
- `hdgsnnScore` (số thực > 0)
- `contributors[]`

Công thức:
- `B0 = 600 × hdgsnnScore`
- Chia tác giả giống mục 1.2, 1.3

---

### Mục 5 (hội thảo có ISBN)

Trường bắt buộc:
- `researchOutputTypeId = PUB_CONF_ISBN`
- `isbn`
- `contributors[]`

Giờ/điểm:
- Theo rule cố định của lá

---

### Mục 6, 7 (sách, giáo trình, phản biện)

Trường bắt buộc:
- `researchOutputTypeId` đúng lá 6.x hoặc 7
- `isbn` (khi loại yêu cầu)
- `publisher` (khi loại yêu cầu)
- `contributors[]`
- `% đóng góp` nếu có xác nhận tỷ lệ (điều 1.4)

Giờ/điểm:
- Theo rule lá (cố định hoặc cộng thưởng)
- Nếu nhiều người thì chia theo `contributionPercent` (nếu có), không thì chia đều

## Nhóm II. Thực hiện nhiệm vụ khoa học công nghệ (8-11)

### Mục 8 (xây dựng thuyết minh)

Trường bắt buộc:
- `researchOutputTypeId` (8.1/8.2)
- `taskLevel`
- `isPrincipalInvestigator = true`

Giờ/điểm:
- Theo rule cố định của lá

---

### Mục 9 (hoàn thành đề tài)

Trường bắt buộc:
- `researchOutputTypeId` (9.1/9.2/9.3)
- `acceptanceGrade` (`EXCELLENT | PASS_ON_TIME | PASS_LATE`) hoặc `cFactor`

Giờ/điểm:
- `base × c`

---

### Mục 10 (nhiệm vụ quốc tế)

Trường bắt buộc:
- `researchOutputTypeId` (10.1 hoặc 10.2)
- `taskPhase` (`PROPOSAL` hoặc `COMPLETED`)

---

### Mục 11 (hướng dẫn SV NCKH)

Trường bắt buộc:
- `researchOutputTypeId` (11.1 -> 11.6)
- `awardLevel` tương ứng

## Nhóm III. SHTT, chuyển giao công nghệ (12-13)

### Mục 12 (sở hữu trí tuệ)

Trường bắt buộc:
- `researchOutputTypeId` (12.1 -> 12.4)
- `ipKind` (sáng chế/giải pháp hữu ích)
- `ipStage` (được cấp/chấp nhận hợp lệ)

---

### Mục 13 (chuyển giao, thương mại hóa)

Trường bắt buộc:
- `researchOutputTypeId` (13.1 -> 13.3) hoặc
- `contractRevenue` để hệ thống tự chọn lá theo doanh thu

## Nhóm IV. Đổi mới sáng tạo và khởi nghiệp (14-16)

Trường bắt buộc:
- `researchOutputTypeId` theo 14.x/15.x/16
- `awardLevel` (nếu là loại đạt giải)
- `decisionNo` hoặc `certificateNo` (minh chứng)

## Nhóm V. Khen thưởng và hoạt động khác (17-21)

Trường bắt buộc:
- `researchOutputTypeId` theo 17 -> 21
- `level` (quốc tế/quốc gia/tỉnh/bộ)
- `prizeRank` (nhất/nhì/ba/khuyến khích) nếu có

## 3) Đề xuất cấu trúc cấu hình form động

Ví dụ cấu hình một lá:

```json
{
  "leafCode": "PUB_WOS_Q1",
  "requiredFields": [
    "researchOutputTypeId",
    "academicYear",
    "quartile",
    "contributors"
  ],
  "contributorsRules": {
    "requireMainGroup": true,
    "requireCorrespondingForPublication": false,
    "allowedAffiliationTypes": ["UDN_ONLY", "MIXED", "OUTSIDE"]
  },
  "formulaHint": "B = B0 × a; chia theo n/p mục 1.3"
}
```

## 4) Khoảng trống hiện tại cần bổ sung trên form

- Cần hiển thị và cho chọn rõ `MIXED` (vừa trong vừa ngoài ĐHĐN)
- Cần checkbox `isMultiAffiliationOutsideUdn` cho từng tác giả
- Nhãn `p` phải là “tổng số tác giả”, không phải “số tác giả liên hệ”
- Với nhóm không phải bài báo: cần block `% đóng góp` để đáp ứng điều 1.4

## 5) Thứ tự triển khai khuyến nghị

1. Hoàn chỉnh form bài báo (mục 1,2,4,5) cho đúng 1.1 -> 1.7  
2. Chuẩn hóa form đề tài (mục 8 -> 11)  
3. Bổ sung nhóm III, IV, V theo lá danh mục và rule  
4. Chuyển tất cả sang form động dựa `leafCode -> requiredFields`
