# 自己用的 iOS / Android APP 建置說明（不上架）

專案已用 **Capacitor** 接好，可以建出**只裝在自己裝置**的 App，不用上架商店。

---

## 沒有 Mac，想在 iPhone 用怎麼辦？

**不用 Mac 也能在 iPhone 上「像 App 一樣」使用。**

### 做法：用 Safari「加入主畫面」（推薦）

1. 把網站部署到 **HTTPS 網址**（例如 Vercel、Netlify，或自己的主機）：
   ```bash
   npm run build
   ```
   再把 `dist` 資料夾裡的檔案上傳到伺服器。

2. 在 **iPhone 上用 Safari** 打開你的網址（例如 `https://your-pos.example.com`）。

3. 點 Safari 下方的 **分享** 按鈕（□↑）→ 選 **「加入主畫面」**。

4. 名稱可改成「MOGU POS」→ 點 **加入**。

之後主畫面會多一個圖示，點進去會**全螢幕**開啟，用法和 App 幾乎一樣。專案已設定好 `manifest` 與 Apple 相關 meta，加入主畫面後圖示與全螢幕都會正常。

- **優點**：不用 Mac、不用 Xcode、不用 Apple 開發者帳號，部署好網址就能用。
- **注意**：資料存在該 iPhone 的 Safari 裡（localStorage），和用電腦開的網站是分開的。

### 若一定要「真正的 .ipa 檔」、又沒有 Mac

- **借／用一台 Mac**：朋友、公司、圖書館、或二手 Mac mini。
- **雲端 Mac**：租用雲端 Mac 來跑 Xcode 建置（例如 [MacStadium](https://www.macstadium.com/)、[Codemagic](https://codemagic.io/) 等），再下載建好的 .ipa。需要付費且要會操作建置流程。

對多數「自己用」的情境，**加入主畫面**就夠用了。

---

## 一、Android（可在 Windows 建置）

### 1. 建置網頁並同步到 Android

```bash
npm run cap:sync
```

或分開做：

```bash
npm run build
npx cap sync
```

### 2. 用 Android Studio 建 APK

1. 安裝 [Android Studio](https://developer.android.com/studio)。
2. 在專案目錄執行：
   ```bash
   npx cap open android
   ```
3. Android Studio 開啟後：
   - 選單 **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**。
   - 建好後會提示 APK 路徑，通常在  
     `android/app/build/outputs/apk/debug/app-debug.apk`。
4. 把 `app-debug.apk` 傳到手機後安裝（需允許「未知來源」安裝）。

若要 **Release 版**（較小、較快）：**Build** → **Generate Signed Bundle / APK**，依精靈建立金鑰並建出 APK。

### 3. 或一條指令開 Android 專案（會先 build + sync）

```bash
npm run cap:android
```

---

## 二、iOS（需要 Mac）— 含產出 .ipa 安裝檔

要有 **.ipa 安裝檔**，必須在 **Mac** 上用 **Xcode** 建置。若你沒有 Mac，可借一台或使用雲端 Mac 服務（見下方）。

### 1. 在 Mac 上建置網頁並同步到 iOS

```bash
cd 專案目錄
npm install
npm run cap:sync
```

（若專案在 Windows 開發，把整個專案資料夾複製到 Mac 再執行以上指令。）

### 2. 安裝 CocoaPods（若尚未安裝）

```bash
sudo gem install cocoapods
```

在專案目錄執行：

```bash
cd ios/App && pod install && cd ../..
```

### 3. 用 Xcode 產出 .ipa 安裝檔

1. 執行：
   ```bash
   npx cap open ios
   ```
2. 在 Xcode 左側選 **App** 專案（藍色圖示）→ 上方選 **Any iOS Device (arm64)**，不要選模擬器。
3. 選單 **Product** → **Archive**。  
   （若 Archive 是灰的，先選 **Any iOS Device** 或接上實機再試。）
4. Archive 完成後會跳出 **Organizer** 視窗。在列表中選剛建好的 Archive，點右側 **Distribute App**。
5. 選 **Ad Hoc**（只裝在自己或指定裝置，不上架）→ **Next**。
6. 選 **Automatically manage signing**，Team 選你的 **Apple ID**（免費即可）→ **Next**。
7. 若要裝在實機，需先**註冊裝置**：在 Xcode 選單 **Window** → **Devices and Simulators**，接上 iPhone，確認裝置已出現。Ad Hoc 匯出時可勾選「Export for specific devices」並選你的裝置。
8. 選好後 **Next** → 選儲存位置 → **Export**，會得到一個資料夾，裡面有 **.ipa** 檔。

### 4. 把 .ipa 裝到 iPhone

**方式 A：用 Xcode 直接裝（最簡單）**  
- 傳輸線接上 iPhone，在 Xcode 左上角選你的裝置，按 **Run**（▶），App 會直接裝到手機。  
- 這種方式不會單獨產生 .ipa 檔，但裝機最快。

**方式 B：已有 .ipa 檔時**  
- **Apple Configurator 2**（Mac App Store 免費）：接上 iPhone，把 .ipa 拖進裝置即可安裝。  
- 或使用 **AltStore**（[altstore.io](https://altstore.io)）：在電腦安裝 AltServer，iPhone 裝 AltStore，再透過 AltStore 安裝 .ipa（需同一個 Wi‑Fi）。  
- 用免費 Apple ID 簽的 App，裝機後約 **7 天**會過期，需重新安裝或改用付費開發者帳號（可延長為 1 年）。

### 5. 沒有 Mac 時怎麼取得 .ipa？

- **借／用 Mac**：用別人的 Mac 或二手 Mac mini，依上面步驟操作一次即可產出 .ipa。
- **雲端 Mac**：  
  - **[MacStadium](https://www.macstadium.com/)**：租一台遠端 Mac，連線進去後裝 Xcode、建專案，依同樣步驟 Archive → Export，再把 .ipa 下載回來。**詳細步驟見：[MacStadium建置ipa指南.md](MacStadium建置ipa指南.md)**  
  - [AWS EC2 Mac](https://aws.amazon.com/ec2/instance-types/mac/)：同上，需有 AWS 帳號。  
  - [Codemagic](https://codemagic.io/)：連結 GitHub 用雲端 Mac 自動建置，建完可下載 .ipa（有免費額度）。

### 6. 之後改版、重新產 .ipa

```bash
npm run cap:sync
```

再在 Xcode 裡 **Product** → **Archive**，重複「Distribute App → Ad Hoc → Export」即可得到新的 .ipa。

---

## 常用指令整理

| 想做什麼           | 指令 |
|--------------------|------|
| 建置網頁並同步到 App | `npm run cap:sync` |
| 開 Android 專案建 APK | `npm run cap:android`（或 `npx cap open android`） |
| 開 iOS 專案裝到 iPhone | `npm run cap:ios`（或 `npx cap open ios`）**需在 Mac** |

---

## 注意

- **Android**：在 Windows 或 Mac 都可以建 APK，裝在自己或別人的 Android 手機。
- **iOS**：一定要在 **Mac** 上用 **Xcode** 建置並裝到自己的 iPhone / iPad；用免費 Apple ID 即可，不用上架、不用付費開發者帳號。
- 資料一樣存在裝置裡（localStorage），和用瀏覽器「加入主畫面」的資料是分開的（App 與 Safari 各一份）。

這樣就可以做出「只給自己用的」iOS App 與 Android App。
