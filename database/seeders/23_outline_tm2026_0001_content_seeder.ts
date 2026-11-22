import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'
import ProjectOutline from '#models/project_outline'
import ProjectProcessType from '#models/project_process_type'

const OUTLINE_CODE = 'TM-2026-0001'

/**
 * Đổ nội dung thuyết minh thực tế (HTML editor) vào TM-2026-0001.
 * Giữ nguyên owner / thành viên / trạng thái hiện có.
 *
 * Chạy: node ace db:seed --files=database/seeders/23_outline_tm2026_0001_content_seeder.ts
 */
export default class extends BaseSeeder {
  async run() {
    const outline = await ProjectOutline.query()
      .where('code', OUTLINE_CODE)
      .preload('members')
      .first()
    if (!outline) {
      console.warn(`[23] Không thấy ${OUTLINE_CODE} — bỏ qua`)
      return
    }

    const processType =
      (await ProjectProcessType.query().where('code', 'QT-I').first()) ||
      (await ProjectProcessType.query().orderBy('id', 'asc').first())

    const start = outline.startDate || DateTime.fromObject({ year: 2026, month: 3, day: 1 })
    const end = outline.endDate || DateTime.fromObject({ year: 2027, month: 8, day: 31 })

    const fundingBreakdown = {
      schoolFund: 250_000_000,
      externalFund: 100_000_000,
      stateBudget: 100_000_000,
      nonStateBudget: 250_000_000,
      lumpSumMode: 'PARTIAL' as const,
      lumpSumAmount: 280_000_000,
      nonLumpSumAmount: 70_000_000,
    }

    const budgetMatrix = {
      STATE_LUMP: {
        THU_LAO: 40_000_000,
        VAT_LIEU: 10_000_000,
        HOI_NGHI: 8_000_000,
        THUE_NGOAI: 5_000_000,
        DIEU_TRA: 12_000_000,
        VAN_PHONG: 3_000_000,
        CONG_BO: 15_000_000,
        TU_DANH_GIA: 2_000_000,
        TU_VAN_SHTT: 3_000_000,
        PHO_BIEN: 2_000_000,
        CHI_KHAC: 0,
      },
      STATE_NON_LUMP: {
        THU_LAO: 0,
        VAT_LIEU: 0,
        HOI_NGHI: 0,
        THUE_NGOAI: 0,
        DIEU_TRA: 0,
        VAN_PHONG: 0,
        CONG_BO: 0,
        TU_DANH_GIA: 0,
        TU_VAN_SHTT: 0,
        PHO_BIEN: 0,
        CHI_KHAC: 0,
      },
      NON_STATE: {
        THU_LAO: 90_000_000,
        VAT_LIEU: 25_000_000,
        HOI_NGHI: 20_000_000,
        THUE_NGOAI: 15_000_000,
        DIEU_TRA: 30_000_000,
        VAN_PHONG: 8_000_000,
        CONG_BO: 25_000_000,
        TU_DANH_GIA: 5_000_000,
        TU_VAN_SHTT: 7_000_000,
        PHO_BIEN: 5_000_000,
        CHI_KHAC: 5_000_000,
      },
    }

    const principal = outline.principalInfo || {}
    const tenChuNhiemTuTv =
      outline.members?.find((m) => String(m.role || '').toUpperCase() === 'PRINCIPAL')
        ?.fullName || ''

    outline.merge({
      title:
        outline.title?.trim() ||
        'Nghiên cứu xây dựng hệ thống hỗ trợ đánh giá năng lực số của giáo viên phổ thông dựa trên trí tuệ nhân tạo',
      projectProcessTypeId: outline.projectProcessTypeId || processType?.id || null,
      level: outline.level || 'TRUONG',
      field: outline.field || 'Công nghệ thông tin',
      startDate: start,
      endDate: end,
      requestedBudget: Number(outline.requestedBudget || 0) || 350_000_000,
      fundingBreakdown,
      budgetMatrix,
      principalInfo: {
        ...principal,
        fullName: principal.fullName || tenChuNhiemTuTv || 'Phan Quốc Mười',
        identityNumber: principal.identityNumber || '048085001234',
        dateOfBirth: principal.dateOfBirth || '1980-08-15',
        gender: principal.gender || 'MALE',
        academicTitleDegree: principal.academicTitleDegree || 'PGS.TS',
        professionalTitle: principal.professionalTitle || 'Giảng viên cao cấp',
        position: principal.position || 'Trưởng bộ môn',
        phone: principal.phone || '0905123456',
        organization: principal.organization || 'Trường Đại học Sư phạm – ĐHĐN',
        workAddress: principal.workAddress || '459 Tôn Đức Thắng, Liên Chiểu, Đà Nẵng',
      },
      hostUnit: outline.hostUnit || 'Trường Đại học Sư phạm – Đại học Đà Nẵng',
      hostOrganization: {
        name: 'Trường Đại học Sư phạm – Đại học Đà Nẵng',
        orgCode: 'DV-UED-CNTT',
        phone: '02363841234',
        address: '459 Tôn Đức Thắng, Liên Chiểu, Đà Nẵng',
        leaderName: 'PGS.TS. Nguyễn Văn Hiệu',
        experienceHtml: `<p><strong>Năng lực tổ chức chủ trì:</strong> Trường ĐHSP – ĐHĐN đã chủ trì nhiều nhiệm vụ KHCN cấp Trường/ĐHĐN về chuyển đổi số giáo dục và AI ứng dụng.</p>
<ul>
<li>Phòng lab Công nghệ thông tin, hệ thống LMS và kho dữ liệu khảo sát giáo dục.</li>
<li>Đội ngũ giảng viên chuyên ngành CNTT, Giáo dục học, Đo lường đánh giá.</li>
<li>Kinh nghiệm hợp tác với Sở GD&amp;ĐT Đà Nẵng trong bồi dưỡng giáo viên.</li>
</ul>`,
        teamCapacityHtml: `<p><strong>Đội ngũ chính:</strong></p>
<ol>
<li><strong>Chủ nhiệm:</strong> PGS.TS — định hướng chuyên môn, quản lý tiến độ, công bố.</li>
<li><strong>Thành viên chính:</strong> phát triển mô hình AI, xây dựng phần mềm, khảo sát thực địa.</li>
<li><strong>Kỹ thuật viên / HVCH:</strong> thu thập dữ liệu, hỗ trợ thử nghiệm tại trường phổ thông.</li>
</ol>
<p><em>Lý lịch khoa học điện tử</em> được cập nhật trên hệ thống quản lý đề tài.</p>`,
      },
      partnerUnits: [
        {
          name: 'Sở Giáo dục và Đào tạo thành phố Đà Nẵng',
          orgCode: 'SGD-DN',
          phone: '02363821111',
          address: '41 Lê Duẩn, Hải Châu, Đà Nẵng',
        },
        {
          name: 'Trường THPT chuyên Lê Quý Đôn',
          orgCode: 'LQD-DN',
          phone: '02363822222',
          address: '01 Ông Ích Khiêm, Đà Nẵng',
        },
      ],
      urgency: `<p>Chuyển đổi số giáo dục đòi hỏi <strong>chuẩn hóa năng lực số</strong> của giáo viên phổ thông. Thực tế còn thiếu công cụ đánh giá <em>khách quan, quy mô lớn</em>.</p>
<p>Ứng dụng AI giúp:</p>
<ul>
<li>Chuẩn hóa bộ công cụ và chỉ số đo lường;</li>
<li>Hỗ trợ nhà trường, Sở GD&amp;ĐT ra quyết định bồi dưỡng đúng nhu cầu;</li>
<li>Giảm thời gian xử lý thủ công, tăng tính minh bạch.</li>
</ul>`,
      detailedObjectives: `<p><strong>Mục tiêu chung:</strong> Xây dựng hệ thống hỗ trợ đánh giá năng lực số giáo viên phổ thông dựa trên trí tuệ nhân tạo.</p>
<p><strong>Mục tiêu cụ thể:</strong></p>
<ol>
<li>Đề xuất khung năng lực số phù hợp bối cảnh Việt Nam.</li>
<li>Xây dựng bộ công cụ đánh giá và mô hình AI hỗ trợ chấm/phân tích.</li>
<li>Thử nghiệm tại ít nhất <u>05 trường phổ thông</u> Đà Nẵng.</li>
<li>Công bố kết quả khoa học và chuyển giao cho Sở GD&amp;ĐT.</li>
</ol>`,
      researchContent: `<p><strong>Nội dung 1 — Khảo sát hiện trạng:</strong> tổng quan tài liệu, điều tra năng lực số giáo viên.</p>
<p><strong>Nội dung 2 — Khung năng lực &amp; công cụ:</strong> xây dựng chỉ số, rubric, bộ câu hỏi.</p>
<p><strong>Nội dung 3 — Hệ thống &amp; AI:</strong> phát triển phần mềm web, mô hình học máy có giám sát.</p>
<p><strong>Nội dung 4 — Thử nghiệm &amp; chuyển giao:</strong> đánh giá hiệu quả, hoàn thiện, tập huấn.</p>
<p><strong>Phương pháp:</strong></p>
<ul>
<li>Nghiên cứu tài liệu, khảo sát định lượng/định tính;</li>
<li>Thiết kế phần mềm theo Agile;</li>
<li>Học máy có giám sát, kiểm chứng mẫu ngẫu nhiên;</li>
<li>Đánh giá thực địa tại trường phổ thông.</li>
</ul>`,
      methodology: null,
      milestones: [
        {
          content:
            '<p>Khảo sát hiện trạng và tổng quan nghiên cứu</p>',
          startDate: '2026-03-01',
          endDate: '2026-06-30',
          expectedResult: '<p>Báo cáo khảo sát; bộ dữ liệu điều tra</p>',
        },
        {
          content: '<p>Xây dựng khung năng lực số và bộ công cụ đánh giá</p>',
          startDate: '2026-07-01',
          endDate: '2026-12-31',
          expectedResult: '<p>Khung năng lực; bộ Rubric/câu hỏi</p>',
        },
        {
          content: '<p>Phát triển hệ thống phần mềm và mô hình AI</p>',
          startDate: '2027-01-01',
          endDate: '2027-05-31',
          expectedResult: '<p>Hệ thống chạy thử; mô hình AI v1.0</p>',
        },
        {
          content: '<p>Thử nghiệm thực địa, hoàn thiện và chuyển giao</p>',
          startDate: '2027-06-01',
          endDate: '2027-08-31',
          expectedResult: '<p>Báo cáo thử nghiệm; hồ sơ chuyển giao; công bố</p>',
        },
      ],
      expectedProducts: [
        {
          name: 'Khung năng lực số giáo viên phổ thông',
          quantity: '01',
          quality: 'Được nghiệm thu',
        },
        {
          name: 'Hệ thống phần mềm hỗ trợ đánh giá',
          quantity: '01',
          quality: 'Triển khai thử tại ≥5 trường',
        },
      ],
      expectedResults: {
        publications: [
          {
            id: 'pub-1',
            category: 'DOMESTIC',
            content: 'Bài báo trên tạp chí chuyên ngành giáo dục/CNTT trong nước',
            quantity: '01',
            scienceRequirement: 'Được chấp nhận đăng',
            note: '',
          },
          {
            id: 'pub-2',
            category: 'INTERNATIONAL',
            content: 'Bài báo hội nghị/tạp chí quốc tế (Scopus/WoS nếu đủ điều kiện)',
            quantity: '01',
            scienceRequirement: 'Được chấp nhận hoặc trình bày',
            note: '',
          },
        ],
        appliedProducts: [
          {
            id: 'ap-1',
            name: 'Quy trình đánh giá năng lực số giáo viên phổ thông',
            scienceRequirement: 'Có hướng dẫn vận hành và bộ chỉ số đo lường',
            note: '',
          },
          {
            id: 'ap-2',
            name: 'Phần mềm hỗ trợ đánh giá năng lực số (web)',
            scienceRequirement: 'Có tài liệu kỹ thuật, mã nguồn quản lý phiên bản',
            note: '',
          },
        ],
        tangibleProducts: [
          {
            id: 'tp-1',
            name: 'Bộ dữ liệu khảo sát năng lực số đã làm sạch',
            unit: 'bộ',
            qualityRequired: 'Ẩn danh, đủ mẫu thống kê',
            qualitySampleDomestic: 'Theo chuẩn nghiên cứu giáo dục',
            qualitySampleWorld: '—',
            quantityScale: '≥500 phiếu',
          },
        ],
        ipProducts: [
          {
            id: 'ip-1',
            name: 'Đăng ký quyền tác giả phần mềm hỗ trợ đánh giá',
            scienceRequirement: 'Có giấy chứng nhận hoặc hồ sơ nộp',
            note: '',
          },
        ],
        postgraduateTraining: [
          {
            id: 'tr-1',
            level: 'Thạc sĩ',
            quantity: '02',
            major: 'Công nghệ thông tin / Giáo dục học',
            note: 'Học viên tham gia thu thập dữ liệu và thử nghiệm',
          },
        ],
      },
      otherContents: {
        applicationTransferHtml: `<p>Chuyển giao cho <strong>Sở GD&amp;ĐT Đà Nẵng</strong> và các trường tham gia thử nghiệm; tổ chức tập huấn sử dụng hệ thống.</p>
<ul>
<li>Phương thức: bàn giao phần mềm + tài liệu vận hành;</li>
<li>Phân chia lợi ích theo thỏa thuận hợp tác (nếu thương mại hóa).</li>
</ul>`,
        outputEffectivenessHtml: `<p>Cung cấp công cụ đánh giá <strong>chuẩn hóa</strong>, giảm thời gian xử lý thủ công, hỗ trợ lập kế hoạch bồi dưỡng giáo viên dựa trên dữ liệu.</p>`,
        impactAssessmentHtml: `<p>Tác động đến quản trị nhà trường và chính sách bồi dưỡng giáo viên tại địa phương; tạo nền tảng mở rộng sang các tỉnh miền Trung.</p>`,
        riskManagementHtml: `<p><strong>Rủi ro chính và biện pháp:</strong></p>
<ol>
<li>Dữ liệu thiếu/không đồng nhất → mẫu dự phòng, làm sạch dữ liệu.</li>
<li>Tiến độ phần mềm chậm → chia giai đoạn MVP.</li>
<li>Đạo đức/riêng tư → ẩn danh, xin chấp thuận trước khi thu thập.</li>
</ol>`,
        ethicsDataApprovalHtml: `<p>Thu thập dữ liệu giáo viên có <u>chấp thuận</u>; ẩn danh trước khi phân tích; lưu trữ theo quy định bảo vệ dữ liệu cá nhân.</p>`,
        dataManagementPlanHtml: `<p>Dữ liệu lưu trên máy chủ Trường, phân quyền truy cập; sao lưu định kỳ; công bố chỉ dùng dữ liệu đã ẩn danh.</p>`,
        ipProtectionHtml: `<p>Quyền sở hữu kết quả thuộc Trường theo quy định; đăng ký quyền tác giả phần mềm; thỏa thuận với đối tác về quyền sử dụng.</p>`,
        aiUsageHtml: `<p>AI dùng để <strong>hỗ trợ chấm/phân tích</strong> kết quả đánh giá; dữ liệu huấn luyện ẩn danh; có kiểm chứng thủ công mẫu ngẫu nhiên; nhóm nghiên cứu chịu trách nhiệm kết quả công bố.</p>`,
      },
      summary:
        'Nội dung seed thực tế BM-02.02 cho TM-2026-0001 — phục vụ demo form và xuất Word có định dạng.',
      completionPercent: Math.max(Number(outline.completionPercent || 0), 90),
    } as any)

    await outline.save()
    console.info(
      `[23] Đã cập nhật nội dung ${OUTLINE_CODE} (id=${outline.id}, status=${outline.status})`
    )
  }
}
