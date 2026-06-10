(function (NB) {
  async function importToPs() {
    var state = NB.state;
    if (!state.apiResultBase64 || !state.uploadedData) throw new Error("没有可导入的结果。");

    var data = state.uploadedData;
    var targetDoc = data.sourceDoc;

    var isOpen = NB.app.documents.some(function (d) { return d.id === targetDoc.id; });
    if (!isOpen) throw new Error("原始文档已关闭，无法导入。");

    var resultBytes = new Uint8Array(NB.arrayBufferFromBase64(state.apiResultBase64));
    var folder = await NB.fs.getTemporaryFolder();
    var file = await folder.createFile("xinban-result-" + Date.now() + ".png", { overwrite: true });
    await file.write(resultBytes, { format: NB.formats.binary });

    var targetW = data.bounds.width;
    var targetH = data.bounds.height;
    var targetL = data.bounds.left;
    var targetT = data.bounds.top;
    var squareSize = data.squareSize;
    var docRes = targetDoc.resolution;

    var sessionToken = await NB.fs.createSessionToken(file);

    var cropDoc = await NB.app.createDocument({
      width: targetW, height: targetH,
      resolution: docRes, mode: "RGBColorMode",
      fill: "transparent", name: "Xinban Crop"
    });

    try {
      await NB.batchPlay([{
        _obj: "placeEvent",
        null: { _path: sessionToken, _kind: "local" },
        freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
        offset: { _obj: "offset", horizontal: { _unit: "pixelsUnit", _value: 0 }, vertical: { _unit: "pixelsUnit", _value: 0 } }
      }], {});

      var cropLayer = cropDoc.activeLayers[0];
      var cb = NB.normalizeBounds(cropLayer.bounds);
      var uniformCropScale = (squareSize / cb.width) * 100;
      var cropDx = (targetW / 2) - (cb.left + cb.width / 2);
      var cropDy = (targetH / 2) - (cb.top + cb.height / 2);

      await NB.batchPlay([{
        _obj: "transform",
        freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
        offset: { _obj: "offset", horizontal: { _unit: "pixelsUnit", _value: cropDx }, vertical: { _unit: "pixelsUnit", _value: cropDy } },
        width: { _unit: "percentUnit", _value: uniformCropScale },
        height: { _unit: "percentUnit", _value: uniformCropScale }
      }], {});

      await cropDoc.flatten();
      var croppedFile = await folder.createFile("xinban-cropped-" + Date.now() + ".png", { overwrite: true });
      await cropDoc.saveAs.png(croppedFile, { compression: 6 }, true);
      cropDoc.closeWithoutSaving();
    } catch (e) {
      try { cropDoc.closeWithoutSaving(); } catch (_) {}
      throw e;
    }

    NB.app.activeDocument = targetDoc;
    var croppedToken = await NB.fs.createSessionToken(croppedFile);

    await NB.batchPlay([{
      _obj: "placeEvent",
      null: { _path: croppedToken, _kind: "local" },
      freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
      offset: { _obj: "offset", horizontal: { _unit: "pixelsUnit", _value: 0 }, vertical: { _unit: "pixelsUnit", _value: 0 } }
    }], {});

    var placedLayer = targetDoc.activeLayers[0];
    placedLayer.name = data.layerName + " - AI";

    var rb = NB.normalizeBounds(placedLayer.bounds);
    var uniformScale = (targetW / rb.width) * 100;
    var destCx = targetL + targetW / 2;
    var destCy = targetT + targetH / 2;
    var dx = destCx - (rb.left + rb.width / 2);
    var dy = destCy - (rb.top + rb.height / 2);

    await NB.batchPlay([{
      _obj: "transform",
      freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
      offset: { _obj: "offset", horizontal: { _unit: "pixelsUnit", _value: dx }, vertical: { _unit: "pixelsUnit", _value: dy } },
      width: { _unit: "percentUnit", _value: uniformScale },
      height: { _unit: "percentUnit", _value: uniformScale }
    }], {});

    await NB.batchPlay([{
      _obj: "set",
      _target: [{ _ref: "channel", _property: "selection" }],
      to: {
        _obj: "rectangle",
        top: { _unit: "pixelsUnit", _value: targetT },
        left: { _unit: "pixelsUnit", _value: targetL },
        bottom: { _unit: "pixelsUnit", _value: targetT + targetH },
        right: { _unit: "pixelsUnit", _value: targetL + targetW }
      }
    }], {});

    await NB.batchPlay([{ _obj: "contract", by: { _unit: "pixelsUnit", _value: 2 } }], {});
    await NB.batchPlay([{ _obj: "feather", radius: { _unit: "pixelsUnit", _value: 2 } }], {});

    await NB.batchPlay([{
      _obj: "make",
      new: { _class: "channel" },
      at: { _ref: "channel", _enum: "channel", _value: "mask" },
      using: { _enum: "userMaskEnabled", _value: "revealSelection" }
    }], {});

    await NB.batchPlay([{
      _obj: "set",
      _target: [{ _ref: "channel", _property: "selection" }],
      to: { _enum: "ordinal", _value: "none" }
    }], {});

    state.uploadedData = null;
    state.uploadedImages = [null, null, null, null];
    state.apiResultBase64 = null;
  }

  NB.importToPs = importToPs;
})(window.NB);
