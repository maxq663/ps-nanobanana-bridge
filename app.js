(function () {
  "use strict";

  var seq = 0;
  var pending = new Map();

  function callHost(method, args) {
    var id = "msg-" + Date.now() + "-" + (++seq);
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        pending.delete(id);
        reject(new Error("宿主通信超时：" + method));
      }, 60000);
      pending.set(id, { resolve: resolve, reject: reject, timer: timer });
      window.uxpHost.postMessage({ id: id, method: method, args: args || [] });
    });
  }

  window.addEventListener("message", function (event) {
    var payload = event && event.data;
    if (!payload || typeof payload !== "object") return;
    if (payload.type === "host.ready") return;
    if (!("id" in payload)) return;
    var entry = pending.get(payload.id);
    if (!entry) return;
    pending.delete(payload.id);
    clearTimeout(entry.timer);
    if (payload.error) {
      entry.reject(new Error(payload.error.message || "宿主通信失败"));
    } else {
      entry.resolve(payload.result);
    }
  });

  var $ = function (id) { return document.getElementById(id); };

  var dom = {
    layerStatus: $("layerStatus"),
    statusBar: $("status"),
    connLabel: $("connLabel"),
    connBox: $("connectionStatus"),
    apiUrlInput: $("apiUrlInput"),
    apiKeyInput: $("apiKeyInput"),
    authModeInput: $("authModeInput"),
    modelInput: $("modelInput"),
    promptInput: $("promptInput"),
    fitBoundsBtn: $("fitBoundsInput"),
    uploadBtn: $("uploadBtn"),
    sendApiBtn: $("sendApiBtn"),
    importPsBtn: $("importPsBtn"),
    previewSourceImg: $("previewSourceImg"),
    previewSourceEmpty: $("previewSourceEmpty"),
    previewResultImg: $("previewResultImg"),
    previewResultEmpty: $("previewResultEmpty"),
    testBtn: $("testBtn"),
    saveConfigBtn: $("saveConfigBtn"),
    refreshBtn: $("refreshBtn"),
    loadPromptBtn: $("loadPromptBtn")
  };

  var state = {
    currentAuthMode: "api-key",
    currentFitBounds: true,
    uploadedBase64: null,
    apiResultBase64: null
  };

  var DEFAULTS = {
    apiUrl: "https://ai.comfly.org/v1/images/edits",
    authMode: "api-key",
    model: "nanobanan",
    prompt: "处理这个 Photoshop 选中图层，并返回编辑后的图片。"
  };

  function setStatus(msg, type) {
    dom.statusBar.textContent = msg;
    dom.statusBar.className = "status-bar";
    if (type === "ok") dom.statusBar.className = "status-bar status-ok";
    if (type === "bad") dom.statusBar.className = "status-bar status-bad";
  }

  function setConnStatus(msg, type) {
    dom.connLabel.textContent = msg;
    dom.connBox.className = "conn-box";
    var dot = dom.connBox.querySelector(".dot");
    dot.className = "dot dot-gray";
    if (type === "ok") { dom.connBox.className = "conn-box conn-ok"; dot.className = "dot dot-green"; }
    if (type === "bad") { dom.connBox.className = "conn-box conn-bad"; dot.className = "dot dot-red"; }
  }

  function setAuthMode(value) {
    state.currentAuthMode = value;
    var buttons = dom.authModeInput.querySelectorAll(".seg");
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var base = "seg";
      if (i === 0) base = "seg seg-first";
      if (i === buttons.length - 1) base = "seg seg-last";
      btn.className = btn.getAttribute("data-value") === value ? base + " seg-active" : base;
    }
  }

  function setFitBounds(value) {
    state.currentFitBounds = value;
    if (value) {
      dom.fitBoundsBtn.textContent = "结果适配原图层边界：开启";
      dom.fitBoundsBtn.className = "btn-toggle toggle-on";
    } else {
      dom.fitBoundsBtn.textContent = "结果适配原图层边界：关闭";
      dom.fitBoundsBtn.className = "btn-toggle toggle-off";
    }
  }

  function setBusy(busy) {
    dom.uploadBtn.disabled = busy;
    dom.sendApiBtn.disabled = busy || !state.uploadedBase64;
    dom.importPsBtn.disabled = busy || !state.apiResultBase64;
    dom.testBtn.disabled = busy;
    dom.saveConfigBtn.disabled = busy;
  }

  function normalizeApiUrl(value) {
    var trimmed = (value || "").trim().replace(/\/+$/, "");
    try {
      var url = new URL(trimmed);
      var path = url.pathname.replace(/\/+$/, "");
      if (!path || path === "/") { url.pathname = "/v1/images/edits"; return url.toString(); }
      if (path === "/v1") { url.pathname = "/v1/images/edits"; return url.toString(); }
    } catch (e) {}
    return trimmed;
  }

  function getApiOriginUrl(apiUrl) {
    try {
      var url = new URL(apiUrl);
      url.pathname = "/v1";
      url.search = "";
      url.hash = "";
      return url.toString().replace(/\/+$/, "");
    } catch (e) { return apiUrl; }
  }

  function buildHeaders() {
    var headers = {};
    var key = dom.apiKeyInput.value.trim();
    var mode = state.currentAuthMode;
    if (mode === "bearer") headers["Authorization"] = "Bearer " + key;
    if (mode === "x-api-key") headers["x-api-key"] = key;
    if (mode === "api-key") headers["api-key"] = key;
    return headers;
  }

  function extractJsonImage(json) {
    if (json.data && json.data[0]) {
      var d = json.data[0];
      if (d.b64_json) return { buffer: base64ToArrayBuffer(d.b64_json) };
      if (d.url) return { url: d.url };
    }
    if (json.b64_json) return { buffer: base64ToArrayBuffer(json.b64_json) };
    if (json.url) return { url: json.url };
    if (json.output && json.output.url) return { url: json.output.url };
    throw new Error("无法从响应中提取图片数据。");
  }

  function base64ToArrayBuffer(b64) {
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  function arrayBufferToBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var binary = "";
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
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

  // --- Actions ---

  async function doRefresh() {
    var info = await callHost("ps.getLayerStatus");
    dom.layerStatus.textContent = info.text;
    setStatus("图层状态已刷新。", "ok");
  }

  async function doLoadConfig() {
    var data = await callHost("config.load");
    dom.apiUrlInput.value = data.api.url || DEFAULTS.apiUrl;
    dom.apiKeyInput.value = data.api.key || "";
    setAuthMode(data.api.authMode || DEFAULTS.authMode);
    setModelValue(data.api.model || DEFAULTS.model);
    dom.promptInput.value = data.params.prompt || DEFAULTS.prompt;
    setFitBounds(data.params.fitBounds !== false);
    var info = await callHost("ps.getLayerStatus");
    dom.layerStatus.textContent = info.text;
  }

  async function doSaveConfig() {
    var data = {
      api: {
        url: dom.apiUrlInput.value.trim() || DEFAULTS.apiUrl,
        key: dom.apiKeyInput.value.trim(),
        authMode: state.currentAuthMode,
        model: dom.modelInput.value || DEFAULTS.model
      },
      params: {
        prompt: dom.promptInput.value.trim() || DEFAULTS.prompt,
        fitBounds: state.currentFitBounds
      }
    };
    await callHost("config.save", [data]);
    setStatus("配置已保存。", "ok");
  }

  async function doTestConnection() {
    var apiUrl = normalizeApiUrl(dom.apiUrlInput.value || DEFAULTS.apiUrl);
    var modelsUrl = getApiOriginUrl(apiUrl) + "/models";
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

  async function doUpload() {
    setStatus("正在导出框选区域...");
    var result = await callHost("ps.exportSelection");
    state.uploadedBase64 = result.base64;
    dom.previewSourceImg.src = "data:image/png;base64," + result.base64;
    dom.previewSourceImg.style.display = "block";
    dom.previewSourceEmpty.style.display = "none";
    dom.sendApiBtn.disabled = false;
    setStatus("已上传: " + result.layerName + " " + result.width + "x" + result.height + "px", "ok");
  }

  async function doSendApi() {
    if (!state.uploadedBase64) throw new Error("请先上传图层。");
    await doSaveConfig();
    dom.sendApiBtn.textContent = "处理中...";
    setStatus("正在发送到 AI 接口，请等待...");
    dom.previewResultEmpty.textContent = "正在等待 API 返回...";

    var apiUrl = normalizeApiUrl(dom.apiUrlInput.value || DEFAULTS.apiUrl);
    var binary = atob(state.uploadedBase64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    var imageBlob = new Blob([bytes], { type: "image/png" });

    var form = new FormData();
    form.append("image", imageBlob, "selection.png");
    form.append("prompt", dom.promptInput.value.trim() || DEFAULTS.prompt);
    form.append("model", dom.modelInput.value.trim() || DEFAULTS.model);
    form.append("response_format", "b64_json");

    var response;
    try {
      response = await fetch(apiUrl, { method: "POST", headers: buildHeaders(), body: form });
    } catch (e) {
      dom.sendApiBtn.textContent = "上传API网站";
      dom.previewResultEmpty.textContent = "API 返回结果";
      throw new Error("网络错误：" + (e.message || "无法连接到 API"));
    }

    if (!response.ok) {
      dom.sendApiBtn.textContent = "上传API网站";
      dom.previewResultEmpty.textContent = "API 返回结果";
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
    state.apiResultBase64 = resultBase64;
    dom.previewResultImg.src = "data:image/png;base64," + resultBase64;
    dom.previewResultImg.style.display = "block";
    dom.previewResultEmpty.style.display = "none";
    dom.importPsBtn.disabled = false;
    dom.sendApiBtn.textContent = "上传API网站";
    setStatus("API 返回成功，预览结果后点击传回PS。", "ok");
  }

  async function doImport() {
    if (!state.apiResultBase64) throw new Error("没有可导入的结果。");
    setStatus("正在导入到 PS...");
    await callHost("ps.importResult", [state.apiResultBase64]);
    setStatus("已传回PS，结果已作为新图层导入。", "ok");
    state.uploadedBase64 = null;
    state.apiResultBase64 = null;
    dom.sendApiBtn.disabled = true;
    dom.importPsBtn.disabled = true;
    dom.previewSourceImg.style.display = "none";
    dom.previewSourceEmpty.style.display = "block";
    dom.previewResultImg.style.display = "none";
    dom.previewResultEmpty.style.display = "block";
  }

  async function doLoadPrompt() {
    var result = await callHost("config.loadPromptFile");
    if (result.text) {
      dom.promptInput.value = result.text;
      setStatus("已加载提示词: " + result.name + " (" + result.text.length + " 字符)", "ok");
    }
  }

  function setModelValue(value) {
    var sel = dom.modelInput;
    var found = false;
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === value) { found = true; break; }
    }
    if (!found && value) {
      var opt = document.createElement("option");
      opt.value = value;
      opt.textContent = value;
      sel.appendChild(opt);
    }
    sel.value = value;
  }

  function populateModels(models) {
    var sel = dom.modelInput;
    var current = sel.value;
    sel.innerHTML = "";
    var filtered = models.filter(function (m) {
      var l = m.toLowerCase();
      return l.indexOf("nano") !== -1 || l.indexOf("banana") !== -1;
    });
    if (filtered.length === 0) filtered = models;
    filtered.forEach(function (m) {
      var opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      sel.appendChild(opt);
    });
    if (current) setModelValue(current);
    if (!sel.value && filtered.length > 0) sel.value = filtered[0];
  }

  // --- Event Bindings ---

  dom.refreshBtn.addEventListener("click", function () { withBusy(doRefresh); });
  dom.saveConfigBtn.addEventListener("click", function () { withBusy(doSaveConfig); });
  dom.testBtn.addEventListener("click", function () { withBusy(doTestConnection); });
  dom.uploadBtn.addEventListener("click", function () { withBusy(doUpload); });
  dom.sendApiBtn.addEventListener("click", function () { withBusy(doSendApi); });
  dom.importPsBtn.addEventListener("click", function () { withBusy(doImport); });
  dom.loadPromptBtn.addEventListener("click", function () { withBusy(doLoadPrompt); });

  dom.fitBoundsBtn.addEventListener("click", function () {
    setFitBounds(!state.currentFitBounds);
  });

  var authButtons = dom.authModeInput.querySelectorAll(".seg");
  for (var i = 0; i < authButtons.length; i++) {
    (function (btn) {
      btn.addEventListener("click", function () {
        setAuthMode(btn.getAttribute("data-value"));
      });
    })(authButtons[i]);
  }

  $("consultWoxin").addEventListener("click", function () { setStatus("咨询：我心 — 二维码功能即将上线。", "ok"); });
  $("consultHuixin").addEventListener("click", function () { setStatus("咨询：绘欣 — 二维码功能即将上线。", "ok"); });
  $("consultQianning").addEventListener("click", function () { setStatus("咨询：浅柠 — 二维码功能即将上线。", "ok"); });

  // --- Init ---
  function init() {
    if (window.uxpHost && window.uxpHost.postMessage) {
      window.uxpHost.postMessage({ type: "webview.ready" });
      doLoadConfig().catch(function (e) { setStatus(e.message, "bad"); });
    } else {
      setTimeout(init, 100);
    }
  }
  init();
})();
