import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import * as fs from 'node:fs'
import * as path from 'node:path'
import ProjectResearchImportService from '#services/project_research_import_service'

/** Tên sheet cố định — luồng import luôn ghi projects.project_type = LECTURER_RESEARCH (trong ProjectResearchImportService) */
const SHEET_GV_NCKH2025 = 'GV_NCKH2025'

/**
 * Lệnh clone chuyên import sheet GV_NCKH2025 → bảng projects với project_type = LECTURER_RESEARCH.
 * Logic xử lý dùng chung ProjectResearchImportService (map cột nckh_id, nckh_name, …).
 */
export default class ImportGvNckh2025LecturerProjects extends BaseCommand {
  static commandName = 'import:gv-nckh2025-lecturer-projects'
  static description = `Import chỉ sheet ${SHEET_GV_NCKH2025} — project_type luôn là LECTURER_RESEARCH`

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({
    flagName: 'file',
    alias: 'f',
    description: 'Đường dẫn .xlsx (mặc định: prompts/KH_CNTT_2025_2026.xlsx)',
  })
  declare file?: string

  @flags.boolean({
    flagName: 'dry-run',
    description: 'Parse/import không ghi DB',
  })
  declare dryRun: boolean

  @flags.boolean({
    flagName: 'verbose',
    description: 'In chi tiết cảnh báo',
  })
  declare verbose: boolean

  async run() {
    const filePath = this.file || 'prompts/KH_CNTT_2025_2026.xlsx'

    const summary = await ProjectResearchImportService.import({
      file: filePath,
      sheet: SHEET_GV_NCKH2025,
      dryRun: this.dryRun,
      verbose: this.verbose,
    })

    this.logger.info(`sheet cố định: ${SHEET_GV_NCKH2025} (project_type = LECTURER_RESEARCH)`)
    this.logger.info(`file: ${filePath}`)
    this.logger.info(`total rows read: ${summary.totalRowsRead}`)
    this.logger.info(`created projects: ${summary.createdProjects}`)
    this.logger.info(`updated projects: ${summary.updatedProjects}`)
    this.logger.info(`matched internal leaders: ${summary.matchedInternalLeaders}`)
    this.logger.info(`fallback raw leaders created: ${summary.fallbackRawLeadersCreated}`)
    this.logger.info(`unmatched departments/units: ${summary.unmatchedDepartments}`)
    this.logger.info(`skipped rows: ${summary.skippedRows}`)
    this.logger.info(`warnings: ${summary.warnings.length}`)
    this.logger.info(`errors: ${summary.errors.length}`)

    if (summary.warnings.length > 0 || summary.errors.length > 0) {
      const logsDir = path.join(process.cwd(), 'storage', 'import-logs')
      await fs.promises.mkdir(logsDir, { recursive: true })
      const runId = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const logPath = path.join(logsDir, `gv-nckh2025-lecturer-import-${runId}.json`)
      await fs.promises.writeFile(
        logPath,
        JSON.stringify(
          {
            file: filePath,
            sheet: SHEET_GV_NCKH2025,
            projectType: 'LECTURER_RESEARCH',
            dryRun: this.dryRun,
            summary,
          },
          null,
          2
        ),
        'utf-8'
      )
      this.logger.info(`log file: ${logPath}`)
    }

    if (this.verbose) {
      for (const warning of summary.warnings) {
        this.logger.warning(warning)
      }
    }
    for (const err of summary.errors) {
      this.logger.error(err)
    }

    if (summary.errors.length > 0) this.exitCode = 1
  }
}
