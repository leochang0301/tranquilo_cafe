# Tranquilo Cafe POS

輕量 POS 系統，純前端 + Google Apps Script 後端，無伺服器。

---

## 系統架構

```
GitHub Pages（前端）
├── index.html      客人點餐頁
└── staff.html      員工後台

Google Apps Script（後端 API）
├── tranquilo       川夏 → 連川夏 Google Sheet
└── underden        渡深 → 連渡深 Google Sheet
```

**資料流：** 前端 fetch → GAS Web App URL → Google Sheets

---

## 兩間店的網址

| 用途 | 川夏 | 渡深 |
|------|------|------|
| 客人點餐 | `/index.html?store=tranquilo` | `/index.html?store=underden` |
| 員工後台 | `/staff.html?store=tranquilo` | `/staff.html?store=underden` |

> 沒有 `?store=` 參數時預設走川夏。

完整 URL（GitHub Pages）：
```
https://leochang0301.github.io/tranquilo_cafe/index.html?store=tranquilo
https://leochang0301.github.io/tranquilo_cafe/index.html?store=underden
https://leochang0301.github.io/tranquilo_cafe/staff.html?store=tranquilo
https://leochang0301.github.io/tranquilo_cafe/staff.html?store=underden
```

---

## 店家 Config 位置

兩個檔案都有各自的 `STORES` 物件，要新增店家或換 GAS URL 都在這裡改：

**index.html**
```javascript
const STORES = {
  tranquilo: {
    name:        '川夏',
    scriptUrl:   'https://script.google.com/macros/s/...',
    showIGShare: false,
    cacheKey:    'menu_tranquilo_v2',
  },
  underden: {
    name:        '渡深',
    scriptUrl:   'https://script.google.com/macros/s/...',
    igHandle:    'tranquilo_underden',
    showIGShare: true,
    cacheKey:    'menu_underden_v2',
  }
};
```

**staff.html**
```javascript
const STORES = {
  tranquilo: {
    name:      '川夏',
    scriptUrl: 'https://script.google.com/macros/s/...',
  },
  underden: {
    name:      '渡深',
    scriptUrl: 'https://script.google.com/macros/s/...',
  }
};
```

---

## Google Sheet Schema

Sheet tab 名稱固定，大小寫需完全一致。

### POS（訂單主表）
| 欄 | 欄位 | 說明 |
|----|------|------|
| A | 日期 | `yyyy/MM/dd` |
| B | 時間 | `HH:mm` |
| C | 客人名稱 | 選填 |
| D | 座位 | |
| E | 訂單ID | 例：TR17 |
| F | 餐點內容 | 每行一項，格式：`品項 x數量 = $金額` |
| G | 總金額 | |
| H | 狀態 | `待製作` / `完成` |
| I | 結帳 | `未結帳` / staff 名字（已結帳時寫入） |

### MENU
| 欄 | 欄位 |
|----|------|
| A | 品項名稱 |
| B | 分類 |
| C | 熱價格 |
| D | 冰價格 |
| E | Emoji |
| F | 啟用（TRUE/FALSE） |

### SEAT
| 欄 | 欄位 |
|----|------|
| A | 座位名稱 |

### STAFF
| 欄 | 欄位 |
|----|------|
| A | 員工姓名（第2行起） |

### STAFF_LOG（自動建立）
打卡記錄，GAS 首次執行時自動建立。

---

## GAS Actions

### doGet
| action | 說明 |
|--------|------|
| `getMenu` | 回傳 MENU tab 啟用品項 |
| `getSeats` | 回傳 SEAT tab 座位清單 |
| `getStaff` | 回傳 STAFF tab 員工名單 |
| `getOrders` | 回傳未結帳訂單（staff.html 輪詢用） |
| `getPOSOrders` | 回傳今日已結帳訂單（當日 Log 用） |

### doPost
| action | 說明 |
|--------|------|
| （無） | 新增訂單 |
| `updateStatus` | 更新訂單狀態或結帳，傳 `staffName` 寫入 I 欄 |
| `addItem` | 加點品項 |
| `splitPay` | 分開結帳（純前端維護，後端只回 ok） |
| `clockIn` | 員工打卡，寫入 STAFF_LOG |
| `toggleMenu` | 啟用/停用菜單品項 |

---

## 部署流程

### 前端（GitHub Pages）
1. 改完 `index.html` / `staff.html` 後 push 到 main
2. GitHub Pages 自動更新（約 1 分鐘）

### 後端（GAS）
1. 打開對應店家的 GAS 編輯器
2. 貼上新的 `Code.gs` 內容
3. **部署 → 管理部署作業 → 編輯 → 版本選「新版本」→ 部署**
4. URL 不變，不需要更新前端

> ⚠️ GAS 改完沒有重新部署的話，前端呼叫的還是舊版本。

---

## GAS Script URL

| 店家 | URL |
|------|-----|
| 川夏 | `https://script.google.com/macros/s/AKfycbzXfw9tTQJgwteqUIbhx-yaWHKb1X2skilxVRMWe8-1r6VRTLuuileTb_cpJiCklgpZYw/exec` |
| 渡深 | `https://script.google.com/macros/s/AKfycbypWJMIdQYy6HYkgW7uVPB1X0PwzsQN9UpAnzGSprAHuf5DchTx3ykJJFhRFQoPEuaj/exec` |

---

## staff.html 功能說明

### Tab 1 — 待製作
- 右滑品項 → 標記完成（綠底）
- 左滑已完成品項 → 恢復待製作（紅底）
- 全部品項完成 → 自動 POST 更新狀態為「完成」，移入 Tab 2
- 長按手沖/煎餃品項 → 加註 bottom sheet（選豆子/辣度）
- Header 右側「＋ 加點」→ 新增品項到該訂單

### Tab 2 — 出餐完成（待結帳）
- 右滑整張卡片 → 結帳完成，寫入 staff 名字到 I 欄
- 「✂ 分開結帳」→ 勾選品項分批收款，全部結清後才寫入 Sheet
- 「＋ 加點」→ 新增品項

### Tab 3 — 當日 Log
- 切換到此 Tab 時呼叫 `getPOSOrders` 從後端讀取
- 下拉刷新也會重新拉取
- 顯示今日總營業額與所有已結帳訂單

### 其他操作
- **下拉刷新**：在任何 Tab 向下拉 → 觸發更新
- **上班/下班按鈕**：打卡記錄寫入 STAFF_LOG，不影響訂單顯示
- **自動輪詢**：每 30 秒自動拉一次 `getOrders`

---

## 已知限制

- 分開結帳狀態存在前端 session，重新整理後歸零（Sheet 不動）
- 菜單快取存在 localStorage，各店家獨立，Staff 按「更新菜單」才會拉新資料
- GAS 免費版有每日執行配額限制，一般咖啡廳流量不會觸及

---

## 維護紀錄

| 日期 | 更新內容 |
|------|----------|
| 2026/04 | 初版上線，川夏單店 |
| 2026/04 | 雙店架構（川夏/渡深），?store= 參數切換 |
| 2026/04 | 分開結帳、pull-to-refresh、左滑恢復、當日 Log 從後端讀取 |
