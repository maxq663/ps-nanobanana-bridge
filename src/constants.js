(function (NB) {
  NB.photoshop = require("photoshop");
  NB.uxp = require("uxp");

  var ps = NB.photoshop;
  NB.app = ps.app;
  NB.core = ps.core;
  NB.batchPlay = ps.action.batchPlay;

  var uxp = NB.uxp;
  NB.entrypoints = uxp.entrypoints;
  NB.formats = uxp.storage.formats;
  NB.fs = uxp.storage.localFileSystem;
  NB.secureStorage = uxp.storage.secureStorage;

  NB.CONFIG_KEYS = {
    apiUrl: "nanobanan.apiUrl",
    apiKey: "nanobanan.apiKey",
    authMode: "nanobanan.authMode",
    model: "nanobanan.model",
    prompt: "nanobanan.prompt",
    fitBounds: "nanobanan.fitBounds"
  };

  NB.DEFAULTS = {
    apiUrl: "https://ai.comfly.org/v1/images/edits",
    authMode: "api-key",
    model: "nanobanan",
    prompt: "处理这个 Photoshop 选中图层，并返回编辑后的图片。",
    fitBounds: true,
    maxExportSize: 2048
  };

  NB.$ = function (id) {
    return document.getElementById(id);
  };
})(window.NB);
