import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'
import User from '#models/user'
import ScientificProfile from '#models/scientific_profile'
import ProjectProposal from '#models/project_proposal'
import ProjectProposalMember from '#models/project_proposal_member'
import ProjectOutline from '#models/project_outline'
import ProjectOutlineMember from '#models/project_outline_member'
import ProjectProcessType from '#models/project_process_type'

const OUTLINE_CODE = 'TM-2026-SEED'
const PROPOSAL_CODE = 'ĐT-2026-SEED'

/** Ưu tiên email CNNV (SEED_TM_OWNER_EMAIL ghi đè). */
const OWNER_EMAIL_CANDIDATES = [
  process.env.SEED_TM_OWNER_EMAIL,
  'pqmuoi@ued.udn.vn',
  'nmly@ued.udn.vn',
  'nqhuy@ued.udn.vn',
  'nqhuydn@gmail.com',
  'huygoit@gmail.com',
  'nhqhuy@ued.udn.vn',
  'ncv@university.edu.vn',
  'cndt@university.edu.vn',
].filter(Boolean) as string[]

/**
 * Seed thuyết minh mẫu đầy đủ BM-02.02 — code TM-2026-SEED.
 * Chạy: node ace db:seed --files=database/seeders/22_outline_tm2026_seed.ts
 * Gán owner: set SEED_TM_OWNER_EMAIL=email@... nếu cần.
 */
export default class extends BaseSeeder {
  async run() {
    let owner: User | null = null
    let profile: ScientificProfile | null = null

    /**
     * Ưu tiên 1: bám thuyết minh mới nhất (khác seed).
     * - profile/PRINCIPAL = chủ nhiệm thật
     * - owner đề xuất = owner đề xuất gốc (có thể khác CNNV) → cả hai đều mở được seed
     */
    let proposalOwnerUser: User | null = null
    const recentOutline = await ProjectOutline.query()
      .whereNot('code', OUTLINE_CODE)
      .orderBy('updated_at', 'desc')
      .first()
    if (recentOutline) {
      const recentProposal = await ProjectProposal.find(recentOutline.projectProposalId)
      if (recentProposal?.ownerId) {
        proposalOwnerUser = (await User.find(recentProposal.ownerId)) || null
      }
      const prin = await ProjectOutlineMember.query()
        .where('project_outline_id', recentOutline.id)
        .where('role', 'PRINCIPAL')
        .whereNotNull('profile_id')
        .first()
      if (prin?.profileId) {
        const p = await ScientificProfile.find(prin.profileId)
        const u = p?.userId ? await User.find(p.userId) : null
        if (u && p) {
          owner = u
          profile = p
        }
      }
      if ((!owner || !profile) && proposalOwnerUser) {
        const p = await ScientificProfile.query().where('user_id', proposalOwnerUser.id).first()
        if (p) {
          owner = proposalOwnerUser
          profile = p
        }
      }
    }

    // Ưu tiên 2: danh sách email ứng viên
    if (!owner || !profile) {
      for (const email of OWNER_EMAIL_CANDIDATES) {
        const u = await User.query().where('email', email).first()
        if (!u) continue
        const p = await ScientificProfile.query().where('user_id', u.id).first()
        if (!p) continue
        owner = u
        profile = p
        break
      }
    }

    // Fallback: NCV bất kỳ đã có hồ sơ khoa học (không lấy Admin)
    if (!owner || !profile) {
      const profiles = await ScientificProfile.query()
        .whereNotNull('user_id')
        .orderBy('id', 'asc')
        .limit(50)
      for (const p of profiles) {
        const u = await User.find(p.userId)
        if (!u || u.role === 'ADMIN' || String(u.email || '').startsWith('admin@')) continue
        owner = u
        profile = p
        break
      }
    }

    if (!owner || !profile) {
      console.warn('[22_outline_tm2026] Không tìm được CNNV có hồ sơ — bỏ qua')
      return
    }
    // Owner đề xuất: ưu tiên owner gốc (nmly…); CNNV PRINCIPAL có thể khác
    const proposalOwner = proposalOwnerUser || owner
    console.info(
      `[22_outline_tm2026] CNNV=${owner.email} (profile=${profile.id}); proposalOwner=${proposalOwner.email}`
    )

    const processType =
      (await ProjectProcessType.query().where('code', 'QT-I').first()) ||
      (await ProjectProcessType.query().orderBy('id', 'asc').first())

    let proposal = await ProjectProposal.query().where('code', PROPOSAL_CODE).first()
    if (!proposal) {
      proposal = await ProjectProposal.create({
        code: PROPOSAL_CODE,
        title:
          'Nghiên cứu xây dựng hệ thống hỗ trợ đánh giá năng lực số của giáo viên phổ thông dựa trên AI',
        field: 'Công nghệ thông tin',
        level: 'TRUONG',
        year: 2026,
        durationMonths: 18,
        keywords: ['AI', 'Năng lực số', 'Giáo viên', 'Đánh giá'],
        ownerId: proposalOwner.id,
        ownerName: proposalOwner.fullName || owner.fullName || 'Nguyễn Văn A',
        ownerEmail: proposalOwner.email,
        ownerUnit: proposalOwner.unit || owner.unit || 'Khoa CNTT',
        coAuthors: ['PGS.TS. Trần Minh Hoàng', 'ThS. Lê Thị Mai'],
        objectives:
          'Xây dựng khung năng lực số và công cụ hỗ trợ đánh giá cho giáo viên phổ thông.',
        summary:
          'Đề tài phát triển mô hình và hệ thống AI hỗ trợ đánh giá năng lực số giáo viên.',
        contentOutline: '1. Khảo sát\n2. Xây dựng khung\n3. Phát triển hệ thống\n4. Thử nghiệm',
        expectedResults: 'Khung năng lực; Hệ thống phần mềm; 02 bài báo; 01 giải pháp hữu ích',
        applicationPotential: 'Áp dụng tại các trường phổ thông thuộc Đà Nẵng và khu vực miền Trung.',
        requestedBudgetTotal: 350_000_000,
        requestedBudgetDetail: 'Nhân công, hội thảo, công bố, quản lý',
        status: 'DUOC_CHON',
        canWriteOutline: true,
        catalogRegistrationStatus: 'DA_GIAO',
        unitApproved: true,
        unitComment: 'Đề tài phù hợp định hướng chuyển đổi số giáo dục.',
        sciDeptPriority: 'HIGH',
        sciDeptComment: 'Ưu tiên thực hiện năm 2026.',
      })
      console.info(`[22_outline_tm2026] Đã tạo đề xuất ${PROPOSAL_CODE}`)
    } else {
      proposal.merge({
        status: 'DUOC_CHON',
        canWriteOutline: true,
        catalogRegistrationStatus: 'DA_GIAO',
        ownerId: proposalOwner.id,
        ownerName: proposalOwner.fullName || profile.fullName,
        ownerEmail: proposalOwner.email,
        ownerUnit: proposalOwner.unit || profile.organization || 'Khoa CNTT',
      })
      await proposal.save()
    }

    // Gắn CNNV trên đề xuất (điều kiện list/soạn thuyết minh)
    await ProjectProposalMember.query().where('project_proposal_id', proposal.id).delete()
    await ProjectProposalMember.create({
      projectProposalId: proposal.id,
      profileId: profile.id,
      studentId: null,
      departmentId: profile.departmentId ?? null,
      fullName: profile.fullName || owner.fullName || 'Chủ nhiệm',
      memberOrder: 1,
      role: 'PRINCIPAL',
      affiliationType: 'UDN_ONLY',
      affiliationUnits: [],
      gender: (profile.gender as any) || null,
      isMultiAffiliationOutsideUdn: false,
      contributionPercent: 40,
    })

    const start = DateTime.fromObject({ year: 2026, month: 3, day: 1 })
    const end = DateTime.fromObject({ year: 2027, month: 8, day: 31 })

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

    const principalInfo = {
      profileId: profile?.id ?? null,
      fullName: profile?.fullName || owner.fullName || 'Nguyễn Văn A',
      identityNumber: '048085001234',
      dateOfBirth: profile?.dateOfBirth?.toISODate?.() || '1985-05-12',
      gender: profile?.gender || 'MALE',
      academicTitleDegree: [profile?.academicTitle, profile?.degree].filter(Boolean).join(' ') || 'TS',
      professionalTitle: profile?.currentTitle || 'Giảng viên chính',
      position: profile?.managementRole || 'Trưởng bộ môn',
      phone: profile?.phone || '0905123456',
      email: profile?.workEmail || owner.email,
      organization: profile?.organization || 'Trường Đại học Sư phạm – ĐHĐN',
      workAddress: '459 Tôn Đức Thắng, Liên Chiểu, Đà Nẵng',
    }

    const payload = {
      projectProposalId: proposal.id,
      code: OUTLINE_CODE,
      status: 'THUYETMINH_DRAFT' as const,
      title:
        'Nghiên cứu xây dựng hệ thống hỗ trợ đánh giá năng lực số của giáo viên phổ thông dựa trên trí tuệ nhân tạo',
      projectProcessTypeId: processType?.id ?? null,
      level: 'TRUONG',
      field: 'Công nghệ thông tin',
      startDate: start,
      endDate: end,
      requestedBudget: 350_000_000,
      fundingBreakdown,
      budgetMatrix,
      principalInfo,
      hostUnit: 'Trường Đại học Sư phạm – Đại học Đà Nẵng',
      hostOrganization: {
        name: 'Trường Đại học Sư phạm – Đại học Đà Nẵng',
        orgCode: 'DV-UED-CNTT',
        phone: '02363841234',
        address: '459 Tôn Đức Thắng, Liên Chiểu, Đà Nẵng',
        leaderName: 'PGS.TS. Nguyễn Văn Hiệu',
        experienceHtml:
          '<p>Trường có kinh nghiệm chủ trì nhiều nhiệm vụ KHCN cấp Trường/ĐHĐN về AI giáo dục, có phòng lab CNTT và đội ngũ giảng viên chuyên ngành Công nghệ thông tin, Giáo dục học.</p>',
        teamCapacityHtml:
          '<p>Nhóm nghiên cứu gồm 01 chủ nhiệm (TS), 02 thành viên chính (ThS/TS), 01 kỹ thuật viên và 02 học viên cao học. Lý lịch khoa học điện tử cập nhật trên hệ thống.</p>',
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
      urgency:
        '<p>Chuyển đổi số giáo dục yêu cầu chuẩn hóa năng lực số của giáo viên. Hiện thiếu công cụ đánh giá khách quan, quy mô lớn. Việc ứng dụng AI giúp chuẩn hóa bộ công cụ, hỗ trợ nhà trường và Sở GD&ĐT ra quyết định bồi dưỡng đúng nhu cầu.</p>',
      detailedObjectives:
        '<p><strong>Mục tiêu chung:</strong> Xây dựng hệ thống hỗ trợ đánh giá năng lực số giáo viên phổ thông dựa trên AI.</p><p><strong>Mục tiêu cụ thể:</strong></p><ol><li>Đề xuất khung năng lực số phù hợp bối cảnh Việt Nam.</li><li>Xây dựng bộ công cụ đánh giá và mô hình AI hỗ trợ chấm/phân tích.</li><li>Thử nghiệm tại ít nhất 05 trường phổ thông Đà Nẵng.</li><li>Công bố kết quả và chuyển giao cho Sở GD&ĐT.</li></ol>',
      researchContent:
        '<p><strong>Nội dung 1:</strong> Tổng quan, khảo sát hiện trạng năng lực số giáo viên.</p><p><strong>Nội dung 2:</strong> Xây dựng khung năng lực và bộ chỉ số đánh giá.</p><p><strong>Nội dung 3:</strong> Phát triển hệ thống phần mềm và mô hình AI.</p><p><strong>Nội dung 4:</strong> Thử nghiệm, đánh giá hiệu quả, hoàn thiện và chuyển giao.</p><p><strong>Phương pháp:</strong> Nghiên cứu tài liệu, khảo sát định lượng/định tính, thiết kế phần mềm Agile, học máy có giám sát, đánh giá thực địa.</p>',
      methodology: null,
      milestones: [
        {
          content: 'Khảo sát hiện trạng và tổng quan nghiên cứu',
          startDate: '2026-03-01',
          endDate: '2026-06-30',
          expectedResult: 'Báo cáo khảo sát; bộ dữ liệu điều tra',
        },
        {
          content: 'Xây dựng khung năng lực số và bộ công cụ đánh giá',
          startDate: '2026-07-01',
          endDate: '2026-12-31',
          expectedResult: 'Khung năng lực; bộ Rubric/câu hỏi đánh giá',
        },
        {
          content: 'Phát triển hệ thống phần mềm và mô hình AI',
          startDate: '2027-01-01',
          endDate: '2027-05-31',
          expectedResult: 'Hệ thống chạy thử; mô hình AI phiên bản 1.0',
        },
        {
          content: 'Thử nghiệm thực địa, hoàn thiện và chuyển giao',
          startDate: '2027-06-01',
          endDate: '2027-08-31',
          expectedResult: 'Báo cáo thử nghiệm; hồ sơ chuyển giao; công bố',
        },
      ],
      expectedProducts: [
        { name: 'Khung năng lực số giáo viên phổ thông', quantity: '01', quality: 'Được nghiệm thu' },
        { name: 'Hệ thống phần mềm hỗ trợ đánh giá', quantity: '01', quality: 'Triển khai thử tại ≥5 trường' },
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
        applicationTransferHtml:
          '<p>Chuyển giao cho Sở GD&ĐT Đà Nẵng và các trường tham gia thử nghiệm; tổ chức tập huấn sử dụng hệ thống; phân chia lợi ích theo thỏa thuận hợp tác (nếu thương mại hóa).</p>',
        outputEffectivenessHtml:
          '<p>Cung cấp công cụ đánh giá chuẩn hóa, giảm thời gian xử lý thủ công, hỗ trợ lập kế hoạch bồi dưỡng giáo viên dựa trên dữ liệu.</p>',
        impactAssessmentHtml:
          '<p>Tác động đến quản trị nhà trường và chính sách bồi dưỡng giáo viên tại địa phương; tạo nền tảng mở rộng sang các tỉnh miền Trung.</p>',
        riskManagementHtml:
          '<p>Rủi ro dữ liệu thiếu/không đồng nhất: dự phòng mẫu dự phòng và làm sạch dữ liệu. Rủi ro tiến độ phần mềm: chia giai đoạn MVP. Rủi ro đạo đức/riêng tư: ẩn danh và xin chấp thuận.</p>',
        ethicsDataApprovalHtml:
          '<p>Thu thập dữ liệu giáo viên có chấp thuận; ẩn danh trước khi phân tích; lưu trữ theo quy định bảo vệ dữ liệu cá nhân.</p>',
        dataManagementPlanHtml:
          '<p>Dữ liệu lưu trên máy chủ Trường, phân quyền truy cập; sao lưu định kỳ; công bố chỉ dùng dữ liệu đã ẩn danh.</p>',
        ipProtectionHtml:
          '<p>Quyền sở hữu kết quả thuộc Trường theo quy định; đăng ký quyền tác giả phần mềm; thỏa thuận với đối tác về quyền sử dụng.</p>',
        aiUsageHtml:
          '<p>AI dùng để hỗ trợ chấm/phân tích kết quả đánh giá; dữ liệu huấn luyện ẩn danh; có kiểm chứng thủ công mẫu ngẫu nhiên; nhóm nghiên cứu chịu trách nhiệm kết quả công bố.</p>',
      },
      summary:
        'Thuyết minh mẫu đầy đủ BM-02.02 phục vụ demo xuất Word và kiểm thử form.',
      outlineFileUrl: null,
      appendixFileUrl: null,
      completionPercent: 95,
    }

    let outline = await ProjectOutline.query().where('code', OUTLINE_CODE).first()
    if (outline) {
      outline.merge(payload as any)
      await outline.save()
      console.info(`[22_outline_tm2026] Đã cập nhật ${OUTLINE_CODE} (id=${outline.id})`)
    } else {
      outline = await ProjectOutline.create(payload as any)
      console.info(`[22_outline_tm2026] Đã tạo ${OUTLINE_CODE} (id=${outline.id})`)
    }

    await ProjectOutlineMember.query().where('project_outline_id', outline.id).delete()
    await ProjectOutlineMember.create({
      projectOutlineId: outline.id,
      profileId: profile?.id ?? null,
      studentId: null,
      departmentId: profile?.departmentId ?? null,
      fullName: principalInfo.fullName,
      memberOrder: 1,
      role: 'PRINCIPAL',
      affiliationType: null,
      affiliationUnits: [],
      gender: principalInfo.gender,
      isMultiAffiliationOutsideUdn: false,
      contributionPercent: 40,
      participationHours: 400,
    })
    await ProjectOutlineMember.create({
      projectOutlineId: outline.id,
      profileId: null,
      studentId: null,
      departmentId: null,
      fullName: 'PGS.TS. Trần Minh Hoàng',
      memberOrder: 2,
      role: 'MEMBER',
      affiliationType: null,
      affiliationUnits: [],
      gender: 'MALE',
      isMultiAffiliationOutsideUdn: false,
      contributionPercent: 30,
      participationHours: 300,
    })
    await ProjectOutlineMember.create({
      projectOutlineId: outline.id,
      profileId: null,
      studentId: null,
      departmentId: null,
      fullName: 'ThS. Lê Thị Mai',
      memberOrder: 3,
      role: 'MEMBER',
      affiliationType: null,
      affiliationUnits: [],
      gender: 'FEMALE',
      isMultiAffiliationOutsideUdn: false,
      contributionPercent: 30,
      participationHours: 280,
    })

    console.info(
      `[22_outline_tm2026] Xong — CNNV ${owner.email} / owner ${proposalOwner.email} → /projects/outlines/form/${outline.id}`
    )
  }
}
