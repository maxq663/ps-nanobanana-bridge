(function (NB) {
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

  function getModelsUrl(apiUrl) {
    try {
      var url = new URL(apiUrl);
      url.pathname = "/v1/models";
      url.search = "";
      url.hash = "";
      return url.toString().replace(/\/+$/, "");
    } catch (e) { return apiUrl; }
  }

  function buildHeaders(config) {
    var headers = {};
    var key = (config.key || "").trim();
    var mode = config.authMode || "api-key";
    if (mode === "bearer") headers["Authorization"] = "Bearer " + key;
    if (mode === "x-api-key") headers["x-api-key"] = key;
    if (mode === "api-key") headers["api-key"] = key;
    return headers;
  }

  async function testConnection(config) {
    var apiUrl = normalizeApiUrl(config.url);
    var modelsUrl = getModelsUrl(apiUrl);
    var headers = buildHeaders(config);

    var response = await fetch(modelsUrl, { method: "GET", headers: headers });
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
        if (ids.length > 0) return { ok: true, models: ids };
      }
      return { ok: true, models: [] };
    }
    if (response.status === 401 || response.status === 403) throw new Error("API Key 无效或没有权限。");
    if (response.status === 404) throw new Error("未找到检测接口: " + modelsUrl);
    var text = await response.text();
    throw new Error("HTTP " + response.status + " " + text.slice(0, 120));
  }

  async function sendToApi(config, imageBase64, prompt, model) {
    var apiUrl = normalizeApiUrl(config.url);
    var headers = buildHeaders(config);

    var binary = atob(imageBase64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    var imageBlob = new Blob([bytes], { type: "image/png" });

    var form = new FormData();
    form.append("image", imageBlob, "selection.png");
    form.append("prompt", prompt);
    form.append("model", model);
    form.append("response_format", "b64_json");

    var response;
    try {
      response = await fetch(apiUrl, { method: "POST", headers: headers, body: form });
    } catch (e) {
      throw new Error("网络错误：" + (e.message || "无法连接到 API"));
    }

    if (!response.ok) {
      var msg = await response.text();
      throw new Error("接口请求失败：HTTP " + response.status + " " + msg.slice(0, 200));
    }

    var ct = response.headers.get("content-type") || "";
    var resultBuffer;
    if (ct.startsWith("image/")) {
      resultBuffer = await response.arrayBuffer();
    } else {
      var json = await response.json();
      var img = NB.extractJsonImage(json);
      if (img.url) {
        var r2 = await fetch(img.url, { headers: headers });
        if (!r2.ok) throw new Error("结果图片下载失败：HTTP " + r2.status);
        resultBuffer = await r2.arrayBuffer();
      } else {
        resultBuffer = img.buffer;
      }
    }

    return NB.arrayBufferToBase64(resultBuffer);
  }

  NB.normalizeApiUrl = normalizeApiUrl;
  NB.buildHeaders = buildHeaders;
  NB.testConnection = testConnection;
  NB.sendToApi = sendToApi;
})(window.NB);
