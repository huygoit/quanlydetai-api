/** Cờ trong bộ nhớ: đang khôi phục thì API khác tạm dừng. Không ghi database. */
let dangKhoiPhuc = false

export function khoaDangBat(): boolean {
  return dangKhoiPhuc
}

/** Trả false nếu đã có phiên khôi phục khác. */
export function batKhoaKhoiPhuc(): boolean {
  if (dangKhoiPhuc) return false
  dangKhoiPhuc = true
  return true
}

export function moKhoaKhoiPhuc(): void {
  dangKhoiPhuc = false
}
