import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ProjectOutline from '#models/project_outline'
import User from '#models/user'

export type OutlineVersionType = 'BASELINE_AFTER_DEFENSE' | 'REVISION_SUBMITTED'
export type OutlineVersionStatus = 'LOCKED'

export default class ProjectOutlineVersion extends BaseModel {
  static table = 'project_outline_versions'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare projectOutlineId: number

  @column()
  declare versionNo: number

  @column()
  declare parentVersionId: number | null

  @column()
  declare versionType: OutlineVersionType

  @column()
  declare status: OutlineVersionStatus

  @column({
    prepare: (v: unknown) => JSON.stringify(v ?? {}),
    consume: (v: string | unknown) => {
      if (typeof v === 'string') {
        try {
          return JSON.parse(v)
        } catch {
          return {}
        }
      }
      return v ?? {}
    },
  })
  declare snapshotJson: Record<string, unknown>

  @column()
  declare outlineFileUrl: string | null

  @column()
  declare appendixFileUrl: string | null

  @column()
  declare explanation: string | null

  @column()
  declare defenseSessionId: number | null

  @column()
  declare createdBy: number | null

  @column.dateTime()
  declare lockedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => ProjectOutline, { foreignKey: 'projectOutlineId' })
  declare outline: BelongsTo<typeof ProjectOutline>

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>
}
