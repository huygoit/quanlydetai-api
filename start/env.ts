/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),

  /*
  |----------------------------------------------------------
  | Variables for configuring database connection
  |----------------------------------------------------------
  */
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | OpenAlex integration
  |----------------------------------------------------------
  */
  OPENALEX_API_KEY: Env.schema.string.optional(),
  OPENALEX_BASE_URL: Env.schema.string.optional(),
  OPENALEX_MAILTO: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Uploads (đính kèm hồ sơ)
  |----------------------------------------------------------
  |
  | UPLOAD_STORAGE_ROOT: thư mục gốc lưu file upload. Có thể là:
  | - đường dẫn tuyệt đối (vd: D:/uploads)
  | - hoặc tương đối theo appRoot (vd: storage)
  |
  | UPLOAD_PROFILE_ATTACHMENTS_DIR: thư mục con cho attachments
  | UPLOAD_PUBLIC_BASE_PATH: prefix public để FE truy cập (vd: /storage)
  */
  UPLOAD_STORAGE_ROOT: Env.schema.string.optional(),
  UPLOAD_PROFILE_ATTACHMENTS_DIR: Env.schema.string.optional(),
  UPLOAD_PUBLIC_BASE_PATH: Env.schema.string.optional(),
})
