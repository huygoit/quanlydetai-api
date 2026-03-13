import type { HttpContext } from '@adonisjs/core/http'
import Idea from '#models/idea'
import ProjectProposal from '#models/project_proposal'
import Notification from '#models/notification'
import User from '#models/user'
import CouncilSession from '#models/council_session'
import PermissionService from '#services/permission_service'

/** Nhãn trạng thái ý tưởng cho dashboard */
const IDEA_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Mới',
  SUBMITTED: 'Đã nộp',
  REVIEWING: 'Đang sơ loại',
  APPROVED_INTERNAL: 'Đã sơ loại',
  PROPOSED_FOR_ORDER: 'Đề xuất đặt hàng',
  APPROVED_FOR_ORDER: 'Phê duyệt đặt hàng',
  REJECTED: 'Từ chối',
}

/** Nhãn trạng thái đề xuất cho dashboard */
const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nháp',
  SUBMITTED: 'Chờ duyệt',
  UNIT_REVIEWED: 'Đơn vị đã duyệt',
  APPROVED: 'Đang thực hiện',
  REJECTED: 'Không phê duyệt',
  WITHDRAWN: 'Đã rút',
}

/** Nhãn cấp đề tài */
const LEVEL_LABELS: Record<string, string> = {
  CO_SO: 'Cấp cơ sở',
  TRUONG: 'Cấp Trường',
  BO: 'Cấp Bộ',
  NHA_NUOC: 'Cấp Nhà nước',
}

/** Map type thông báo sang type dashboard (INFO, WARNING, DEADLINE, SYSTEM, SUCCESS, ERROR) */
function notificationTypeForDashboard(type: string): string {
  const map: Record<string, string> = {
    PROFILE_VERIFIED: 'SUCCESS',
    IDEA_STATUS_CHANGED: 'SUCCESS',
    PROJECT_UPDATE: 'INFO',
    PROFILE_NEED_INFO: 'WARNING',
    SYSTEM: 'SYSTEM',
    PROFILE_SUBMITTED: 'INFO',
    PUBLICATION_SYNC: 'INFO',
  }
  return map[type] ?? 'INFO'
}

/** Helper đếm từ query count */
function getCount(row: { $extras?: { total?: string } } | null): number {
  return Number((row?.$extras as { total?: string } | undefined)?.total ?? 0)
}

/**
 * API Dashboard: summary, tasks, notifications, my-projects, my-ideas, workflow, charts, v.v.
 * Dữ liệu thay đổi theo role (NCV/CNDT, PHONG_KH, LANH_DAO).
 */
export default class HomeController {
  /**
   * GET /api/home/summary
   * KPI cards theo role
   */
  async summary({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    const hasPhongKH = await PermissionService.userHasPermission(user.id, 'idea.review') ||
      await PermissionService.userHasPermission(user.id, 'project.review') ||
      await PermissionService.userHasPermission(user.id, 'council.view')
    const hasLanhDao = await PermissionService.userHasPermission(user.id, 'idea.approve') ||
      await PermissionService.userHasPermission(user.id, 'project.approve')

    let data: Array<{
      key: string
      title: string
      value: number
      unit?: string
      trend?: 'up' | 'down' | 'flat'
      trendPercent?: number
      diffText?: string
      icon?: string
      color?: string
    }> = []

    if (hasPhongKH) {
      const [proposalsPendingRow, ideasPendingRow, projectsManagingRow, registrationRow] =
        await Promise.all([
          ProjectProposal.query().where('status', 'SUBMITTED').count('*', 'total').first(),
          Idea.query().where('status', 'SUBMITTED').count('*', 'total').first(),
          ProjectProposal.query().where('status', 'APPROVED').count('*', 'total').first(),
          CouncilSession.query().where('status', 'OPEN').count('*', 'total').first(),
        ])
      const registrationOpen = getCount(registrationRow)
      data = [
        {
          key: 'proposals_pending',
          title: 'Đề xuất mới chờ xử lý',
          value: getCount(proposalsPendingRow),
          trend: 'up',
          trendPercent: 25,
          icon: 'FileTextOutlined',
          color: '#1890ff',
        },
        {
          key: 'ideas_pending',
          title: 'Ý tưởng mới chờ sơ loại',
          value: getCount(ideasPendingRow),
          trend: 'up',
          trendPercent: 15,
          icon: 'BulbOutlined',
          color: '#faad14',
        },
        {
          key: 'projects_managing',
          title: 'Đề tài đang quản lý',
          value: getCount(projectsManagingRow),
          trend: 'flat',
          icon: 'ProjectOutlined',
          color: '#52c41a',
        },
        {
          key: 'registration_open',
          title: 'Đợt đăng ký đang mở',
          value: registrationOpen,
          trend: registrationOpen > 0 ? 'up' : 'flat',
          trendPercent: registrationOpen > 0 ? 100 : 0,
          icon: 'CalendarOutlined',
          color: '#722ed1',
        },
      ]
    } else if (hasLanhDao) {
      const currentYear = new Date().getFullYear()
      const [totalProjectsRow, budgetRow] = await Promise.all([
        ProjectProposal.query()
          .where('year', currentYear)
          .where('status', 'APPROVED')
          .count('*', 'total')
          .first(),
        ProjectProposal.query()
          .where('status', 'APPROVED')
          .sum('requested_budget_total as total')
          .first(),
      ])
      const totalProjects = getCount(totalProjectsRow)
      const totalBudget = Number(
        (budgetRow?.$extras as { total?: string } | undefined)?.total ?? 0
      )
      const budgetInBillion = totalBudget / 1_000_000_000
      data = [
        {
          key: 'total_projects_year',
          title: 'Tổng đề tài trong năm',
          value: totalProjects,
          trend: 'up',
          trendPercent: 18,
          icon: 'ProjectOutlined',
          color: '#1890ff',
        },
        {
          key: 'budget_disbursed',
          title: 'Kinh phí giải ngân',
          value: Math.round(budgetInBillion * 10) / 10,
          unit: 'tỷ đồng',
          trend: 'up',
          trendPercent: 22,
          icon: 'DollarOutlined',
          color: '#52c41a',
        },
        {
          key: 'acceptance_rate',
          title: 'Tỷ lệ nghiệm thu',
          value: 85,
          unit: '%',
          trend: 'up',
          trendPercent: 5,
          icon: 'CheckCircleOutlined',
          color: '#722ed1',
        },
        {
          key: 'idea_conversion',
          title: 'Ý tưởng → Đề tài',
          value: 32,
          unit: '%',
          trend: 'down',
          trendPercent: -3,
          icon: 'RiseOutlined',
          color: '#faad14',
        },
      ]
    } else {
      // NCV, CNDT, TRUONG_DON_VI, HOI_DONG
      const [myProposalsRow, myIdeasRow, unreadRow] = await Promise.all([
        ProjectProposal.query()
          .where('owner_id', user.id)
          .whereIn('status', ['SUBMITTED', 'UNIT_REVIEWED', 'APPROVED'])
          .count('*', 'total')
          .first(),
        Idea.query().where('owner_id', user.id).count('*', 'total').first(),
        Notification.query()
          .where('user_id', user.id)
          .where('read', false)
          .count('*', 'total')
          .first(),
      ])
      const projectsInProgress = getCount(myProposalsRow)
      const ideasSubmitted = getCount(myIdeasRow)
      const unread = getCount(unreadRow)
      data = [
        {
          key: 'projects_in_progress',
          title: 'Đề tài đang thực hiện',
          value: projectsInProgress,
          trend: 'up',
          trendPercent: 50,
          icon: 'ProjectOutlined',
          color: '#1890ff',
        },
        {
          key: 'projects_pending_acceptance',
          title: 'Chờ nghiệm thu',
          value: 0,
          trend: 'flat',
          icon: 'ClockCircleOutlined',
          color: '#52c41a',
        },
        {
          key: 'ideas_submitted',
          title: 'Ý tưởng đã nộp',
          value: ideasSubmitted,
          trend: 'up',
          trendPercent: 25,
          icon: 'BulbOutlined',
          color: '#faad14',
        },
        {
          key: 'notifications_unread',
          title: 'Thông báo chưa đọc',
          value: unread,
          trend: 'down',
          trendPercent: -20,
          icon: 'BellOutlined',
          color: '#ff4d4f',
        },
      ]
    }

    return response.ok({ success: true, data })
  }

  /**
   * GET /api/home/tasks
   * Danh sách công việc cần làm theo role (dữ liệu mẫu / aggregate)
   */
  async tasks({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    const hasPhongKH = await PermissionService.userHasPermission(user.id, 'idea.review') ||
      await PermissionService.userHasPermission(user.id, 'project.review') ||
      await PermissionService.userHasPermission(user.id, 'council.view')
    const hasLanhDao = await PermissionService.userHasPermission(user.id, 'idea.approve') ||
      await PermissionService.userHasPermission(user.id, 'project.approve')

    type TaskItem = {
      id: string
      type: string
      title: string
      description?: string
      relatedModule: 'IDEA' | 'PROJECT' | 'CV' | 'FINANCE'
      dueDate?: string
      status: 'PENDING' | 'DONE'
      priority: 'HIGH' | 'MEDIUM' | 'LOW'
      link?: string
    }

    let data: TaskItem[] = []

    if (hasPhongKH) {
      const ideasPending = await Idea.query().where('status', 'SUBMITTED').limit(5)
      const proposalsPending = await ProjectProposal.query()
        .whereIn('status', ['SUBMITTED', 'UNIT_REVIEWED'])
        .limit(3)
      const sessionsOpen = await CouncilSession.query().where('status', 'OPEN').limit(2)
      data = [
        ...ideasPending.slice(0, 1).map((i, idx) => ({
          id: `task-idea-${i.id}`,
          type: 'SO_LOAI_Y_TUONG',
          title: `Sơ loại ý tưởng: ${i.title}`,
          description: `Đợt ${i.createdAt.toFormat('yyyy')}`,
          relatedModule: 'IDEA' as const,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19) + 'Z',
          status: 'PENDING' as const,
          priority: 'HIGH' as const,
          link: '/ideas/review',
        })),
        ...sessionsOpen.slice(0, 1).map((s) => ({
          id: `task-council-${s.id}`,
          type: 'PHAN_HOI_DONG',
          title: `Phân hội đồng: ${s.title}`,
          relatedModule: 'PROJECT' as const,
          dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19) + 'Z',
          status: 'PENDING' as const,
          priority: 'HIGH' as const,
          link: '/projects/council',
        })),
        ...proposalsPending.slice(0, 1).map((p) => ({
          id: `task-proposal-${p.id}`,
          type: 'DUYET_DE_XUAT',
          title: `Duyệt đề xuất: ${p.title}`,
          description: `Từ ${p.ownerName}`,
          relatedModule: 'PROJECT' as const,
          dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19) + 'Z',
          status: 'PENDING' as const,
          priority: 'MEDIUM' as const,
          link: '/projects/proposals/review',
        })),
      ].filter(Boolean) as TaskItem[]
      if (data.length === 0) {
        data = [
          {
            id: 'task1',
            type: 'SO_LOAI_Y_TUONG',
            title: 'Sơ loại ý tưởng mới',
            description: 'Đợt 1 năm 2025',
            relatedModule: 'IDEA',
            dueDate: '2025-12-10T00:00:00Z',
            status: 'PENDING',
            priority: 'HIGH',
            link: '/ideas/review',
          },
          {
            id: 'task2',
            type: 'DUYET_DE_XUAT',
            title: 'Duyệt đề xuất đề tài',
            relatedModule: 'PROJECT',
            dueDate: '2025-12-15T00:00:00Z',
            status: 'PENDING',
            priority: 'MEDIUM',
            link: '/projects/proposals/review',
          },
        ]
      }
    } else if (hasLanhDao) {
      data = [
        {
          id: 'task1',
          type: 'PHE_DUYET_DAT_HANG',
          title: 'Phê duyệt đặt hàng ý tưởng chiến lược',
          relatedModule: 'IDEA',
          dueDate: '2025-12-08T00:00:00Z',
          status: 'PENDING',
          priority: 'HIGH',
          link: '/ideas/approve',
        },
        {
          id: 'task2',
          type: 'XEM_XET_DE_XUAT',
          title: 'Xem xét báo cáo tổng kết năm 2025',
          relatedModule: 'PROJECT',
          dueDate: '2025-12-20T00:00:00Z',
          status: 'PENDING',
          priority: 'HIGH',
          link: '/reports/annual',
        },
      ]
    } else {
      // NCV, CNDT
      const myProposals = await ProjectProposal.query()
        .where('owner_id', user.id)
        .whereIn('status', ['SUBMITTED', 'UNIT_REVIEWED', 'APPROVED'])
        .orderBy('updated_at', 'desc')
        .limit(3)
      const myIdeas = await Idea.query()
        .where('owner_id', user.id)
        .where('status', 'DRAFT')
        .limit(2)
      data = [
        ...myProposals.slice(0, 1).map((p) => ({
          id: `task-proposal-${p.id}`,
          type: 'NOP_BAO_CAO_TIEN_DO',
          title: `Nộp báo cáo tiến độ: ${p.title}`,
          description: `Hạn nộp theo kế hoạch.`,
          relatedModule: 'PROJECT' as const,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19) + 'Z',
          status: 'PENDING' as const,
          priority: 'HIGH' as const,
          link: `/projects/${p.id}/progress`,
        })),
        ...myIdeas.slice(0, 1).map((i) => ({
          id: `task-idea-${i.id}`,
          type: 'NOP_Y_TUONG',
          title: `Hoàn thiện ý tưởng: ${i.title}`,
          relatedModule: 'IDEA' as const,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19) + 'Z',
          status: 'PENDING' as const,
          priority: 'HIGH' as const,
          link: '/ideas/new',
        })),
      ].filter(Boolean) as TaskItem[]
      if (data.length === 0) {
        data = [
          {
            id: 'task1',
            type: 'NOP_Y_TUONG',
            title: 'Nộp ý tưởng mới',
            relatedModule: 'IDEA',
            dueDate: '2025-12-05T00:00:00Z',
            status: 'PENDING',
            priority: 'HIGH',
            link: '/ideas/new',
          },
          {
            id: 'task2',
            type: 'NOP_DE_XUAT',
            title: 'Nộp đề xuất đề tài',
            relatedModule: 'PROJECT',
            dueDate: '2025-12-20T00:00:00Z',
            status: 'PENDING',
            priority: 'MEDIUM',
            link: '/projects/register',
          },
        ]
      }
    }

    return response.ok({ success: true, data })
  }

  /**
   * GET /api/home/notifications
   * 5 thông báo gần nhất (chưa ưu tiên unread), format dashboard: content, read, type, priority
   */
  async notifications({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    const list = await Notification.query()
      .where('user_id', user.id)
      .orderBy('created_at', 'desc')
      .limit(5)
    const unreadRow = await Notification.query()
      .where('user_id', user.id)
      .where('read', false)
      .count('*', 'total')
      .first()
    const unreadCount = getCount(unreadRow)

    const data = list.map((n) => ({
      id: n.id,
      title: n.title,
      content: n.message,
      createdAt: n.createdAt.toISO(),
      read: n.read,
      type: notificationTypeForDashboard(n.type),
      priority: 'NORMAL' as const,
      link: n.link ?? undefined,
    }))

    return response.ok({ success: true, data, unreadCount })
  }

  /**
   * GET /api/home/my-projects
   * Danh sách đề xuất của user (NCV/CNDT), map sang format "dự án" với status label
   */
  async myProjects({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    const list = await ProjectProposal.query()
      .where('owner_id', user.id)
      .whereIn('status', ['SUBMITTED', 'UNIT_REVIEWED', 'APPROVED'])
      .orderBy('updated_at', 'desc')
      .limit(20)

    const data = list.map((p) => {
      const startDate =
        p.status === 'APPROVED'
          ? new Date(p.year, 0, 1).toISOString()
          : p.createdAt.toISO()
      const endDate =
        p.status === 'APPROVED'
          ? new Date(p.year + Math.ceil(p.durationMonths / 12), 0, 0).toISOString()
          : null
      return {
        id: String(p.id),
        code: p.code,
        title: p.title,
        level: LEVEL_LABELS[p.level] ?? p.level,
        status: PROPOSAL_STATUS_LABELS[p.status] ?? p.status,
        role: 'CHU_NHIEM' as const,
        startDate,
        endDate,
        progress: p.status === 'APPROVED' ? 45 : undefined,
      }
    })

    return response.ok({ success: true, data })
  }

  /**
   * GET /api/home/my-ideas
   * Danh sách ý tưởng của user với status label và score (nếu có)
   */
  async myIdeas({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    const list = await Idea.query()
      .where('owner_id', user.id)
      .orderBy('created_at', 'desc')
      .limit(20)

    const data = list.map((i) => {
      const score =
        i.councilAvgWeightedScore != null
          ? Math.round(Number(i.councilAvgWeightedScore) * 10) / 10
          : undefined
      return {
        id: i.id,
        title: i.title,
        status: IDEA_STATUS_LABELS[i.status] ?? i.status,
        createdAt: i.createdAt.toISO(),
        ...(score !== undefined && { score }),
      }
    })

    return response.ok({ success: true, data })
  }

  /**
   * GET /api/home/workflow-steps (PHONG_KH only)
   */
  async workflowSteps({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    const hasPerm = await PermissionService.userHasPermission(user.id, 'idea.review') ||
      await PermissionService.userHasPermission(user.id, 'project.review') ||
      await PermissionService.userHasPermission(user.id, 'council.view')
    if (!hasPerm) {
      return response.forbidden({ success: false, message: 'Chỉ người có quyền sơ loại/duyệt được xem.' })
    }

    const [ideasSubmittedRow, proposalsUnitRow, councilOpenRow, approvedRow, approvedCountRow] =
      await Promise.all([
        Idea.query().where('status', 'SUBMITTED').count('*', 'total').first(),
        ProjectProposal.query().where('status', 'UNIT_REVIEWED').count('*', 'total').first(),
        CouncilSession.query().where('status', 'OPEN').count('*', 'total').first(),
        ProjectProposal.query().where('status', 'APPROVED').limit(15),
        ProjectProposal.query().where('status', 'APPROVED').count('*', 'total').first(),
      ])
    const ideaReviewCount = getCount(ideasSubmittedRow)
    const council2aCount = getCount(proposalsUnitRow)
    const councilOpenCount = getCount(councilOpenRow)
    const trackingCount = approvedRow.length
    const acceptanceCount = 4

    const data = [
      {
        key: 'idea_review',
        title: 'Sơ loại ý tưởng',
        description: 'Xem xét và sơ loại ý tưởng mới',
        count: ideaReviewCount,
        status: ideaReviewCount > 0 ? 'process' : 'wait',
        link: '/ideas/review',
      },
      {
        key: 'council_2a',
        title: 'Phân hội đồng 2A',
        description: 'Phân công hội đồng xét duyệt',
        count: council2aCount,
        status: council2aCount > 0 ? 'process' : 'wait',
        link: '/projects/council',
      },
      {
        key: 'scoring_2b',
        title: 'Chấm điểm 2B',
        description: 'Hội đồng chấm điểm đề xuất',
        count: councilOpenCount,
        status: councilOpenCount > 0 ? 'process' : 'wait',
        link: '/ideas/council',
      },
      {
        key: 'tracking_gd3',
        title: 'Theo dõi GĐ3',
        description: 'Theo dõi tiến độ thực hiện',
        count: trackingCount,
        status: 'finish',
        link: '/projects/my',
      },
      {
        key: 'acceptance_gd4',
        title: 'Nghiệm thu GĐ4',
        description: 'Nghiệm thu và đánh giá',
        count: acceptanceCount,
        status: 'wait',
        link: '/projects/acceptance',
      },
    ]

    return response.ok({ success: true, data })
  }

  /**
   * GET /api/home/pending-proposals (PHONG_KH only)
   */
  async pendingProposals({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    const hasPerm = await PermissionService.userHasPermission(user.id, 'idea.review') ||
      await PermissionService.userHasPermission(user.id, 'project.review')
    if (!hasPerm) {
      return response.forbidden({ success: false, message: 'Chỉ người có quyền duyệt được xem.' })
    }
    const list = await ProjectProposal.query()
      .whereIn('status', ['SUBMITTED', 'UNIT_REVIEWED'])
      .orderBy('updated_at', 'desc')
      .limit(20)
    const data = list.map((p) => ({
      id: p.id,
      code: p.code,
      title: p.title,
      ownerName: p.ownerName,
      ownerUnit: p.ownerUnit,
      status: p.status,
      statusLabel: PROPOSAL_STATUS_LABELS[p.status] ?? p.status,
      requestedBudgetTotal: p.requestedBudgetTotal,
      createdAt: p.createdAt.toISO(),
    }))
    return response.ok({ success: true, data })
  }

  /**
   * GET /api/home/delayed-projects (PHONG_KH only)
   * Đề tài chậm tiến độ - mock vì chưa có bảng tiến độ
   */
  async delayedProjects({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    const hasPerm = await PermissionService.userHasPermission(user.id, 'project.review') ||
      await PermissionService.userHasPermission(user.id, 'project.view')
    if (!hasPerm) {
      return response.forbidden({ success: false, message: 'Chỉ người có quyền quản lý đề tài được xem.' })
    }
    const list = await ProjectProposal.query()
      .where('status', 'APPROVED')
      .orderBy('updated_at', 'desc')
      .limit(5)
    const data = list.map((p) => ({
      id: p.id,
      code: p.code,
      title: p.title,
      ownerName: p.ownerName,
      expectedProgress: 70,
      actualProgress: 35,
      delayReason: 'Chưa có dữ liệu tiến độ',
      link: `/projects/${p.id}`,
    }))
    return response.ok({ success: true, data })
  }

  /**
   * GET /api/home/charts (LANH_DAO only)
   */
  async charts({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    const hasPerm = await PermissionService.userHasPermission(user.id, 'idea.approve') ||
      await PermissionService.userHasPermission(user.id, 'project.approve') ||
      await PermissionService.userHasPermission(user.id, 'dashboard.view_all')
    if (!hasPerm) {
      return response.forbidden({ success: false, message: 'Chỉ người có quyền phê duyệt/xem dashboard được xem.' })
    }
    const allApproved = await ProjectProposal.query()
      .where('status', 'APPROVED')
      .select('year', 'level')
    const byYearMap = new Map<number, number>()
    const byLevelMap = new Map<string, number>()
    for (const p of allApproved) {
      byYearMap.set(p.year, (byYearMap.get(p.year) ?? 0) + 1)
      byLevelMap.set(p.level, (byLevelMap.get(p.level) ?? 0) + 1)
    }
    const projectsByYear = Array.from(byYearMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, value]) => ({ year: String(year), value }))
    const projectsByLevel = Array.from(byLevelMap.entries())
      .map(([level, value]) => ({ name: LEVEL_LABELS[level] ?? level, value }))
      .sort((a, b) => b.value - a.value)
    const months = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12']
    const growthTrend = months.slice(0, 4).flatMap((month, i) => [
      { month, value: 10 + i * 2, type: 'Đề tài mới' },
      { month, value: 5 + i, type: 'Nghiệm thu' },
    ])
    return response.ok({
      success: true,
      data: {
        projectsByYear:
          projectsByYear.length > 0
            ? projectsByYear
            : [
                { year: '2024', value: 118 },
                { year: '2025', value: 128 },
              ],
        projectsByLevel:
          projectsByLevel.length > 0
            ? projectsByLevel
            : [
                { name: 'Cấp Trường', value: 75 },
                { name: 'Cấp Bộ', value: 38 },
                { name: 'Cấp Nhà nước', value: 15 },
              ],
        growthTrend,
      },
    })
  }

  /**
   * GET /api/home/top-projects (LANH_DAO only)
   */
  async topProjects({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    const hasPerm = await PermissionService.userHasPermission(user.id, 'idea.approve') ||
      await PermissionService.userHasPermission(user.id, 'dashboard.view_all')
    if (!hasPerm) {
      return response.forbidden({ success: false, message: 'Chỉ người có quyền xem dashboard được xem.' })
    }
    const list = await ProjectProposal.query()
      .where('status', 'APPROVED')
      .orderBy('requested_budget_total', 'desc')
      .limit(5)
    const data = list.map((p) => ({
      id: p.id,
      code: p.code,
      title: p.title,
      level: LEVEL_LABELS[p.level] ?? p.level,
      budget: p.requestedBudgetTotal ?? 0,
      progress: 65,
    }))
    return response.ok({ success: true, data })
  }

  /**
   * GET /api/home/top-researchers (LANH_DAO only)
   */
  async topResearchers({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    const hasPerm = await PermissionService.userHasPermission(user.id, 'dashboard.view_all')
    if (!hasPerm) {
      return response.forbidden({ success: false, message: 'Chỉ người có quyền xem dashboard được xem.' })
    }
    const ideas = await Idea.query().select('owner_id')
    const proposals = await ProjectProposal.query()
      .where('status', 'APPROVED')
      .select('owner_id')
    const ideaMap = new Map<number, number>()
    for (const i of ideas) {
      const id = i.ownerId
      ideaMap.set(id, (ideaMap.get(id) ?? 0) + 1)
    }
    const proposalMap = new Map<number, number>()
    for (const p of proposals) {
      const id = p.ownerId
      proposalMap.set(id, (proposalMap.get(id) ?? 0) + 1)
    }
    const userIds = new Set([...ideaMap.keys(), ...proposalMap.keys()])
    const users = await User.query().whereIn('id', Array.from(userIds))
    const combined = users.map((u) => ({
      id: u.id,
      name: u.fullName,
      department: u.unit ?? '',
      projectCount: proposalMap.get(u.id) ?? 0,
      ideaCount: ideaMap.get(u.id) ?? 0,
    }))
    combined.sort((a, b) => b.projectCount * 2 + b.ideaCount - (a.projectCount * 2 + a.ideaCount))
    const data = combined.slice(0, 5)
    return response.ok({ success: true, data })
  }

  /**
   * GET /api/home/warnings (LANH_DAO only)
   */
  async warnings({ auth, response }: HttpContext) {
    const user = auth.use('api').user!
    const hasPerm = await PermissionService.userHasPermission(user.id, 'dashboard.view_all')
    if (!hasPerm) {
      return response.forbidden({ success: false, message: 'Chỉ người có quyền xem dashboard được xem.' })
    }
    const delayed = await ProjectProposal.query()
      .where('status', 'APPROVED')
      .limit(1)
    const data = [
      ...delayed.map((p) => ({
        id: `w-${p.id}`,
        title: `Đề tài ${p.code} cần theo dõi tiến độ`,
        type: 'DELAY',
        severity: 'HIGH',
        description: 'Tiến độ cần cập nhật trên hệ thống.',
        link: `/projects/${p.id}`,
      })),
      {
        id: 'w2',
        title: 'Kinh phí Q4 chưa giải ngân',
        type: 'BUDGET',
        severity: 'MEDIUM',
        description: '3 đề tài chưa hoàn thành thủ tục giải ngân Q4',
        link: '/finance/pending',
      },
      {
        id: 'w3',
        title: 'Deadline nghiệm thu cuối năm',
        type: 'DEADLINE',
        severity: 'HIGH',
        description: '5 đề tài cần nghiệm thu trước 31/12/2025',
        link: '/projects/acceptance',
      },
    ]
    return response.ok({ success: true, data })
  }
}
