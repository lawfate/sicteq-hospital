// Acepta enteros JSON o enviados como texto, sin coerciones de booleanos.
const entero = (valor, minimo = 1, maximo = 2147483647) => {
    if (!['string', 'number'].includes(typeof valor) || !/^\d+$/.test(String(valor))) return null;
    const numero = Number(valor);
    return Number.isSafeInteger(numero) && numero >= minimo && numero <= maximo ? numero : null;
};

module.exports = { entero };
