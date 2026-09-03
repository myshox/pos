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
    script.src = 'https://js.tappaysdk.com/sdk/tpdirect/v5.22.0';
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

export async function setupTapPayFields(onUpdate) {
  const initialized = await initializeTapPay();
  if (!initialized.ready) return initialized;

  window.TPDirect.card.setup({
    fields: {
      number: { element: '#tappay-card-number', placeholder: '**** **** **** ****' },
      expirationDate: { element: '#tappay-card-expiry', placeholder: 'MM / YY' },
      ccv: { element: '#tappay-card-ccv', placeholder: '後三碼' },
    },
    styles: {
      input: { color: '#173f38', 'font-size': '16px' },
      ':focus': { color: '#0f766e' },
      '.valid': { color: '#047857' },
      '.invalid': { color: '#dc2626' },
    },
    isMaskCreditCardNumber: true,
    maskCreditCardNumberRange: { beginIndex: 6, endIndex: 11 },
  });
  window.TPDirect.card.onUpdate(onUpdate);
  return { ready: true };
}

export function getTapPayPrime() {
  return new Promise((resolve, reject) => {
    if (!window.TPDirect?.card) {
      reject(new Error('TapPay 尚未初始化'));
      return;
    }
    window.TPDirect.card.getPrime((result) => {
      if (result.status !== 0 || !result.card?.prime) {
        reject(new Error(result.msg || '信用卡資料驗證失敗'));
        return;
      }
      resolve(result);
    });
  });
}

export async function getTapPayAtmPrime() {
  const initialized = await initializeTapPay();
  if (!initialized.ready || !window.TPDirect?.virtualAccount) {
    throw new Error('TapPay ATM 服務尚未完成初始化');
  }
  return new Promise((resolve, reject) => {
    window.TPDirect.virtualAccount.getPrime((error, result) => {
      if (error || result?.status !== 0 || !result?.prime) {
        reject(new Error(result?.msg || error?.message || '無法建立 ATM 付款資料'));
        return;
      }
      resolve(result.prime);
    });
  });
}

export async function payWithTapPay({ prime, amount, details, cardholder }) {
  const endpoint = window.location.hostname === 'localhost'
    ? '/api/tappay/pay'
    : 'https://pos-6q7.pages.dev/api/tappay/pay';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prime, amount, details, cardholder }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.status !== 0) {
    throw new Error(result.error || result.msg || 'TapPay 付款失敗');
  }
  return result;
}

export async function createTapPayAtmTransfer({ prime, amount, details, cardholder }) {
  const endpoint = window.location.hostname === 'localhost'
    ? '/api/tappay/atm'
    : 'https://pos-6q7.pages.dev/api/tappay/atm';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prime, amount, details, cardholder }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.status !== 0 || !result.payee_info?.vacc_no) {
    throw new Error(result.error || result.msg || 'ATM 虛擬帳號建立失敗');
  }
  return result;
}

export async function getTapPayAfteePrime() {
  const initialized = await initializeTapPay();
  if (!initialized.ready || !window.TPDirect?.aftee) throw new Error('TapPay AFTEE 服務尚未完成初始化');
  return new Promise((resolve, reject) => {
    window.TPDirect.aftee.getPrime((result) => {
      if (result?.status !== 0 || !result?.prime) {
        reject(new Error(result?.msg || '無法建立 AFTEE 付款資料'));
        return;
      }
      resolve(result.prime);
    });
  });
}

export async function createTapPayAfteePayment({ prime, amount, details, cardholder }) {
  const endpoint = window.location.hostname === 'localhost' ? '/api/tappay/aftee' : 'https://pos-6q7.pages.dev/api/tappay/aftee';
  const response = await fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prime, amount, details, cardholder }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.status !== 0 || !result.payment_url) throw new Error(result.error || result.msg || 'AFTEE 付款建立失敗');
  return result;
}

export async function queryTapPayTransaction(recTradeId) {
  const endpoint = window.location.hostname === 'localhost' ? '/api/tappay/query' : 'https://pos-6q7.pages.dev/api/tappay/query';
  const response = await fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recTradeId }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || '交易狀態查詢失敗');
  return result.trade_records?.[0] || null;
}
