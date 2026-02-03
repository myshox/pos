# 免費「像 App」：Android 和 Apple 都能用

不用付 Apple Developer、不用 Mac，把 POS 網站部署到 **HTTPS** 後，**Android** 和 **iPhone** 都可以「加到主畫面」當成 App 用，全螢幕、有圖示。

---

## 一、把網站部署到 HTTPS（只需做一次）

網站**一定要在 HTTPS 網址**，手機才能「加入主畫面」當 App 用。推薦用免費的 **Vercel** 或 **Netlify**。

### 方式 A：用 Vercel（推薦）

1. 到 [https://vercel.com](https://vercel.com) 註冊（可用 GitHub 登入）。
2. 點 **Add New** → **Project**，選你的 **myshox/pos** 倉庫。
3. **Framework Preset** 選 **Vite**，**Root Directory** 維持空白。
4. **Build Command** 留 `npm run build`，**Output Directory** 留 `dist`。
5. 點 **Deploy**，等一兩分鐘。
6. 完成後會給你一個網址，例如：`https://pos-xxxx.vercel.app`，這就是你的 **HTTPS 網址**。

### 方式 B：用 Netlify

1. 到 [https://netlify.com](https://netlify.com) 註冊（可用 GitHub 登入）。
2. **Add new site** → **Import an existing project** → 選 **GitHub** → 選 **pos**。
3. **Build command**：`npm run build`，**Publish directory**：`dist`。
4. 點 **Deploy**，完成後會得到網址，例如：`https://xxxx.netlify.app`。

之後程式碼有更新，只要 **push 到 GitHub**，Vercel/Netlify 會自動重新部署。

---

## 二、在 iPhone（Apple）上「像 App」使用

1. 用 **Safari** 打開你的 HTTPS 網址（例如 `https://pos-xxxx.vercel.app`）。
2. 點 Safari 下方的 **分享** 按鈕（□↑）。
3. 在選單裡選 **「加入主畫面」**。
4. 名稱可改成「MOGU POS」→ 點 **加入**。

主畫面會多一個圖示，點進去會**全螢幕**開啟，就像 App。資料存在這台 iPhone 的 Safari 裡。

---

## 三、在 Android 上「像 App」使用

1. 用 **Chrome** 打開你的 HTTPS 網址。
2. 點 Chrome 右上角 **⋮**（三個點）選單。
3. 選 **「新增至主畫面」** 或 **「安裝應用程式」**（依 Android/Chrome 版本用語可能不同）。
4. 確認名稱後點 **新增** 或 **安裝**。

主畫面會多一個圖示，點進去可全螢幕使用，像 App。

---

## 四、對照：像 App 的網頁 vs 原生 App

| 項目 | 像 App 的網頁（本做法） | 原生 .ipa / .apk |
|------|-------------------------|-------------------|
| 費用 | 免費 | Apple 需 $99/年（若要 .ipa） |
| Android | ✅ Chrome 加到主畫面即可 | 可自己建 .apk |
| iPhone | ✅ Safari 加入主畫面即可 | 需 Mac 或 Codemagic + 付費開發者 |
| 全螢幕、圖示 | ✅ 有 | ✅ 有 |
| 資料存在哪 | 存在該裝置瀏覽器（localStorage） | 存在該裝置 App 內 |
| 離線 | 已開過的頁面可離線用（依 PWA 快取） | 可完全離線 |

---

## 五、注意事項

- **資料**：每台裝置（手機、電腦）的資料是**分開的**，不會自動同步。若要備份，請用後台「備份與還原」匯出 JSON。
- **網址**：請把部署好的網址記下來（或加入書籤），要裝到新手機時用同一個網址再「加入主畫面」即可。
- 專案已設定好 **manifest** 與 **Apple 用 meta**，部署到 HTTPS 後，Android 和 Apple 都能正常當成「像 App 的網頁」使用。

這樣就可以**免費**在 **Android 和 Apple** 上都能用，而且都像 App。
