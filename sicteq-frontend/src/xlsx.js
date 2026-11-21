const encoder = new TextEncoder();

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  const data = typeof bytes === 'string' ? encoder.encode(bytes) : bytes;
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Caracteres de control que XML no admite: se quitan (con ellos Excel no abre el archivo).
// eslint-disable-next-line no-control-regex -- justamente se buscan caracteres de control
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;
const xmlEscape = (value) => String(value)
  .replace(CONTROL, '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const nombreHojaSeguro = (hoja) => {
  let nombre = String(hoja ?? 'Datos')
    .replace(CONTROL, '')
    .replace(/[[\]:*?/\\]/g, '_')
    .slice(0, 31);
  return nombre || 'Datos';
};

const letraColumna = (indice) => {
  let n = indice + 1;
  let letra = '';
  while (n > 0) {
    n--;
    letra = String.fromCharCode(65 + (n % 26)) + letra;
    n = Math.floor(n / 26);
  }
  return letra;
};

const concatBytes = (arrays) => {
  const total = arrays.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of arrays) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

const setUint16 = (view, offset, value) => view.setUint16(offset, value, true);
const setUint32 = (view, offset, value) => view.setUint32(offset, value >>> 0, true);

const zipStore = (files) => {
  const parts = [];
  const central = [];
  let offset = 0;
  const dosTime = 0;
  const dosDate = 33; // 1980-01-01

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = typeof file.data === 'string' ? encoder.encode(file.data) : file.data;
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    setUint32(lv, 0, 0x04034b50);
    setUint16(lv, 4, 20);
    setUint16(lv, 6, 0x0800);
    setUint16(lv, 8, 0);
    setUint16(lv, 10, dosTime);
    setUint16(lv, 12, dosDate);
    setUint32(lv, 14, crc);
    setUint32(lv, 18, data.length);
    setUint32(lv, 22, data.length);
    setUint16(lv, 26, name.length);
    setUint16(lv, 28, 0);
    local.set(name, 30);
    parts.push(local, data);

    const entry = new Uint8Array(46 + name.length);
    const cv = new DataView(entry.buffer);
    setUint32(cv, 0, 0x02014b50);
    setUint16(cv, 4, 20);
    setUint16(cv, 6, 20);
    setUint16(cv, 8, 0x0800);
    setUint16(cv, 10, 0);
    setUint16(cv, 12, dosTime);
    setUint16(cv, 14, dosDate);
    setUint32(cv, 16, crc);
    setUint32(cv, 20, data.length);
    setUint32(cv, 24, data.length);
    setUint16(cv, 28, name.length);
    setUint16(cv, 30, 0);
    setUint16(cv, 32, 0);
    setUint16(cv, 34, 0);
    setUint16(cv, 36, 0);
    setUint32(cv, 38, 0);
    setUint32(cv, 42, offset);
    entry.set(name, 46);
    central.push(entry);
    offset += local.length + data.length;
  }

  const centralData = concatBytes(central);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  setUint32(ev, 0, 0x06054b50);
  setUint16(ev, 4, 0);
  setUint16(ev, 6, 0);
  setUint16(ev, 8, files.length);
  setUint16(ev, 10, files.length);
  setUint32(ev, 12, centralData.length);
  setUint32(ev, 16, offset);
  setUint16(ev, 20, 0);
  return concatBytes([...parts, centralData, end]);
};

export function xlsxBytes(filas, columnas, hoja = 'Datos') {
  const rows = Array.isArray(filas) ? filas : [];
  const cols = Array.isArray(columnas) ? columnas : [];
  const sheetName = nombreHojaSeguro(hoja);

  const widths = cols.map((col) => {
    let longest = String(col.label ?? '').length;
    for (const row of rows) {
      const value = row?.[col.key];
      if (value !== null && value !== undefined) longest = Math.max(longest, String(value).length);
    }
    return Math.max(8, Math.min(60, longest + 2));
  });

  const sheetRows = [];
  if (cols.length) {
    const headers = cols.map((col, index) =>
      `<c r="${letraColumna(index)}1" t="inlineStr" s="1"><is><t xml:space="preserve">${xmlEscape(col.label ?? '')}</t></is></c>`
    ).join('');
    sheetRows.push(`<row r="1">${headers}</row>`);

    rows.forEach((row, rowIndex) => {
      const r = rowIndex + 2;
      const cells = cols.map((col, index) => {
        const ref = `${letraColumna(index)}${r}`;
        const value = row?.[col.key];
        if (value === null || value === undefined) return `<c r="${ref}"/>`;
        if (typeof value === 'number' && Number.isFinite(value)) {
          return `<c r="${ref}" t="n"><v>${value}</v></c>`;
        }
        return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(String(value))}</t></is></c>`;
      }).join('');
      sheetRows.push(`<row r="${r}">${cells}</row>`);
    });
  }

  const colXml = cols.map((_, index) =>
    `<col min="${index + 1}" max="${index + 1}" width="${widths[index]}" customWidth="1"/>`
  ).join('');
  const lastCol = cols.length ? letraColumna(cols.length - 1) : 'A';
  const autoFilter = cols.length ? `<autoFilter ref="A1:${lastCol}1"/>` : '';
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
    + `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    + `<cols>${colXml}</cols>`
    + `<sheetData>${sheetRows.join('')}</sheetData>`
    + `${autoFilter}`
    + `<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>`
    + `</worksheet>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  // Excel espera el rango del autofiltro también como nombre definido; sin él, algunas versiones piden "reparar" el archivo.
  const filtroDefinido = cols.length ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${xmlEscape(sheetName.replace(/'/g, "''"))}'!$A$1:$${lastCol}$1</definedName></definedNames>` : '';
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/></sheets>${filtroDefinido}</workbook>`;
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

  return zipStore([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rootRels },
    { name: 'xl/workbook.xml', data: workbook },
    { name: 'xl/_rels/workbook.xml.rels', data: workbookRels },
    { name: 'xl/styles.xml', data: styles },
    { name: 'xl/worksheets/sheet1.xml', data: sheetXml },
  ]);
}

export function descargarXlsx(nombreArchivo, filas, columnas) {
  const bytes = xlsxBytes(filas, columnas);
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nombreArchivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
