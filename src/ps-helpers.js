(function (NB) {
  function getActiveDocument() {
    return NB.app.documents.length ? NB.app.activeDocument : null;
  }

  function getSelectedLayer(doc) {
    if (!doc || !doc.activeLayers || doc.activeLayers.length !== 1) return null;
    return doc.activeLayers[0];
  }

  function normalizeBounds(bounds) {
    var left = Number(bounds.left);
    var top = Number(bounds.top);
    var right = Number(bounds.right);
    var bottom = Number(bounds.bottom);
    if (right <= left || bottom <= top) throw new Error("图层没有可见像素边界。");
    return { left: left, top: top, right: right, bottom: bottom, width: Math.ceil(right - left), height: Math.ceil(bottom - top) };
  }

  function updateLayerStatus() {
    var doc = getActiveDocument();
    if (!doc) { NB.dom.layerStatus.textContent = "未检测到文档。"; return; }
    var layer = getSelectedLayer(doc);
    if (!layer) { NB.dom.layerStatus.textContent = doc.title + " - 请选择一个图层"; return; }
    var b = normalizeBounds(layer.bounds);
    NB.dom.layerStatus.textContent = layer.name + " - " + b.width + " x " + b.height + "px";
  }

  NB.getActiveDocument = getActiveDocument;
  NB.getSelectedLayer = getSelectedLayer;
  NB.normalizeBounds = normalizeBounds;
  NB.updateLayerStatus = updateLayerStatus;
})(window.NB);
