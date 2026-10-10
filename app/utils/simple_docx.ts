import PizZip from 'pizzip'

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function paragraph(text: string, bold = false) {
  const safe = escapeXml(text || '')
  const rPr = bold ? '<w:rPr><w:b/></w:rPr>' : ''
  return `<w:p><w:r>${rPr}<w:t xml:space="preserve">${safe}</w:t></w:r></w:p>`
}

/**
 * DOCX từ các dòng chữ.
 * Chưa có thư viện PDF; văn bản xuất DOCX.
 */
export function buildSimpleDocx(lines: string[]): Buffer {
  const paras = lines.map((line) => paragraph(line)).join('')
  return zipDocx(paras)
}

/** DOCX có tiêu đề và từng mục in đậm. */
export function buildFormDocx(title: string, blocks: { heading: string; lines: string[] }[]): Buffer {
  const parts = [paragraph(title, true), paragraph('')]
  for (const block of blocks) {
    parts.push(paragraph(block.heading, true))
    for (const line of block.lines) parts.push(paragraph(line))
    parts.push(paragraph(''))
  }
  return zipDocx(parts.join(''))
}

function zipDocx(paras: string): Buffer {

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${paras}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body>
</w:document>`

  const zip = new PizZip()
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  )
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  )
  zip.file('word/document.xml', documentXml)
  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`
  )

  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer
}

