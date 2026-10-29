/** Tiêu chí phiếu BM.05a (= mẫu BM-02.09 đã gửi) */
export const BM05A_CRITERIA = [
  { code: 'PHU_HOP_MUC_TIEU', name: 'Sự phù hợp với mục tiêu, yêu cầu nhiệm vụ', maxScore: 15 },
  { code: 'KHOA_HOC_MOI', name: 'Tính khoa học, tính mới và sáng tạo', maxScore: 15 },
  { code: 'NOI_DUNG_PP', name: 'Nội dung và phương pháp thực hiện', maxScore: 15 },
  { code: 'SAN_PHAM_CL', name: 'Sản phẩm và chỉ tiêu chất lượng', maxScore: 15 },
  { code: 'KHA_THI_TIEN_DO', name: 'Tính khả thi và tiến độ', maxScore: 10 },
  { code: 'NANG_LUC_NHOM', name: 'Năng lực của chủ nhiệm và nhóm thực hiện', maxScore: 10 },
  { code: 'CSVC_NGUON_LUC', name: 'Cơ sở vật chất và nguồn lực', maxScore: 10 },
  { code: 'HIEU_QUA_CG', name: 'Hiệu quả, khả năng ứng dụng/chuyển giao', maxScore: 10 },
] as const

export const BM05A_CONCLUSIONS = ['DE_XUAT', 'HOAN_THIEN', 'KHONG_DE_XUAT'] as const
