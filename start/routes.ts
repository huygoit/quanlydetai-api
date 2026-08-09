/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| API Auth/Users (01), Admin/Catalogs (02), Notifications (03), Profile (04), Ideas (05)
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import AuthController from '#controllers/auth_controller'
import UsersController from '#controllers/users_controller'
import AdminController from '#controllers/admin_controller'
import CatalogsController from '#controllers/catalogs_controller'
import NotificationsController from '#controllers/notifications_controller'
import ProfileController from '#controllers/profile_controller'
import ProfileLanguagesController from '#controllers/profile_languages_controller'
import ProfileAttachmentsController from '#controllers/profile_attachments_controller'
import PublicationsController from '#controllers/publications_controller'
import PublicationAuthorsController from '#controllers/publication_authors_controller'
import ProfilesController from '#controllers/profiles_controller'
import IdeasController from '#controllers/ideas_controller'
import CouncilSessionsController from '#controllers/council_sessions_controller'
import SessionMembersController from '#controllers/session_members_controller'
import SessionIdeasController from '#controllers/session_ideas_controller'
import IdeaCouncilScoresController from '#controllers/idea_council_scores_controller'
import ProjectProposalsController from '#controllers/project_proposals_controller'
import ProjectProposalMembersController from '#controllers/project_proposal_members_controller'
import ProposalSelectionSessionsController from '#controllers/proposal_selection_sessions_controller'
import CallForProposalsController from '#controllers/call_for_proposals_controller'
import HomeController from '#controllers/home_controller'
import KpisController from '#controllers/kpis_controller'
import AdminResearchOutputTypesController from '#controllers/admin/research_output_types_controller'
import AdminResearchOutputRulesController from '#controllers/admin/research_output_rules_controller'
import AdminDepartmentsController from '#controllers/admin/departments_controller'
import DepartmentsController from '#controllers/departments_controller'
import AdminFieldsController from '#controllers/admin/fields_controller'
import FieldsController from '#controllers/fields_controller'
import AdminSpecializationsController from '#controllers/admin/specializations_controller'
import SpecializationsController from '#controllers/specializations_controller'
import AdminProjectProcessTypesController from '#controllers/admin/project_process_types_controller'
import ProjectProcessTypesController from '#controllers/project_process_types_controller'
import ScientificProfileCatalogController from '#controllers/scientific_profile_catalog_controller'
import AdminRolesController from '#controllers/admin/roles_controller'
import AdminPermissionsController from '#controllers/admin/permissions_controller'
import AdminIamUsersController from '#controllers/admin/iam_users_controller'
import MeStaffProfileController from '#controllers/me_staff_profile_controller'
import AdminStaffsController from '#controllers/admin/staffs_controller'
import AdminPublicationsController from '#controllers/admin/publications_controller'
import AdminPublicationAuthorsController from '#controllers/admin/publication_authors_controller'
import path from 'node:path'
import { access } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import { findAttachmentFilePath } from '#utils/upload_storage_helper'

// --- Auth (login, register không cần token)
router.post('/api/auth/login', [AuthController, 'login'])
router.post('/api/auth/register', [AuthController, 'register'])

// --- Public: phục vụ file đính kèm hồ sơ theo /storage/profile-attachments/:filename
router.get('/storage/profile-attachments/:filename', async ({ params, response }) => {
  const filename = String(params.filename || '')
  if (!filename || filename !== path.basename(filename)) {
    return response.badRequest({ success: false, message: 'Tên file không hợp lệ.' })
  }

  try {
    const foundPath = await findAttachmentFilePath(filename)
    if (!foundPath) {
      return response.notFound({ success: false, message: 'Không tìm thấy file.' })
    }

    response.header('Content-Disposition', `inline; filename="${filename}"`)
    return response.download(foundPath)
  } catch {
    return response.notFound({ success: false, message: 'Không tìm thấy file.' })
  }
})

// --- Public: biên bản phiên xét chọn (HTML UTF-8)
router.get('/uploads/selection-minutes/:filename', async ({ params, response }) => {
  const filename = String(params.filename || '')
  if (!filename || filename !== path.basename(filename) || !filename.endsWith('.html')) {
    return response.badRequest({ success: false, message: 'Tên file không hợp lệ.' })
  }
  const filePath = path.join(app.makePath('public'), 'uploads', 'selection-minutes', filename)
  try {
    await access(filePath)
    response.header('Content-Type', 'text/html; charset=utf-8')
    response.header('Content-Disposition', `inline; filename="${filename}"`)
    return response.download(filePath)
  } catch {
    return response.notFound({ success: false, message: 'Không tìm thấy biên bản.' })
  }
})

// --- Auth (cần Bearer token)
router
  .group(() => {
    router.post('/logout', [AuthController, 'logout'])
    router.get('/me', [AuthController, 'me'])
  })
  .prefix('/api/auth')
  .middleware([middleware.auth()])

// --- Users (permission: user.view)
router
  .group(() => {
    router.get('/', [UsersController, 'index'])
    router.get('/:id', [UsersController, 'show'])
    router.post('/', [UsersController, 'store'])
    router.put('/:id', [UsersController, 'update'])
    router.delete('/:id', [UsersController, 'destroy'])
  })
  .prefix('/api/users')
  .middleware([middleware.auth(), middleware.permission('user.view')])

// --- Admin: configs & audit-logs (permission: user.view)
router
  .group(() => {
    router.get('/configs', [AdminController, 'configsIndex'])
    router.get('/configs/:key', [AdminController, 'configsShow'])
    router.put('/configs/:key', [AdminController, 'configsUpdate'])
    router.get('/audit-logs', [AdminController, 'auditLogsIndex'])
  })
  .prefix('/api/admin')
  .middleware([middleware.auth(), middleware.permission('user.view')])

// --- Admin: departments CRUD (permission-based)
router
  .group(() => {
    router
      .get('/', [AdminDepartmentsController, 'index'])
      .use(middleware.permission('department.view'))
    router
      .get('/:id', [AdminDepartmentsController, 'show'])
      .use(middleware.permission('department.view'))
    router
      .post('/', [AdminDepartmentsController, 'store'])
      .use(middleware.permission('department.create'))
    router
      .put('/:id', [AdminDepartmentsController, 'update'])
      .use(middleware.permission('department.update'))
    router
      .patch('/:id/status', [AdminDepartmentsController, 'changeStatus'])
      .use(middleware.permission('department.change_status'))
  })
  .prefix('/api/admin/departments')
  .use([middleware.auth()])

// --- Catalog đơn vị (đọc, chỉ cần đăng nhập)
router
  .group(() => {
    router.get('/options', [DepartmentsController, 'options'])
    router.get('/', [DepartmentsController, 'index'])
    router.get('/:id', [DepartmentsController, 'show'])
  })
  .prefix('/api/departments')
  .middleware([middleware.auth()])

// --- Admin: fields CRUD (danh mục lĩnh vực, permission-based)
router
  .group(() => {
    router.get('/', [AdminFieldsController, 'index']).use(middleware.permission('field.view'))
    router.get('/:id', [AdminFieldsController, 'show']).use(middleware.permission('field.view'))
    router.post('/', [AdminFieldsController, 'store']).use(middleware.permission('field.create'))
    router.put('/:id', [AdminFieldsController, 'update']).use(middleware.permission('field.update'))
    router
      .patch('/:id/status', [AdminFieldsController, 'changeStatus'])
      .use(middleware.permission('field.update'))
  })
  .prefix('/api/admin/fields')
  .use([middleware.auth()])

// --- Catalog lĩnh vực (đọc, chỉ cần đăng nhập)
router
  .group(() => {
    router.get('/options', [FieldsController, 'options'])
    router.get('/', [FieldsController, 'index'])
    router.get('/:id', [FieldsController, 'show'])
  })
  .prefix('/api/fields')
  .middleware([middleware.auth()])

// --- Admin: specializations CRUD (danh mục chuyên ngành, permission-based)
router
  .group(() => {
    router
      .get('/', [AdminSpecializationsController, 'index'])
      .use(middleware.permission('specialization.view'))
    router
      .get('/:id', [AdminSpecializationsController, 'show'])
      .use(middleware.permission('specialization.view'))
    router
      .post('/', [AdminSpecializationsController, 'store'])
      .use(middleware.permission('specialization.create'))
    router
      .put('/:id', [AdminSpecializationsController, 'update'])
      .use(middleware.permission('specialization.update'))
    router
      .patch('/:id/status', [AdminSpecializationsController, 'changeStatus'])
      .use(middleware.permission('specialization.update'))
  })
  .prefix('/api/admin/specializations')
  .use([middleware.auth()])

// --- Catalog chuyên ngành (đọc, chỉ cần đăng nhập)
router
  .group(() => {
    router.get('/options', [SpecializationsController, 'options'])
    router.get('/', [SpecializationsController, 'index'])
    router.get('/:id', [SpecializationsController, 'show'])
  })
  .prefix('/api/specializations')
  .middleware([middleware.auth()])

// --- Admin: loại quy trình đề tài CRUD
router
  .group(() => {
    router
      .get('/', [AdminProjectProcessTypesController, 'index'])
      .use(middleware.permission('project_process_type.view'))
    router
      .get('/:id', [AdminProjectProcessTypesController, 'show'])
      .use(middleware.permission('project_process_type.view'))
    router
      .post('/', [AdminProjectProcessTypesController, 'store'])
      .use(middleware.permission('project_process_type.create'))
    router
      .put('/:id', [AdminProjectProcessTypesController, 'update'])
      .use(middleware.permission('project_process_type.update'))
    router
      .patch('/:id/status', [AdminProjectProcessTypesController, 'changeStatus'])
      .use(middleware.permission('project_process_type.update'))
  })
  .prefix('/api/admin/project-process-types')
  .use([middleware.auth()])

// --- Catalog loại quy trình đề tài (đọc, chỉ cần đăng nhập)
router
  .group(() => {
    router.get('/options', [ProjectProcessTypesController, 'options'])
    router.get('/', [ProjectProcessTypesController, 'index'])
    router.get('/:id', [ProjectProcessTypesController, 'show'])
  })
  .prefix('/api/project-process-types')
  .middleware([middleware.auth()])

// --- Admin: IAM Roles (permission-based)
router
  .group(() => {
    router
      .get('/', [AdminRolesController, 'index'])
      .use(middleware.permission('role.view'))
    router
      .get('/:id', [AdminRolesController, 'show'])
      .use(middleware.permission('role.view'))
    router
      .post('/', [AdminRolesController, 'store'])
      .use(middleware.permission('role.create'))
    router
      .put('/:id', [AdminRolesController, 'update'])
      .use(middleware.permission('role.update'))
    router
      .patch('/:id/status', [AdminRolesController, 'changeStatus'])
      .use(middleware.permission('role.update'))
    router
      .get('/:id/permissions', [AdminRolesController, 'permissions'])
      .use(middleware.permission('role.view'))
    router
      .put('/:id/permissions', [AdminRolesController, 'syncPermissions'])
      .use(middleware.permission('role.assign_permission'))
  })
  .prefix('/api/admin/roles')
  .use([middleware.auth()])

// --- Admin: IAM Permissions (permission-based)
router
  .group(() => {
    router
      .post('/sync-missing', [AdminPermissionsController, 'syncMissing'])
      .use(middleware.permission('permission.view'))
    router
      .get('/module-labels', [AdminPermissionsController, 'moduleLabels'])
      .use(middleware.permission('permission.view'))
    router
      .put('/module-labels/:code', [AdminPermissionsController, 'updateModuleLabel'])
      .use(middleware.permission('permission.view'))
    router
      .get('/all', [AdminPermissionsController, 'all'])
      .use(middleware.permission('permission.view'))
    router
      .get('/', [AdminPermissionsController, 'index'])
      .use(middleware.permission('permission.view'))
    router
      .get('/:id', [AdminPermissionsController, 'show'])
      .use(middleware.permission('permission.view'))
    router
      .post('/', [AdminPermissionsController, 'store'])
      .use(middleware.permission('permission.view'))
    router
      .put('/:id', [AdminPermissionsController, 'update'])
      .use(middleware.permission('permission.view'))
    router
      .patch('/:id/status', [AdminPermissionsController, 'changeStatus'])
      .use(middleware.permission('permission.view'))
  })
  .prefix('/api/admin/permissions')
  .use([middleware.auth()])

// --- Admin: IAM User management (permission-based)
router
  .group(() => {
    router
      .get('/', [AdminIamUsersController, 'index'])
      .use(middleware.permission('user.view'))
    router
      .get('/:id', [AdminIamUsersController, 'show'])
      .use(middleware.permission('user.view'))
    router
      .post('/', [AdminIamUsersController, 'store'])
      .use(middleware.permission('user.create'))
    router
      .put('/:id', [AdminIamUsersController, 'update'])
      .use(middleware.permission('user.update'))
    router
      .patch('/:id/status', [AdminIamUsersController, 'changeStatus'])
      .use(middleware.permission('user.change_status'))
    router
      .patch('/:id/reset-password', [AdminIamUsersController, 'resetPassword'])
      .use(middleware.permission('user.reset_password'))
    router
      .get('/:id/roles', [AdminIamUsersController, 'roles'])
      .use(middleware.permission('user.assign_role'))
    router
      .post('/:id/roles', [AdminIamUsersController, 'addRole'])
      .use(middleware.permission('user.assign_role'))
    router
      .put('/:id/roles', [AdminIamUsersController, 'assignRoles'])
      .use(middleware.permission('user.assign_role'))
    router
      .patch('/:id/roles/:assignmentId/status', [AdminIamUsersController, 'updateAssignmentStatus'])
      .use(middleware.permission('user.assign_role'))
    router
      .delete('/:id/roles/:assignmentId', [AdminIamUsersController, 'removeRole'])
      .use(middleware.permission('user.assign_role'))
  })
  .prefix('/api/admin/users')
  .use([middleware.auth()])

// --- Admin: danh mục nhân sự staffs (master)
router
  .group(() => {
    router
      .get('/', [AdminStaffsController, 'index'])
      .use(middleware.permission('department.view,personal_profile.view'))
    router
      .post('/', [AdminStaffsController, 'store'])
      .use(middleware.permission('personal_profile.create'))
    router
      .get('/:id', [AdminStaffsController, 'show'])
      .use(middleware.permission('department.view,personal_profile.view'))
    router
      .put('/:id', [AdminStaffsController, 'update'])
      .use(middleware.permission('personal_profile.update'))
  })
  .prefix('/api/admin/staffs')
  .use([middleware.auth()])

// --- Lookup dùng chung (NCV / sinh viên) — chỉ cần đăng nhập
router
  .group(() => {
    router.get('/author-profiles', [ProfileController, 'authorProfilesLookup'])
    router.get('/author-students', [ProfileController, 'authorStudentsLookup'])
  })
  .prefix('/api/lookup')
  .middleware([middleware.auth()])

// --- Admin: kết quả NCKH toàn hệ thống (permission: publication.*)
router
  .group(() => {
    router
      .get('/', [AdminPublicationsController, 'index'])
      .use(middleware.permission('publication.view'))
    router
      .get('/research-output-types/tree', [ProfileController, 'researchOutputTypesTree'])
      .use(middleware.permission('publication.view'))
    router
      .get('/:id/authors', [AdminPublicationAuthorsController, 'index'])
      .use(middleware.permission('publication.view'))
    router
      .put('/:id/authors', [AdminPublicationAuthorsController, 'update'])
      .use(middleware.permission('publication.update'))
    router
      .get('/:id', [AdminPublicationsController, 'show'])
      .use(middleware.permission('publication.view'))
    router
      .post('/', [AdminPublicationsController, 'store'])
      .use(middleware.permission('publication.create'))
    router
      .put('/:id', [AdminPublicationsController, 'update'])
      .use(middleware.permission('publication.update'))
    router
      .delete('/:id', [AdminPublicationsController, 'destroy'])
      .use(middleware.permission('publication.delete'))
    router
      .post('/:id/request-correction', [AdminPublicationsController, 'requestCorrection'])
      .use(middleware.permission('publication.review'))
    router
      .post('/:id/approve', [AdminPublicationsController, 'approve'])
      .use(middleware.permission('publication.approve'))
  })
  .prefix('/api/admin/publications')
  .use([middleware.auth()])

// --- Admin: catalogs CRUD (chỉ ADMIN)
router
  .group(() => {
    router.get('/', [CatalogsController, 'index'])
    router.get('/:id', [CatalogsController, 'show'])
    router.post('/', [CatalogsController, 'store'])
    router.put('/:id', [CatalogsController, 'update'])
    router.delete('/:id', [CatalogsController, 'destroy'])
  })
  .prefix('/api/admin/catalogs')
  .middleware([middleware.auth(), middleware.permission('department.view')])

// --- Admin: loại kết quả NCKH (permission: department.view)
router
  .group(() => {
    router.get('/research-output-types/tree', [AdminResearchOutputTypesController, 'tree'])
    router.post('/research-output-types', [AdminResearchOutputTypesController, 'store'])
    router.get('/research-output-types/:id/rule', [AdminResearchOutputRulesController, 'show'])
    router.put('/research-output-types/:id/rule', [AdminResearchOutputRulesController, 'upsert'])
    router.put('/research-output-types/:id/move', [AdminResearchOutputTypesController, 'move'])
    router.delete('/research-output-types/:id', [AdminResearchOutputTypesController, 'destroy'])
    router.put('/research-output-types/:id', [AdminResearchOutputTypesController, 'update'])
  })
  .prefix('/api/admin')
  .middleware([middleware.auth(), middleware.permission('department.view')])

// --- Catalogs public: lấy theo type (không cần auth)
router.get('/api/catalogs/by-type/:type', [CatalogsController, 'byType'])

// --- Catalog hồ sơ khoa học: học vị / học hàm (chỉ cần đăng nhập)
router
  .group(() => {
    router.get('/options', [ScientificProfileCatalogController, 'options'])
    router.get('/degrees/options', [ScientificProfileCatalogController, 'degreeOptions'])
    router.get('/academic-titles/options', [
      ScientificProfileCatalogController,
      'academicTitleOptions',
    ])
  })
  .prefix('/api/catalog/scientific-profile')
  .middleware([middleware.auth()])

// --- Notifications (user đăng nhập: danh sách, đánh dấu đọc, xóa)
router
  .group(() => {
    router.get('/', [NotificationsController, 'index'])
    router.get('/unread-count', [NotificationsController, 'unreadCount'])
    router.put('/read-all', [NotificationsController, 'markAllRead'])
    router.delete('/clear-all', [NotificationsController, 'clearAll'])
    router.put('/:id/read', [NotificationsController, 'markRead'])
    router.delete('/:id', [NotificationsController, 'destroy'])
  })
  .prefix('/api/notifications')
  .middleware([middleware.auth()])

// --- Danh mục cơ quan công tác ĐHĐN (key + value)
router
  .get('/api/profile/udn-affiliation-units', [ProfileController, 'udnAffiliationUnits'])
  .middleware([middleware.auth()])

// --- Hồ sơ khoa học của bản thân (NCV)
router
  .group(() => {
    router.get('/', [ProfileController, 'me'])
    router.get('/suggestions', [ProfileController, 'suggestions'])
    router.get('/openalex/publication-drafts', [ProfileController, 'openAlexPublicationDrafts'])
    router.get('/research-output-types/tree', [ProfileController, 'researchOutputTypesTree'])
    router.post('/', [ProfileController, 'storeMe'])
    router.put('/', [ProfileController, 'updateMe'])
    router.post('/submit', [ProfileController, 'submitMe'])
    router.get('/languages', [ProfileLanguagesController, 'index'])
    router.post('/languages', [ProfileLanguagesController, 'store'])
    router.put('/languages/:id', [ProfileLanguagesController, 'update'])
    router.delete('/languages/:id', [ProfileLanguagesController, 'destroy'])
    router.get('/attachments', [ProfileAttachmentsController, 'index'])
    router.post('/attachments', [ProfileAttachmentsController, 'store'])
    router.delete('/attachments/:id', [ProfileAttachmentsController, 'destroy'])
    router.get('/publications', [PublicationsController, 'index'])
    router.post('/publications', [PublicationsController, 'store'])
    router.put('/publications/:id', [PublicationsController, 'update'])
    router.delete('/publications/:id', [PublicationsController, 'destroy'])
    router.get('/publications/:id/authors', [PublicationAuthorsController, 'index'])
    router.put('/publications/:id/authors', [PublicationAuthorsController, 'update'])
  })
  .prefix('/api/profile/me')
  .middleware([middleware.auth(), middleware.personalWorkspace()])

// --- Hồ sơ nhân sự của user đang đăng nhập (bảng staffs)
router
  .group(() => {
    router.get('/', [MeStaffProfileController, 'show'])
    router.put('/', [MeStaffProfileController, 'update'])
  })
  .prefix('/api/me/staff-profile')
  .middleware([middleware.auth(), middleware.personalWorkspace()])

// --- Alias không có /api (một số FE đang gọi /profile/me)
router
  .group(() => {
    router.get('/', [ProfileController, 'me'])
    router.get('/suggestions', [ProfileController, 'suggestions'])
    router.get('/openalex/publication-drafts', [ProfileController, 'openAlexPublicationDrafts'])
    router.get('/research-output-types/tree', [ProfileController, 'researchOutputTypesTree'])
    router.post('/', [ProfileController, 'storeMe'])
    router.put('/', [ProfileController, 'updateMe'])
    router.post('/submit', [ProfileController, 'submitMe'])
    router.get('/languages', [ProfileLanguagesController, 'index'])
    router.post('/languages', [ProfileLanguagesController, 'store'])
    router.put('/languages/:id', [ProfileLanguagesController, 'update'])
    router.delete('/languages/:id', [ProfileLanguagesController, 'destroy'])
    router.get('/attachments', [ProfileAttachmentsController, 'index'])
    router.post('/attachments', [ProfileAttachmentsController, 'store'])
    router.delete('/attachments/:id', [ProfileAttachmentsController, 'destroy'])
    router.get('/publications', [PublicationsController, 'index'])
    router.post('/publications', [PublicationsController, 'store'])
    router.put('/publications/:id', [PublicationsController, 'update'])
    router.delete('/publications/:id', [PublicationsController, 'destroy'])
    router.get('/publications/:id/authors', [PublicationAuthorsController, 'index'])
    router.put('/publications/:id/authors', [PublicationAuthorsController, 'update'])
  })
  .prefix('/profile/me')
  .middleware([middleware.auth(), middleware.personalWorkspace()])

// --- Upload alias (để FE dùng POST /api/uploads)
router.post('/api/uploads', [ProfileAttachmentsController, 'store']).middleware([middleware.auth()])

// --- Danh sách hồ sơ + verify (permission: profile.view_all, profile.verify)
router
  .group(() => {
    router.get('/', [ProfilesController, 'index'])
    router.get('/:id/publications/:pubId/authors', [ProfilesController, 'profilePublicationAuthors'])
    router.get('/:id/publications', [ProfilesController, 'profilePublications'])
    router.get('/:id', [ProfilesController, 'show'])
    router.post('/:id/verify', [ProfilesController, 'verify'])
    router.post('/:id/request-more-info', [ProfilesController, 'requestMoreInfo'])
    router.get('/:id/verify-logs', [ProfilesController, 'verifyLogs'])
  })
  .prefix('/api/profiles')
  .middleware([middleware.auth(), middleware.permission('profile.view_all,profile.verify')])

// --- Ngân hàng ý tưởng (Ideas)
router
  .group(() => {
    router.get('/', [IdeasController, 'index'])
    router.get('/my', [IdeasController, 'myIndex']).middleware([middleware.personalWorkspace()])
    router.get('/:id', [IdeasController, 'show'])
    router.post('/', [IdeasController, 'store']).middleware([middleware.personalWorkspace()])
    router.put('/:id', [IdeasController, 'update'])
    router.delete('/:id', [IdeasController, 'destroy'])
    router.post('/:id/submit', [IdeasController, 'submit'])
    router.post('/:id/receive', [IdeasController, 'receive'])
    router.post('/:id/approve-internal', [IdeasController, 'approveInternal'])
    router.post('/:id/propose-order', [IdeasController, 'proposeOrder'])
    router.post('/:id/approve-order', [IdeasController, 'approveOrder'])
    router.post('/:id/reject', [IdeasController, 'reject'])
    router.post('/:id/create-project', [IdeasController, 'createProject'])
    router.put('/:id/council-result', [IdeasController, 'councilResult'])
  })
  .prefix('/api/ideas')
  .middleware([middleware.auth()])

// --- Hội đồng chấm điểm ý tưởng (Council Sessions)
router
  .group(() => {
    router.get('/', [CouncilSessionsController, 'index'])
    router.post('/', [CouncilSessionsController, 'store'])
    router.get('/:id', [CouncilSessionsController, 'show'])
    router.put('/:id', [CouncilSessionsController, 'update'])
    router.post('/:id/open', [CouncilSessionsController, 'open'])
    router.post('/:id/close', [CouncilSessionsController, 'close'])
    router.post('/:id/publish', [CouncilSessionsController, 'publish'])
    router.get('/:id/available-members', [SessionMembersController, 'availableMembers'])
    router.get('/:id/members', [SessionMembersController, 'index'])
    router.post('/:id/members', [SessionMembersController, 'store'])
    router.delete('/:id/members/:memberId', [SessionMembersController, 'destroy'])
    router.get('/:id/available-ideas', [SessionIdeasController, 'availableIdeas'])
    router.get('/:id/ideas', [SessionIdeasController, 'index'])
    router.post('/:id/ideas', [SessionIdeasController, 'store'])
    router.delete('/:id/ideas/:sessionIdeaId', [SessionIdeasController, 'destroy'])
    router.get('/:sessionId/ideas/:ideaId/my-score', [IdeaCouncilScoresController, 'myScore'])
    router.post('/:sessionId/ideas/:ideaId/score', [IdeaCouncilScoresController, 'saveScore'])
    router.post('/:sessionId/ideas/:ideaId/submit', [IdeaCouncilScoresController, 'submitMyScore'])
    router.post('/:sessionId/scores/:scoreId/submit', [IdeaCouncilScoresController, 'submitScore'])
    router.get('/:sessionId/ideas/:ideaId/scores', [IdeaCouncilScoresController, 'listScores'])
    router.get('/:sessionId/ideas/:ideaId/result', [IdeaCouncilScoresController, 'result'])
    router.get('/:sessionId/results', [IdeaCouncilScoresController, 'results'])
    router.get('/:sessionId/stats', [IdeaCouncilScoresController, 'stats'])
  })
  .prefix('/api/council-sessions')
  .middleware([middleware.auth()])

// --- Thông báo tuyển chọn đề tài (CFP)
router
  .group(() => {
    // Static paths trước /:id
    router
      .get('/published', [CallForProposalsController, 'published'])
      .use(middleware.permission('cfp.view'))
    router
      .get('/published/:id', [CallForProposalsController, 'publishedShow'])
      .use(middleware.permission('cfp.view'))
    router
      .get('/active-period', [CallForProposalsController, 'activePeriod'])
      .use(middleware.permission('cfp.view,project.create,project.submit,project.view'))
    router.get('/', [CallForProposalsController, 'index']).use(middleware.permission('cfp.view'))
    router.get('/:id/audits', [CallForProposalsController, 'audits']).use(middleware.permission('cfp.view'))
    router.get('/:id', [CallForProposalsController, 'show']).use(middleware.permission('cfp.view'))
    router.post('/', [CallForProposalsController, 'store']).use(middleware.permission('cfp.create'))
    router.put('/:id', [CallForProposalsController, 'update']).use(middleware.permission('cfp.update'))
    router.post('/:id/submit', [CallForProposalsController, 'submit']).use(middleware.permission('cfp.submit'))
    router.post('/:id/approve', [CallForProposalsController, 'approve']).use(middleware.permission('cfp.approve'))
    router.post('/:id/return', [CallForProposalsController, 'return']).use(middleware.permission('cfp.approve'))
    router.post('/:id/publish', [CallForProposalsController, 'publish']).use(middleware.permission('cfp.publish'))
    router.post('/:id/extend', [CallForProposalsController, 'extend']).use(middleware.permission('cfp.extend'))
    router.post('/:id/close', [CallForProposalsController, 'close']).use(middleware.permission('cfp.close'))
  })
  .prefix('/api/call-for-proposals')
  .middleware([middleware.auth()])

// --- Đăng ký đề xuất đề tài (Project Proposals)
router
  .group(() => {
    router.get('/pending-unit-count', [ProjectProposalsController, 'pendingUnitCount'])
    router.get('/pkh/stats', [ProjectProposalsController, 'pkhStats'])
    router.get('/pkh/export-excel', [ProjectProposalsController, 'exportPkhExcel'])
    router.get('/', [ProjectProposalsController, 'index'])
    router.get('/:id/audits', [ProjectProposalsController, 'audits'])
    router.get('/:id/members', [ProjectProposalMembersController, 'index'])
    router.put('/:id/members', [ProjectProposalMembersController, 'update'])
    router.get('/:id', [ProjectProposalsController, 'show'])
    router.post('/', [ProjectProposalsController, 'store'])
    router.put('/:id', [ProjectProposalsController, 'update'])
    router.delete('/:id', [ProjectProposalsController, 'destroy'])
    router.post('/:id/submit', [ProjectProposalsController, 'submit'])
    router.post('/:id/withdraw', [ProjectProposalsController, 'withdraw'])
    router.post('/:id/unit-review', [ProjectProposalsController, 'unitReview'])
    router.post('/:id/unit-return', [ProjectProposalsController, 'unitReturn'])
    router.post('/:id/mark-valid', [ProjectProposalsController, 'markValid'])
    router.post('/:id/request-supplement', [ProjectProposalsController, 'requestSupplement'])
    router.post('/:id/resubmit-to-pkh', [ProjectProposalsController, 'resubmitToPkh'])
    router.post('/:id/extend-supplement', [ProjectProposalsController, 'extendSupplement'])
    router.post('/:id/reject-by-pkh', [ProjectProposalsController, 'rejectByPkh'])
    router.post('/:id/submit-council-adjustment', [
      ProjectProposalsController,
      'submitCouncilAdjustment',
    ])
    router.get('/:id/adjustment-versions', [ProjectProposalsController, 'adjustmentVersions'])
    router.post('/:id/extend-adjustment', [ProjectProposalsController, 'extendAdjustment'])
  })
  .prefix('/api/project-proposals')
  .middleware([middleware.auth()])

// --- Phiên xét chọn đề tài (US-03-03 tạo phiên + US-03-04 kết quả/BGH)
router
  .group(() => {
    router.get('/', [ProposalSelectionSessionsController, 'index'])
    router.post('/', [ProposalSelectionSessionsController, 'store'])
    router.get('/:id', [ProposalSelectionSessionsController, 'show'])
    router.put('/:id', [ProposalSelectionSessionsController, 'updateMeta'])
    router.put('/:id/results', [ProposalSelectionSessionsController, 'upsertResults'])
    router.post('/:id/save-minutes', [ProposalSelectionSessionsController, 'saveMinutes'])
    router.post('/:id/submit-bgh', [ProposalSelectionSessionsController, 'submitBgh'])
    router.post('/:id/bgh-approve', [ProposalSelectionSessionsController, 'bghApprove'])
    router.post('/:id/bgh-reject', [ProposalSelectionSessionsController, 'bghReject'])
    router.get('/:id/summary', [ProposalSelectionSessionsController, 'summary'])
    router.put('/:id/admin-edit', [ProposalSelectionSessionsController, 'adminEditLocked'])
  })
  .prefix('/api/proposal-selection-sessions')
  .middleware([middleware.auth()])

// --- Dashboard / Home (theo role)
router
  .group(() => {
    router.get('/summary', [HomeController, 'summary'])
    router.get('/tasks', [HomeController, 'tasks'])
    router.get('/notifications', [HomeController, 'notifications'])
    router.get('/my-projects', [HomeController, 'myProjects']).middleware([middleware.personalWorkspace()])
    router.get('/my-ideas', [HomeController, 'myIdeas']).middleware([middleware.personalWorkspace()])
    router.get('/workflow-steps', [HomeController, 'workflowSteps'])
    router.get('/pending-proposals', [HomeController, 'pendingProposals'])
    router.get('/delayed-projects', [HomeController, 'delayedProjects'])
    router.get('/charts', [HomeController, 'charts'])
    router.get('/top-projects', [HomeController, 'topProjects'])
    router.get('/top-researchers', [HomeController, 'topResearchers'])
    router.get('/warnings', [HomeController, 'warnings'])
    router.get('/overview', [HomeController, 'overview'])
  })
  .prefix('/api/home')
  .middleware([middleware.auth()])

// --- KPI Engine (giờ NCKH theo QĐ 1883)
router
  .group(() => {
    router.get('/teachers/:profileId', [KpisController, 'teachersShow'])
    router.get('/publications/:id/breakdown', [KpisController, 'publicationsBreakdown'])
    router.get('/nckh-hours-report', [KpisController, 'nckhHoursReport'])
    router.get('/nckh-data-report', [KpisController, 'nckhDataReport'])
    router.post('/recalculate', [KpisController, 'recalculate'])
  })
  .prefix('/api/kpis')
  .middleware([middleware.auth()])

// Health check
router.get('/', async () => {
  return { hello: 'world' }
})
