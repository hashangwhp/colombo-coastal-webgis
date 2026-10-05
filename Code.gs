/**
 * Google Apps Script: publishes the Google Form's response sheet as JSON.
 *
 * Setup
 * 1. In the Google Form: Responses tab > "Link to Sheets" (creates the response sheet).
 * 2. Open that sheet > Extensions > Apps Script, paste this file, save.
 * 3. Deploy > New deployment > type "Web app"
 *      Execute as: Me      Who has access: Anyone
 * 4. Copy the /exec URL into js/config.js (RESPONSES_URL).
 * 5. After any code change use Deploy > Manage deployments > Edit > New version.
 *
 * Privacy: the form collects no names or e-mail addresses. Do NOT add questions that
 * collect personal data to this sheet, because every column is published.
 */
function doGet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var values = sheet.getDataRange().getValues();
  var headers = values.shift().map(String);
  var rows = values
    .filter(function (r) { return r.some(function (c) { return c !== ''; }); })
    .map(function (r) {
      var o = {};
      headers.forEach(function (h, i) {
        o[h] = r[i] instanceof Date ? r[i].toISOString() : r[i];
      });
      return o;
    });
  return ContentService
    .createTextOutput(JSON.stringify({ updated: new Date().toISOString(), data: rows }))
    .setMimeType(ContentService.MimeType.JSON);
}
