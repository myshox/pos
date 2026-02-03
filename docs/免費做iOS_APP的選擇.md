# 免費做 iOS APP 的選擇

不想花錢買 Mac 或租雲端，還是有辦法在 iPhone 上用、或產出 .ipa。以下都是**免費**選項。

---

## 一、加入主畫面（完全免費，推薦）

**不用 Mac、不用開發者帳號、不用任何付費服務。**

1. 把網站部署到 **HTTPS 網址**（例如 [Vercel](https://vercel.com)、[Netlify](https://netlify.com) 都有免費方案）。
2. 在 **iPhone 用 Safari** 打開你的網址。
3. **分享** → **「加入主畫面」** → 加入。

主畫面會多一個圖示，點進去**全螢幕**使用，就像 App。專案已設定好，不需額外付費。

- **優點**：零成本、立刻用。
- **限制**：不是 App Store 的 .ipa，而是「網頁加主畫面」；資料存在該裝置的 Safari。

---

## 二、Codemagic 免費額度（產出 .ipa，不用 Mac）

**[Codemagic](https://codemagic.io)** 是 CI/CD 服務，用**雲端 Mac** 幫你建置。**個人帳號每月有 500 分鐘免費** macOS 建置時間，可拿來建 iOS .ipa。

### 大致流程

1. **註冊** [Codemagic](https://codemagic.io)（選個人帳號才有免費額度）。
2. **連結 GitHub**：把專案推到 GitHub，在 Codemagic 連這個 repo。
3. **新增應用**：選專案，建置類型選 **iOS**（或 Flutter / 其他，我們是 Capacitor 所以要選能跑 npm + Xcode 的）。
4. **設定建置腳本**：例如：
   - 安裝 Node
   - `npm ci` 或 `npm install`
   - `npm run build`
   - `npx cap sync ios`
   - 進入 `ios/App` 跑 `pod install`
   - 用 `xcodebuild` 或 Xcode 建置、匯出 .ipa
5. **簽名**：在 Codemagic 後台設定 **Apple ID** 或上傳簽名憑證，讓雲端 Mac 能簽名產出 .ipa。
6. **建置**：按 Build，跑完後可**下載 .ipa**。

建一次大約會用掉數分鐘到十幾分鐘，500 分鐘/月對偶爾建一次很夠用。

- **優點**：不用買 Mac、可產出真正的 .ipa。
- **限制**：要會一點 CI／設定；簽名要自己處理（免費 Apple ID 可，但裝機約 7 天要重裝）。

---

## 三、GitHub Actions 免費 macOS（進階）

**GitHub** 對公開 repo 提供 **macOS 建置**（每月有一定免費分鐘數）。你可以寫一個 workflow：

- 用 `macos-latest` runner
- 執行：`npm install` → `npm run build` → `npx cap sync ios` → `pod install` → `xcodebuild` 建置

但要產出**可安裝的 .ipa**，還要在 workflow 裡設定 **code signing**（憑證、provisioning profile），並把 .ipa 上傳成 artifact 或 release。步驟較多，適合願意查文件、試錯的人。

- **優點**：完全在 GitHub 內、用免費額度。
- **限制**：需自己查 GitHub Actions + Xcode 簽名文件，門檻較高。

---

## 四、借／用別人的 Mac（免費）

若朋友、公司或學校有 Mac，可以：

- 用那台 Mac 打開專案，照 **`自己用APP建置說明.md`** 的 iOS 步驟做 **Archive → Export .ipa**。
- 不需要付費給任何服務，只要有一台 Mac 用一次即可。

---

## 總結

| 方式 | 費用 | 需要 Mac？ | 得到什麼 |
|------|------|------------|----------|
| **加入主畫面** | 免費 | 不需要 | 像 App 的網頁，全螢幕使用 |
| **Codemagic** | 免費額度 500 分/月 | 不需要 | 可下載 .ipa，自己裝到 iPhone |
| **GitHub Actions** | 免費額度 | 不需要 | 可產 .ipa，需自己設簽名 |
| **借 Mac** | 免費 | 要（借一次） | 自己建出 .ipa |

**建議**：  
- 只想在 iPhone 上用：用 **加入主畫面** 最簡單。  
- 一定要 .ipa 又沒有 Mac：優先試 **Codemagic 免費方案**。
