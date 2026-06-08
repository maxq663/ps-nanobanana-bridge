const photoshop = require("photoshop");
const uxp = require("uxp");

const { app, core, constants } = photoshop;
const { entrypoints } = uxp;
const { formats, localFileSystem: fs, secureStorage } = uxp.storage;

const CONFIG_KEYS = {
  apiUrl: "nanobanan.apiUrl",
  apiKey: "nanobanan.apiKey",
  authMode: "nanobanan.authMode",
  model: "nanobanan.model",
  prompt: "nanobanan.prompt",
  extraFields: "nanobanan.extraFields",
  fitBounds: "nanobanan.fitBounds"
};

const DEFAULTS = {
  apiUrl: "https://ai.comfly.org/v1/images/edits",
  authMode: "bearer",
  model: "nanobanan",
  prompt: "处理这个 Photoshop 选中图层，并返回编辑后的图片。",
  extraFields: '{"response_format":"b64_json"}',
  fitBounds: true
};

function $(id) {
  return document.getElementById(id);
}

const layerStatus = $("layerStatus");
const statusBar = $("status");
const connLabel = $("connLabel");
const connBox = $("connectionStatus");
const apiUrlInput = $("apiUrlInput");
const apiKeyInput = $("apiKeyInput");
const authModeInput = $("authModeInput");
const modelInput = $("modelInput");
const promptInput = $("promptInput");
const extraFieldsInput = null;
const fitBoundsBtn = $("fitBoundsInput");
const uploadBtn = $("uploadBtn");
const sendApiBtn = $("sendApiBtn");
const importPsBtn = $("importPsBtn");
const previewSourceImg = $("previewSourceImg");
const previewSourceEmpty = $("previewSourceEmpty");
const previewResultImg = $("previewResultImg");
const previewResultEmpty = $("previewResultEmpty");
const testBtn = $("testBtn");
const saveConfigBtn = $("saveConfigBtn");
const refreshBtn = $("refreshBtn");

let currentAuthMode = DEFAULTS.authMode;
let currentFitBounds = true;
let uploadedData = null;
let apiResultBase64 = null;

function setStatus(msg, type) {
  statusBar.textContent = msg;
  statusBar.className = "status-bar";
  if (type === "ok") statusBar.className = "status-bar status-ok";
  if (type === "bad") statusBar.className = "status-bar status-bad";
}

function setConnStatus(msg, type) {
  connLabel.textContent = msg;
  connBox.className = "conn-box";
  var dot = connBox.querySelector(".dot");
  dot.className = "dot dot-gray";
  if (type === "ok") {
    connBox.className = "conn-box conn-ok";
    dot.className = "dot dot-green";
  }
  if (type === "bad") {
    connBox.className = "conn-box conn-bad";
    dot.className = "dot dot-red";
  }
}

function setAuthMode(value) {
  currentAuthMode = value;
  var buttons = authModeInput.querySelectorAll(".seg");
  for (var i = 0; i < buttons.length; i++) {
    var btn = buttons[i];
    var base = "seg";
    if (i === 0) base = "seg seg-first";
    if (i === buttons.length - 1) base = "seg seg-last";
    if (btn.getAttribute("data-value") === value) {
      btn.className = base + " seg-active";
    } else {
      btn.className = base;
    }
  }
}

function setFitBounds(value) {
  currentFitBounds = value;
  if (value) {
    fitBoundsBtn.textContent = "结果适配原图层边界：开启";
    fitBoundsBtn.className = "btn-toggle toggle-on";
  } else {
    fitBoundsBtn.textContent = "结果适配原图层边界：关闭";
    fitBoundsBtn.className = "btn-toggle toggle-off";
  }
}

function setBusy(busy) {
  uploadBtn.disabled = busy;
  sendApiBtn.disabled = busy || !uploadedData;
  importPsBtn.disabled = busy || !apiResultBase64;
  testBtn.disabled = busy;
  saveConfigBtn.disabled = busy;
}

function getActiveDocument() {
  return app.documents.length ? app.activeDocument : null;
}

function getSelectedLayer(doc) {
  if (!doc || !doc.activeLayers || doc.activeLayers.length !== 1) return null;
  return doc.activeLayers[0];
}

function normalizeBounds(bounds) {
  var left = Number(bounds.left);
  var top = Number(bounds.top);
  var right = Number(bounds.right);
  var bottom = Number(bounds.bottom);
  if (right <= left || bottom <= top) throw new Error("图层没有可见像素边界。");
  return { left: left, top: top, right: right, bottom: bottom, width: Math.ceil(right - left), height: Math.ceil(bottom - top) };
}

function updateLayerStatus() {
  var doc = getActiveDocument();
  if (!doc) { layerStatus.textContent = "未检测到文档。"; return; }
  var layer = getSelectedLayer(doc);
  if (!layer) { layerStatus.textContent = doc.title + " - 请选择一个图层"; return; }
  var b = normalizeBounds(layer.bounds);
  layerStatus.textContent = layer.name + " - " + b.width + " x " + b.height + "px";
}

function readLocal(key, fallback) {
  var v = localStorage.getItem(key);
  return v === null ? (fallback || "") : v;
}

function writeLocal(key, value) {
  localStorage.setItem(key, String(value));
}

async function readSecret(key) {
  try {
    var v = await secureStorage.getItem(key);
    if (!v) return "";
    if (typeof v === "string") return v;
    return new TextDecoder().decode(v);
  } catch (e) {
    return localStorage.getItem(key + ".fallback") || "";
  }
}

async function writeSecret(key, value) {
  try {
    await secureStorage.setItem(key, value);
    localStorage.removeItem(key + ".fallback");
  } catch (e) {
    localStorage.setItem(key + ".fallback", value);
  }
}

async function loadConfig() {
  apiUrlInput.value = readLocal(CONFIG_KEYS.apiUrl, DEFAULTS.apiUrl);
  apiKeyInput.value = await readSecret(CONFIG_KEYS.apiKey);
  setAuthMode(readLocal(CONFIG_KEYS.authMode, DEFAULTS.authMode));
  var savedModel = readLocal(CONFIG_KEYS.model, DEFAULTS.model);
  setModelValue(savedModel);
  promptInput.value = readLocal(CONFIG_KEYS.prompt, DEFAULTS.prompt);
  setFitBounds(readLocal(CONFIG_KEYS.fitBounds, "true") === "true");
}

async function saveConfig() {
  writeLocal(CONFIG_KEYS.apiUrl, apiUrlInput.value.trim());
  await writeSecret(CONFIG_KEYS.apiKey, apiKeyInput.value.trim());
  writeLocal(CONFIG_KEYS.authMode, currentAuthMode);
  writeLocal(CONFIG_KEYS.model, modelInput.value || DEFAULTS.model);
  writeLocal(CONFIG_KEYS.prompt, promptInput.value.trim() || DEFAULTS.prompt);
  writeLocal(CONFIG_KEYS.fitBounds, String(currentFitBounds));
  setStatus("配置已保存。", "ok");
}

function setModelValue(value) {
  var options = modelInput.querySelectorAll("option");
  var found = false;
  for (var i = 0; i < options.length; i++) {
    if (options[i].value === value) { found = true; break; }
  }
  if (!found && value) {
    var opt = document.createElement("option");
    opt.value = value;
    opt.textContent = value;
    modelInput.appendChild(opt);
  }
  modelInput.value = value;
}

function populateModels(models) {
  var current = modelInput.value;
  while (modelInput.firstChild) {
    modelInput.removeChild(modelInput.firstChild);
  }
  var filtered = [];
  for (var i = 0; i < models.length; i++) {
    var lower = models[i].toLowerCase();
    if (lower.indexOf("nano") !== -1 || lower.indexOf("banana") !== -1) {
      filtered.push(models[i]);
    }
  }
  if (filtered.length === 0) filtered = models;
  for (var i = 0; i < filtered.length; i++) {
    var opt = document.createElement("option");
    opt.value = filtered[i];
    opt.textContent = filtered[i];
    modelInput.appendChild(opt);
  }
  if (current) setModelValue(current);
  if (!modelInput.value && filtered.length > 0) {
    modelInput.value = filtered[0];
  }
}

function normalizeApiUrl(value) {
  var trimmed = (value || "").trim().replace(/\/+$/, "");
  var url = new URL(trimmed);
  var path = url.pathname.replace(/\/+$/, "");
  if (!path || path === "/") { url.pathname = "/v1/images/edits"; return url.toString(); }
  if (path === "/v1") { url.pathname = "/v1/images/edits"; return url.toString(); }
  return trimmed;
}

function getApiOriginUrl(apiUrl) {
  var url = new URL(apiUrl);
  url.pathname = "/v1";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/+$/, "");
}

function buildHeaders() {
  var headers = {};
  var key = apiKeyInput.value.trim();
  if (currentAuthMode === "bearer") headers["Authorization"] = "Bearer " + key;
  if (currentAuthMode === "x-api-key") headers["x-api-key"] = key;
  if (currentAuthMode === "api-key") headers["api-key"] = key;
  return headers;
}

function readConfig() {
  var apiUrl = normalizeApiUrl(apiUrlInput.value || DEFAULTS.apiUrl);
  var apiKey = apiKeyInput.value.trim();
  var model = modelInput.value.trim() || DEFAULTS.model;
  var prompt = promptInput.value.trim() || DEFAULTS.prompt;
  if (!apiUrl) throw new Error("请填写 API 地址。");
  if (currentAuthMode !== "none" && !apiKey) throw new Error("请填写 API Key。");
  return { apiUrl: apiUrl, apiKey: apiKey, authMode: currentAuthMode, model: model, prompt: prompt, fitBounds: currentFitBounds };
}

async function fetchModels() {
  var apiUrl = normalizeApiUrl(apiUrlInput.value || DEFAULTS.apiUrl);
  var modelsUrl = getApiOriginUrl(apiUrl) + "/models";
  var response = await fetch(modelsUrl, { method: "GET", headers: buildHeaders() });
  if (!response.ok) return [];
  var json = await response.json();
  var list = json.data || json.models || json;
  if (!Array.isArray(list)) return [];
  var ids = [];
  for (var i = 0; i < list.length; i++) {
    var id = list[i].id || list[i].name || list[i];
    if (typeof id === "string" && id.length > 0) ids.push(id);
  }
  ids.sort();
  return ids;
}

async function testApiConnection() {
  var config = readConfig();
  var modelsUrl = getApiOriginUrl(config.apiUrl) + "/models";
  setConnStatus("正在检测连接...");
  setStatus("正在检测 API 地址和 Key...");
  var response = await fetch(modelsUrl, { method: "GET", headers: buildHeaders() });
  if (response.ok) {
    var json = await response.json();
    var list = json.data || json.models || json;
    if (Array.isArray(list)) {
      var ids = [];
      for (var i = 0; i < list.length; i++) {
        var id = list[i].id || list[i].name || list[i];
        if (typeof id === "string" && id.length > 0) ids.push(id);
      }
      ids.sort();
      if (ids.length > 0) {
        populateModels(ids);
        setConnStatus("连接成功，已获取 " + ids.length + " 个模型。", "ok");
        setStatus("连接成功，模型列表已更新。", "ok");
        return;
      }
    }
    setConnStatus("连接成功，API Key 可用。", "ok");
    setStatus("连接检测成功。", "ok");
    return;
  }
  if (response.status === 401 || response.status === 403) throw new Error("API Key 无效或没有权限。");
  if (response.status === 404) throw new Error("未找到检测接口: " + modelsUrl);
  var text = await response.text();
  throw new Error("HTTP " + response.status + " " + text.slice(0, 120));
}

async function createTempFile(prefix, ext) {
  var folder = await fs.getTemporaryFolder();
  return folder.createFile(prefix + "-" + Date.now() + "." + ext, { overwrite: true });
}

async function exportSelection() {
  var result;
  await core.executeAsModal(async function () {
    var doc = getActiveDocument();
    if (!doc) throw new Error("请先打开一个 Photoshop 文档。");

    var bounds;
    var hasSelection = false;
    try {
      var sel = doc.selection;
      var sb = sel.bounds;
      if (sb && sb.right > sb.left && sb.bottom > sb.top) {
        bounds = { left: sb.left, top: sb.top, right: sb.right, bottom: sb.bottom };
        hasSelection = true;
      }
    } catch (e) {}

    if (!hasSelection) {
      var layer = getSelectedLayer(doc);
      if (!layer) throw new Error("请先框选区域或选择一个图层。");
      bounds = normalizeBounds(layer.bounds);
    }

    var w = Math.ceil(bounds.right - bounds.left);
    var h = Math.ceil(bounds.bottom - bounds.top);
    var squareSize = Math.max(w, h);

    var batchPlay = require("photoshop").action.batchPlay;
    await batchPlay([{ _obj: "copyMerged" }], {});

    var exportDoc = await app.createDocument({
      width: squareSize, height: squareSize,
      resolution: doc.resolution, mode: "RGBColorMode",
      fill: "transparent", name: "Nanobanan Export"
    });

    await batchPlay([{ _obj: "paste" }], {});

    var exportFile = await createTempFile("nanobanan-sel", "png");
    await exportDoc.saveAs.png(exportFile, { compression: 6 }, true);
    exportDoc.closeWithoutSaving();

    result = {
      file: exportFile,
      sourceDoc: doc,
      squareSize: squareSize,
      bounds: { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom, width: w, height: h },
      layerName: hasSelection ? "选区" : (doc.activeLayers[0] ? doc.activeLayers[0].name : "图层")
    };
  }, { commandName: "Export selection for Nanobanan" });
  return result;
}

function arrayBufferToBase64(buffer) {
  var bytes = new Uint8Array(buffer);
  var binary = "";
  for (var i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function uploadLayer() {
  setStatus("正在导出框选区域...");
  var data = await exportSelection();
  var bytes = await data.file.read({ format: formats.binary });
  var base64 = arrayBufferToBase64(bytes);

  previewSourceImg.src = "data:image/png;base64," + base64;
  previewSourceImg.style.display = "block";
  previewSourceEmpty.style.display = "none";

  uploadedData = data;
  uploadedData.bytes = bytes;
  sendApiBtn.disabled = false;

  var info = data.layerName + " " + data.bounds.width + "x" + data.bounds.height + "px";
  setStatus("已上传: " + info + "，可点击上传API网站。", "ok");
}

function arrayBufferFromBase64(base64) {
  var clean = base64.replace(/^data:[^,]+,/, "").replace(/\s/g, "");
  var binary = atob(clean);
  var bytes = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function extractJsonImage(json) {
  var b64 = "";
  if (Array.isArray(json.data) && json.data[0]) {
    b64 = json.data[0].b64_json || json.data[0].image_base64 || json.data[0].output_image || "";
  }
  if (!b64) b64 = json.b64_json || json.image_base64 || json.output_image || "";
  if (!b64 && json.result) b64 = json.result.b64_json || json.result.image_base64 || "";
  if (!b64 && json.data && !Array.isArray(json.data)) b64 = json.data.b64_json || "";
  if (b64 && b64.length > 128) return { buffer: arrayBufferFromBase64(b64) };
  var url = "";
  if (Array.isArray(json.data) && json.data[0]) url = json.data[0].url || "";
  if (!url) url = json.url || json.image_url || json.output_url || "";
  if (url) return { url: url };
  if (json.image && json.image.length > 128) return { buffer: arrayBufferFromBase64(json.image) };
  throw new Error("接口返回中没有找到图片。");
}

async function sendToApi() {
  if (!uploadedData) throw new Error("请先上传图层。");
  var config = readConfig();
  await saveConfig();

  sendApiBtn.textContent = "处理中...";
  setStatus("正在发送到 AI 接口，请等待...");
  previewResultEmpty.textContent = "正在等待 API 返回...";

  var imageBlob = new Blob([uploadedData.bytes], { type: "image/png" });
  var form = new FormData();
  form.append("image", imageBlob, "selection.png");
  form.append("prompt", config.prompt);
  form.append("model", config.model);
  form.append("response_format", "b64_json");

  var response;
  try {
    response = await fetch(config.apiUrl, { method: "POST", headers: buildHeaders(), body: form });
  } catch (e) {
    sendApiBtn.textContent = "上传API网站";
    previewResultEmpty.textContent = "API 返回结果将显示在此处";
    throw new Error("网络错误：" + (e.message || "无法连接到 API"));
  }

  if (!response.ok) {
    sendApiBtn.textContent = "上传API网站";
    previewResultEmpty.textContent = "API 返回结果将显示在此处";
    var msg = await response.text();
    throw new Error("接口请求失败：HTTP " + response.status + " " + msg.slice(0, 200));
  }

  var ct = response.headers.get("content-type") || "";
  var resultBuffer;
  if (ct.startsWith("image/")) {
    resultBuffer = await response.arrayBuffer();
  } else {
    var json = await response.json();
    var img = extractJsonImage(json);
    if (img.url) {
      var r2 = await fetch(img.url, { headers: buildHeaders() });
      if (!r2.ok) throw new Error("结果图片下载失败：HTTP " + r2.status);
      resultBuffer = await r2.arrayBuffer();
    } else {
      resultBuffer = img.buffer;
    }
  }

  var resultBase64 = arrayBufferToBase64(resultBuffer);
  previewResultImg.src = "data:image/png;base64," + resultBase64;
  previewResultImg.style.display = "block";
  previewResultEmpty.style.display = "none";

  apiResultBase64 = resultBase64;
  importPsBtn.disabled = false;
  sendApiBtn.textContent = "上传API网站";
  setStatus("API 返回成功，预览结果后点击传回PS。", "ok");
}

async function importToPs() {
  if (!apiResultBase64 || !uploadedData) throw new Error("没有可导入的结果。");
  setStatus("正在导入到 PS...");

  var resultBytes = new Uint8Array(arrayBufferFromBase64(apiResultBase64));
  var folder = await fs.getTemporaryFolder();
  var file = await folder.createFile("xinban-result-" + Date.now() + ".png", { overwrite: true });
  await file.write(resultBytes, { format: formats.binary });

  var batchPlay = require("photoshop").action.batchPlay;

  await core.executeAsModal(async function () {
    var targetDoc = uploadedData.sourceDoc;
    var targetW = uploadedData.bounds.width;
    var targetH = uploadedData.bounds.height;
    var targetL = uploadedData.bounds.left;
    var targetT = uploadedData.bounds.top;
    var squareSize = uploadedData.squareSize;
    var docRes = targetDoc.resolution;

    var sessionToken = await fs.createSessionToken(file);

    // Step 1: crop the square result to original W×H (removes white padding)
    var cropDoc = await app.createDocument({
      width: targetW, height: targetH,
      resolution: docRes, mode: "RGBColorMode",
      fill: "transparent", name: "Xinban Crop"
    });

    await batchPlay([{
      _obj: "placeEvent",
      null: { _path: sessionToken, _kind: "local" },
      freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
      offset: { _obj: "offset", horizontal: { _unit: "pixelsUnit", _value: 0 }, vertical: { _unit: "pixelsUnit", _value: 0 } }
    }], {});

    var cropLayer = cropDoc.activeLayers[0];
    var cb = normalizeBounds(cropLayer.bounds);
    var uniformCropScale = (squareSize / cb.width) * 100;
    var cropDocCx = targetW / 2;
    var cropDocCy = targetH / 2;
    var cropLayerCx = cb.left + cb.width / 2;
    var cropLayerCy = cb.top + cb.height / 2;
    var cropDx = cropDocCx - cropLayerCx;
    var cropDy = cropDocCy - cropLayerCy;

    await batchPlay([{
      _obj: "transform",
      freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
      offset: { _obj: "offset", horizontal: { _unit: "pixelsUnit", _value: cropDx }, vertical: { _unit: "pixelsUnit", _value: cropDy } },
      width: { _unit: "percentUnit", _value: uniformCropScale },
      height: { _unit: "percentUnit", _value: uniformCropScale }
    }], {});

    cropDoc.flatten();
    var croppedFile = await folder.createFile("xinban-cropped-" + Date.now() + ".png", { overwrite: true });
    await cropDoc.saveAs.png(croppedFile, { compression: 6 }, true);
    cropDoc.closeWithoutSaving();

    // Step 2: place the cropped image in the target document
    app.activeDocument = targetDoc;
    var croppedToken = await fs.createSessionToken(croppedFile);

    await batchPlay([{
      _obj: "placeEvent",
      null: { _path: croppedToken, _kind: "local" },
      freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
      offset: { _obj: "offset", horizontal: { _unit: "pixelsUnit", _value: 0 }, vertical: { _unit: "pixelsUnit", _value: 0 } }
    }], {});

    var placedLayer = targetDoc.activeLayers[0];
    placedLayer.name = uploadedData.layerName + " - AI";

    var rb = normalizeBounds(placedLayer.bounds);
    var uniformScale = (targetW / rb.width) * 100;
    var destCx = targetL + targetW / 2;
    var destCy = targetT + targetH / 2;
    var layerCx = rb.left + rb.width / 2;
    var layerCy = rb.top + rb.height / 2;
    var dx = destCx - layerCx;
    var dy = destCy - layerCy;

    await batchPlay([{
      _obj: "transform",
      freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
      offset: { _obj: "offset", horizontal: { _unit: "pixelsUnit", _value: dx }, vertical: { _unit: "pixelsUnit", _value: dy } },
      width: { _unit: "percentUnit", _value: uniformScale },
      height: { _unit: "percentUnit", _value: uniformScale }
    }], {});

    // feathered inward mask: select bounds, contract 2px, feather 2px, apply mask
    await batchPlay([{
      _obj: "set",
      _target: [{ _ref: "channel", _property: "selection" }],
      to: {
        _obj: "rectangle",
        top: { _unit: "pixelsUnit", _value: targetT },
        left: { _unit: "pixelsUnit", _value: targetL },
        bottom: { _unit: "pixelsUnit", _value: targetT + targetH },
        right: { _unit: "pixelsUnit", _value: targetL + targetW }
      }
    }], {});

    await batchPlay([{
      _obj: "contract",
      by: { _unit: "pixelsUnit", _value: 2 }
    }], {});

    await batchPlay([{
      _obj: "feather",
      radius: { _unit: "pixelsUnit", _value: 2 }
    }], {});

    await batchPlay([{
      _obj: "make",
      new: { _class: "channel" },
      at: { _ref: "channel", _enum: "channel", _value: "mask" },
      using: { _enum: "userMaskEnabled", _value: "revealSelection" }
    }], {});

    await batchPlay([{
      _obj: "set",
      _target: [{ _ref: "channel", _property: "selection" }],
      to: { _enum: "ordinal", _value: "none" }
    }], {});

  }, { commandName: "Import result" });

  updateLayerStatus();
  setStatus("已传回PS，结果已作为新图层导入。", "ok");

  uploadedData = null;
  apiResultBase64 = null;
  sendApiBtn.disabled = true;
  importPsBtn.disabled = true;
  previewSourceImg.style.display = "none";
  previewSourceEmpty.style.display = "block";
  previewResultImg.style.display = "none";
  previewResultEmpty.style.display = "block";
}

async function withBusy(fn) {
  try {
    setBusy(true);
    await fn();
  } catch (e) {
    console.error(e);
    setStatus(e.message || "操作失败。", "bad");
    setConnStatus(e.message || "失败", "bad");
  } finally {
    setBusy(false);
  }
}

refreshBtn.addEventListener("click", function () {
  updateLayerStatus();
  setStatus("图层状态已刷新。", "ok");
});

apiKeyInput.addEventListener("change", function () {
  writeSecret(CONFIG_KEYS.apiKey, apiKeyInput.value.trim());
});

apiUrlInput.addEventListener("change", function () {
  writeLocal(CONFIG_KEYS.apiUrl, apiUrlInput.value.trim());
});

saveConfigBtn.addEventListener("click", function () { withBusy(saveConfig); });

testBtn.addEventListener("click", function () {
  setStatus("已点击检测连接。");
  withBusy(testApiConnection);
});

uploadBtn.addEventListener("click", function () {
  withBusy(uploadLayer);
});

sendApiBtn.addEventListener("click", function () {
  withBusy(sendToApi);
});

importPsBtn.addEventListener("click", function () {
  withBusy(importToPs);
});

fitBoundsBtn.addEventListener("click", function () {
  setFitBounds(!currentFitBounds);
});

// consult buttons (QR code popup placeholder)
function showConsultDialog(name) {
  setStatus("咨询：" + name + " — 二维码功能即将上线。", "ok");
}

$("consultWoxin").addEventListener("click", function () { showConsultDialog("我心"); });
$("consultHuixin").addEventListener("click", function () { showConsultDialog("绘欣"); });
$("consultQianning").addEventListener("click", function () { showConsultDialog("浅柠"); });

var authButtons = authModeInput.querySelectorAll(".seg");
for (var i = 0; i < authButtons.length; i++) {
  (function (btn) {
    btn.addEventListener("click", function () {
      setAuthMode(btn.getAttribute("data-value"));
    });
  })(authButtons[i]);
}

entrypoints.setup({
  panels: {
    nanobananPanel: {
      show: function () {
        updateLayerStatus();
      }
    }
  }
});

loadConfig().then(function () { updateLayerStatus(); }).catch(function (e) { setStatus(e.message, "bad"); });
