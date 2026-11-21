// Una celda que empieza con = + @ (o - seguido de texto) Excel la ejecuta como
// fórmula al abrir el CSV (inyección CSV, OWASP). Se antepone ' para que quede
// como texto; los números negativos ("-3") se dejan tal cual.
const neutralizar = (s) => (/^[=+@\t\r]|^-(?!\d)/.test(s) ? `'${s}` : s);

export const toCSV = (rows, columns) => {
  const header = columns.map(c => `"${c.label}"`).join(',');
  const lines = rows.map(row =>
    columns.map(c => {
      const v = row[c.key];
      const s = v === null || v === undefined ? '' : neutralizar(String(v));
      return `"${s.replace(/"/g, '""')}"`;
    }).join(',')
  );
  return [header, ...lines].join('\n');
};
