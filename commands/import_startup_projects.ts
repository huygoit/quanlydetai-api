import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import StartupProjectImportService from '#services/startup_project_import_service'

export default class ImportStartupProjects extends BaseCommand {
  static commandName = 'import:startup-projects'
  static description = 'Import startup projects from Excel/CSV'

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
    description: 'Excel sheet name',
  })
  declare sheet?: string

  @flags.boolean({
    flagName: 'create-missing-fields',
    description: 'Create missing startup fields from input field names',
  })
  declare createMissingFields: boolean

  async run() {
    if (!this.file) {
      this.logger.error('Missing --file flag. Example: node ace import:startup-projects --file=prompts/data.xlsx')
      this.exitCode = 1
      return
    }

    const summary = await StartupProjectImportService.import({
      file: this.file,
      sheet: this.sheet || 'SV_KhoiNghiep',
      createMissingFields: this.createMissingFields,
    })

    this.logger.info(`total rows read: ${summary.totalRowsRead}`)
    this.logger.info(`normalized rows processed: ${summary.normalizedRowsProcessed}`)
    this.logger.info(`created projects: ${summary.createdProjects}`)
    this.logger.info(`updated projects: ${summary.updatedProjects}`)
    this.logger.info(`attached student members: ${summary.attachedStudentMembers}`)
    this.logger.info(`attached lecturer mentors: ${summary.attachedLecturerMentors}`)
    this.logger.info(`unmatched students: ${summary.unmatchedStudents}`)
    this.logger.info(`unmatched lecturers: ${summary.unmatchedLecturers}`)
    this.logger.info(`created fields: ${summary.createdFields}`)
    this.logger.info(`skipped rows: ${summary.skippedRows}`)
    this.logger.info(`warnings: ${summary.warnings.length}`)
    this.logger.info(`errors: ${summary.errors.length}`)

    for (const w of summary.warnings) {
      this.logger.warning(w)
    }
    for (const e of summary.errors) {
      this.logger.error(e)
    }

    if (summary.errors.length > 0) {
      this.exitCode = 1
    }
  }
}