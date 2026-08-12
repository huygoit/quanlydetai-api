import Staff from '#models/staff'
import StaffPosition from '#models/staff_position'
import {
  parseStaffPositionIds,
  serializeStaffPositionIds,
} from '#utils/staff_position_ids'

function chuanHoaTen(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase()
}

/** Tách chuỗi tên (phẩy / chấm phẩy) */
function tachTen(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export type StaffPositionIdsMigrateReport = {
  applied: boolean
  staffTotal: number
  staffUpdated: number
  positionMapped: number
  partyMapped: number
  unmappedNames: string[]
}

/**
 * Chuyển position_title / party_position từ tên (hoặc text) sang chuỗi ID.
 * Gộp concurrent_position + highest_position vào position_title.
 */
export default class StaffPositionIdsMigrateService {
  static async run(apply = false): Promise<StaffPositionIdsMigrateReport> {
    const positions = await StaffPosition.query().where('kind', 'POSITION').where('status', 'ACTIVE')
    const parties = await StaffPosition.query().where('kind', 'PARTY').where('status', 'ACTIVE')

    const nameToPositionId = new Map<string, number>()
    for (const p of positions) {
      nameToPositionId.set(chuanHoaTen(p.name), p.id)
    }
    const nameToPartyId = new Map<string, number>()
    for (const p of parties) {
      nameToPartyId.set(chuanHoaTen(p.name), p.id)
    }

    const unmapped = new Set<string>()
    let positionMapped = 0
    let partyMapped = 0
    let staffUpdated = 0

    const staffs = await Staff.query().orderBy('id', 'asc')
    for (const staff of staffs) {
      const posIds = new Set<number>()
      const partyIds = new Set<number>()

      const addPositionNames = (names: string[]) => {
        for (const n of names) {
          const id = nameToPositionId.get(chuanHoaTen(n))
          if (id) {
            posIds.add(id)
            positionMapped += 1
          } else if (n) unmapped.add(n)
        }
      }
      const addPartyNames = (names: string[]) => {
        for (const n of names) {
          const id = nameToPartyId.get(chuanHoaTen(n))
          if (id) {
            partyIds.add(id)
            partyMapped += 1
          } else if (n) unmapped.add(n)
        }
      }

      const rawPos = staff.positionTitle
      if (rawPos && /^\d+(,\d+)*$/.test(rawPos.trim())) {
        parseStaffPositionIds(rawPos).forEach((id) => posIds.add(id))
      } else {
        addPositionNames(tachTen(rawPos))
      }
      addPositionNames(tachTen(staff.concurrentPosition))
      addPositionNames(tachTen(staff.highestPosition))

      const rawParty = staff.partyPosition
      if (rawParty && /^\d+(,\d+)*$/.test(rawParty.trim())) {
        parseStaffPositionIds(rawParty).forEach((id) => partyIds.add(id))
      } else {
        addPartyNames(tachTen(rawParty))
      }

      const nextPos = serializeStaffPositionIds([...posIds])
      const nextParty = serializeStaffPositionIds([...partyIds])

      const changed =
        (staff.positionTitle || null) !== nextPos ||
        (staff.partyPosition || null) !== nextParty ||
        staff.concurrentPosition != null ||
        staff.highestPosition != null

      if (changed && apply) {
        staff.positionTitle = nextPos
        staff.partyPosition = nextParty
        staff.concurrentPosition = null
        staff.highestPosition = null
        await staff.save()
        staffUpdated += 1
      } else if (changed) {
        staffUpdated += 1
      }
    }

    return {
      applied: apply,
      staffTotal: staffs.length,
      staffUpdated,
      positionMapped,
      partyMapped,
      unmappedNames: [...unmapped].sort().slice(0, 200),
    }
  }
}
