(function (NB) {
  function arrayBufferToBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var binary = "";
    for (var i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function arrayBufferFromBase64(base64) {
    var clean = base64.replace(/^data:[^,]+,/, "").replace(/\s/g, "");
    var binary = atob(clean);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  function extractJsonImage(json) {
    var b64 = "";
    if (Array.isArray(json.data) && json.data[0]) {
      b64 = json.data[0].b64_json || json.data[0].image_base64 || json.data[0].output_image || "";
    }
    if (!b64) b64 = json.b64_json || json.image_base64 || json.output_image || "";
    if (!b64 && json.result) b64 = json.result.b64_json || json.result.image_base64 || "";
    if (!b64 && json.data && !Array.isArray(json.data)) b64 = json.data.b64_json || "";
    if (b64 && b64.length > 128) return { buffer: arrayBufferFromBase64(b64) };
    var url = "";
    if (Array.isArray(json.data) && json.data[0]) url = json.data[0].url || "";
    if (!url) url = json.url || json.image_url || json.output_url || "";
    if (url) return { url: url };
    if (json.image && json.image.length > 128) return { buffer: arrayBufferFromBase64(json.image) };
    throw new Error("接口返回中没有找到图片。");
  }

  NB.arrayBufferToBase64 = arrayBufferToBase64;
  NB.arrayBufferFromBase64 = arrayBufferFromBase64;
  NB.extractJsonImage = extractJsonImage;
})(window.NB);
