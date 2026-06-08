(function () {
  var NB = window.NB;
  var webviewEl = null;

  function getWebview() {
    if (!webviewEl) webviewEl = document.getElementById("webview");
    return webviewEl;
  }

  function sendResponse(id, result, error) {
    var wv = getWebview();
    if (!wv) return;
    wv.postMessage({
      id: id,
      result: error ? null : result,
      error: error ? { message: String(error.message || error) } : null
    });
  }

  function pushEvent(type, data) {
    var wv = getWebview();
    if (!wv) return;
    wv.postMessage({ type: type, data: data });
  }

  async function handleExportSelection() {
    var data = await NB.exportSelection();
    var bytes = await data.file.read({ format: NB.formats.binary });
    var base64 = NB.arrayBufferToBase64(bytes);
    NB.state.uploadedData = data;
    NB.state.uploadedData.bytes = bytes;
    return {
      base64: base64,
      layerName: data.layerName,
      width: data.bounds.width,
      height: data.bounds.height
    };
  }

  async function handleImportResult(args) {
    var resultBase64 = args[0];
    if (!resultBase64 || !NB.state.uploadedData) {
      throw new Error("没有可导入的结果。");
    }
    NB.state.apiResultBase64 = resultBase64;
    await NB.importToPs();
    return { ok: true };
  }

  async function handleGetLayerStatus() {
    var doc = NB.getActiveDocument();
    if (!doc) return { text: "未检测到文档。", hasDoc: false };
    var layer = doc.activeLayers[0];
    var name = layer ? layer.name : "无选中图层";
    var w = doc.width;
    var h = doc.height;
    return {
      text: "选区 - " + name + " - " + w + " x " + h + "px",
      hasDoc: true
    };
  }

  async function handleConfigLoad() {
    return await NB.readConfigFile();
  }

  async function handleConfigSave(args) {
    var data = args[0];
    await NB.writeConfigFile(data);
    return { ok: true };
  }

  async function handleLoadPromptFile() {
    var file = await NB.fs.getFileForOpening({ types: ["txt", "json", "md"] });
    if (!file) return { text: null };
    var text = await file.read({ format: NB.formats.utf8 });
    return { text: text, name: file.name };
  }

  var handlers = {
    "ps.exportSelection": handleExportSelection,
    "ps.importResult": handleImportResult,
    "ps.getLayerStatus": handleGetLayerStatus,
    "config.load": handleConfigLoad,
    "config.save": handleConfigSave,
    "config.loadPromptFile": handleLoadPromptFile
  };

  async function handleMessage(msg) {
    var method = msg.method;
    var args = msg.args || [];
    var handler = handlers[method];
    if (!handler) throw new Error("未知方法: " + method);
    return await handler(args);
  }

  function onMessage(event) {
    var payload = event && event.data;
    if (!payload || typeof payload !== "object") return;
    if (payload.type === "webview.ready") {
      pushEvent("host.ready", {});
      return;
    }
    if (typeof payload.method !== "string" || !("id" in payload)) return;

    NB.core.executeAsModal(async function () {
      try {
        var result = await handleMessage(payload);
        sendResponse(payload.id, result, null);
      } catch (e) {
        sendResponse(payload.id, null, e);
      }
    }, { commandName: "Bridge: " + payload.method }).catch(function (e) {
      sendResponse(payload.id, null, e);
    });
  }

  window.addEventListener("message", onMessage);

  var wv = getWebview();
  if (wv) wv.addEventListener("message", onMessage);

  NB.entrypoints.setup({
    panels: {
      nanobananPanel: {
        show: function () {}
      }
    }
  });
})();
