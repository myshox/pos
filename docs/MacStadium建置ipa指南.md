# 用 MacStadium 雲端 Mac 建置 .ipa 指南

沒有實體 Mac 時，可租用 **MacStadium** 的雲端 Mac，遠端連線進去用 Xcode 建置，產出 .ipa 後下載到自己的電腦。

---

## 一、MacStadium 是什麼？

- **雲端 Mac 主機**：租一台遠端 Mac（Mac mini 等），月費約 **US$109 起**（依規格）。
- **適合**：偶爾需要建 .ipa、不想買 Mac，或想用完就停租。
- **官網**：https://www.macstadium.com/  
- **購買入口**：https://portal.macstadium.com/ （註冊帳號後可選方案、線上購買）

---

## 二、建議使用流程

### 1. 註冊與租用 Mac

1. 到 **https://portal.macstadium.com/** 註冊帳號。
2. 登入後用 **Pricing / 購買** 選一台 Mac：
   - 只建 Capacitor 專案：選最便宜方案即可（例如 **M2.S Mac mini**，約 US$109/月）。
   - 選 **月繳**，之後不用可取消。
3. 完成付款後，MacStadium 會提供：
   - **連線方式**：多半是 **VPN** 或 **SSH**，或 **螢幕共享**（依方案說明）。
   - **IP 位址**、**帳號密碼**（或 SSH key）等，在 Portal 的說明或 email 裡。

### 2. 連線到雲端 Mac

- **方式 A：VPN + 螢幕共享**  
  - 依 MacStadium 說明安裝 VPN 並連線。  
  - 在 Mac 上用 **螢幕共享** 或 **VNC** 連到那台 Mac 的 IP，就能像坐在那台 Mac 前一樣操作。

- **方式 B：VPN + SSH**  
  - 連上 VPN 後，從你電腦的終端機：
    ```bash
    ssh 使用者名@該Mac的IP
    ```
  - 適合只跑指令、不需要開 Xcode 視窗時（例如用指令列建置）。

建議第一次用 **螢幕共享**，比較直覺，建 .ipa 時也要在 Xcode 裡選 Archive / Export。

### 3. 在雲端 Mac 上建置 .ipa

連上那台 Mac 後，在那台 Mac 的終端機與 Xcode 裡操作：

**（1）準備專案**

- 若專案在 **GitHub / GitLab**：
  ```bash
  git clone https://github.com/你的帳號/POS.git
  cd POS
  ```
- 若只在你自己電腦：先用 **雲端硬碟（Dropbox、Google 雲端硬碟）** 或 **scp** 把整個專案資料夾傳到雲端 Mac，再在該 Mac 上 `cd` 到專案目錄。

**（2）安裝環境（該 Mac 第一次要做）**

- 安裝 **Node.js**：到 https://nodejs.org 下載 macOS 版，或用 Homebrew：
  ```bash
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  brew install node
  ```
- 安裝 **Xcode**：從 Mac App Store 安裝 Xcode（體積大，可能要一陣子）。
- 安裝 **CocoaPods**：
  ```bash
  sudo gem install cocoapods
  ```

**（3）建置網頁並同步到 iOS**

```bash
cd 專案目錄
npm install
npm run cap:sync
```

**（4）iOS 依賴**

```bash
cd ios/App && pod install && cd ../..
```

**（5）用 Xcode 產出 .ipa**

1. 執行：
   ```bash
   npx cap open ios
   ```
2. 在 Xcode：選 **Any iOS Device (arm64)** → 選單 **Product** → **Archive**。
3. Archive 完成後在 **Organizer** 視窗選剛建好的 Archive → **Distribute App** → **Ad Hoc** → 依畫面設定簽名（用你的 Apple ID）→ **Export**，選一個資料夾儲存。
4. 匯出資料夾裡會有 **.ipa** 檔。

### 4. 把 .ipa 下載回你的電腦

- **螢幕共享**：若雲端 Mac 桌面有匯出資料夾，可用 MacStadium 或系統內建的檔案傳輸方式（依他們提供的工具）把整個資料夾下載回來。
- **SSH + scp**：若 .ipa 在雲端 Mac 的某路徑，可在**你電腦**上執行（先連好 VPN）：
  ```bash
  scp 使用者名@該Mac的IP:/路徑/到/Export/資料夾/*.ipa ./
  ```
  就會把 .ipa 抓到目前目錄。

### 5. 之後不再需要時

到 **portal.macstadium.com** 取消訂閱或不要續約，就不會再扣款。

---

## 三、注意事項

- **費用**：以月費為主（例如 US$109/月），不建議只為建一次 .ipa 長期租用；若只建一次，可考慮借 Mac 或用 **Codemagic** 等有免費額度的服務。
- **Apple ID**：在雲端 Mac 的 Xcode 裡登入你的 **Apple ID**（免費即可），用於簽名；簽名與裝置信任同「在實體 Mac 上建 .ipa」。
- **網路與權限**：需能連上 MacStadium VPN、該 Mac 能上網（下載 Xcode、npm 等）。
- **專案與隱私**：程式碼會放在雲端 Mac 上，若很在意可建完 .ipa 後刪除專案或取消租用。

---

## 四、替代方案簡比

| 方式           | 優點               | 缺點           |
|----------------|--------------------|----------------|
| **MacStadium** | 完整 Mac、可重複用 | 月費、需自己裝 Xcode、操作 |
| **Codemagic**  | 連 GitHub 自動建、有免費額度 | 需設定 CI、簽名較繁瑣 |
| **借實體 Mac** | 一次建完、無月費   | 要有人可借     |

若你只是「偶爾產一個 .ipa」，可先試 **Codemagic** 免費額度或借 Mac；若打算**經常**在沒有 Mac 的環境建 iOS，再考慮 MacStadium 月租。
