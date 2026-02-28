# API Loại kết quả NCKH – Sample request/response

Base URL: `/api/admin`. Middleware: auth + role ADMIN hoặc PHONG_KH.

---

## GET /research-output-types/tree

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "I",
      "name": "Công bố khoa học",
      "level": 1,
      "sortOrder": 1,
      "isActive": true,
      "hasRule": false,
      "children": [
        {
          "id": 2,
          "code": "I.1",
          "name": "Bài báo tạp chí",
          "level": 2,
          "sortOrder": 1,
          "isActive": true,
          "hasRule": false,
          "children": [
            {
              "id": 3,
              "code": "I.1.1",
              "name": "Bài báo tạp chí ISI nhóm Q1",
              "level": 3,
              "sortOrder": 1,
              "isActive": true,
              "hasRule": true,
              "children": []
            }
          ]
        }
      ]
    }
  ]
}
```

---

## POST /research-output-types

**Request:**
```json
{
  "code": "I.1.2",
  "name": "Bài báo tạp chí ISI nhóm Q2",
  "level": 3,
  "parentId": 2,
  "sortOrder": 2,
  "isActive": true,
  "note": null
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": 4,
    "parentId": 2,
    "code": "I.1.2",
    "name": "Bài báo tạp chí ISI nhóm Q2",
    "level": 3,
    "sortOrder": 2,
    "isActive": true,
    "note": null,
    "createdAt": "2025-02-23T10:00:00.000Z",
    "updatedAt": "2025-02-23T10:00:00.000Z"
  }
}
```

---

## PUT /research-output-types/:id

**Request:** (các field cần sửa, optional)
```json
{
  "name": "Bài báo tạp chí quốc tế",
  "sortOrder": 1
}
```

**Response 200:** trả về object type đã cập nhật.

---

## PUT /research-output-types/:id/move

**Request:**
```json
{
  "newParentId": null,
  "newSortOrder": 2
}
```
hoặc chỉ đổi thứ tự: `{ "newSortOrder": 3 }`.

**Response 200:** trả về object type sau khi move.

---

## DELETE /research-output-types/:id

- Nếu node có con → **409** `"Không thể xoá vì còn node con. Dùng ?cascade=1 để xoá cả cây con."`
- Nếu gọi với `?cascade=1` → xoá cả cây con.
- **Response 200:** `{ "success": true, "message": "Đã xoá." }`

---

## GET /research-output-types/:id/rule

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "typeId": 3,
    "ruleKind": "FIXED",
    "pointsValue": 1.0,
    "hoursValue": 600,
    "hoursMultiplierVar": null,
    "hoursBonus": null,
    "meta": {},
    "evidenceRequirements": "Bài báo đăng trên tạp chí ISI thuộc nhóm Q1."
  }
}
```

**Response 404:** Loại chưa có rule.

---

## PUT /research-output-types/:id/rule

Chỉ node lá (không có con) mới gắn được rule.

**Ví dụ FIXED:**
```json
{
  "ruleKind": "FIXED",
  "pointsValue": 1.0,
  "hoursValue": 600,
  "evidenceRequirements": "Mô tả yêu cầu minh chứng."
}
```

**Ví dụ MULTIPLY_C:**
```json
{
  "ruleKind": "MULTIPLY_C",
  "pointsValue": 100,
  "hoursValue": 600,
  "hoursMultiplierVar": "c",
  "meta": {
    "c_map": {
      "EXCELLENT": 1.1,
      "PASS_ON_TIME": 1.0,
      "PASS_LATE": 0.5
    }
  }
}
```

**Ví dụ RANGE_REVENUE:**
```json
{
  "ruleKind": "RANGE_REVENUE",
  "meta": {
    "ranges": [
      { "min": 0, "max": 100000000, "points": 1.0, "hours": 600 },
      { "min": 100000000, "max": 300000000, "points": 1.5, "hours": 900 },
      { "min": 300000000, "max": null, "points": 2.0, "hours": 1200 }
    ]
  }
}
```

**Response 200:** trả về rule đã tạo/cập nhật.

**Response 400:** Không phải node lá hoặc payload không đúng rule_kind.
