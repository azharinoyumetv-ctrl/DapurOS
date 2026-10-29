(() => {
  'use strict';
  if (window.top !== window || location.origin !== 'https://dagangos.com') return;
  const send = (type, payload = {}) => {
    if (navigator.userActivation && !navigator.userActivation.isActive) return;
    window.DapurOSNative.postMessage(JSON.stringify({ type, ...payload }));
  };
  window.DapurOSDevice = Object.freeze({
    offline: true,
    appInfo: window.__dapurosAppInfo ? Object.freeze({ ...window.__dapurosAppInfo }) : null,
    checkForUpdates: () => send('checkForUpdates'),
    scanBarcode: (target = 'pos') => send('scanBarcode', { target }),
    configurePrinter: () => send('configurePrinter'),
    testPrinter: () => send('testPrinter'),
    printReceipt: order => send('printReceipt', { order })
  });
})();
