import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Role from '#models/role'
import Permission from '#models/permission'
import RolePermission from '#models/role_permission'
import User from '#models/user'
import UserRoleAssignment from '#models/user_role_assignment'

/**
 * Seed roles, permissions, role_permissions và gán SUPER_ADMIN cho admin.
 */
const ROLES = [
  { code: 'SUPER_ADMIN', name: 'Super Admin', description: 'Toàn quyền hệ thống' },
  { code: 'SYSTEM_ADMIN', name: 'System Admin', description: 'Quản trị hệ thống' },
  { code: 'RESEARCH_OFFICE', name: 'Phòng Nghiên cứu', description: 'Phòng nghiên cứu' },
  { code: 'RESEARCH_MANAGER', name: 'Quản lý nghiên cứu', description: '' },
  { code: 'DEPARTMENT_HEAD', name: 'Trưởng đơn vị', description: '' },
  { code: 'DEPARTMENT_STAFF', name: 'Nhân viên đơn vị', description: '' },
  { code: 'SCIENTIST', name: 'Nhà khoa học', description: '' },
  { code: 'PROJECT_OWNER', name: 'Chủ nhiệm đề tài', description: '' },
  { code: 'PROJECT_MEMBER', name: 'Thành viên đề tài', description: '' },
  { code: 'COUNCIL_CHAIR', name: 'Chủ tịch hội đồng', description: '' },
  { code: 'COUNCIL_SECRETARY', name: 'Thư ký hội đồng', description: '' },
  { code: 'COUNCIL_MEMBER', name: 'Thành viên hội đồng', description: '' },
  { code: 'REVIEWER', name: 'Phản biện', description: '' },
  { code: 'FINANCE_OFFICER', name: 'Kế toán', description: '' },
  { code: 'FINANCE_APPROVER', name: 'Phê duyệt tài chính', description: '' },
]

const PERMISSIONS = [
  { code: 'department.view', name: 'Xem đơn vị', module: 'department', action: 'view' },
  { code: 'department.create', name: 'Tạo đơn vị', module: 'department', action: 'create' },
  { code: 'department.update', name: 'Sửa đơn vị', module: 'department', action: 'update' },
  { code: 'department.change_status', name: 'Đổi trạng thái đơn vị', module: 'department', action: 'change_status' },
  { code: 'user.view', name: 'Xem user', module: 'user', action: 'view' },
  { code: 'user.create', name: 'Tạo user', module: 'user', action: 'create' },
  { code: 'user.update', name: 'Sửa user', module: 'user', action: 'update' },
  { code: 'user.change_status', name: 'Đổi trạng thái user', module: 'user', action: 'change_status' },
  { code: 'user.reset_password', name: 'Reset mật khẩu user', module: 'user', action: 'reset_password' },
  { code: 'user.assign_role', name: 'Gán role cho user', module: 'user', action: 'assign_role' },
  { code: 'role.view', name: 'Xem role', module: 'role', action: 'view' },
  { code: 'role.create', name: 'Tạo role', module: 'role', action: 'create' },
  { code: 'role.update', name: 'Sửa role', module: 'role', action: 'update' },
  { code: 'role.assign_permission', name: 'Gán permission cho role', module: 'role', action: 'assign_permission' },
  { code: 'permission.view', name: 'Xem permission', module: 'permission', action: 'view' },
  { code: 'profile.view_own', name: 'Xem hồ sơ bản thân', module: 'profile', action: 'view_own' },
  { code: 'profile.update_own', name: 'Cập nhật hồ sơ bản thân', module: 'profile', action: 'update_own' },
  { code: 'profile.view_department', name: 'Xem hồ sơ đơn vị', module: 'profile', action: 'view_department' },
  { code: 'profile.view_all', name: 'Xem tất cả hồ sơ', module: 'profile', action: 'view_all' },
  { code: 'profile.verify', name: 'Xác thực hồ sơ', module: 'profile', action: 'verify' },
  { code: 'idea.view', name: 'Xem ý tưởng', module: 'idea', action: 'view' },
  { code: 'idea.create', name: 'Tạo ý tưởng', module: 'idea', action: 'create' },
  { code: 'idea.update', name: 'Sửa ý tưởng', module: 'idea', action: 'update' },
  { code: 'idea.submit', name: 'Gửi ý tưởng', module: 'idea', action: 'submit' },
  { code: 'idea.review', name: 'Sơ loại ý tưởng', module: 'idea', action: 'review' },
  { code: 'idea.approve', name: 'Duyệt ý tưởng', module: 'idea', action: 'approve' },
  { code: 'project.view', name: 'Xem đề tài', module: 'project', action: 'view' },
  { code: 'project.create', name: 'Tạo đề tài', module: 'project', action: 'create' },
  { code: 'project.update', name: 'Sửa đề tài', module: 'project', action: 'update' },
  { code: 'project.submit', name: 'Nộp đề tài', module: 'project', action: 'submit' },
  { code: 'project.review', name: 'Phản biện đề tài', module: 'project', action: 'review' },
  { code: 'project.approve', name: 'Duyệt đề tài', module: 'project', action: 'approve' },
  { code: 'project.assign_reviewer', name: 'Gán phản biện', module: 'project', action: 'assign_reviewer' },
  { code: 'project.acceptance', name: 'Nghiệm thu đề tài', module: 'project', action: 'acceptance' },
  { code: 'project.liquidation', name: 'Thanh lý đề tài', module: 'project', action: 'liquidation' },
  { code: 'council.view', name: 'Xem hội đồng', module: 'council', action: 'view' },
  { code: 'council.create', name: 'Tạo hội đồng', module: 'council', action: 'create' },
  { code: 'council.update', name: 'Sửa hội đồng', module: 'council', action: 'update' },
  { code: 'council.assign_member', name: 'Gán thành viên hội đồng', module: 'council', action: 'assign_member' },
  { code: 'council.score', name: 'Chấm điểm hội đồng', module: 'council', action: 'score' },
  { code: 'publication.view', name: 'Xem công bố', module: 'publication', action: 'view' },
  { code: 'publication.create', name: 'Tạo công bố', module: 'publication', action: 'create' },
  { code: 'publication.update', name: 'Sửa công bố', module: 'publication', action: 'update' },
  { code: 'publication.review', name: 'Phản biện công bố', module: 'publication', action: 'review' },
  { code: 'publication.approve', name: 'Duyệt công bố', module: 'publication', action: 'approve' },
  { code: 'report.view_department', name: 'Xem báo cáo đơn vị', module: 'report', action: 'view_department' },
  { code: 'report.view_all', name: 'Xem tất cả báo cáo', module: 'report', action: 'view_all' },
  { code: 'report.export', name: 'Xuất báo cáo', module: 'report', action: 'export' },
  { code: 'dashboard.view_department', name: 'Xem dashboard đơn vị', module: 'dashboard', action: 'view_department' },
  { code: 'dashboard.view_all', name: 'Xem dashboard toàn hệ thống', module: 'dashboard', action: 'view_all' },
  { code: 'audit_log.view', name: 'Xem audit log', module: 'audit_log', action: 'view' },
  { code: 'notification.view', name: 'Xem thông báo', module: 'notification', action: 'view' },
  { code: 'system_config.view', name: 'Xem cấu hình', module: 'system_config', action: 'view' },
  { code: 'system_config.update', name: 'Cập nhật cấu hình', module: 'system_config', action: 'update' },
]

export default class IamRolesPermissionsSeeder extends BaseSeeder {
  async run() {
    const roleMap = new Map<string, number>()
    for (const r of ROLES) {
      let role = await Role.findBy('code', r.code)
      if (!role) {
        role = await Role.create({
          code: r.code,
          name: r.name,
          description: r.description || null,
          status: 'ACTIVE',
        })
      }
      roleMap.set(r.code, role.id)
    }

    const permMap = new Map<string, number>()
    for (const p of PERMISSIONS) {
      let perm = await Permission.findBy('code', p.code)
      if (!perm) {
        perm = await Permission.create({
          code: p.code,
          name: p.name,
          module: p.module,
          action: p.action,
          status: 'ACTIVE',
        })
      }
      permMap.set(p.code, perm.id)
    }

    const superAdminRoleId = roleMap.get('SUPER_ADMIN')!
    const allPermIds = [...permMap.values()]

    await RolePermission.query().where('role_id', superAdminRoleId).delete()
    for (const pid of allPermIds) {
      await RolePermission.create({ roleId: superAdminRoleId, permissionId: pid })
    }

    const systemAdminRoleId = roleMap.get('SYSTEM_ADMIN')!
    const systemAdminPermCodes = [
      'department.view', 'department.create', 'department.update', 'department.change_status',
      'user.view', 'user.create', 'user.update', 'user.change_status', 'user.reset_password', 'user.assign_role',
      'role.view', 'role.create', 'role.update', 'role.assign_permission',
      'permission.view', 'system_config.view', 'system_config.update', 'audit_log.view',
    ]
    await RolePermission.query().where('role_id', systemAdminRoleId).delete()
    for (const code of systemAdminPermCodes) {
      const pid = permMap.get(code)
      if (pid) await RolePermission.create({ roleId: systemAdminRoleId, permissionId: pid })
    }

    const researchOfficeRoleId = roleMap.get('RESEARCH_OFFICE')!
    const researchOfficePermCodes = [
      'profile.view_all', 'idea.view', 'idea.review', 'idea.approve',
      'project.view', 'project.review', 'project.approve', 'project.assign_reviewer',
      'project.acceptance', 'project.liquidation',
      'council.view', 'council.create', 'council.update', 'council.assign_member',
      'publication.view', 'publication.review', 'publication.approve',
      'report.view_all', 'report.export', 'dashboard.view_all',
    ]
    await RolePermission.query().where('role_id', researchOfficeRoleId).delete()
    for (const code of researchOfficePermCodes) {
      const pid = permMap.get(code)
      if (pid) await RolePermission.create({ roleId: researchOfficeRoleId, permissionId: pid })
    }

    const deptHeadRoleId = roleMap.get('DEPARTMENT_HEAD')!
    const deptHeadPermCodes = [
      'profile.view_department', 'idea.view', 'idea.review', 'idea.approve',
      'project.view', 'project.review', 'project.approve',
      'report.view_department', 'dashboard.view_department',
    ]
    await RolePermission.query().where('role_id', deptHeadRoleId).delete()
    for (const code of deptHeadPermCodes) {
      const pid = permMap.get(code)
      if (pid) await RolePermission.create({ roleId: deptHeadRoleId, permissionId: pid })
    }

    const scientistRoleId = roleMap.get('SCIENTIST')!
    const scientistPermCodes = [
      'profile.view_own', 'profile.update_own',
      'idea.view', 'idea.create', 'idea.update', 'idea.submit',
      'project.view', 'project.create', 'project.update', 'project.submit',
      'publication.view', 'publication.create', 'publication.update',
    ]
    await RolePermission.query().where('role_id', scientistRoleId).delete()
    for (const code of scientistPermCodes) {
      const pid = permMap.get(code)
      if (pid) await RolePermission.create({ roleId: scientistRoleId, permissionId: pid })
    }

    const adminUser = await User.findBy('email', 'admin@university.edu.vn')
    if (adminUser) {
      const existing = await UserRoleAssignment.query()
        .where('user_id', adminUser.id)
        .where('role_id', superAdminRoleId)
        .first()
      if (!existing) {
        await UserRoleAssignment.create({
          userId: adminUser.id,
          roleId: superAdminRoleId,
          isActive: true,
        })
      }
    }
  }
}
