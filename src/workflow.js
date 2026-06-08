(function (NB) {
  var dom = NB.dom;
  var state = NB.state;

  async function uploadLayer() {
    NB.setStatus("正在导出框选区域...");
    var data = await NB.exportSelection();
    var bytes = await data.file.read({ format: NB.formats.binary });
    var base64 = NB.arrayBufferToBase64(bytes);

    dom.previewSourceImg.src = "data:image/png;base64," + base64;
    dom.previewSourceImg.style.display = "block";
    dom.previewSourceEmpty.style.display = "none";

    state.uploadedData = data;
    state.uploadedData.bytes = bytes;
    dom.sendApiBtn.disabled = false;

    var info = data.layerName + " " + data.bounds.width + "x" + data.bounds.height + "px";
    NB.setStatus("已上传: " + info + "，可点击上传API网站。", "ok");
  }

  async function sendToApi() {
    if (!state.uploadedData) throw new Error("请先上传图层。");
    var config = NB.readConfig();
    await NB.saveConfig();

    dom.sendApiBtn.textContent = "处理中...";
    NB.setStatus("正在发送到 AI 接口，请等待...");
    dom.previewResultEmpty.textContent = "正在等待 API 返回...";

    var imageBlob = new Blob([state.uploadedData.bytes], { type: "image/png" });
    var form = new FormData();
    form.append("image", imageBlob, "selection.png");
    form.append("prompt", config.prompt);
    form.append("model", config.model);
    form.append("response_format", "b64_json");

    var response;
    try {
      response = await fetch(config.apiUrl, { method: "POST", headers: NB.buildHeaders(), body: form });
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
      var img = NB.extractJsonImage(json);
      if (img.url) {
        var r2 = await fetch(img.url, { headers: NB.buildHeaders() });
        if (!r2.ok) throw new Error("结果图片下载失败：HTTP " + r2.status);
        resultBuffer = await r2.arrayBuffer();
      } else {
        resultBuffer = img.buffer;
      }
    }

    var resultBase64 = NB.arrayBufferToBase64(resultBuffer);
    dom.previewResultImg.src = "data:image/png;base64," + resultBase64;
    dom.previewResultImg.style.display = "block";
    dom.previewResultEmpty.style.display = "none";

    state.apiResultBase64 = resultBase64;
    dom.importPsBtn.disabled = false;
    dom.sendApiBtn.textContent = "上传API网站";
    NB.setStatus("API 返回成功，预览结果后点击传回PS。", "ok");
  }

  async function withBusy(fn) {
    try {
      NB.setBusy(true);
      await fn();
    } catch (e) {
      console.error(e);
      NB.setStatus(e.message || "操作失败。", "bad");
      NB.setConnStatus(e.message || "失败", "bad");
    } finally {
      NB.setBusy(false);
    }
  }

  NB.uploadLayer = uploadLayer;
  NB.sendToApi = sendToApi;
  NB.withBusy = withBusy;
})(window.NB);
