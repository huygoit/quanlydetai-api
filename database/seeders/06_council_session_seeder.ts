import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'
import CouncilSession from '#models/council_session'
import SessionMember from '#models/session_member'
import SessionIdea from '#models/session_idea'
import Idea from '#models/idea'
import IdeaCouncilScore from '#models/idea_council_score'
import { calculateWeightedScore } from '#services/council_score_service'

/**
 * Seed 1 phiên hội đồng mẫu: HDYT-2024-01, status OPEN, 5 members, 2 ideas, vài phiếu chấm.
 */
export default class CouncilSessionSeeder extends BaseSeeder {
  async run() {
    const existing = await CouncilSession.findBy('code', 'HDYT-2024-01')
    if (existing) return

    const session = await CouncilSession.create({
      code: 'HDYT-2024-01',
      title: 'Hội đồng chấm ý tưởng đợt 1/2024',
      year: 2024,
      meetingDate: null,
      location: 'Phòng họp A1',
      status: 'OPEN',
      createdById: 2,
      createdByName: 'Phòng Khoa học',
      memberCount: 0,
      ideaCount: 0,
      note: 'Đợt xét duyệt quý 1',
    })

    const members = [
      { memberId: 1, memberName: 'PGS.TS Nguyễn Văn A', roleInCouncil: 'CHU_TICH', unit: 'Khoa CNTT' },
      { memberId: 3, memberName: 'TS. Trần Thị B', roleInCouncil: 'THU_KY', unit: 'Khoa Kinh tế' },
      { memberId: 4, memberName: 'PGS.TS Lê Văn C', roleInCouncil: 'PHAN_BIEN', unit: 'Khoa CNTT' },
      { memberId: 5, memberName: 'TS. Phạm Văn D', roleInCouncil: 'UY_VIEN', unit: 'Khoa Y' },
      { memberId: 6, memberName: 'TS. Hoàng Thị E', roleInCouncil: 'UY_VIEN', unit: 'Khoa Luật' },
    ]
    for (const m of members) {
      await SessionMember.create({
        sessionId: session.id,
        memberId: m.memberId,
        memberName: m.memberName,
        memberEmail: null,
        roleInCouncil: m.roleInCouncil,
        unit: m.unit,
      })
    }
    session.memberCount = members.length
    await session.save()

    const idea3 = await Idea.findBy('code', 'YT-2024-003')
    const idea6 = await Idea.findBy('code', 'YT-2024-006')
    if (idea3) {
      await SessionIdea.create({
        sessionId: session.id,
        ideaId: idea3.id,
        ideaCode: idea3.code,
        ideaTitle: idea3.title,
        ownerName: idea3.ownerName,
        ownerUnit: idea3.ownerUnit,
        field: idea3.field,
        statusSnapshot: idea3.status,
      })
    }
    if (idea6) {
      await SessionIdea.create({
        sessionId: session.id,
        ideaId: idea6.id,
        ideaCode: idea6.code,
        ideaTitle: idea6.title,
        ownerName: idea6.ownerName,
        ownerUnit: idea6.ownerUnit,
        field: idea6.field,
        statusSnapshot: idea6.status,
      })
    }
    session.ideaCount = (await SessionIdea.query().where('session_id', session.id)).length
    await session.save()

    if (idea3) {
      await IdeaCouncilScore.create({
        sessionId: session.id,
        ideaId: idea3.id,
        councilMemberId: 1,
        councilMemberName: 'PGS.TS Nguyễn Văn A',
        councilRole: 'CHU_TICH',
        noveltyScore: 8,
        feasibilityScore: 7,
        alignmentScore: 8,
        authorCapacityScore: 8,
        weightedScore: calculateWeightedScore({ novelty: 8, feasibility: 7, alignment: 8, authorCapacity: 8 }),
        submitted: true,
        submittedAt: DateTime.now(),
      })
      await IdeaCouncilScore.create({
        sessionId: session.id,
        ideaId: idea3.id,
        councilMemberId: 4,
        councilMemberName: 'PGS.TS Lê Văn C',
        councilRole: 'PHAN_BIEN',
        noveltyScore: 7,
        feasibilityScore: 7.5,
        alignmentScore: 7.5,
        authorCapacityScore: 7.5,
        weightedScore: calculateWeightedScore({ novelty: 7, feasibility: 7.5, alignment: 7.5, authorCapacity: 7.5 }),
        submitted: true,
        submittedAt: DateTime.now(),
      })
    }
  }
}
