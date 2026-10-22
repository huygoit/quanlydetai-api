import { createReadStream, createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { crc32 } from 'node:zlib'

export type TepNen = { ten: string; duongDan: string }

type MucZip = { ten: string; crc: number; size: number; offset: number }

function viet(ws: NodeJS.WritableStream, buf: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.write(buf, (err) => (err ? reject(err) : resolve()))
  })
}

/** CRC và kích thước, đọc một lượt. */
async function doCrc(duongDan: string): Promise<{ crc: number; size: number }> {
  let crc = 0
  let size = 0
  const rs = createReadStream(duongDan)
  for await (const chunk of rs) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    crc = crc32(buf, crc)
    size += buf.length
  }
  return { crc, size }
}

/**
 * Nén STORE (không nén thêm) để dump lớn không phải nằm trọn trong RAM.
 */
export async function ghiZip(dich: string, tep: TepNen[]): Promise<void> {
  await fs.mkdir(path.dirname(dich), { recursive: true })
  const ws = createWriteStream(dich)
  const mucs: MucZip[] = []
  let offset = 0

  try {
    for (const item of tep) {
      const ten = item.ten.replaceAll('\\', '/')
      const { crc, size } = await doCrc(item.duongDan)
      const nameBuf = Buffer.from(ten, 'utf8')
      const local = Buffer.alloc(30)
      local.writeUInt32LE(0x04034b50, 0)
      local.writeUInt16LE(20, 4)
      local.writeUInt16LE(0, 6)
      local.writeUInt16LE(0, 8)
      local.writeUInt32LE(crc >>> 0, 14)
      local.writeUInt32LE(size, 18)
      local.writeUInt32LE(size, 22)
      local.writeUInt16LE(nameBuf.length, 26)
      await viet(ws, local)
      await viet(ws, nameBuf)
      const rs = createReadStream(item.duongDan)
      for await (const chunk of rs) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        await viet(ws, buf)
      }
      mucs.push({ ten, crc, size, offset })
      offset += 30 + nameBuf.length + size
    }

    const batDauMucLuc = offset
    let kichThuocMucLuc = 0
    for (const muc of mucs) {
      const nameBuf = Buffer.from(muc.ten, 'utf8')
      const central = Buffer.alloc(46)
      central.writeUInt32LE(0x02014b50, 0)
      central.writeUInt16LE(20, 4)
      central.writeUInt16LE(20, 6)
      central.writeUInt16LE(0, 10)
      central.writeUInt32LE(muc.crc >>> 0, 16)
      central.writeUInt32LE(muc.size, 20)
      central.writeUInt32LE(muc.size, 24)
      central.writeUInt16LE(nameBuf.length, 28)
      central.writeUInt32LE(muc.offset, 42)
      await viet(ws, central)
      await viet(ws, nameBuf)
      kichThuocMucLuc += 46 + nameBuf.length
    }

    const eocd = Buffer.alloc(22)
    eocd.writeUInt32LE(0x06054b50, 0)
    eocd.writeUInt16LE(mucs.length, 8)
    eocd.writeUInt16LE(mucs.length, 10)
    eocd.writeUInt32LE(kichThuocMucLuc, 12)
    eocd.writeUInt32LE(batDauMucLuc, 16)
    await viet(ws, eocd)
  } finally {
    await new Promise<void>((resolve, reject) => {
      ws.end(() => resolve())
      ws.on('error', reject)
    })
  }
}

async function doc(fd: fs.FileHandle, viTri: number, soByte: number): Promise<Buffer> {
  const buf = Buffer.alloc(soByte)
  const { bytesRead } = await fd.read(buf, 0, soByte, viTri)
  if (bytesRead !== soByte) throw new Error('File zip bị cắt.')
  return buf
}

/**
 * Giải nén zip STORE do hàm ghiZip tạo. Chặn đường dẫn thoát thư mục.
 */
export async function giaiZip(nguon: string, thuMucDich: string): Promise<void> {
  await fs.mkdir(thuMucDich, { recursive: true })
  const goc = path.resolve(thuMucDich)
  const fd = await fs.open(nguon, 'r')
  try {
    let viTri = 0
    const stat = await fd.stat()
    while (viTri + 30 <= stat.size) {
      const head = await doc(fd, viTri, 4)
      const chuKy = head.readUInt32LE(0)
      if (chuKy === 0x02014b50 || chuKy === 0x06054b50) break
      if (chuKy !== 0x04034b50) throw new Error('File zip không đúng định dạng.')
      const local = await doc(fd, viTri, 30)
      const phuongThuc = local.readUInt16LE(8)
      if (phuongThuc !== 0) {
        throw new Error('Chỉ khôi phục được file zip do chức năng sao lưu tạo ra.')
      }
      const crc = local.readUInt32LE(14)
      const size = local.readUInt32LE(18)
      const tenDai = local.readUInt16LE(26)
      const extra = local.readUInt16LE(28)
      const tenBuf = await doc(fd, viTri + 30, tenDai)
      const ten = tenBuf.toString('utf8')
      const batDauDuLieu = viTri + 30 + tenDai + extra
      if (ten.endsWith('/')) {
        viTri = batDauDuLieu + size
        continue
      }
      const dich = path.resolve(goc, ten)
      if (!dich.startsWith(goc + path.sep) && dich !== goc) {
        throw new Error('File zip chứa đường dẫn không hợp lệ.')
      }
      await fs.mkdir(path.dirname(dich), { recursive: true })
      let crcDoc = 0
      if (size === 0) {
        await fs.writeFile(dich, Buffer.alloc(0))
      } else {
        const ws = createWriteStream(dich)
        const rs = createReadStream(nguon, { start: batDauDuLieu, end: batDauDuLieu + size - 1 })
        await new Promise<void>((resolve, reject) => {
          rs.on('data', (chunk) => {
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
            crcDoc = crc32(buf, crcDoc)
          })
          rs.on('error', reject)
          ws.on('error', reject)
          ws.on('finish', () => resolve())
          rs.pipe(ws)
        })
      }
      if ((crcDoc >>> 0) !== (crc >>> 0)) {
        throw new Error(`File trong zip bị hỏng: ${ten}`)
      }
      viTri = batDauDuLieu + size
    }
  } finally {
    await fd.close()
  }
}
