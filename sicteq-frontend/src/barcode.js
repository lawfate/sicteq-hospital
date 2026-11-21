// PB-06: código de barras Code 39 en SVG, sin dependencias. Code 39 lo leen
// todos los lectores USB por defecto y cubre el formato CAJA-0045 (A-Z, 0-9, '-').
// Cada carácter = 9 elementos alternando barra/espacio; '1' = ancho, '0' = angosto.
const PATRONES = {
  '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000', '4': '000110001',
  '5': '100110000', '6': '001110000', '7': '000100101', '8': '100100100', '9': '001100100',
  'A': '100001001', 'B': '001001001', 'C': '101001000', 'D': '000011001', 'E': '100011000',
  'F': '001011000', 'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
  'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011', 'O': '100010010',
  'P': '001010010', 'Q': '000000111', 'R': '100000110', 'S': '001000110', 'T': '000010110',
  'U': '110000001', 'V': '011000001', 'W': '111000000', 'X': '010010001', 'Y': '110010000',
  'Z': '011010000', '-': '010000101', '.': '110000100', ' ': '011000100', '*': '010010100',
};

// Devuelve los anchos de cada elemento (en módulos), empezando por barra.
export function code39Anchos(texto, ancho = 3) {
  const t = `*${String(texto).toUpperCase()}*`;
  const anchos = [];
  [...t].forEach((c, i) => {
    const p = PATRONES[c];
    if (!p || (c === '*' && i !== 0 && i !== t.length - 1)) throw new Error(`Carácter no válido para Code 39: "${c}"`);
    for (const b of p) anchos.push(b === '1' ? ancho : 1);
    if (i < t.length - 1) anchos.push(1); // espacio entre caracteres
  });
  return anchos;
}

export function code39Svg(texto, { alto = 60, modulo = 2 } = {}) {
  const anchos = code39Anchos(texto);
  const margen = 10 * modulo; // zona de silencio exigida por la norma
  let x = margen;
  const barras = [];
  anchos.forEach((w, i) => {
    if (i % 2 === 0) barras.push(`<rect x="${x}" y="0" width="${w * modulo}" height="${alto}"/>`);
    x += w * modulo;
  });
  const total = x + margen;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${alto}" width="100%" height="${alto}" preserveAspectRatio="none" role="img" aria-label="Código de barras ${texto}"><rect width="${total}" height="${alto}" fill="#fff"/><g fill="#000">${barras.join('')}</g></svg>`;
}
