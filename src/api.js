(function (NB) {
  var dom = NB.dom;

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
    var key = dom.apiKeyInput.value.trim();
    var mode = NB.state.currentAuthMode;
    if (mode === "bearer") headers["Authorization"] = "Bearer " + key;
    if (mode === "x-api-key") headers["x-api-key"] = key;
    if (mode === "api-key") headers["api-key"] = key;
    return headers;
  }

  function readConfig() {
    var apiUrl = normalizeApiUrl(dom.apiUrlInput.value || NB.DEFAULTS.apiUrl);
    var apiKey = dom.apiKeyInput.value.trim();
    var model = dom.modelInput.value.trim() || NB.DEFAULTS.model;
    var prompt = dom.promptInput.value.trim() || NB.DEFAULTS.prompt;
    if (!apiUrl) throw new Error("请填写 API 地址。");
    if (NB.state.currentAuthMode !== "none" && !apiKey) throw new Error("请填写 API Key。");
    return { apiUrl: apiUrl, apiKey: apiKey, authMode: NB.state.currentAuthMode, model: model, prompt: prompt, fitBounds: NB.state.currentFitBounds };
  }

  async function fetchModels() {
    var apiUrl = normalizeApiUrl(dom.apiUrlInput.value || NB.DEFAULTS.apiUrl);
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
    NB.setConnStatus("正在检测连接...");
    NB.setStatus("正在检测 API 地址和 Key...");
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
          NB.populateModels(ids);
          NB.setConnStatus("连接成功，已获取 " + ids.length + " 个模型。", "ok");
          NB.setStatus("连接成功，模型列表已更新。", "ok");
          return;
        }
      }
      NB.setConnStatus("连接成功，API Key 可用。", "ok");
      NB.setStatus("连接检测成功。", "ok");
      return;
    }
    if (response.status === 401 || response.status === 403) throw new Error("API Key 无效或没有权限。");
    if (response.status === 404) throw new Error("未找到检测接口: " + modelsUrl);
    var text = await response.text();
    throw new Error("HTTP " + response.status + " " + text.slice(0, 120));
  }

  NB.normalizeApiUrl = normalizeApiUrl;
  NB.getApiOriginUrl = getApiOriginUrl;
  NB.buildHeaders = buildHeaders;
  NB.readConfig = readConfig;
  NB.fetchModels = fetchModels;
  NB.testApiConnection = testApiConnection;
})(window.NB);
