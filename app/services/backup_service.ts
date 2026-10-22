import app from '@adonisjs/core/services/app'
import env from '#start/env'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'
import { DateTime } from 'luxon'
import { resolveWritableUploadRoot } from '#utils/upload_storage_helper'
import { giaiZip, ghiZip, type TepNen } from '#utils/zip_luu_tru'
import { batKhoaKhoiPhuc, moKhoaKhoiPhuc } from '#services/backup_lock'

export class LoiSaoLuu extends Error {}

const MAU_TEN = /^[A-Za-z0-9._-]+\.zip$/

export type BanSao = {
  name: string
  size: number
  createdAt: string
}

function thongTinDb() {
  return {
    host: env.get('DB_HOST'),
    port: String(env.get('DB_PORT')),
    user: env.get('DB_USER'),
    password: env.get('DB_PASSWORD') || '',
    database: env.get('DB_DATABASE'),
  }
}

async function thuMucBanSao(): Promise<string> {
  const goc = await resolveWritableUploadRoot()
  const dir = path.join(goc, 'backups')
  await fs.mkdir(dir, { recursive: true })
  return dir
}

function tenAnToan(ten: string): string {
  const base = path.basename(ten)
  if (base !== ten || !MAU_TEN.test(base)) {
    throw new LoiSaoLuu('Tên file không hợp lệ.')
  }
  return base
}

async function duongDanBanSao(ten: string): Promise<string> {
  const anToan = tenAnToan(ten)
  const dir = await thuMucBanSao()
  const dayDu = path.join(dir, anToan)
  try {
    await fs.access(dayDu)
  } catch {
    throw new LoiSaoLuu('Không tìm thấy file sao lưu.')
  }
  return dayDu
}

function chayLenh(bin: string, args: string[], themEnv: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      env: { ...process.env, ...themEnv },
      windowsHide: true,
    })
    let loi = ''
    child.stderr.on('data', (buf) => {
      loi += buf.toString()
      if (loi.length > 4000) loi = loi.slice(-4000)
    })
    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') reject(new LoiSaoLuu(`Không tìm thấy lệnh ${bin}.`))
      else reject(err)
    })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new LoiSaoLuu(loi.trim() || `Lệnh ${bin} thoát mã ${code}.`))
    })
  })
}

async function lietKeTep(goc: string, boQuaThuMucGoc: Set<string>): Promise<string[]> {
  const ketQua: string[] = []
  async function di(dir: string, laGoc: boolean) {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (laGoc && boQuaThuMucGoc.has(entry.name)) continue
      const dayDu = path.join(dir, entry.name)
      if (entry.isDirectory()) await di(dayDu, false)
      else if (entry.isFile()) ketQua.push(dayDu)
    }
  }
  await di(goc, true)
  return ketQua
}

async function thayThuMuc(nguon: string, dich: string, giuLai: string[]) {
  try {
    await fs.access(nguon)
  } catch {
    return
  }
  await fs.mkdir(dich, { recursive: true })
  const giu = new Set(giuLai)
  const hienCo = await fs.readdir(dich)
  for (const ten of hienCo) {
    if (giu.has(ten)) continue
    await fs.rm(path.join(dich, ten), { recursive: true, force: true })
  }
  const moi = await fs.readdir(nguon)
  for (const ten of moi) {
    await fs.cp(path.join(nguon, ten), path.join(dich, ten), { recursive: true, force: true })
  }
}

/** Danh sách file zip trong thư mục sao lưu. */
export default class BackupService {
  static tenDatabase(): string {
    return thongTinDb().database
  }

  static async danhSach(): Promise<BanSao[]> {
    const dir = await thuMucBanSao()
    const ten = await fs.readdir(dir)
    const rows: BanSao[] = []
    for (const name of ten) {
      if (!name.endsWith('.zip')) continue
      const st = await fs.stat(path.join(dir, name))
      if (!st.isFile()) continue
      rows.push({
        name,
        size: st.size,
        createdAt: DateTime.fromMillis(st.mtimeMs).toISO() || '',
      })
    }
    rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    return rows
  }

  static async tao(): Promise<BanSao> {
    const db = thongTinDb()
    const dir = await thuMucBanSao()
    const nhan = DateTime.now().toFormat('yyyy-MM-dd-HHmmss')
    const tenZip = `backup-${nhan}.zip`
    const dump = path.join(dir, `tmp-${nhan}.dump`)
    const zip = path.join(dir, tenZip)
    const bin = env.get('PG_DUMP_BIN') || 'pg_dump'
    try {
      await chayLenh(
        bin,
        ['-Fc', '-h', db.host, '-p', db.port, '-U', db.user, '-d', db.database, '-f', dump],
        { PGPASSWORD: db.password }
      )
      const storageGoc = await resolveWritableUploadRoot()
      const uploadsGoc = app.makePath('public', 'uploads')
      const tep: TepNen[] = [{ ten: 'database.dump', duongDan: dump }]
      for (const file of await lietKeTep(storageGoc, new Set(['backups']))) {
        const tuongDoi = path.relative(storageGoc, file).replaceAll('\\', '/')
        tep.push({ ten: `files/storage/${tuongDoi}`, duongDan: file })
      }
      for (const file of await lietKeTep(uploadsGoc, new Set())) {
        const tuongDoi = path.relative(uploadsGoc, file).replaceAll('\\', '/')
        tep.push({ ten: `files/public-uploads/${tuongDoi}`, duongDan: file })
      }
      await ghiZip(zip, tep)
    } catch (err) {
      await fs.rm(zip, { force: true }).catch(() => {})
      if (err instanceof LoiSaoLuu) throw err
      throw new LoiSaoLuu((err as Error).message || 'Tạo bản sao thất bại.')
    } finally {
      await fs.rm(dump, { force: true }).catch(() => {})
    }
    const st = await fs.stat(zip)
    return {
      name: tenZip,
      size: st.size,
      createdAt: DateTime.fromMillis(st.mtimeMs).toISO() || '',
    }
  }

  static async duongDanTai(ten: string): Promise<string> {
    return duongDanBanSao(ten)
  }

  static async xoa(ten: string): Promise<void> {
    const dayDu = await duongDanBanSao(ten)
    await fs.rm(dayDu, { force: true })
  }

  /** Lưu file zip người dùng tải lên vào thư mục sao lưu. */
  static async nhanFile(tmpPath: string, tenGoc: string): Promise<BanSao> {
    const ten = tenAnToan(tenGoc)
    const dir = await thuMucBanSao()
    const dich = path.join(dir, ten)
    await fs.copyFile(tmpPath, dich)
    const st = await fs.stat(dich)
    return {
      name: ten,
      size: st.size,
      createdAt: DateTime.fromMillis(st.mtimeMs).toISO() || '',
    }
  }

  /**
   * Ghi đè database và thư mục file theo bản sao.
   * confirmName phải trùng tên file đang chọn.
   */
  static async khoiPhuc(ten: string, confirmName: string): Promise<void> {
    if (ten !== confirmName) {
      throw new LoiSaoLuu('Tên xác nhận không khớp file đang chọn.')
    }
    const zip = await duongDanBanSao(ten)
    if (!batKhoaKhoiPhuc()) {
      throw new LoiSaoLuu('Đang có một lần khôi phục khác.')
    }
    const tam = path.join(path.dirname(zip), `restore-${Date.now()}`)
    const db = thongTinDb()
    try {
      await giaiZip(zip, tam)
      const dump = path.join(tam, 'database.dump')
      try {
        await fs.access(dump)
      } catch {
        throw new LoiSaoLuu('Bản sao không có file database.')
      }
      const client = new pg.Client({
        host: db.host,
        port: Number(db.port),
        user: db.user,
        password: db.password,
        database: db.database,
      })
      await client.connect()
      try {
        await client.query(
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
          [db.database]
        )
      } finally {
        await client.end()
      }
      const bin = env.get('PG_RESTORE_BIN') || 'pg_restore'
      await chayLenh(
        bin,
        [
          '--clean',
          '--if-exists',
          '--no-owner',
          '--no-acl',
          '-h',
          db.host,
          '-p',
          db.port,
          '-U',
          db.user,
          '-d',
          db.database,
          dump,
        ],
        { PGPASSWORD: db.password }
      )
      const storageGoc = await resolveWritableUploadRoot()
      await thayThuMuc(path.join(tam, 'files', 'storage'), storageGoc, ['backups'])
      await thayThuMuc(path.join(tam, 'files', 'public-uploads'), app.makePath('public', 'uploads'), [])
    } finally {
      moKhoaKhoiPhuc()
      await fs.rm(tam, { recursive: true, force: true }).catch(() => {})
    }
  }
}
