import { checkoutReturn, checkoutAuthLink } from './checkoutReturn';

test('login and registration preserve a validated package and billing period', () => {
  const next = '/dapuros/pricing?period=yearly&plan=business&checkout=1';
  window.history.replaceState(null, '', `/dapuros/login?next=${encodeURIComponent(next)}`);
  expect(checkoutReturn('dapuros')).toBe(next);
  expect(checkoutAuthLink('dapuros', 'register')).toBe(`/dapuros/register?next=${encodeURIComponent(next)}`);
});

test.each([
  'https://evil.test/dapuros/pricing?period=yearly&plan=business&checkout=1',
  '//evil.test/dapuros/pricing?period=yearly&plan=business&checkout=1',
  '/dapuros/pricing?period=weekly&plan=business&checkout=1',
  '/dapuros/pricing?period=yearly&plan=free&checkout=1',
  '/geraina/pricing?period=yearly&plan=business&checkout=1',
])('rejects an invalid checkout return path: %s', next => {
  window.history.replaceState(null, '', `/dapuros/login?next=${encodeURIComponent(next)}`);
  expect(checkoutReturn('dapuros')).toBeNull();
  expect(checkoutAuthLink('dapuros', 'register')).toBe('/dapuros/register');
});
