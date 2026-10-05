// ---------------------------------------------------------------
// Project settings. Edit this file only; app.js reads these values.
// ---------------------------------------------------------------
window.APP_CONFIG = {
  // Public Google Form used by participants.
  FORM_URL: "https://docs.google.com/forms/d/e/1FAIpQLScg5iyrMsFIVR6wiKeU7-e10PGcbfdbewvzFShCfYlm87dijA/viewform",

  // Apps Script web app that returns the form-response sheet as JSON.
  // (Source code is in apps-script/Code.gs.)
  RESPONSES_URL: "https://script.google.com/macros/s/AKfycbwq2ojgLb3nv_DSMnZs-yh-VxHlZaGoxeAIXzqKrG4QlmAHHGAxtU20aE2zuzjbPZHRbQ/exec",

  // Optional: lets "Add a place" pre-fill Latitude and Longitude in the form.
  // In Google Forms: ⋮ menu > "Get pre-filled link", fill any value in the
  // Latitude and Longitude boxes, submit, and copy the entry.XXXXXXXXX numbers.
  // Leave as null to skip pre-filling (coordinates are then shown to copy by hand).
  FORM_ENTRY_IDS: { lat: "entry.628053126", lng: "entry.317969998" },

  REFRESH_MS: 60000,                           // auto-refresh interval for live responses
  MAP_CENTER: [6.93, 79.86],
  MAP_ZOOM: 11,
  // Responses outside this box are ignored as typing mistakes: [south, west, north, east]
  VALID_BOUNDS: [6.3, 79.5, 7.5, 80.2]
};
