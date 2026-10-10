import app from '@adonisjs/core/services/app'
import ProjectProgressService from '#services/project_progress_service'
import ProjectFinalService from '#services/project_final_service'

const SAU_KHI_KHOI_DONG = 15_000
const MOI_SAU_GIO = 6 * 60 * 60 * 1000

/**
 * Nhắc hạn khi process web đang chạy.
 * Cờ remindedDays / remindedDay10 / remindedDay13 giữ lần gửi, chạy lại không gửi trùng.
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
    }, MOI_SAU_GIO)
  }, SAU_KHI_KHOI_DONG)
})
