const assert = require('node:assert/strict');
const { normalizarRut, generarClaveTemporal } = require('../src/utils/usuarios');

assert.equal(normalizarRut('12.345.678-5'), '12345678-5');
assert.equal(normalizarRut('12345678-5'), '12345678-5');
assert.equal(normalizarRut('6.000.000-k'), '6000000-K');
assert.equal(normalizarRut('6000000-K'), '6000000-K');
assert.equal(normalizarRut('11111111-1'), '11111111-1');
for (const rut of [null, 123456785, '', '12345678-4', '12.34.5678-5', '123456785', '00000000-0', '12345678-X']) {
    assert.equal(normalizarRut(rut), null);
}
for (let i = 0; i < 1000; i++) {
    const clave = generarClaveTemporal();
    assert.equal(clave.length, 10);
    assert.match(clave, /^[A-Za-z2-9]+$/);
    assert.doesNotMatch(clave, /[0O1lI]/);
}
console.log('OK: RUT válidos e inválidos y 1000 claves temporales.');
