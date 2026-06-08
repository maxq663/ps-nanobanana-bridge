(function (NB) {
  async function createTempFile(prefix, ext) {
    var folder = await NB.fs.getTemporaryFolder();
    return folder.createFile(prefix + "-" + Date.now() + "." + ext, { overwrite: true });
  }

  async function exportSelection() {
    var doc = NB.getActiveDocument();
    if (!doc) throw new Error("请先打开一个 Photoshop 文档。");

    var bounds;
    var hasSelection = false;
    try {
      var sel = doc.selection;
      var sb = sel.bounds;
      if (sb && sb.right > sb.left && sb.bottom > sb.top) {
        bounds = { left: sb.left, top: sb.top, right: sb.right, bottom: sb.bottom };
        hasSelection = true;
      }
    } catch (e) {}

    if (!hasSelection) {
      var layer = NB.getSelectedLayer(doc);
      if (!layer) throw new Error("请先框选区域或选择一个图层。");
      bounds = NB.normalizeBounds(layer.bounds);
    }

    var w = Math.ceil(bounds.right - bounds.left);
    var h = Math.ceil(bounds.bottom - bounds.top);
    var squareSize = Math.max(w, h);

    await NB.batchPlay([{ _obj: "copyMerged" }], {});

    var exportDoc = await NB.app.createDocument({
      width: squareSize, height: squareSize,
      resolution: doc.resolution, mode: "RGBColorMode",
      fill: "transparent", name: "Nanobanan Export"
    });

    await NB.batchPlay([{ _obj: "paste" }], {});

    var maxDim = NB.DEFAULTS.maxExportSize || 2048;
    if (squareSize > maxDim) {
      exportDoc.resizeImage(maxDim, maxDim);
    }

    var exportFile = await createTempFile("nanobanan-sel", "png");
    await exportDoc.saveAs.png(exportFile, { compression: 6 }, true);
    exportDoc.closeWithoutSaving();

    return {
      file: exportFile,
      sourceDoc: doc,
      squareSize: squareSize,
      bounds: { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom, width: w, height: h },
      layerName: hasSelection ? "选区" : (doc.activeLayers[0] ? doc.activeLayers[0].name : "图层")
    };
  }

  NB.createTempFile = createTempFile;
  NB.exportSelection = exportSelection;
})(window.NB);
