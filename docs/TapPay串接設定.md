# TapPay 串接設定

目前已完成 SDK 載入器、付款頁揭露、購物車入口與 Vercel 後端請款端點骨架。未設定金鑰時，介面會標示「待設定」，不會送出真實交易。

## 正式啟用時設定

前端環境變數：

- `VITE_TAPPAY_APP_ID`
- `VITE_TAPPAY_APP_KEY`
- `VITE_TAPPAY_SERVER_TYPE=sandbox` 或 `production`
- `VITE_TAPPAY_CHECKOUT_ENABLED=false`（完整 prime 與後端成功流程完成前不可改為 `true`）

伺服器端環境變數：

- `TAPPAY_PARTNER_KEY`
- `TAPPAY_MERCHANT_ID`
- `TAPPAY_SERVER_TYPE=sandbox` 或 `production`

`TAPPAY_PARTNER_KEY` 絕對不可使用 `VITE_` 前綴或提交至 Git。

## 下一階段

取得商店資料後，需在 TapPay 後台確認網域、建立 TPDirect 卡片欄位、取得 prime，送至 `/api/tappay/pay`，並以後端回覆成功狀態後才建立正式訂單。
