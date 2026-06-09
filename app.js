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
      }, 120000);
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

  // --- DOM ---

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

  // --- State ---

  var state = {
    currentAuthMode: "api-key",
    currentFitBounds: true,
    hasUpload: false,
    hasResult: false
  };

  var DEFAULTS = {
    apiUrl: "https://ai.comfly.org/v1/images/edits",
    authMode: "api-key",
    model: "nanobanan",
    prompt: "处理这个 Photoshop 选中图层，并返回编辑后的图片。"
  };

  // --- UI Helpers ---

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
    dom.sendApiBtn.disabled = busy || !state.hasUpload;
    dom.importPsBtn.disabled = busy || !state.hasResult;
    dom.testBtn.disabled = busy;
    dom.saveConfigBtn.disabled = busy;
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

  function getApiConfig() {
    return {
      url: dom.apiUrlInput.value.trim() || DEFAULTS.apiUrl,
      key: dom.apiKeyInput.value.trim(),
      authMode: state.currentAuthMode
    };
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

  // --- Actions (pure UI → callHost → display) ---

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
    setConnStatus("正在检测连接...");
    setStatus("正在检测 API 地址和 Key...");
    var result = await callHost("api.testConnection", [getApiConfig()]);
    if (result.models && result.models.length > 0) {
      populateModels(result.models);
      setConnStatus("连接成功，已获取 " + result.models.length + " 个模型。", "ok");
      setStatus("连接成功，模型列表已更新。", "ok");
    } else {
      setConnStatus("连接成功，API Key 可用。", "ok");
      setStatus("连接检测成功。", "ok");
    }
  }

  async function doUpload() {
    setStatus("正在导出框选区域...");
    var result = await callHost("ps.exportSelection");
    state.hasUpload = true;
    dom.previewSourceImg.src = "data:image/png;base64," + result.base64;
    dom.previewSourceImg.style.display = "block";
    dom.previewSourceEmpty.style.display = "none";
    dom.sendApiBtn.disabled = false;
    setStatus("已上传: " + result.layerName + " " + result.width + "x" + result.height + "px", "ok");
  }

  async function doSendApi() {
    if (!state.hasUpload) throw new Error("请先上传图层。");
    await doSaveConfig();
    dom.sendApiBtn.textContent = "处理中...";
    setStatus("正在发送到 AI 接口，请等待...");
    dom.previewResultEmpty.textContent = "正在等待 API 返回...";

    var config = getApiConfig();
    var prompt = dom.promptInput.value.trim() || DEFAULTS.prompt;
    var model = dom.modelInput.value.trim() || DEFAULTS.model;

    var result = await callHost("api.send", [config, prompt, model]);

    state.hasResult = true;
    dom.previewResultImg.src = "data:image/png;base64," + result.base64;
    dom.previewResultImg.style.display = "block";
    dom.previewResultEmpty.style.display = "none";
    dom.importPsBtn.disabled = false;
    dom.sendApiBtn.textContent = "上传API网站";
    setStatus("API 返回成功，预览结果后点击传回PS。", "ok");
  }

  async function doImport() {
    if (!state.hasResult) throw new Error("没有可导入的结果。");
    setStatus("正在导入到 PS...");
    await callHost("ps.importResult", []);
    setStatus("已传回PS，结果已作为新图层导入。", "ok");
    state.hasUpload = false;
    state.hasResult = false;
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
