(function (NB) {
  var dom = NB.dom;

  dom.refreshBtn.addEventListener("click", function () {
    NB.updateLayerStatus();
    NB.setStatus("图层状态已刷新。", "ok");
  });

  dom.saveConfigBtn.addEventListener("click", function () { NB.withBusy(NB.saveConfig); });

  dom.testBtn.addEventListener("click", function () {
    NB.setStatus("已点击检测连接。");
    NB.withBusy(NB.testApiConnection);
  });

  dom.uploadBtn.addEventListener("click", function () { NB.withBusy(NB.uploadLayer); });
  dom.sendApiBtn.addEventListener("click", function () { NB.withBusy(NB.sendToApi); });
  dom.importPsBtn.addEventListener("click", function () { NB.withBusy(NB.importToPs); });

  dom.fitBoundsBtn.addEventListener("click", function () {
    NB.setFitBounds(!NB.state.currentFitBounds);
  });

  var authButtons = dom.authModeInput.querySelectorAll(".seg");
  for (var i = 0; i < authButtons.length; i++) {
    (function (btn) {
      btn.addEventListener("click", function () {
        NB.setAuthMode(btn.getAttribute("data-value"));
      });
    })(authButtons[i]);
  }

  NB.entrypoints.setup({
    panels: {
      nanobananPanel: {
        show: function () {
          NB.updateLayerStatus();
        }
      }
    }
  });

  NB.loadConfig().then(function () {
    NB.updateLayerStatus();
  }).catch(function (e) {
    NB.setStatus(e.message, "bad");
  });
})(window.NB);
