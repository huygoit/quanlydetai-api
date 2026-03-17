import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import * as fs from 'node:fs'
import * as path from 'node:path'
import ProjectResearchImportService from '#services/project_research_import_service'

export default class ImportResearchProjects extends BaseCommand {
  static commandName = 'import:research-projects'
  static description = 'Import research projects from BangNCKH sheet'

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
    description: 'Sheet name for xlsx (default: BangNCKH)',
  })
  declare sheet?: string

  @flags.boolean({
    flagName: 'dry-run',
    description: 'Parse/import without writing DB',
  })
  declare dryRun: boolean

  @flags.boolean({
    flagName: 'verbose',
    description: 'Print warning details',
  })
  declare verbose: boolean

  async run() {
    if (!this.file) {
      this.logger.error(
        'Missing --file. Example: node ace import:research-projects --file=prompts/data.xlsx --sheet=BangNCKH'
      )
      this.exitCode = 1
      return
    }

    const summary = await ProjectResearchImportService.import({
      file: this.file,
      sheet: this.sheet || 'BangNCKH',
      dryRun: this.dryRun,
      verbose: this.verbose,
    })

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
      const logPath = path.join(logsDir, `bangnckh-import-${runId}.json`)
      await fs.promises.writeFile(
        logPath,
        JSON.stringify(
          {
            file: this.file,
            sheet: this.sheet || 'BangNCKH',
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
