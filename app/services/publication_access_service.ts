import Publication from '#models/publication'
import PublicationAuthor from '#models/publication_author'

/**
 * Quyền truy cập công bố: chủ bài (profile_id) hoặc đồng tác giả (publication_authors.profile_id).
 */
export default class PublicationAccessService {
  /** Query công bố mà hồ sơ được xem (chủ bài hoặc đồng tác giả có profile_id). */
  static accessiblePublicationsQuery(profileId: number) {
    const coAuthorSubquery = PublicationAuthor.query()
      .where('profile_id', profileId)
      .select('publication_id')

    return Publication.query().where((b) => {
      b.where('profile_id', profileId).orWhereIn('id', coAuthorSubquery)
    })
  }

  static async findViewable(publicationId: number, viewerProfileId: number) {
    return this.accessiblePublicationsQuery(viewerProfileId)
      .where('id', publicationId)
      .first()
  }

  static async findEditable(publicationId: number, ownerProfileId: number) {
    return Publication.query().where('id', publicationId).where('profile_id', ownerProfileId).first()
  }

  static isOwner(publication: Publication, profileId: number): boolean {
    return Number(publication.profileId) === Number(profileId)
  }
}
