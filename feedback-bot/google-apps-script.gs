// Google Apps Script: принимает отзыв от бота и пишет строку в таблицу.
// Отдельный (standalone) скрипт — пишет в таблицу по её ID.
//
// Установка (один раз):
// 1. Открыть script.new (создастся новый проект Apps Script).
// 2. Вставить этот код, указать SHEET_ID своей таблицы.
// 3. Деплой -> Веб-приложение: «Выполнять как: Я», «Доступ: Все».
// 4. Скопировать URL (.../exec) -> .env: SHEETS_WEBHOOK_URL.

var SHEET_ID = "1zyRHtN-zDU3Z7xRaigjLMbP0Y8Fg8Hv7uQAnB8qnWjw";

var HEADERS = [
  "Дата", "Заведение", "Имя", "Телефон", "TG username", "TG ID",
  "Общая", "Вкус", "Время доставки", "Упаковка", "Скорость",
  "Комментарий", "Фото (file_id)", "Важный"
];

var KEYS = [
  "date", "venue", "name", "phone", "username", "telegram_id",
  "overall", "taste", "delivery_time", "packaging", "delivery_speed",
  "comment", "photo_id", "important"
];

function doPost(e) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  }
  var d = JSON.parse(e.postData.contents);
  sheet.appendRow(KEYS.map(function (k) { return d[k]; }));
  return ContentService.createTextOutput("ok");
}
