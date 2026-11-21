const crypto = require('node:crypto');

// Devuelve null si el formato o el dígito verificador no coinciden.
const normalizarRut = (valor) => {
    if (typeof valor !== 'string') return null;
    const rut = valor.trim().toUpperCase();
    if (!/^(?:\d{7,8}|\d{1,2}\.\d{3}\.\d{3})-[\dK]$/.test(rut)) return null;
    const [numero, dv] = rut.replace(/\./g, '').split('-');
    if (Number(numero) === 0 || numero.startsWith('0')) return null;
    let suma = 0;
    let factor = 2;
    for (const digito of [...numero].reverse()) {
        suma += Number(digito) * factor;
        factor = factor === 7 ? 2 : factor + 1;
    }
    const resto = 11 - suma % 11;
    const esperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
    return dv === esperado ? `${numero}-${dv}` : null;
};

const generarClaveTemporal = () => {
    const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    return Array.from({ length: 10 }, () => alfabeto[crypto.randomInt(alfabeto.length)]).join('');
};

module.exports = { normalizarRut, generarClaveTemporal };
