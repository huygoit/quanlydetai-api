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
import HomeController from '#controllers/home_controller'
import KpisController from '#controllers/kpis_controller'
import AdminResearchOutputTypesController from '#controllers/admin/research_output_types_controller'
import AdminResearchOutputRulesController from '#controllers/admin/research_output_rules_controller'
import AdminDepartmentsController from '#controllers/admin/departments_controller'
import AdminRolesController from '#controllers/admin/roles_controller'
import AdminPermissionsController from '#controllers/admin/permissions_controller'
import AdminIamUsersController from '#controllers/admin/iam_users_controller'
import AdminPersonalProfilesController from '#controllers/admin/personal_profiles_controller'

// --- Auth (login, register không cần token)
router.post('/api/auth/login', [AuthController, 'login'])
router.post('/api/auth/register', [AuthController, 'register'])

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

// --- Admin: personal profiles CRUD (chỉ ADMIN)
router
  .group(() => {
    router.get('/', [AdminPersonalProfilesController, 'index'])
    router.get('/user/:userId', [AdminPersonalProfilesController, 'showByUserId'])
    router.get('/:id', [AdminPersonalProfilesController, 'show'])
    router.post('/', [AdminPersonalProfilesController, 'store'])
    router.put('/:id', [AdminPersonalProfilesController, 'update'])
    router.patch('/:id/status', [AdminPersonalProfilesController, 'changeStatus'])
  })
  .prefix('/api/admin/personal-profiles')
  .use([middleware.auth(), middleware.role('ADMIN')])

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

// --- Hồ sơ khoa học của bản thân (NCV)
router
  .group(() => {
    router.get('/', [ProfileController, 'me'])
    router.get('/suggestions', [ProfileController, 'suggestions'])
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
  .middleware([middleware.auth()])

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
    router.get('/my', [IdeasController, 'myIndex'])
    router.get('/:id', [IdeasController, 'show'])
    router.post('/', [IdeasController, 'store'])
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

// --- Đăng ký đề xuất đề tài (Project Proposals)
router
  .group(() => {
    router.get('/', [ProjectProposalsController, 'index'])
    router.get('/:id', [ProjectProposalsController, 'show'])
    router.post('/', [ProjectProposalsController, 'store'])
    router.put('/:id', [ProjectProposalsController, 'update'])
    router.delete('/:id', [ProjectProposalsController, 'destroy'])
    router.post('/:id/submit', [ProjectProposalsController, 'submit'])
    router.post('/:id/withdraw', [ProjectProposalsController, 'withdraw'])
    router.post('/:id/unit-review', [ProjectProposalsController, 'unitReview'])
    router.post('/:id/sci-dept-review', [ProjectProposalsController, 'sciDeptReview'])
  })
  .prefix('/api/project-proposals')
  .middleware([middleware.auth()])

// --- Dashboard / Home (theo role)
router
  .group(() => {
    router.get('/summary', [HomeController, 'summary'])
    router.get('/tasks', [HomeController, 'tasks'])
    router.get('/notifications', [HomeController, 'notifications'])
    router.get('/my-projects', [HomeController, 'myProjects'])
    router.get('/my-ideas', [HomeController, 'myIdeas'])
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
    router.post('/recalculate', [KpisController, 'recalculate'])
  })
  .prefix('/api/kpis')
  .middleware([middleware.auth()])

// Health check
router.get('/', async () => {
  return { hello: 'world' }
})
