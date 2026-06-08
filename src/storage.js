(function (NB) {
  var dom = NB.dom;
  var DEFS = NB.DEFAULTS;

  var configFile = null;

  async function getConfigFile() {
    if (configFile) return configFile;
    var folder = await NB.fs.getDataFolder();
    try {
      configFile = await folder.getEntry("config.json");
    } catch (e) {
      configFile = await folder.createFile("config.json", { overwrite: false });
      await configFile.write(JSON.stringify({
        api: { url: DEFS.apiUrl, key: "", authMode: DEFS.authMode, model: DEFS.model },
        params: { prompt: DEFS.prompt, fitBounds: DEFS.fitBounds }
      }, null, 2));
    }
    return configFile;
  }

  async function readConfigFile() {
    var file = await getConfigFile();
    var text = await file.read({ format: NB.formats.utf8 });
    try {
      return JSON.parse(text);
    } catch (e) {
      return {
        api: { url: DEFS.apiUrl, key: "", authMode: DEFS.authMode, model: DEFS.model },
        params: { prompt: DEFS.prompt, fitBounds: DEFS.fitBounds }
      };
    }
  }

  async function writeConfigFile(data) {
    var file = await getConfigFile();
    await file.write(JSON.stringify(data, null, 2));
  }

  function setModelValue(value) {
    var sel = dom.modelInput;
    var options = sel.querySelectorAll("option");
    var found = false;
    for (var i = 0; i < options.length; i++) {
      if (options[i].value === value) { found = true; break; }
    }
    if (!found && value) {
      var opt = document.createElement("option");
      opt.value = value;
      opt.textContent = value;
      sel.appendChild(opt);
    }
    sel.value = value;
  }

  function populateModels(models) {
    var sel = dom.modelInput;
    var current = sel.value;
    while (sel.firstChild) { sel.removeChild(sel.firstChild); }
    var filtered = [];
    for (var i = 0; i < models.length; i++) {
      var lower = models[i].toLowerCase();
      if (lower.indexOf("nano") !== -1 || lower.indexOf("banana") !== -1) {
        filtered.push(models[i]);
      }
    }
    if (filtered.length === 0) filtered = models;
    for (var i = 0; i < filtered.length; i++) {
      var opt = document.createElement("option");
      opt.value = filtered[i];
      opt.textContent = filtered[i];
      sel.appendChild(opt);
    }
    if (current) setModelValue(current);
    if (!sel.value && filtered.length > 0) { sel.value = filtered[0]; }
  }

  async function loadConfig() {
    var data = await readConfigFile();
    dom.apiUrlInput.value = data.api.url || DEFS.apiUrl;
    dom.apiKeyInput.value = data.api.key || "";
    NB.setAuthMode(data.api.authMode || DEFS.authMode);
    setModelValue(data.api.model || DEFS.model);
    dom.promptInput.value = data.params.prompt || DEFS.prompt;
    NB.setFitBounds(data.params.fitBounds !== false);
  }

  async function saveConfig() {
    var data = {
      api: {
        url: dom.apiUrlInput.value.trim() || DEFS.apiUrl,
        key: dom.apiKeyInput.value.trim(),
        authMode: NB.state.currentAuthMode,
        model: dom.modelInput.value || DEFS.model
      },
      params: {
        prompt: dom.promptInput.value.trim() || DEFS.prompt,
        fitBounds: NB.state.currentFitBounds
      }
    };
    await writeConfigFile(data);
    NB.setStatus("配置已保存。", "ok");
  }

  NB.readConfigFile = readConfigFile;
  NB.setModelValue = setModelValue;
  NB.populateModels = populateModels;
  NB.loadConfig = loadConfig;
  NB.saveConfig = saveConfig;
})(window.NB);
