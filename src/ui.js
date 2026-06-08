(function (NB) {
  var $ = NB.$;

  NB.dom = {
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
    refreshBtn: $("refreshBtn")
  };

  function setStatus(msg, type) {
    var el = NB.dom.statusBar;
    el.textContent = msg;
    el.className = "status-bar";
    if (type === "ok") el.className = "status-bar status-ok";
    if (type === "bad") el.className = "status-bar status-bad";
  }

  function setConnStatus(msg, type) {
    var box = NB.dom.connBox;
    var label = NB.dom.connLabel;
    label.textContent = msg;
    box.className = "conn-box";
    var dot = box.querySelector(".dot");
    dot.className = "dot dot-gray";
    if (type === "ok") {
      box.className = "conn-box conn-ok";
      dot.className = "dot dot-green";
    }
    if (type === "bad") {
      box.className = "conn-box conn-bad";
      dot.className = "dot dot-red";
    }
  }

  function setAuthMode(value) {
    NB.state.currentAuthMode = value;
    var buttons = NB.dom.authModeInput.querySelectorAll(".seg");
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
    NB.state.currentFitBounds = value;
    var btn = NB.dom.fitBoundsBtn;
    if (value) {
      btn.textContent = "结果适配原图层边界：开启";
      btn.className = "btn-toggle toggle-on";
    } else {
      btn.textContent = "结果适配原图层边界：关闭";
      btn.className = "btn-toggle toggle-off";
    }
  }

  function setBusy(busy) {
    var d = NB.dom;
    var s = NB.state;
    d.uploadBtn.disabled = busy;
    d.sendApiBtn.disabled = busy || !s.uploadedData;
    d.importPsBtn.disabled = busy || !s.apiResultBase64;
    d.testBtn.disabled = busy;
    d.saveConfigBtn.disabled = busy;
  }

  NB.setStatus = setStatus;
  NB.setConnStatus = setConnStatus;
  NB.setAuthMode = setAuthMode;
  NB.setFitBounds = setFitBounds;
  NB.setBusy = setBusy;
})(window.NB);
