import type Publication from '#models/publication'
import type PublicationAuthor from '#models/publication_author'

/** Ghép họ tên tác giả từ bảng chi tiết (theo author_order) để hiển thị trên danh sách KQNC. */
export function formatAuthorsDisplayFromRows(
  rows: Array<Pick<PublicationAuthor, 'fullName' | 'authorOrder'>>
): string {
  return rows
    .slice()
    .sort((a, b) => a.authorOrder - b.authorOrder)
    .map((a) => String(a.fullName ?? '').trim())
    .filter((name) => name.length > 0)
    .join(', ')
}

/** Ưu tiên bảng publication_authors; không có thì dùng cột publications.authors. */
export function resolvePublicationAuthorsDisplay(publication: Publication): string {
  const related = publication.publicationAuthors as PublicationAuthor[] | undefined
  if (related && related.length > 0) {
    const fromTable = formatAuthorsDisplayFromRows(related)
    if (fromTable) return fromTable
  }
  return String(publication.authors ?? '').trim()
}
