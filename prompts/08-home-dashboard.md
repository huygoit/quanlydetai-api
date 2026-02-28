# Prompt 08: Home/Dashboard Module

Tôi cần bạn tạo API Dashboard cho hệ thống "Quản lý KH&CN" bằng AdonisJS + PostgreSQL.

Dashboard hiển thị thông tin khác nhau tùy theo role của user. Module này aggregate dữ liệu từ các bảng đã tạo ở các module trước.

**Lưu ý:** Module này cần được tạo SAU KHI đã có đầy đủ các module khác (users, ideas, project_proposals, notifications, scientific_profiles, council_sessions).

## 1. API Endpoints

### GET /api/home/summary
Trả về các KPI cards tùy theo role của user

**HomeSummaryCard Interface:**
```typescript
interface HomeSummaryCard {
  key: string;
  title: string;
  value: number;
  unit?: string;          // VD: "tỷ đồng", "%"
  trend?: 'up' | 'down' | 'flat';
  trendPercent?: number;  // VD: 12 (cho +12%), -5 (cho -5%)
  diffText?: string;      // Text mô tả sự khác biệt (optional)
  icon?: string;          // Tên icon Ant Design
  color?: string;         // Màu chủ đạo (hex)
}
```

**Response cho NCV/CNDT:**
```json
{
  "success": true,
  "data": [
    { "key": "projects_in_progress", "title": "Đề tài đang thực hiện", "value": 3, "trend": "up", "trendPercent": 50, "icon": "ProjectOutlined", "color": "#1890ff" },
    { "key": "projects_pending_acceptance", "title": "Chờ nghiệm thu", "value": 1, "trend": "flat", "icon": "ClockCircleOutlined", "color": "#52c41a" },
    { "key": "ideas_submitted", "title": "Ý tưởng đã nộp", "value": 5, "trend": "up", "trendPercent": 25, "icon": "BulbOutlined", "color": "#faad14" },
    { "key": "notifications_unread", "title": "Thông báo chưa đọc", "value": 4, "trend": "down", "trendPercent": -20, "icon": "BellOutlined", "color": "#ff4d4f" }
  ]
}
```

**Response cho PHONG_KH:**
```json
{
  "success": true,
  "data": [
    { "key": "proposals_pending", "title": "Đề xuất mới chờ xử lý", "value": 12, "trend": "up", "trendPercent": 25, "icon": "FileTextOutlined", "color": "#1890ff" },
    { "key": "ideas_pending", "title": "Ý tưởng mới chờ sơ loại", "value": 8, "trend": "up", "trendPercent": 15, "icon": "BulbOutlined", "color": "#faad14" },
    { "key": "projects_managing", "title": "Đề tài đang quản lý", "value": 45, "trend": "flat", "icon": "ProjectOutlined", "color": "#52c41a" },
    { "key": "registration_open", "title": "Đợt đăng ký đang mở", "value": 2, "trend": "up", "trendPercent": 100, "icon": "CalendarOutlined", "color": "#722ed1" }
  ]
}
```

**Response cho LANH_DAO:**
```json
{
  "success": true,
  "data": [
    { "key": "total_projects_year", "title": "Tổng đề tài trong năm", "value": 128, "trend": "up", "trendPercent": 18, "icon": "ProjectOutlined", "color": "#1890ff" },
    { "key": "budget_disbursed", "title": "Kinh phí giải ngân", "value": 12.5, "unit": "tỷ đồng", "trend": "up", "trendPercent": 22, "icon": "DollarOutlined", "color": "#52c41a" },
    { "key": "acceptance_rate", "title": "Tỷ lệ nghiệm thu", "value": 85, "unit": "%", "trend": "up", "trendPercent": 5, "icon": "CheckCircleOutlined", "color": "#722ed1" },
    { "key": "idea_conversion", "title": "Ý tưởng → Đề tài", "value": 32, "unit": "%", "trend": "down", "trendPercent": -3, "icon": "RiseOutlined", "color": "#faad14" }
  ]
}
```

### GET /api/home/tasks
Danh sách công việc cần làm theo role

**HomeTaskItem Interface:**
```typescript
type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW';

interface HomeTaskItem {
  id: string;
  type: string;           // Task type theo role
  title: string;
  description?: string;
  relatedModule: 'IDEA' | 'PROJECT' | 'CV' | 'FINANCE';
  dueDate?: string;       // ISO date string
  status: 'PENDING' | 'DONE';
  priority: TaskPriority;
  link?: string;
}
```

**Response cho CNDT/NCV:**
```json
{
  "success": true,
  "data": [
    {
      "id": "task1",
      "type": "NOP_BAO_CAO_TIEN_DO",
      "title": "Nộp báo cáo tiến độ đề tài ABC",
      "description": "Đợt 2 năm 2025, hạn nộp 31/12/2025.",
      "relatedModule": "PROJECT",
      "dueDate": "2025-12-07T00:00:00Z",
      "status": "PENDING",
      "priority": "HIGH",
      "link": "/projects/abc/progress"
    },
    {
      "id": "task2",
      "type": "NOP_Y_TUONG",
      "title": "Hoàn thiện ý tưởng quản lý phòng thí nghiệm",
      "relatedModule": "IDEA",
      "dueDate": "2025-12-05T00:00:00Z",
      "status": "PENDING",
      "priority": "HIGH",
      "link": "/ideas/new"
    },
    {
      "id": "task3",
      "type": "NOP_HO_SO_NGHIEM_THU",
      "title": "Nộp hồ sơ nghiệm thu đề tài XYZ",
      "description": "Chuẩn bị đầy đủ hồ sơ theo mẫu.",
      "relatedModule": "PROJECT",
      "dueDate": "2025-12-20T00:00:00Z",
      "status": "PENDING",
      "priority": "MEDIUM",
      "link": "/projects/xyz/acceptance"
    }
  ]
}
```

**Response cho PHONG_KH:**
```json
{
  "success": true,
  "data": [
    {
      "id": "task1",
      "type": "SO_LOAI_Y_TUONG",
      "title": "Sơ loại 5 ý tưởng mới từ Khoa CNTT",
      "description": "Đợt 1 năm 2025",
      "relatedModule": "IDEA",
      "dueDate": "2025-12-10T00:00:00Z",
      "status": "PENDING",
      "priority": "HIGH",
      "link": "/ideas/review"
    },
    {
      "id": "task2",
      "type": "PHAN_HOI_DONG",
      "title": "Phân hội đồng 2A cho 3 đề xuất",
      "relatedModule": "PROJECT",
      "dueDate": "2025-12-08T00:00:00Z",
      "status": "PENDING",
      "priority": "HIGH",
      "link": "/projects/council"
    },
    {
      "id": "task3",
      "type": "DUYET_DE_XUAT",
      "title": "Duyệt đề xuất đề tài cấp Bộ",
      "description": "Từ PGS. Trần Văn B",
      "relatedModule": "PROJECT",
      "dueDate": "2025-12-15T00:00:00Z",
      "status": "PENDING",
      "priority": "MEDIUM",
      "link": "/projects/proposals/review"
    }
  ]
}
```

**Response cho LANH_DAO:**
```json
{
  "success": true,
  "data": [
    {
      "id": "task1",
      "type": "PHE_DUYET_DAT_HANG",
      "title": "Phê duyệt đặt hàng 3 ý tưởng chiến lược",
      "relatedModule": "IDEA",
      "dueDate": "2025-12-08T00:00:00Z",
      "status": "PENDING",
      "priority": "HIGH",
      "link": "/ideas/approve"
    },
    {
      "id": "task2",
      "type": "XEM_XET_DE_XUAT",
      "title": "Xem xét báo cáo tổng kết năm 2025",
      "relatedModule": "PROJECT",
      "dueDate": "2025-12-20T00:00:00Z",
      "status": "PENDING",
      "priority": "HIGH",
      "link": "/reports/annual"
    }
  ]
}
```

**Task types theo role:**
- **NCV/CNDT:** NOP_Y_TUONG, NOP_DE_XUAT, NOP_BAO_CAO_TIEN_DO, NOP_HO_SO_NGHIEM_THU, XEM_XET_DE_XUAT
- **PHONG_KH:** XEM_XET_DE_XUAT, SO_LOAI_Y_TUONG, PHAN_CONG_PHAN_BIEN, PHAN_HOI_DONG, DUYET_DE_XUAT
- **LANH_DAO:** PHE_DUYET_DAT_HANG, DUYET_DE_XUAT, XEM_XET_DE_XUAT
- **HOI_DONG:** CHAM_DIEM_Y_TUONG

### GET /api/home/notifications
5 notifications gần nhất chưa đọc của user

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "noti1",
      "title": "Nhắc nộp báo cáo tiến độ đề tài ABC",
      "content": "Hạn nộp: 31/12/2025. Vui lòng hoàn tất trên hệ thống.",
      "createdAt": "2025-12-07T08:00:00Z",
      "read": false,
      "type": "DEADLINE",
      "priority": "URGENT",
      "link": "/projects/abc/progress"
    },
    {
      "id": "noti2",
      "title": "Kết quả sơ tuyển đề tài XYZ",
      "content": "Đề tài XYZ đã được chấp thuận về mặt chủ trương.",
      "createdAt": "2025-12-06T10:00:00Z",
      "read": true,
      "type": "SUCCESS",
      "priority": "NORMAL",
      "link": "/projects/xyz"
    }
  ],
  "unreadCount": 8
}
```

**LƯU Ý quan trọng cho Home Notifications:**
- Field `content` (KHÔNG phải `message`) - dùng cho dashboard notifications
- Field `read` (boolean, KHÔNG phải `isRead`)
- Field `type` có các giá trị: `INFO`, `WARNING`, `DEADLINE`, `SYSTEM`, `SUCCESS`, `ERROR`
- Field `priority` (optional): `URGENT` | `NORMAL`
- Field `id` có thể là string hoặc number

### GET /api/home/my-projects
Danh sách đề xuất của user hiện tại (cho NCV/CNDT)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "p1",
      "code": "CS-2025-01",
      "title": "Xây dựng hệ thống quản lý khoa học cho trường",
      "level": "Cấp Trường",
      "status": "Đang thực hiện",
      "role": "CHU_NHIEM",
      "startDate": "2025-01-01T00:00:00Z",
      "endDate": "2026-12-31T00:00:00Z",
      "progress": 45
    },
    {
      "id": "p2",
      "code": "CS-2024-05",
      "title": "Nghiên cứu ứng dụng AI trong giáo dục",
      "level": "Cấp Bộ",
      "status": "Đã nghiệm thu",
      "role": "THANH_VIEN",
      "startDate": "2024-03-01T00:00:00Z",
      "endDate": "2025-03-01T00:00:00Z",
      "progress": 100
    },
    {
      "id": "p3",
      "code": "CS-2025-08",
      "title": "Phát triển nền tảng học trực tuyến",
      "level": "Cấp Trường",
      "status": "Chờ nghiệm thu",
      "role": "THANH_VIEN",
      "startDate": "2025-02-01T00:00:00Z",
      "endDate": "2025-12-31T00:00:00Z",
      "progress": 90
    }
  ]
}
```

**LƯU Ý:**
- Field `role`: `CHU_NHIEM` hoặc `THANH_VIEN`
- Field `status` trả về **label text** (VD: "Đang thực hiện", "Chờ nghiệm thu")
- Field `startDate`, `endDate` là optional, format ISO string
- Field `progress` là optional, giá trị 0-100 (phần trăm)

### GET /api/home/my-ideas
Danh sách ý tưởng của user hiện tại (cho NCV)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "i1",
      "title": "Ngân hàng ý tưởng số dùng cho quản lý đề tài",
      "status": "Đề xuất đặt hàng",
      "createdAt": "2025-10-15T00:00:00Z",
      "score": 8.5
    },
    {
      "id": "i2",
      "title": "Ứng dụng blockchain trong quản lý chứng chỉ",
      "status": "Phê duyệt đặt hàng",
      "createdAt": "2025-09-20T00:00:00Z",
      "score": 9.2
    },
    {
      "id": "i3",
      "title": "Hệ thống IoT giám sát phòng thí nghiệm",
      "status": "Đã sơ loại",
      "createdAt": "2025-08-10T00:00:00Z",
      "score": 7.0
    },
    {
      "id": "i4",
      "title": "Chatbot hỗ trợ sinh viên",
      "status": "Mới",
      "createdAt": "2025-11-25T00:00:00Z"
    }
  ]
}
```

**LƯU Ý:**
- Field `status` trả về **label text** (VD: "Mới", "Đã sơ loại", "Đề xuất đặt hàng") thay vì enum code
- Field `score` là optional, chỉ có khi đã được chấm điểm
- Field `id` có thể là string

### GET /api/home/workflow-steps (PHONG_KH only)
Các bước workflow cần xử lý

**Response:**
```json
{
  "success": true,
  "data": [
    { "key": "idea_review", "title": "Sơ loại ý tưởng", "description": "Xem xét và sơ loại ý tưởng mới", "count": 8, "status": "process", "link": "/ideas/review" },
    { "key": "council_2a", "title": "Phân hội đồng 2A", "description": "Phân công hội đồng xét duyệt", "count": 3, "status": "wait", "link": "/projects/council" },
    { "key": "scoring_2b", "title": "Chấm điểm 2B", "description": "Hội đồng chấm điểm đề xuất", "count": 5, "status": "wait", "link": "/ideas/council" },
    { "key": "tracking_gd3", "title": "Theo dõi GĐ3", "description": "Theo dõi tiến độ thực hiện", "count": 15, "status": "finish", "link": "/projects/my" },
    { "key": "acceptance_gd4", "title": "Nghiệm thu GĐ4", "description": "Nghiệm thu và đánh giá", "count": 4, "status": "wait", "link": "/projects/acceptance" }
  ]
}
```

### GET /api/home/pending-proposals (PHONG_KH only)
Danh sách đề xuất chờ duyệt

### GET /api/home/delayed-projects (PHONG_KH only)
Danh sách đề tài chậm tiến độ

### GET /api/home/charts (LANH_DAO only)
Dữ liệu biểu đồ

**Response:**
```json
{
  "success": true,
  "data": {
    "projectsByYear": [
      { "year": "2021", "value": 85 },
      { "year": "2022", "value": 95 },
      { "year": "2023", "value": 108 },
      { "year": "2024", "value": 118 },
      { "year": "2025", "value": 128 }
    ],
    "projectsByLevel": [
      { "name": "Cấp Trường", "value": 75 },
      { "name": "Cấp Bộ", "value": 38 },
      { "name": "Cấp Nhà nước", "value": 15 }
    ],
    "growthTrend": [
      { "month": "T1", "value": 10, "type": "Đề tài mới" },
      { "month": "T1", "value": 5, "type": "Nghiệm thu" },
      { "month": "T2", "value": 12, "type": "Đề tài mới" },
      { "month": "T2", "value": 7, "type": "Nghiệm thu" }
    ]
  }
}
```

### GET /api/home/top-projects (LANH_DAO only)
Top 5 đề tài theo kinh phí

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "code": "ĐT-2025-001", "title": "Hệ thống quản lý khoa học thông minh", "level": "Cấp Bộ", "budget": 2500000000, "progress": 65 },
    { "id": 2, "code": "ĐT-2025-002", "title": "Nghiên cứu AI trong y tế", "level": "Cấp Nhà nước", "budget": 5000000000, "progress": 40 }
  ]
}
```

### GET /api/home/top-researchers (LANH_DAO only)
Top 5 nhà nghiên cứu

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "PGS.TS. Nguyễn Văn A", "department": "Khoa CNTT", "projectCount": 5, "ideaCount": 8 },
    { "id": 2, "name": "TS. Trần Thị B", "department": "Khoa Điện tử", "projectCount": 4, "ideaCount": 6 }
  ]
}
```

### GET /api/home/warnings (LANH_DAO only)
Cảnh báo

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": "w1", "title": "Đề tài ĐT-2024-008 chậm tiến độ nghiêm trọng", "type": "DELAY", "severity": "HIGH", "description": "Tiến độ chỉ đạt 35% so với kế hoạch 70%", "link": "/projects/8" },
    { "id": "w2", "title": "Kinh phí Q4 chưa giải ngân", "type": "BUDGET", "severity": "MEDIUM", "description": "3 đề tài chưa hoàn thành thủ tục giải ngân Q4", "link": "/finance/pending" },
    { "id": "w3", "title": "Deadline nghiệm thu cuối năm", "type": "DEADLINE", "severity": "HIGH", "description": "5 đề tài cần nghiệm thu trước 31/12/2025", "link": "/projects/acceptance" }
  ]
}
```

## 2. Implementation Guide

### HomeController

```typescript
// app/controllers/home_controller.ts
import { HttpContext } from '@adonisjs/core/http'
import Idea from '#models/idea'
import ProjectProposal from '#models/project_proposal'
import Notification from '#models/notification'
import User from '#models/user'
import CouncilSession from '#models/council_session'

export default class HomeController {
  /**
   * GET /api/home/summary
   */
  async summary({ auth, response }: HttpContext) {
    const user = auth.user!
    const role = user.role
    
    let data = []
    
    if (role === 'PHONG_KH' || role === 'ADMIN') {
      // Đếm đề xuất chờ xử lý
      const proposalsPending = await ProjectProposal.query()
        .where('status', 'SUBMITTED')
        .count('* as total')
      
      // Đếm ý tưởng chờ sơ loại
      const ideasPending = await Idea.query()
        .where('status', 'SUBMITTED')
        .count('* as total')
      
      // Đếm đề tài đang quản lý (APPROVED)
      const projectsManaging = await ProjectProposal.query()
        .where('status', 'APPROVED')
        .count('* as total')
      
      data = [
        { key: 'proposals_pending', title: 'Đề xuất mới chờ xử lý', value: proposalsPending[0].$extras.total || 0, icon: 'FileTextOutlined', color: '#1890ff' },
        { key: 'ideas_pending', title: 'Ý tưởng mới chờ sơ loại', value: ideasPending[0].$extras.total || 0, icon: 'BulbOutlined', color: '#faad14' },
        { key: 'projects_managing', title: 'Đề tài đang quản lý', value: projectsManaging[0].$extras.total || 0, icon: 'ProjectOutlined', color: '#52c41a' },
        { key: 'registration_open', title: 'Đợt đăng ký đang mở', value: 2, icon: 'CalendarOutlined', color: '#722ed1' },
      ]
    } else if (role === 'LANH_DAO') {
      const currentYear = new Date().getFullYear()
      
      // Tổng đề tài trong năm
      const totalProjects = await ProjectProposal.query()
        .where('year', currentYear)
        .where('status', 'APPROVED')
        .count('* as total')
      
      // Tổng kinh phí (tỷ đồng)
      const totalBudget = await ProjectProposal.query()
        .where('status', 'APPROVED')
        .sum('requested_budget_total as total')
      
      const budgetInBillion = (totalBudget[0].$extras.total || 0) / 1000000000
      
      data = [
        { key: 'total_projects_year', title: 'Tổng đề tài trong năm', value: totalProjects[0].$extras.total || 0, icon: 'ProjectOutlined', color: '#1890ff' },
        { key: 'budget_disbursed', title: 'Kinh phí giải ngân', value: Math.round(budgetInBillion * 10) / 10, unit: 'tỷ đồng', icon: 'DollarOutlined', color: '#52c41a' },
        { key: 'acceptance_rate', title: 'Tỷ lệ nghiệm thu', value: 85, unit: '%', icon: 'CheckCircleOutlined', color: '#722ed1' },
        { key: 'idea_conversion', title: 'Ý tưởng → Đề tài', value: 32, unit: '%', icon: 'RiseOutlined', color: '#faad14' },
      ]
    } else {
      // NCV, CNDT, TRUONG_DON_VI, HOI_DONG
      // Đề xuất của user
      const myProposals = await ProjectProposal.query()
        .where('ownerId', user.id)
        .whereIn('status', ['SUBMITTED', 'UNIT_REVIEWED', 'APPROVED'])
        .count('* as total')
      
      // Ý tưởng của user
      const myIdeas = await Idea.query()
        .where('ownerId', user.id)
        .count('* as total')
      
      // Thông báo chưa đọc
      const unreadNotifications = await Notification.query()
        .where('userId', user.id)
        .where('isRead', false)
        .count('* as total')
      
      data = [
        { key: 'projects_in_progress', title: 'Đề tài đang thực hiện', value: myProposals[0].$extras.total || 0, icon: 'ProjectOutlined', color: '#1890ff' },
        { key: 'projects_pending_acceptance', title: 'Chờ nghiệm thu', value: 0, icon: 'ClockCircleOutlined', color: '#52c41a' },
        { key: 'ideas_submitted', title: 'Ý tưởng đã nộp', value: myIdeas[0].$extras.total || 0, icon: 'BulbOutlined', color: '#faad14' },
        { key: 'notifications_unread', title: 'Thông báo chưa đọc', value: unreadNotifications[0].$extras.total || 0, icon: 'BellOutlined', color: '#ff4d4f' },
      ]
    }
    
    return response.ok({ success: true, data })
  }
  
  // ... other methods
}
```

## 3. Yêu cầu

Hãy tạo đầy đủ:
1. HomeController với tất cả các methods
2. Routes
3. **Không cần migration** - module này chỉ aggregate từ các bảng đã có

## 4. Lưu ý

- Tất cả endpoints đều require authentication
- Response data thay đổi tùy theo role của user
- Một số data có thể trả về giá trị mock nếu chưa có module tương ứng (VD: progress, acceptance_rate)
- Có thể cache kết quả 5 phút để tối ưu performance

## 5. Test

Sau khi tạo xong, test với các role khác nhau:

```bash
# Login với role NCV
curl -X POST http://localhost:3333/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ncv@university.edu.vn","password":"password"}'

# Lấy summary
curl http://localhost:3333/api/home/summary \
  -H "Authorization: Bearer {token}"

# Login với role PHONG_KH và test lại
# Login với role LANH_DAO và test lại
```
