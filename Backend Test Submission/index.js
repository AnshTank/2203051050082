// Build a backend logic for http url shortener microservice using Node.js and Express.js
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const createLogger = require("../Logging Middleware/loggingMiddleware");
const logger = createLogger();
const app = express();
const PORT = 5000;

const dataFilePath = path.join(__dirname, "urlRecords.json");
let urlRecords = {};

// Load saved URLs from file if available
if (fs.existsSync(dataFilePath)) {
  try {
    urlRecords = JSON.parse(fs.readFileSync(dataFilePath, "utf-8"));
  } catch {
    urlRecords = {};
  }
}

// Save URLs to file for persistence
function saveUrlRecords() {
  fs.writeFileSync(dataFilePath, JSON.stringify(urlRecords, null, 2));
}

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Checks if the provided link is a valid URL
function isWebAddressValid(link) {
  try {
    new URL(link);
    return true;
  } catch {
    return false;
  }
}

// Create a new short link or use a custom code
app.post("/shorten", (req, res) => {
  const { url: originalLink, customCode, expiryMinutes } = req.body;

  if (!originalLink || !isWebAddressValid(originalLink)) {
    const errorLog = logger(
      "POST /shorten",
      "error",
      "url-shortener",
      "A valid web address is required.",
      { originalLink }
    );
    return res.status(400).json({
      error: "A valid web address is required.",
      LogId: errorLog.LogId,
    });
  }

  let shortCode;
  if (customCode) {
    if (urlRecords[customCode]) {
      const errorLog = logger(
        "POST /shorten",
        "error",
        "url-shortener",
        "This custom code is already in use.",
        { originalLink, customCode }
      );
      return res.status(409).json({
        error: "This custom code is already in use.",
        LogId: errorLog.LogId,
      });
    }
    shortCode = customCode;
  } else {
    do {
      shortCode = uuidv4().slice(0, 8);
    } while (urlRecords[shortCode]);
  }

  const createdTimestamp = Date.now();
  const validUntil =
    createdTimestamp +
    1000 *
      60 *
      (typeof expiryMinutes === "number" && expiryMinutes > 0
        ? expiryMinutes
        : 60);

  urlRecords[shortCode] = {
    originalLink,
    createdTimestamp,
    validUntil,
  };
  saveUrlRecords();

  const successLog = logger(
    "POST /shorten",
    "info",
    "url-shortener",
    "Web address has been shortened.",
    { originalLink, shortCode, validUntil }
  );

  res.json({ shortCode, validUntil, LogId: successLog.LogId });
});

// Retrieve the original link for a given short code
app.get("/url/:shortCode", (req, res) => {
  const { shortCode } = req.params;
  const record = urlRecords[shortCode];

  if (!record) {
    const errorLog = logger(
      "GET /url/:shortCode",
      "error",
      "url-shortener",
      "Short link not found.",
      { shortCode }
    );
    return res
      .status(404)
      .json({ error: "Short link not found.", LogId: errorLog.LogId });
  }

  if (Date.now() > record.validUntil) {
    const errorLog = logger(
      "GET /url/:shortCode",
      "error",
      "url-shortener",
      "This short link has expired.",
      { shortCode }
    );
    return res
      .status(410)
      .json({ error: "This short link has expired.", LogId: errorLog.LogId });
  }

  const successLog = logger(
    "GET /url/:shortCode",
    "info",
    "url-shortener",
    "Original web address found.",
    { shortCode, originalLink: record.originalLink }
  );
  res.json({
    originalLink: record.originalLink,
    validUntil: record.validUntil,
    LogId: successLog.LogId,
  });
});

// Redirect to the original link using the short code
app.get("/s/:shortCode", (req, res) => {
  const { shortCode } = req.params;
  const record = urlRecords[shortCode];

  if (!record) {
    const errorLog = logger(
      "GET /s/:shortCode",
      "error",
      "url-shortener",
      "Short link not found for redirect.",
      { shortCode }
    );
    return res
      .status(404)
      .json({ error: "Short link not found.", LogId: errorLog.LogId });
  }

  if (Date.now() > record.validUntil) {
    const errorLog = logger(
      "GET /s/:shortCode",
      "error",
      "url-shortener",
      "This short link has expired.",
      { shortCode }
    );
    return res
      .status(410)
      .json({ error: "This short link has expired.", LogId: errorLog.LogId });
  }

  res.redirect(record.originalLink);
});

// Show all shortened links with their details
app.get("/urls", (req, res) => {
  const history = Object.entries(urlRecords).map(([shortCode, data]) => ({
    shortCode,
    originalLink: data.originalLink,
    createdTimestamp: data.createdTimestamp,
    validUntil: data.validUntil,
    expired: Date.now() > data.validUntil,
  }));

  const successLog = logger(
    "GET /urls",
    "info",
    "url-shortener",
    "History retrieved.",
    { history }
  );
  res.json({ urls: history, LogId: successLog.LogId });
});

app.listen(PORT, () => {
  console.log(`URL shortener is running at http://localhost:${PORT}`);
});
