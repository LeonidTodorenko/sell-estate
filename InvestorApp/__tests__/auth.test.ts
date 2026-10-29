import {parseJwt, getRoleFromUserAndToken} from '../src/services/auth';
import {Buffer} from 'buffer';
const jwt = (value: object) => 'header.' + Buffer.from(JSON.stringify(value), 'utf8').toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_') + '.signature';
test('JWT decoding preserves UTF-8 and URL-safe base64 without global Buffer', () => {
  const previous = Reflect.get(globalThis, 'Buffer');
  try {
    // Simulate Hermes, which does not provide Node's global Buffer.
    Reflect.deleteProperty(globalThis, 'Buffer');
    expect(parseJwt(jwt({name: 'Леонид', role: 'Admin'}))).toEqual({name: 'Леонид', role: 'Admin'});
    expect(getRoleFromUserAndToken(undefined, jwt({role: 'Admin'}))).toBe('admin');
  } finally {
    Object.defineProperty(globalThis, 'Buffer', {value: previous, configurable: true, writable: true});
  }
});
test('malformed or absent JWT remains null', () => {
  expect(parseJwt(null)).toBeNull();
  expect(parseJwt('broken')).toBeNull();
  expect(parseJwt('h.invalid.s')).toBeNull();
});
