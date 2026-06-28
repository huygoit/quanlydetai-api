import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Bổ sung 2 link minh chứng theo yêu cầu QĐ 1883 cho bài báo WoS/Scopus:
 * - q_rank_url: link minh chứng mức xếp hạng Q (Scimago/WoS)
 * - reputable_list_url: link danh mục tạp chí uy tín (HĐGSNN/WoS/Scopus)
 */
export default class extends BaseSchema {
  protected tableName = 'publications'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .string('q_rank_url', 500)
        .nullable()
        .comment('Link minh chứng mức xếp hạng Q (Scimago/WoS)')
      table
        .string('reputable_list_url', 500)
        .nullable()
        .comment('Link danh mục tạp chí uy tín (HĐGSNN/WoS/Scopus)')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('q_rank_url')
      table.dropColumn('reputable_list_url')
    })
  }
}
