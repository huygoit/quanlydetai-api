import app from '@adonisjs/core/services/app'
import ProjectProgressService from '#services/project_progress_service'
import ProjectFinalService from '#services/project_final_service'

const SAU_KHI_KHOI_DONG = 15_000
/** Mỗi ngày chạy 1 lần — duyệt toàn bộ nhiệm vụ đang thực hiện + kỳ báo cáo */
const MOI_NGAY = 24 * 60 * 60 * 1000

/**
 * Nhắc hạn khi process web đang chạy (1 lần/ngày).
 * Production nên gắn thêm cron: node ace remind:module56
 * Cờ remindedDays / remindedDay10 / remindedDay13 tránh gửi trùng.
 */
app.ready(() => {
  const gui = async () => {
    try {
      await ProjectProgressService.sendReminders()
      await ProjectFinalService.sendExplanationReminders()
    } catch {
      // lỗi nhắc hạn không được làm sập API
    }
  }
  setTimeout(() => {
    void gui()
    setInterval(() => {
      void gui()
    }, MOI_NGAY)
  }, SAU_KHI_KHOI_DONG)
})
