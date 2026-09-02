export const tappayConfig = {
  appId: import.meta.env.VITE_TAPPAY_APP_ID || '',
  appKey: import.meta.env.VITE_TAPPAY_APP_KEY || '',
  serverType: import.meta.env.VITE_TAPPAY_SERVER_TYPE || 'sandbox',
};

export const isTapPayConfigured = Boolean(tappayConfig.appId && tappayConfig.appKey);
export const isTapPayCheckoutReady = isTapPayConfigured && import.meta.env.VITE_TAPPAY_CHECKOUT_ENABLED === 'true';

export function loadTapPaySdk() {
  if (window.TPDirect) return Promise.resolve(window.TPDirect);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-tappay-sdk]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.TPDirect), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://js.tappaysdk.com/sdk/tpdirect/v5.14.0';
    script.async = true;
    script.dataset.tappaySdk = 'true';
    script.onload = () => resolve(window.TPDirect);
    script.onerror = () => reject(new Error('TapPay SDK 載入失敗'));
    document.head.appendChild(script);
  });
}

export async function initializeTapPay() {
  if (!isTapPayConfigured) return { ready: false, reason: 'missing-config' };
  const TPDirect = await loadTapPaySdk();
  TPDirect.setupSDK(
    Number(tappayConfig.appId),
    tappayConfig.appKey,
    tappayConfig.serverType === 'production' ? 'production' : 'sandbox',
  );
  return { ready: true };
}
