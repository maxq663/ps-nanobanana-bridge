(function () {
  "use strict";

  var VERSION = "v1.0.1";
  var VERSION_DATE = "2026-06-10 21:05";

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
    imageGrid: $("imageGrid"),
    previewResultImg: $("previewResultImg"),
    previewResultEmpty: $("previewResultEmpty"),
    testBtn: $("testBtn"),
    saveConfigBtn: $("saveConfigBtn"),
    refreshBtn: $("refreshBtn"),
    versionBtn: $("versionBtn"),
    loadPromptBtn: $("loadPromptBtn")
  };

  // --- State ---

  var state = {
    currentAuthMode: "api-key",
    currentFitBounds: true,
    images: [null, null, null, null],
    hasResult: false
  };

  var DEFAULTS = {
    apiUrl: "https://ai.comfly.org/v1/images/generations",
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

  function hasAnyImage() {
    return state.images.some(function (img) { return img !== null; });
  }

  function getNextEmptySlot() {
    for (var i = 0; i < state.images.length; i++) {
      if (!state.images[i]) return i;
    }
    return -1;
  }

  function updateSlotUI(index) {
    var slot = dom.imageGrid.children[index];
    if (!slot) return;
    var img = slot.querySelector(".slot-img");
    if (state.images[index]) {
      slot.classList.add("has-image");
      var b64 = state.images[index].replace(/^data:[^,]+,/, "");
      var binary = atob(b64);
      var bytes = new Uint8Array(binary.length);
      for (var k = 0; k < binary.length; k++) bytes[k] = binary.charCodeAt(k);
      var blob = new Blob([bytes], { type: "image/png" });
      var url = URL.createObjectURL(blob);
      if (img._blobUrl) URL.revokeObjectURL(img._blobUrl);
      img._blobUrl = url;
      img.src = url;
      img.style.display = "block";
    } else {
      if (img._blobUrl) { URL.revokeObjectURL(img._blobUrl); img._blobUrl = null; }
      slot.classList.remove("has-image");
      img.src = "";
      img.style.display = "none";
    }
  }

  function updateButtons() {
    var any = hasAnyImage();
    dom.sendApiBtn.disabled = !any;
    dom.importPsBtn.disabled = !state.hasResult;
  }

  function setBusy(busy) {
    dom.uploadBtn.disabled = busy;
    dom.sendApiBtn.disabled = busy || !hasAnyImage();
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
    var api = (data && data.api) || {};
    var params = (data && data.params) || {};
    dom.apiUrlInput.value = api.url || DEFAULTS.apiUrl;
    dom.apiKeyInput.value = api.key || "";
    setAuthMode(api.authMode || DEFAULTS.authMode);
    setModelValue(api.model || DEFAULTS.model);
    dom.promptInput.value = params.prompt || DEFAULTS.prompt;
    setFitBounds(params.fitBounds !== false);
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
    var index = getNextEmptySlot();
    if (index === -1) { setStatus("所有槽位已满，请先删除再上传。", "bad"); return; }
    setStatus("正在导出框选区域...");
    var result = await callHost("ps.exportSelection", [index]);
    state.images[index] = "data:image/png;base64," + result.base64;
    updateSlotUI(index);
    updateButtons();
    setStatus("已上传到槽位 " + (index + 1) + ": " + result.layerName + " " + result.width + "x" + result.height + "px", "ok");
  }

  async function doSendApi() {
    if (!hasAnyImage()) throw new Error("请先上传至少一张图片。");
    await doSaveConfig();
    dom.sendApiBtn.textContent = "处理中...";
    setStatus("正在发送到 AI 接口，请等待...");
    dom.previewResultEmpty.textContent = "正在等待 API 返回...";

    var config = getApiConfig();
    var prompt = dom.promptInput.value.trim() || DEFAULTS.prompt;
    var model = dom.modelInput.value.trim() || DEFAULTS.model;

    try {
      var result = await callHost("api.send", [config, prompt, model]);
    } catch (e) {
      dom.sendApiBtn.textContent = "上传API网站";
      dom.previewResultEmpty.textContent = "API 返回结果";
      throw e;
    }

    state.hasResult = true;
    var b64 = result.base64;
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var k = 0; k < binary.length; k++) bytes[k] = binary.charCodeAt(k);
    var blob = new Blob([bytes], { type: "image/png" });
    var url = URL.createObjectURL(blob);
    if (dom.previewResultImg._blobUrl) URL.revokeObjectURL(dom.previewResultImg._blobUrl);
    dom.previewResultImg._blobUrl = url;
    dom.previewResultImg.src = url;
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
    state.images = [null, null, null, null];
    state.hasResult = false;
    for (var i = 0; i < 4; i++) updateSlotUI(i);
    updateButtons();
    if (dom.previewResultImg._blobUrl) { URL.revokeObjectURL(dom.previewResultImg._blobUrl); dom.previewResultImg._blobUrl = null; }
    dom.previewResultImg.src = "";
    dom.previewResultImg.style.display = "none";
    dom.previewResultEmpty.style.display = "block";
    dom.previewResultEmpty.textContent = "API 返回结果";
  }

  async function doLoadPrompt() {
    var result = await callHost("config.loadPromptFile");
    if (result.text) {
      dom.promptInput.value = result.text;
      setStatus("已加载提示词: " + result.name + " (" + result.text.length + " 字符)", "ok");
    }
  }

  // --- Image Slot: Remove & Drag-and-Drop ---

  function doRemoveImage(index) {
    withBusy(async function () {
      await callHost("images.remove", [index]);
      state.images[index] = null;
      updateSlotUI(index);
      updateButtons();
      setStatus("已移除槽位 " + (index + 1) + " 的图片。", "ok");
    });
  }

  function handleFileDrop(index, file) {
    if (!file || !file.type.startsWith("image/")) {
      setStatus("仅支持图片文件。", "bad");
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var dataUrl = reader.result;
      var base64 = dataUrl.split(",")[1];
      withBusy(async function () {
        await callHost("images.add", [index, base64]);
        state.images[index] = dataUrl;
        updateSlotUI(index);
        updateButtons();
        setStatus("已拖入图片到槽位 " + (index + 1) + "。", "ok");
      });
    };
    reader.readAsDataURL(file);
  }

  function setupSlotEvents() {
    var slots = dom.imageGrid.querySelectorAll(".image-slot");
    for (var i = 0; i < slots.length; i++) {
      (function (slot, index) {
        var removeBtn = slot.querySelector(".slot-remove");
        removeBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          doRemoveImage(index);
        });

        slot.addEventListener("dragover", function (e) {
          e.preventDefault();
          e.stopPropagation();
          slot.classList.add("drag-over");
        });
        slot.addEventListener("dragleave", function (e) {
          e.preventDefault();
          slot.classList.remove("drag-over");
        });
        slot.addEventListener("drop", function (e) {
          e.preventDefault();
          e.stopPropagation();
          slot.classList.remove("drag-over");
          var files = e.dataTransfer && e.dataTransfer.files;
          if (files && files.length > 0) handleFileDrop(index, files[0]);
        });
      })(slots[i], i);
    }

    dom.imageGrid.addEventListener("dragover", function (e) { e.preventDefault(); });
    dom.imageGrid.addEventListener("drop", function (e) { e.preventDefault(); });
  }

  // --- Event Bindings ---

  dom.refreshBtn.addEventListener("click", function () { withBusy(doRefresh); });
  dom.versionBtn.addEventListener("click", function () {
    setStatus("我心的赛博工具 " + VERSION + " | 更新日期: " + VERSION_DATE, "ok");
  });
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
      setupSlotEvents();
      doLoadConfig().catch(function (e) { setStatus(e.message, "bad"); });
    } else {
      setTimeout(init, 100);
    }
  }
  init();
})();
