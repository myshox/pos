# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

市集、展會與工作室現場的收銀人員，主要使用手機或平板快速選品、結帳及查看營運資料。

## Product Purpose

Studio Mogu 的輕量 POS，集中處理商品、購物車、付款方式、訂單、庫存與營運報表。

## Operating Context

現場可能網路不穩，操作需要適合觸控、快速掃讀，且不得因介面改版遺失既有收銀與後台流程。

## Capabilities and Constraints

- React/Vite 網站，並透過 Capacitor 包裝 Android 與 iOS。
- 支援多語系、Supabase 同步與離線待同步狀態。
- TapPay 先建立可設定的安全骨架；正式交易憑證必須留在伺服器環境變數。

## Brand Commitments

蘑菇宇宙工作室（Studio Mogu）；專業、直覺、帶可愛感。付款頁必須揭露 TapPay 喬睿科技金流服務並使用提供的官方 Logo。

## Evidence on Hand

- 現有商品、參展照片與網站內容。
- TapPay 官方橫式 Logo：`public/tappay-logo.png`。
- 公司資料：蘑菇宇宙工作室，統一編號 95148616，公司信箱 `mogu5486047@gmail.com`。

## Product Principles

- 現場結帳優先，主要操作在數秒內可完成。
- 重要金額、狀態與下一步必須一眼可辨。
- 保留完整功能與資料行為，視覺改版不可造成流程消失。
- 金流設定採安全預設，未配置時不送出真實交易。
