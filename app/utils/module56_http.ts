import type { HttpContext } from '@adonisjs/core/http'

const MAP: Record<string, [number, string]> = {
  FORBIDDEN: [403, 'Không có quyền thực hiện thao tác này.'],
  OUTLINE_NOT_FOUND: [404, 'Không tìm thấy nhiệm vụ.'],
  CONTRACT_NOT_FOUND: [404, 'Không tìm thấy hợp đồng.'],
  NOT_FOUND: [404, 'Không tìm thấy hồ sơ.'],
  PERIOD_NOT_FOUND: [404, 'Không tìm thấy kỳ báo cáo.'],
  USER_NOT_FOUND: [404, 'Không tìm thấy tài khoản.'],
  OUTLINE_NOT_READY: [422, 'Nhiệm vụ chưa mở triển khai.'],
  BAD_EXECUTION_STATUS: [422, 'Trạng thái triển khai không cho phép thao tác này.'],
  BAD_CONTRACT_STATUS: [422, 'Trạng thái hợp đồng không cho phép thao tác này.'],
  BAD_STATUS: [422, 'Trạng thái hồ sơ không cho phép thao tác này.'],
  CONTRACT_NOT_DRAFT: [422, 'Chỉ sửa phân bổ kinh phí khi hợp đồng còn dự thảo.'],
  BUDGET_LINES_INCOMPLETE: [422, 'Cần đủ 10 mục chi.'],
  BUDGET_SUM_MISMATCH: [422, 'Tổng 10 mục chi phải bằng kinh phí đã duyệt.'],
  MUC_09_OVER_5_PERCENT: [422, 'Mục quản lý chung không được quá 5% tổng kinh phí.'],
  INVALID_BUDGET_CODE: [422, 'Mã mục chi không hợp lệ.'],
  CNNV_NOT_CONFIRMED: [422, 'CNNV chưa xác nhận nội dung hợp đồng.'],
  REASON_REQUIRED: [422, 'Cần nhập lý do.'],
  ISSUE_NO_REQUIRED: [422, 'Cần số văn bản phát hành.'],
  NOT_PUBLISHED: [422, 'Hợp đồng chưa được phát hành.'],
  INVALID_AMOUNT: [422, 'Số tiền không hợp lệ.'],
  INVALID_KIND: [422, 'Loại hồ sơ không hợp lệ.'],
  FORM_INCOMPLETE: [422, 'Thiếu thông tin bắt buộc.'],
  FIELDS_REQUIRED: [422, 'Cần ít nhất một điều khoản được phép sửa.'],
  FILE_REQUIRED: [422, 'Cần file đính kèm.'],
  FILE_TOO_LARGE: [422, 'File vượt dung lượng cho phép.'],
  INVALID_FILES: [422, 'Danh sách file không hợp lệ.'],
  VOUCHER_REQUIRED: [422, 'Cần số chứng từ và ngày chứng từ.'],
  OVER_BUDGET_NOTE_REQUIRED: [422, 'Vượt dự toán thì cần ghi giải trình.'],
  ITEMS_REQUIRED: [422, 'Cần bảng hàng hóa hợp lệ.'],
  INVALID_METHOD: [422, 'Cách mua chỉ nhận mua trực tiếp hoặc đấu thầu.'],
  REPORT_LOCKED: [422, 'Báo cáo đã nộp, không sửa được.'],
  NEXT_PLAN_REQUIRED: [422, 'Kế hoạch tiếp theo là bắt buộc.'],
  ADJUSTMENT_OPEN: [422, 'Đang có phiếu điều chỉnh chưa kết thúc.'],
  LEAD_CONFIRM_REQUIRED: [422, 'Gia hạn từ lần 2 cần trưởng hoặc phó phòng KH xác nhận.'],
  INVALID_DATE: [422, 'Ngày không hợp lệ.'],
  CHANGES_REQUIRED: [422, 'Cần ít nhất một nội dung điều chỉnh.'],
  FINAL_NOT_OPEN: [422, 'Chưa đến hạn nộp đánh giá cuối kỳ và chưa có thông báo.'],
  DOSSIER_INCOMPLETE: [422, 'Hồ sơ đánh giá còn thiếu mục bắt buộc.'],
  BRIEF_PAGES_REQUIRED: [422, 'PKH cần xác nhận báo cáo tóm tắt không quá 15 trang.'],
  INVALID_COUNCIL: [422, 'Hội đồng cần 1 chủ tịch, 1 thư ký và ít nhất 2 phản biện.'],
  COUNCIL_CONFLICT: [422, 'Thành viên hội đồng không được là thành viên nhiệm vụ.'],
  SHEET_INCOMPLETE: [422, 'Phiếu nhận xét còn thiếu hoặc nhận xét chung dưới 100 ký tự.'],
  MINUTES_LOCKED: [422, 'Biên bản đã khóa.'],
  MINUTES_REOPEN_BLOCKED: [
    422,
    'Không mở lại được vì quyết toán hoặc giải trình đã đi tiếp. Chỉ mở khi chưa nộp các phiếu đó.',
  ],
  SIGNED_FILE_REQUIRED: [422, 'Ký bản giấy cần file scan hợp đồng đã ký.'],
  INVALID_SIGN_MODE: [422, 'Cách ký chỉ nhận trực tuyến hoặc bản giấy.'],
  COUNCIL_REQUIRED: [422, 'Chưa lập hội đồng hoặc chưa có ngày họp.'],
  QUORUM: [422, 'Số thành viên có mặt chưa đủ 2/3.'],
  SHEET_MISSING: [422, 'Còn phản biện chưa nộp phiếu nhận xét.'],
  INVALID_CLASSIFICATION: [422, 'Xếp loại chỉ gồm đạt, cần bổ sung, hoặc không đạt.'],
  MINUTES_INCOMPLETE: [422, 'Biên bản còn thiếu nội dung.'],
  EXPLANATION_MISMATCH: [422, 'Cần giải trình đúng từng kiến nghị của biên bản.'],
  VARIANCE_UNACK: [422, 'Số quyết toán lệch sổ chi. PKH cần ghi nhận lệch và lý do.'],
  SURPLUS_REQUIRED: [422, 'Cần chọn cách xử lý kinh phí tồn.'],
}

/** Ghi response nếu lỗi thuộc Module 5–6. Adonis không trả về response từ các hàm status, nên caller chỉ cần biết đã xử lý. */
export function mapModule56Error(response: HttpContext['response'], err: unknown) {
  const code = (err as Error)?.message || ''
  const hit = MAP[code]
  if (!hit) return false
  const [status, message] = hit
  const body = { success: false, message }
  if (status === 403) response.forbidden(body)
  else if (status === 404) response.notFound(body)
  else response.unprocessableEntity(body)
  return true
}
