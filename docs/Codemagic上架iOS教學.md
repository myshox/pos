# 使用 Codemagic 上架 iOS APP 教學

本教學教你用 **Codemagic** 在**沒有 Mac** 的情況下，建置本專案的 iOS .ipa，並可選擇：
- **只建 .ipa 自己裝**（Ad Hoc）
- **上傳 TestFlight 給測試者**
- **提交 App Store 審核上架**

Codemagic 個人帳號每月有 **500 分鐘免費** macOS 建置時間，足夠偶爾建置 iOS 使用。

---

## 一、事前準備

### 1. 程式碼放到 GitHub

1. 在 [GitHub](https://github.com) 建立一個新 repository（可設為 private）。
2. 在本機專案目錄執行（若尚未用 git）：
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/你的帳號/你的repo名稱.git
   git push -u origin main
   ```
3. 確認專案根目錄有 **`codemagic.yaml`**（本專案已附範例，見下方說明）。

### 2. Apple 帳號與簽名

| 目標 | 需要的 Apple 帳號 | 說明 |
|------|-------------------|------|
| **只建 .ipa、裝在自己/少數裝置** | 免費 Apple ID 或 付費開發者 | 免費簽名裝機約 7 天過期；付費可做 Ad Hoc 裝在已註冊裝置，約 1 年有效。 |
| **TestFlight / App Store 上架** | **付費 Apple Developer Program（約 $99/年）** | 需在 [App Store Connect](https://appstoreconnect.apple.com) 建立 App、設定憑證與描述檔。 |

- 若只先「建出 .ipa」：可先用 **ad_hoc** + 自己在 Apple Developer 後台建立 Ad Hoc 描述檔與憑證，上傳到 Codemagic。
- 若要 **上架 TestFlight / App Store**：需付費開發者、在 Codemagic 設定 **App Store Connect API Key**，並在 `codemagic.yaml` 使用 **app_store** 簽名與發布設定。

---

## 二、註冊並設定 Codemagic

### 步驟 1：註冊 Codemagic

1. 前往 [https://codemagic.io](https://codemagic.io)。
2. 點 **Sign up**，選擇 **Continue with GitHub** 用 GitHub 登入。
3. 授權 Codemagic 讀取你的 repository（可只勾選要建置的那個 repo）。

### 步驟 2：新增應用（App）

1. 登入後在 **Applications** 頁面點 **Add application**。
2. 若有團隊，先選團隊。
3. 選 **Connect repository**，從列表選你放 POS 專案的那個 **GitHub repository**。
4. **Project type** 選 **Other**（或選 Flutter / 其他若沒有「Capacitor」選項，沒關係，我們用 YAML 建置）。
5. 點 **Finish: Add application**。

### 步驟 3：讓 Codemagic 讀取 codemagic.yaml

1. 在專案根目錄要有 **`codemagic.yaml`**（本專案已提供範例檔）。
2. 在 Codemagic 該應用的畫面，上方選你要建置的 **branch**（例如 `main`）。
3. 點 **Check for configuration file**，讓 Codemagic 掃到 `codemagic.yaml`。
4. 之後建置會依 YAML 裡的 **workflow** 執行。

---

## 三、iOS 簽名設定（必做才能產出 .ipa）

iOS 一定要簽名才能安裝。依你的目標選一種方式。

### 方式 A：只建 .ipa 自己裝（Ad Hoc）

1. **Apple Developer 後台**（[developer.apple.com](https://developer.apple.com)）：
   - 登入付費開發者帳號。
   - **Certificates, Identifiers & Profiles** → 建立 **App ID**（Bundle ID 填 `com.studiomogu.pos`，與 `capacitor.config.json` 一致）。
   - 建立 **Distribution** 憑證（Apple Distribution）。
   - 建立 **Ad Hoc** 類型的 **Provisioning Profile**，選剛建的 App ID 與憑證，並**註冊要安裝的裝置**（iPhone 的 UDID）。

2. **Codemagic 後台**：
   - 進 **Team settings**（左側）→ **codemagic.yaml settings** → **Code signing identities**。
   - **iOS certificates**：上傳你的 **.p12** 憑證檔，設一個 **Reference name**（例如 `ios_distribution`），並填憑證密碼。
   - **iOS provisioning profiles**：上傳剛建立的 **.mobileprovision**（Ad Hoc），設一個 **Reference name**（例如 `pos_ad_hoc`）。

3. 在 **codemagic.yaml** 裡（見下方範例）：
   - `distribution_type: ad_hoc`
   - `bundle_identifier: com.studiomogu.pos`
   - 不需填 `APP_STORE_APP_ID`，也不需 App Store Connect 發布。

### 方式 B：上架 TestFlight / App Store

1. **Apple Developer Program**：確認已付費加入（約 $99/年）。

2. **App Store Connect**（[appstoreconnect.apple.com](https://appstoreconnect.apple.com)）：
   - **建立 App**：填名稱、Bundle ID（`com.studiomogu.pos`）、SKU 等。
   - 記下 **App 的 Apple ID**（在 App → 一般 → App 資訊 裡，是一串數字，例如 `1234567890`）。

3. **App Store Connect API Key**（給 Codemagic 用）：
   - App Store Connect → **使用者與存取** → **整合** → **App Store Connect API**。
   - 點 **+** 新增金鑰，名稱可填 `Codemagic`，權限選 **App 管理員**。
   - 下載 **.p8** 金鑰（只會給一次，請妥善保存）。
   - 記下 **Issuer ID**（金鑰列表上方）與該金鑰的 **Key ID**。

4. **Codemagic 後台**：
   - **Team integrations** → **Developer Portal** → **Manage keys** → **Add key**。
   - 上傳 .p8、填 **Issuer ID**、**Key ID**，名稱例如 `codemagic_app_store`。
   - **Code signing identities**：可選「從 Developer Portal 取得」憑證與 **App Store** 描述檔（需先有 App ID 與 Distribution 憑證），或手動上傳 .p12 與 .mobileprovision。

5. 在 **codemagic.yaml** 裡：
   - `integrations.app_store_connect: codemagic_app_store`（與你設的金鑰名稱一致）。
   - `distribution_type: app_store`
   - `bundle_identifier: com.studiomogu.pos`
   - `APP_STORE_APP_ID: "你的App的Apple ID數字"`
   - 若要用 TestFlight：`submit_to_testflight: true`，並可設 `beta_groups`。
   - 若要送審：`submit_to_app_store: true`（依文件可再加排程等進階選項）。

---

## 四、專案裡的 codemagic.yaml 說明

專案根目錄的 **`codemagic.yaml`** 已針對本 POS（Capacitor）專案寫好一個 **iOS workflow**，重點如下：

- **建置步驟**：  
  `npm install` → `cd ios/App && pod install` → `npm run build` → `npx cap sync` → 設定簽名 →（可選）從 App Store 取最新 build 號並遞增 → 用 Xcode 建出 .ipa。

- **變數**（可依需要改）：
  - `XCODE_WORKSPACE`：`App.xcworkspace`
  - `XCODE_SCHEME`：`App`
  - `bundle_identifier`：`com.studiomogu.pos`
  - 若上架：`APP_STORE_APP_ID` 改成你在 App Store Connect 的 App Apple ID。

- **觸發**：  
  預設為推送到 **main** 分支時建置，可在 YAML 的 `triggering` 裡改 branch 或改為手動建置。

- **產物**：  
  建置成功後可在 Codemagic 下載 **ios/App/build/ios/ipa/App.ipa**。

你只要：
1. 依上面「簽名設定」在 Codemagic 與 Apple 後台設好憑證／描述檔（或 App Store Connect API）。
2. 若要上架，在 YAML 裡填 `APP_STORE_APP_ID`、並啟用 `submit_to_testflight` / `submit_to_app_store`。
3. 推送程式碼到 GitHub 或手動在 Codemagic 點 **Start new build** 選對 branch 與 workflow。

---

## 五、開始建置與下載 .ipa

1. 在 Codemagic 該應用頁面，確認 **branch** 與 **workflow**（例如 `pos-ios`）。
2. 點 **Start new build**。
3. 建置過程中可在 **Build** 頁看 log；失敗時多數是簽名或路徑問題，對照錯誤訊息檢查：
   - Bundle ID 是否與 Apple 後台、`capacitor.config.json` 一致。
   - 憑證與描述檔是否對應到正確的 App ID 與 distribution type。
4. 建置成功後到 **Artifacts** 下載 **App.ipa**。

---

## 六、.ipa 怎麼裝到 iPhone

- **Ad Hoc**：  
  用 **Apple Configurator 2**（需 Mac）、**AltStore**（[altstore.io](https://altstore.io)）、或透過其他支援安裝 .ipa 的工具，裝到已註冊在描述檔裡的裝置。

- **TestFlight**：  
  若在 Codemagic 設了 `submit_to_testflight: true`，建完會上傳到 App Store Connect，在 TestFlight 加入測試者後，他們用 TestFlight App 安裝。

- **App Store**：  
  若設了 `submit_to_app_store: true` 且通過審核，使用者從 App Store 下載。

---

## 七、若只想「先建出 .ipa」、暫不上架

- 在 **codemagic.yaml** 使用 **ad_hoc** 簽名（見範例中的註解）。
- 不要設 `integrations.app_store_connect`、不要設 `submit_to_testflight` / `submit_to_app_store`。
- 可註解或刪除「Increment build number」那一段（該段需要 App Store Connect）。
- 建完從 Artifacts 下載 .ipa，用 AltStore 或 Mac 裝到自己的 iPhone。

---

## 八、常見問題

- **建置失敗：找不到 workspace / scheme**  
  確認專案結構是 `ios/App/App.xcworkspace`、scheme 名為 `App`，與 YAML 內變數一致。

- **簽名錯誤：certificate / profile 不符**  
  檢查 Bundle ID 是否為 `com.studiomogu.pos`，以及 Codemagic 上傳的 .p12 與 .mobileprovision 是否對應同一個 App ID 與 distribution type（ad_hoc 或 app_store）。

- **免費額度**  
  個人帳號每月 500 分鐘 macOS；建一次約十幾分鐘，可建不少次。若超過可考慮付費方案或改用「加入主畫面」方式用 PWA。

- **第一次上架 App Store**  
  建議先在 App Store Connect 手動建立 App、上傳第一版（或至少建好 App 記錄與截圖等），再讓 Codemagic 自動送審後續版本。

完成以上步驟後，你就可以用 Codemagic 在沒有 Mac 的情況下建置並上架本專案的 iOS APP。
