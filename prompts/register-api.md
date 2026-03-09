Bạn là senior backend engineer AdonisJS v6 (TypeScript) + Lucid + PostgreSQL.
Hệ thống trả response theo format:
Success: { success:true, data:{ user:{...}, token:{type:'bearer', token:'...', expiresAt:{...}} } }
Error: { success:false, message:string }

Mục tiêu:
Thêm API POST /api/auth/register để đăng ký bằng email + password + confirmPassword.
Sau đăng ký: auto issue token (bearer) giống login, trả user + token giống structure login hiện tại.

==================================================
1) ROUTES
==================================================
Trong start/routes.ts (group /api):
POST /api/auth/register  -> AuthController.register

==================================================
2) VALIDATION
==================================================
Payload:
{ email, password, confirmPassword }

Rules:
- email: required, email format, trim, lowercase, unique users.email
- password: required, min 8
- confirmPassword: required, must match password

Error response:
{ success:false, message:"..." }

==================================================
3) CONTROLLER
==================================================
AuthController.register:
- validate payload
- check email exists -> return 400 {success:false,message:"Email đã tồn tại."}
- create user (email normalized lowercase)
- hash password (Hash.make or Lucid hook)
- set default role = 'NCV' (hoặc role mặc định của hệ thống)
- set isActive = true
- issue token:
  const token = await auth.use('api').login(user, { expiresIn: '30days' }) 
  (hoặc đúng cách dự án đang dùng để token trả về có {type,token,expiresAt} giống login)
- build user payload giống login:
  { id,email,fullName,role,roleLabel,avatarUrl,unit }

Return 201:
{ success:true, data:{ user: userDto, token: tokenDto } }

==================================================
4) OPTIONAL - ONBOARDING FLAG
==================================================
Không bắt buộc, nhưng nếu muốn:
- thêm field onboardingRequired: boolean trong data
Tuy nhiên ưu tiên giữ giống login 100% để frontend reuse.

==================================================
5) OUTPUT
==================================================
- routes snippet
- validator AuthRegisterValidator
- AuthController.register code
- example request/response
Không viết frontend.