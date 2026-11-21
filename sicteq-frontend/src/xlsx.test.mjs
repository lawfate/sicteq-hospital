import assert from 'node:assert';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { crc32, xlsxBytes } from './xlsx.js';

export { crc32 };

const filas = [
  { numero: 42, nombre: 'José Ñandú', dato: 'Chile & <Hospital>' },
  { numero: 3.5, nombre: null, dato: '=1+1' },
];
const columnas = [
  { key: 'numero', label: 'Número' },
  { key: 'nombre', label: 'Nombre' },
  { key: 'dato', label: 'Dato' },
];

const bytes = xlsxBytes(filas, columnas, 'Datos');
const ruta = join(tmpdir(), 'prueba_sicteq.xlsx');
writeFileSync(ruta, bytes);

assert.deepStrictEqual(Array.from(bytes.subarray(0, 4)), [0x50, 0x4b, 0x03, 0x04]);
assert.strictEqual(crc32('123456789'), 0xcbf43926);

console.log(ruta);
