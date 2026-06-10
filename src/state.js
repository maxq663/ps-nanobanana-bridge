(function (NB) {
  NB.state = {
    currentAuthMode: NB.DEFAULTS.authMode,
    currentFitBounds: true,
    currentAspectRatio: "",
    uploadedImages: [null, null, null, null],
    uploadedData: null,
    apiResultBase64: null
  };
})(window.NB);
