import { test } from '@japa/runner'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { giaiZip, ghiZip } from '#utils/zip_luu_tru'

test.group('Zip sao lưu', () => {
  test('ghi rồi giải ra đúng nội dung', async ({ assert }) => {
    const goc = await fs.mkdtemp(path.join(os.tmpdir(), 'zip-sao-luu-'))
    const nguon = path.join(goc, 'nguon')
    const dich = path.join(goc, 'dich')
    const zip = path.join(goc, 'backup-test.zip')
    await fs.mkdir(path.join(nguon, 'files', 'storage'), { recursive: true })
    await fs.writeFile(path.join(nguon, 'database.dump'), 'dump-noi-dung')
    await fs.writeFile(path.join(nguon, 'files', 'storage', 'a.txt'), 'tep-a')
    await ghiZip(zip, [
      { ten: 'database.dump', duongDan: path.join(nguon, 'database.dump') },
      { ten: 'files/storage/a.txt', duongDan: path.join(nguon, 'files', 'storage', 'a.txt') },
    ])
    await giaiZip(zip, dich)
    assert.equal(await fs.readFile(path.join(dich, 'database.dump'), 'utf8'), 'dump-noi-dung')
    assert.equal(await fs.readFile(path.join(dich, 'files', 'storage', 'a.txt'), 'utf8'), 'tep-a')
    await fs.rm(goc, { recursive: true, force: true })
  })
})
