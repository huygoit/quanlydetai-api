import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Bảng danh mục nhân sự (staffs) - import từ Excel sheet DMNHanSu.
 *
 * Nguyên tắc:
 * - Lưu các cột chuẩn hoá để query/filter nhanh.
 * - Lưu toàn bộ dữ liệu gốc vào source_data (jsonb) để đảm bảo "đầy đủ thông tin" như file Excel.
 */
export default class extends BaseSchema {
  protected tableName = 'staffs'

  async up() {
    const exists = await this.schema.hasTable(this.tableName)
    if (exists) return

    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()

      // Định danh nhân sự từ hệ thống nguồn (unique)
      table.string('staff_code', 100).notNullable().unique() // nv_id
      table.string('full_name', 255).notNullable() // nv_hoten

      // Thông tin cá nhân cơ bản
      table.date('date_of_birth').nullable() // nv_ngaysinh
      table.string('gender', 20).nullable() // nv_gioitinh
      table.string('marital_status', 50).nullable() // nv_honnhan
      table.string('religion_or_ethnicity', 100).nullable() // nv_tongiao (file đang chứa "Mường" -> thực tế giống dân tộc)
      table.string('priority_group', 100).nullable() // nv_uutienGD

      // Thông tin giấy tờ/định danh
      table.string('identity_number', 50).nullable() // nv_soCCCD
      table.string('identity_issue_place', 255).nullable() // nv_noicap
      table.date('identity_issue_date').nullable() // nv_ngaycap
      table.string('insurance_number', 50).nullable() // nv_soBHXH

      // Quê quán/địa chỉ
      table.string('hometown', 255).nullable() // nv_quequan
      table.string('place_of_birth', 255).nullable() // nv_noisinh
      table.text('permanent_address').nullable() // nv_thuongtru
      table.text('current_address').nullable() // nv_noiohiennay

      // Liên hệ
      table.string('phone', 50).nullable() // nv_sdt
      table.string('email', 255).nullable() // nv_email

      // Đơn vị công tác (raw + optional FK)
      table.string('department_name', 255).nullable() // donvi_name
      table.string('department_code', 50).nullable() // donvi_ma
      table.bigInteger('department_id').unsigned().nullable().references('id').inTable('departments').onDelete('SET NULL')

      // Thông tin tuyển dụng/công tác
      table.date('hired_at').nullable() // nv_ngaytuyendung
      table.date('ranked_at').nullable() // nv_ngaybanngach
      table.string('receiving_agency', 255).nullable() // nv_coquantiepnhan
      table.string('recruitment_work_type', 255).nullable() // nv_viec_tuyendung
      table.string('staff_type', 100).nullable() // nv_loaicanbo
      table.string('current_job', 255).nullable() // nv_viec_hiennay
      table.string('social_insurance_leave', 100).nullable() // nv_nghiBHXH

      // Chức vụ/chính trị/đoàn thể
      table.string('position_title', 255).nullable() // nv_chucvu
      table.date('appointed_at').nullable() // nv_ngaybonhiem
      table.string('concurrent_position', 255).nullable() // nv_chucvu_coquankiemnhiem
      table.string('highest_position', 255).nullable() // nv_chucvu_coquancao nhat (chuẩn hoá)
      table.string('party_joined_at_raw', 50).nullable() // nv_ngayvaodang (định dạng text trong file)
      table.string('party_position', 255).nullable() // nv_chucvudang
      table.boolean('is_union_member').nullable() // nv_doanvien (0/1)

      // Trình độ/chuyên môn
      table.string('professional_degree', 255).nullable() // nv_chuyenmon
      table.string('industry_group', 50).nullable() // nv_khoinganh
      table.string('field', 255).nullable() // nv_linhvuc
      table.string('major', 255).nullable() // nv_chuyennganh
      table.string('professional_title', 255).nullable() // nv_chức danh

      // Đào tạo
      table.string('training_place', 255).nullable() // nv_noidaotao
      table.string('training_mode', 100).nullable() // nv_hinhthucdaotao_id
      table.string('training_country', 100).nullable() // nv_quocgiadaotao
      table.string('training_institution', 255).nullable() // nv_cosodaotao
      table.integer('graduation_year').nullable() // nv_namtotnghiep

      // Trình độ bổ sung/đánh giá
      table.string('political_level', 100).nullable() // nv_trinhdochinhtri
      table.string('state_management_level', 100).nullable() // nv_trinhdoqlnn
      table.string('it_level', 100).nullable() // nv_trinhdotinhoc
      table.string('title_award', 255).nullable() // nv_danhhieu
      table.integer('recognition_year').nullable() // nv_namcongnhan
      table.string('academic_title', 100).nullable() // nv_hocham
      table.boolean('is_85_program').nullable() // nv_huong85 (0/1)
      table.string('job_title_type', 255).nullable() // nv_loaichucdanh

      // Lương
      table.integer('salary_step').nullable() // nv_batluong
      table.decimal('salary_coefficient', 6, 2).nullable() // nv_hsluong

      // Link tài khoản hệ thống nếu có
      table.bigInteger('user_id').unsigned().nullable().unique().references('id').inTable('users').onDelete('SET NULL')

      // Ghi chú + dữ liệu nguồn
      table.text('note').nullable()
      table.jsonb('source_data').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index('staff_code')
      table.index('full_name')
      table.index('email')
      table.index('identity_number')
      table.index('department_id')
      table.index('department_code')
      table.index('recruitment_work_type')
      table.index('current_job')
    })
  }

  async down() {
    const exists = await this.schema.hasTable(this.tableName)
    if (!exists) return
    this.schema.dropTable(this.tableName)
  }
}

