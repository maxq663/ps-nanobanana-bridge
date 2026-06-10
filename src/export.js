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
    var layerName = hasSelection ? "选区" : (doc.activeLayers[0] ? doc.activeLayers[0].name : "图层");

    var dupDoc = await doc.duplicate();
    try {
      NB.app.activeDocument = dupDoc;
      await dupDoc.flatten();

      var t = Number(bounds.top);
      var l = Number(bounds.left);
      var b = Number(bounds.bottom);
      var r = Number(bounds.right);

      await NB.batchPlay([{
        _obj: "set",
        _target: [{ _ref: "channel", _property: "selection" }],
        to: {
          _obj: "rectangle",
          top: { _unit: "pixelsUnit", _value: t },
          left: { _unit: "pixelsUnit", _value: l },
          bottom: { _unit: "pixelsUnit", _value: b },
          right: { _unit: "pixelsUnit", _value: r }
        }
      }], {});

      await NB.batchPlay([{
        _obj: "crop",
        to: {
          _obj: "rectangle",
          top: { _unit: "pixelsUnit", _value: t },
          left: { _unit: "pixelsUnit", _value: l },
          bottom: { _unit: "pixelsUnit", _value: b },
          right: { _unit: "pixelsUnit", _value: r }
        },
        angle: { _unit: "angleUnit", _value: 0 }
      }], {});

      await NB.batchPlay([{
        _obj: "canvasSize",
        width: { _unit: "pixelsUnit", _value: squareSize },
        height: { _unit: "pixelsUnit", _value: squareSize },
        horizontal: { _enum: "horizontalLocation", _value: "center" },
        vertical: { _enum: "verticalLocation", _value: "center" },
        canvasExtensionColorType: { _enum: "canvasExtensionColorType", _value: "backgroundColor" }
      }], {});

      var maxDim = NB.DEFAULTS.maxExportSize || 2048;
      if (squareSize > maxDim) {
        dupDoc.resizeImage(maxDim, maxDim);
      }

      var exportFile = await createTempFile("nanobanan-sel", "png");
      await dupDoc.saveAs.png(exportFile, { compression: 6 }, true);
      dupDoc.closeWithoutSaving();
    } catch (e) {
      try { dupDoc.closeWithoutSaving(); } catch (_) {}
      throw e;
    }

    NB.app.activeDocument = doc;

    return {
      file: exportFile,
      sourceDoc: doc,
      squareSize: squareSize,
      bounds: { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom, width: w, height: h },
      layerName: layerName
    };
  }

  NB.createTempFile = createTempFile;
  NB.exportSelection = exportSelection;
})(window.NB);
