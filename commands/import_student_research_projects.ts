import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import * as fs from 'node:fs'
import * as path from 'node:path'
import ProjectImportService from '#services/project_import_service'

export default class ImportStudentResearchProjects extends BaseCommand {
  static commandName = 'import:student-research-projects'
  static description = 'Import projects/members from sheet SV_NCKH'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({
    flagName: 'file',
    alias: 'f',
    description: 'Path to .xlsx/.csv file',
  })
  declare file?: string

  @flags.string({
    flagName: 'sheet',
    description: 'Sheet name for xlsx (default: SV_NCKH)',
  })
  declare sheet?: string

  @flags.boolean({
    flagName: 'dry-run',
    description: 'Parse/import without writing DB',
  })
  declare dryRun: boolean

  @flags.boolean({
    flagName: 'create-missing-users',
    description: 'Reserved flag for future user auto-create behavior',
  })
  declare createMissingUsers: boolean

  @flags.boolean({
    flagName: 'verbose',
    description: 'Print warning details',
  })
  declare verbose: boolean

  async run() {
    if (!this.file) {
      this.logger.error(
        'Missing --file. Example: node ace import:student-research-projects --file=prompts/data.xlsx --sheet=SV_NCKH'
      )
      this.exitCode = 1
      return
    }

    const summary = await ProjectImportService.import({
      file: this.file,
      sheet: this.sheet || 'SV_NCKH',
      dryRun: this.dryRun,
      createMissingUsers: this.createMissingUsers,
      verbose: this.verbose,
    })

    this.logger.info(`total rows read: ${summary.totalRowsRead}`)
    this.logger.info(`normalized rows processed: ${summary.normalizedRowsProcessed}`)
    this.logger.info(`created projects: ${summary.createdProjects}`)
    this.logger.info(`updated projects: ${summary.updatedProjects}`)
    this.logger.info(`attached internal users: ${summary.attachedInternalUsers}`)
    this.logger.info(`attached raw members: ${summary.attachedRawMembers}`)
    this.logger.info(`matched leaders: ${summary.matchedLeaders}`)
    this.logger.info(`unmatched users: ${summary.unmatchedUsers}`)
    this.logger.info(`skipped rows: ${summary.skippedRows}`)
    this.logger.info(`warnings: ${summary.warnings.length}`)
    this.logger.info(`errors: ${summary.errors.length}`)

    if (summary.warnings.length > 0 || summary.errors.length > 0) {
      const logsDir = path.join(process.cwd(), 'storage', 'import-logs')
      await fs.promises.mkdir(logsDir, { recursive: true })
      const runId = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const logPath = path.join(logsDir, `sv-nckh-import-${runId}.json`)
      await fs.promises.writeFile(
        logPath,
        JSON.stringify(
          {
            file: this.file,
            sheet: this.sheet || 'SV_NCKH',
            dryRun: this.dryRun,
            summary: {
              totalRowsRead: summary.totalRowsRead,
              normalizedRowsProcessed: summary.normalizedRowsProcessed,
              createdProjects: summary.createdProjects,
              updatedProjects: summary.updatedProjects,
              attachedInternalUsers: summary.attachedInternalUsers,
              attachedRawMembers: summary.attachedRawMembers,
              matchedLeaders: summary.matchedLeaders,
              unmatchedUsers: summary.unmatchedUsers,
              skippedRows: summary.skippedRows,
              warnings: summary.warnings.length,
              errors: summary.errors.length,
            },
            warnings: summary.warnings,
            errors: summary.errors,
          },
          null,
          2
        ),
        'utf-8'
      )
      this.logger.info(`log file: ${logPath}`)
    }

    if (this.verbose) {
      for (const warning of summary.warnings) this.logger.warning(warning)
    }
    for (const err of summary.errors) this.logger.error(err)

    if (summary.errors.length > 0) this.exitCode = 1
  }
}