# STUDIO MOGU POS — iOS 使用與打包成 App 說明

---

## 方式一：當成「網頁 App」使用（推薦，免審核）

不用打包、不用 Mac、不用 Apple 開發者帳號。把網站部署到網路上後，在 **iPhone / iPad 的 Safari** 打開網址，再 **「加入主畫面」**，就會像 App 一樣從主畫面開啟、全螢幕執行。

### 步驟

1. **部署網站**  
   把專案 build 後放到任何可 HTTPS 的空間（例如 Vercel、Netlify、自己的主機）：
   ```bash
   npm run build
   ```
   然後把 `dist` 資料夾裡的檔案上傳到伺服器，並確保網址是 **https**（例如 `https://your-pos.example.com`）。

2. **在 iPhone / iPad 上**  
   - 用 **Safari** 打開你的網址。  
   - 點 Safari 下方的 **分享** 按鈕（方塊加箭頭）。  
   - 選 **「加入主畫面」**。  
   - 名稱可改成「MOGU POS」或你喜歡的，再點 **加入**。

3. **之後使用**  
   主畫面會多一個圖示，點進去就會全螢幕開啟 POS，就像 App 一樣。資料存在該裝置的瀏覽器裡（localStorage）。

### 專案已幫你加好的設定

- `manifest.json`：App 名稱、圖示、主題色、standalone 顯示。
- `index.html`：`apple-mobile-web-app-capable`、`apple-touch-icon`、`manifest` 連結。  
這樣在 iOS 上「加入主畫面」後，圖示與全螢幕表現會比較正常。

---

## 方式二：打包成真正的 iOS App（.ipa / 上架 App Store）

若你要的是「一個可以上架 App Store 或裝成 .ipa 的 iOS App」，就要用 **Capacitor**（或 Cordova）把現有網頁包成原生專案，再用 **Xcode** 建出 .ipa。

### 必要條件

- **Mac**（需用 Xcode 建置 iOS）
- **Xcode**（從 Mac App Store 安裝）
- **Apple Developer 帳號**（上架要付費 $99/年；只在自己裝置安裝可用免費帳號做 ad-hoc）

### 步驟概要

1. **建置網頁**
   ```bash
   npm run build
   ```

2. **安裝 Capacitor 並加入 iOS 平台**
   ```bash
   npm install @capacitor/core @capacitor/cli @capacitor/ios
   npx cap init "STUDIO MOGU POS" com.studiomogu.pos
   npx cap add ios
   ```

3. **設定 Capacitor 的 web 目錄**  
   在 `capacitor.config.ts`（或 `capacitor.config.json`）裡把 `webDir` 指到 `dist`。

4. **把 build 好的檔案同步到 iOS 專案**
   ```bash
   npx cap sync ios
   ```

5. **用 Xcode 打開並建置**
   ```bash
   npx cap open ios
   ```
   在 Xcode 裡選實機或模擬器，按 Run；若要上架再在 Xcode 裡做 Archive 與上傳。

6. **之後每次改網頁**
   ```bash
   npm run build
   npx cap sync ios
   ```
   再在 Xcode 裡 Run 或 Archive。

詳細可查 [Capacitor 官方文件](https://capacitorjs.com/docs/getting-started)。

---

## 建議

- **只想在 iPhone / iPad 上「像 App 一樣用」**：用 **方式一（加入主畫面）** 即可，成本低、維護簡單。  
- **一定要上架 App Store 或需要 .ipa 安裝檔**：用 **方式二（Capacitor + Xcode）**，並預留 Mac 與 Apple 開發者帳號。

目前專案已支援方式一；若你之後要採方式二，可再補上 Capacitor 設定與建置指令。
