// 綁定在教師的試算表；專案屬性設定 SHEET_ID 與8～200 碼的 RECORD_TOKEN。
var HEADERS = ['事件ID', '時間', '學生代號', '題目代碼', '題目', '類型', '結果', '分數', '滿分', '來源',
  '範例程式', '提問', '引導', '追問', '錯誤代碼', '評分時程式變更', '完整紀錄1', '完整紀錄2', '完整紀錄3', '完整紀錄4'];
function output_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
function sheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('NOT_CONFIGURED');
  var book = SpreadsheetApp.openById(id);
  var sheet = book.getSheetByName('學習事件');
  if (!sheet) {
    sheet = book.insertSheet('學習事件');
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setBackground('#2457a7').setFontColor('#ffffff').setFontWeight('bold');
    sheet.setColumnWidths(1, HEADERS.length, 150);
    sheet.setColumnWidths(12, 3, 300);
  }
  if (sheet.getRange(1, 1).getValue() !== HEADERS[0]) throw new Error('WRONG_SHEET');
  return sheet;
}
function initializeRecords() {
  var properties = PropertiesService.getScriptProperties();
  if (!properties.getProperty('SHEET_ID')) properties.setProperty('SHEET_ID', SpreadsheetApp.getActiveSpreadsheet().getId());
  sheet_();
}
// 用明確前綴將所有文字當成文字；讀回時移除。避免 =、+、@ 等開頭被當成公式。
function cell_(value) { return typeof value === 'number' ? value : '\u200B' + String(value == null ? '' : value); }
function uncell_(value) { return typeof value === 'string' && value.charAt(0) === '\u200B' ? value.slice(1) : value; }
function chunks_(value) {
  var result = [], start = 0;
  while (start < value.length) {
    var end = Math.min(start + 39900, value.length);
    if (end < value.length && /[\uDC00-\uDFFF]/.test(value.charAt(end))) end--;
    result.push(value.slice(start, end));
    start = end;
  }
  if (result.length > 4) throw new Error('TOO_LARGE');
  while (result.length < 4) result.push('');
  return result;
}
function clean_(record) {
  if (!record || !/^[a-zA-Z0-9_-]{8,80}$/.test(record.id || '') ||
      !/^[\p{L}\p{N}_-]{1,40}$/u.test(record.studentId || '') || !record.task ||
      typeof record.task.code !== 'string' || !record.task.code || record.task.code.length > 120 ||
      !['ai', 'grade'].includes(record.type) || !['completed', 'failed'].includes(record.status) ||
      !Number.isFinite(Date.parse(record.timestamp)) || !record.program || !Array.isArray(record.program.targets) ||
      JSON.stringify(record.program).length > 120000) throw new Error('INVALID_RECORD');
  var clean = {};
  ['id', 'studentId', 'task', 'type', 'status', 'timestamp', 'program', 'source', 'question', 'guidance', 'followup',
    'errorCode', 'demoLoaded', 'programChanged', 'totalScore', 'maxScore'].forEach(function(key) {
      if (Object.prototype.hasOwnProperty.call(record, key)) clean[key] = record[key];
    });
  clean.task = {code: record.task.code, title: String(record.task.title || '').slice(0, 200)};
  clean.program = {targets: record.program.targets.map(function(target) {
    var blocks = {};
    Object.keys(target.blocks || {}).forEach(function(id) {
      var block = target.blocks[id];
      if (Array.isArray(block)) {
        Object.defineProperty(blocks, id, {value: block, enumerable: true});
        return;
      }
      if (!block || typeof block.opcode !== 'string') throw new Error('INVALID_PROGRAM');
      var copy = {};
      ['opcode', 'next', 'parent', 'inputs', 'fields', 'shadow', 'topLevel', 'x', 'y'].forEach(function(key) {
        if (Object.prototype.hasOwnProperty.call(block, key)) copy[key] = block[key];
      });
      Object.defineProperty(blocks, id, {value: copy, enumerable: true});
    });
    var definitions = function(input) {
      var result = {};
      Object.keys(input || {}).forEach(function(id) {
        if (!Array.isArray(input[id]) || typeof input[id][0] !== 'string') throw new Error('INVALID_PROGRAM');
        Object.defineProperty(result, id, {value: [input[id][0]], enumerable: true});
      });
      return result;
    };
    return {name: String(target.name || '').slice(0, 200), isStage: target.isStage === true,
      variables: definitions(target.variables), lists: definitions(target.lists), blocks: blocks};
  })};
  return clean;
}
function doPost(e) {
  var lock;
  try {
    if (!e || !e.postData || e.postData.contents.length > 800000) return output_({ok: false, code: 'INVALID_REQUEST'});
    var body = JSON.parse(e.postData.contents);
    var token = PropertiesService.getScriptProperties().getProperty('RECORD_TOKEN');
    if (!token || token.length < 8 || token.length > 200 || body.token !== token) return output_({ok: false, code: 'AUTH_REJECTED'});
    if (!['append', 'read'].includes(body.action)) return output_({ok: false, code: 'INVALID_ACTION'});
    lock = LockService.getScriptLock();
    lock.waitLock(5000);
    var sheet = sheet_();
    if (body.action === 'read') {
      var offset = body.offset;
      if (!Number.isSafeInteger(offset) || offset < 0) return output_({ok: false, code: 'INVALID_OFFSET'});
      var available = Math.max(0, sheet.getLastRow() - 1);
      var count = Math.min(100, Math.max(0, available - offset));
      var rows = count ? sheet.getRange(offset + 2, 17, count, 4).getValues() : [];
      var records = rows.map(function(row) { return clean_(JSON.parse(row.map(uncell_).join(''))); });
      return output_({ok: true, records: records, nextOffset: offset + count, more: offset + count < available});
    }
    var record = clean_(body.record);
    var lastRow = sheet.getLastRow();
    var ids = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1).getValues() : [];
    if (ids.some(function(row) { return uncell_(row[0]) === record.id; })) return output_({ok: true, id: record.id, duplicate: true});
    var parts = chunks_(JSON.stringify(record));
    var row = [record.id, record.timestamp, record.studentId, record.task.code, record.task.title, record.type,
      record.status, record.totalScore, record.maxScore, record.source, record.demoLoaded === true, record.question,
      record.guidance, record.followup, record.errorCode, record.programChanged === true].concat(parts).map(cell_);
    sheet.getRange(lastRow + 1, 1, 1, row.length).setValues([row]);
    SpreadsheetApp.flush();
    return output_({ok: true, id: record.id});
  } catch (error) { return output_({ok: false, code: 'RECORD_SERVICE_FAILED'}); }
  finally { if (lock && lock.hasLock()) lock.releaseLock(); }
}
function doGet() { return output_({ok: false, code: 'POST_REQUIRED'}); }
