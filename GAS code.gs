// ╔══════════════════════════════════════════╗
// ║  Underden Cafe POS — Apps Script 後端 ║
// ║  貼到 Apps Script 編輯器後重新部署       ║
// ╚══════════════════════════════════════════╝


const SHEET_ID = 'YOUR_SHEET_ID_HERE'; // 實際值在 GAS 編輯器
const TIMEZONE  = 'Asia/Taipei';

function getSS() {
  return SpreadsheetApp.openById(SHEET_ID);
}

// ────────────────────────────────────────────
// doGet：依 action 參數分流
//   ?action=getMenu        → 回傳菜單
//   ?action=getSeats       → 回傳座位清單
//   ?action=getStaff       → 回傳員工名單
//   ?action=getTodayOrders → 回傳今日已結帳訂單（舊）
//   ?action=getPOSOrders   → 回傳今日已結帳訂單（新，時間格式化）★
//   ?action=getOrders      → 回傳未完成訂單（預設）
// ────────────────────────────────────────────
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'getOrders';
  let result;

  if      (action === 'getMenu')        result = fetchMenu();
  else if (action === 'getSeats')       result = fetchSeats();
  else if (action === 'getStaff')       result = fetchStaff();
  else if (action === 'getTodayOrders') result = fetchTodayOrders();
  else if (action === 'getPOSOrders')   result = fetchPOSOrders();   // ★
  else                                  result = fetchOrders();

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function fetchMenu() {
  const sheet = getSS().getSheetByName('MENU');
  const rows  = sheet.getDataRange().getValues();
  const items = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0]) continue;

    const hotPrice  = (r[2] !== '' && r[2] !== null) ? Number(r[2]) : null;
    const coldPrice = (r[3] !== '' && r[3] !== null) ? Number(r[3]) : null;
    const enabled   = r[5] === true || String(r[5]).toUpperCase() === 'TRUE';

    items.push({
      name:      r[0],
      category:  r[1] || '',
      hotPrice:  hotPrice,
      coldPrice: coldPrice,
      emoji:     r[4] || '',
      enabled:   enabled
    });
  }
  return items;
}

function fetchSeats() {
  const sheet = getSS().getSheetByName('SEAT');
  const rows  = sheet.getDataRange().getValues();
  const seats = [];

  for (let i = 1; i < rows.length; i++) {
    const val = rows[i][0];
    if (val) seats.push(String(val));
  }
  return seats;
}

function fetchStaff() {
  const sheet   = getSS().getSheetByName('STAFF');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  return sheet.getRange(2, 1, lastRow - 1, 1)
    .getValues()
    .map(r => String(r[0]).trim())
    .filter(v => v !== '');
}

// 舊版（保留相容）
function fetchTodayOrders() {
  const sheet   = getSS().getSheetByName('POS');
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const today = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy/MM/dd');
  const rows  = sheet.getDataRange().getValues();
  const result = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[4]) continue;
    if (String(r[0]) !== today) continue;
    if (r[7] !== '完成' || r[8] !== '已結帳') continue;

    result.push({
      date:       r[0], time:       r[1],
      guestName:  r[2], seat:       r[3],
      orderId:    r[4], items:      r[5],
      totalPrice: r[6], status:     r[7],
      payStatus:  r[8]
    });
  }
  return result.reverse();
}

// ★ 新增：getPOSOrders — 時間欄直接格式化為字串，解決前端時區偏移問題
function fetchPOSOrders() {
  const sheet   = getSS().getSheetByName('POS');
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const today = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy/MM/dd');
  const rows  = sheet.getDataRange().getValues();
  const result = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[4]) continue;

    // 日期比對
    const rawDate = r[0];
    const rowDate = rawDate instanceof Date
      ? Utilities.formatDate(rawDate, TIMEZONE, 'yyyy/MM/dd')
      : String(rawDate).slice(0, 10).replace(/-/g, '/');
    if (rowDate !== today) continue;

    // payStatus 欄（I欄，index 8）非空且非「未結帳」視為已結帳
    const payStatus = String(r[8] || '');
    if (!payStatus || payStatus === '未結帳') continue;

    // 時間格式化為 "HH:mm"，避免前端收到 ISO 字串後時區解析錯誤
    const timeStr = r[1] instanceof Date
      ? Utilities.formatDate(r[1], TIMEZONE, 'HH:mm')
      : String(r[1]);

    result.push({
      date:       today,
      time:       timeStr,
      guestName:  r[2],
      seat:       r[3],
      orderId:    r[4],
      items:      r[5],
      totalPrice: r[6],
      status:     r[7],
      payStatus:  payStatus
    });
  }
  return result.reverse();
}

// ★ 修改：getOrders 的 date/time 也格式化為字串，解決前端時間+N分鐘 bug
function fetchOrders() {
  const sheet   = getSS().getSheetByName('POS');
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const rows   = sheet.getDataRange().getValues();
  const orders = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[4]) continue;
    if (r[7] === '完成' && String(r[8]) !== '未結帳' && r[8]) continue;

    const dateStr = r[0] instanceof Date
      ? Utilities.formatDate(r[0], TIMEZONE, 'yyyy/MM/dd')
      : String(r[0]);
    const timeStr = r[1] instanceof Date
      ? Utilities.formatDate(r[1], TIMEZONE, 'HH:mm')
      : String(r[1]);

    orders.push({
      date:       dateStr,
      time:       timeStr,
      guestName:  r[2],
      seat:       r[3],
      orderId:    r[4],
      items:      r[5],
      totalPrice: r[6],
      status:     r[7],
      payStatus:  r[8]
    });
  }
  return orders;
}

// ────────────────────────────────────────────
// doPost：依 action 欄位分流
// ────────────────────────────────────────────
function doPost(e) {
  const data      = JSON.parse(e.parameter.data);
  const action    = data.action || '';
  let orderNumber = '';

  if      (action === 'updateStatus') updateOrderStatus(data);
  else if (action === 'toggleMenu')   toggleMenuItem(data);
  else if (action === 'clockIn')      handleClockIn(data);
  else if (action === 'addItem')      addItemToOrder(data);
  else if (action === 'splitPay')     handleSplitPay(data);  // ★
  else                                orderNumber = addOrder(data);

  return ContentService
    .createTextOutput(JSON.stringify({ success: true, orderNumber: orderNumber }))
    .setMimeType(ContentService.MimeType.JSON);
}

// 新增訂單
function addOrder(data) {
  const sheet = getSheetByName_('POS');
  return addOrderToSheet(sheet, data);
}

function addOrderToSheet(sheet, data) {
  const now    = new Date();
  const prefix = data.storePrefix || 'TR';

  const lastRow = sheet.getLastRow();
  let seq = 1;
  if (lastRow > 1) {
    const ids = sheet.getRange(2, 5, lastRow - 1, 1).getValues()
      .flat().map(String)
      .filter(id => id.startsWith(prefix));
    if (ids.length > 0) {
      const lastSeq = parseInt(ids[ids.length - 1].slice(prefix.length)) || 0;
      seq = (lastSeq % 99) + 1;
    }
  }

  const orderId   = prefix + String(seq).padStart(2, '0');
  const itemsText = data.items
    .map(it => `${it.name} x${it.qty} = $${it.price * it.qty}`)
    .join('\n');

  sheet.appendRow([
    Utilities.formatDate(now, TIMEZONE, 'yyyy/MM/dd'),
    Utilities.formatDate(now, TIMEZONE, 'HH:mm'),
    data.guestName  || '',
    data.seatNumber || '',
    orderId,
    itemsText,
    data.totalPrice,
    '待製作',
    '未結帳'
  ]);
  return orderId;
}

// ★ 修改：updateOrderStatus — payStatus 更新時寫入 staffName 到 I 欄
function updateOrderStatus(data) {
  const sheet = getSheetByName_('POS');
  const rows  = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][4]) !== String(data.orderId)) continue;

    if (data.field === 'payStatus') {
      // I 欄（col 9）：寫 staffName，若沒傳則退回寫 status 字串
      sheet.getRange(i + 1, 9).setValue(data.staffName || data.status);
    } else {
      // H 欄（col 8）：status 欄位
      sheet.getRange(i + 1, 8).setValue(data.status);
    }
    break;
  }
}

// 幫既有訂單加點品項
function addItemToOrder(data) {
  const sheet = getSheetByName_('POS');
  const rows  = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][4]) !== String(data.orderId)) continue;

    const currentItems = String(rows[i][5] || '');
    const newLine      = `${data.itemName} x${data.qty} = $${data.itemPrice * data.qty}`;
    const updatedItems = currentItems ? currentItems + '\n' + newLine : newLine;
    const newTotal     = (Number(rows[i][6]) || 0) + data.itemPrice * data.qty;

    sheet.getRange(i + 1, 6).setValue(updatedItems);
    sheet.getRange(i + 1, 7).setValue(newTotal);
    break;
  }
}

// ★ 新增：splitPay — 部分結帳，從 items 移除已付品項，totalPrice 扣減
function handleSplitPay(data) {
  // 分開結帳不寫 Sheet，狀態由前端維護
  // 最終右滑整張單時才由 updateOrderStatus 寫入結帳
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

// 切換菜單品項啟用狀態
function toggleMenuItem(data) {
  const sheet = getSheetByName_('MENU');
  const rows  = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.itemName) {
      sheet.getRange(i + 1, 6).setValue(data.enabled === true || data.enabled === 'true');
      break;
    }
  }
}

// 員工打卡 → 寫入 STAFF_LOG tab
function handleClockIn(data) {
  const ss    = getSS();
  let sheet   = ss.getSheetByName('STAFF_LOG');

  if (!sheet) {
    sheet = ss.insertSheet('STAFF_LOG');
    sheet.appendRow(['date', 'time', 'staffName', 'type']);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 4)
      .setBackground('#3d2314')
      .setFontColor('#fdf6ed')
      .setFontWeight('bold');
  }

  const ts   = new Date(data.timestamp);
  const date = Utilities.formatDate(ts, TIMEZONE, 'yyyy/MM/dd');
  const time = Utilities.formatDate(ts, TIMEZONE, 'HH:mm:ss');

  sheet.appendRow([date, time, data.staffName, data.type]);
}

function debugPOSOrders() {
  const sheet = getSS().getSheetByName('POS');
  const rows  = sheet.getDataRange().getValues();
  const today = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy/MM/dd');
  Logger.log('today = ' + today);
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[4]) continue;
    const rawDate = r[0];
    const rowDate = rawDate instanceof Date
      ? Utilities.formatDate(rawDate, TIMEZONE, 'yyyy/MM/dd')
      : String(rawDate).slice(0, 10).replace(/-/g, '/');
    Logger.log(`row${i}: orderId=${r[4]}, rowDate=${rowDate}, payStatus=${r[8]}, match=${rowDate===today}`);
  }
}

// ────────────────────────────────────────────
// 工具函式
// ────────────────────────────────────────────
function getSheetByName_(name) {
  return getSS().getSheetByName(name);
}
