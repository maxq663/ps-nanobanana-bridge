(function (NB) {
  var dom = NB.dom;
  var KEYS = NB.CONFIG_KEYS;
  var DEFS = NB.DEFAULTS;

  function readLocal(key, fallback) {
    var v = localStorage.getItem(key);
    return v === null ? (fallback || "") : v;
  }

  function writeLocal(key, value) {
    localStorage.setItem(key, String(value));
  }

  async function readSecret(key) {
    try {
      var v = await NB.secureStorage.getItem(key);
      if (!v) return "";
      if (typeof v === "string") return v;
      return new TextDecoder().decode(v);
    } catch (e) {
      return localStorage.getItem(key + ".fallback") || "";
    }
  }

  async function writeSecret(key, value) {
    try {
      await NB.secureStorage.setItem(key, value);
      localStorage.removeItem(key + ".fallback");
    } catch (e) {
      localStorage.setItem(key + ".fallback", value);
    }
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
    dom.apiUrlInput.value = readLocal(KEYS.apiUrl, DEFS.apiUrl);
    dom.apiKeyInput.value = await readSecret(KEYS.apiKey);
    NB.setAuthMode(readLocal(KEYS.authMode, DEFS.authMode));
    var savedModel = readLocal(KEYS.model, DEFS.model);
    setModelValue(savedModel);
    dom.promptInput.value = readLocal(KEYS.prompt, DEFS.prompt);
    NB.setFitBounds(readLocal(KEYS.fitBounds, "true") === "true");
  }

  async function saveConfig() {
    writeLocal(KEYS.apiUrl, dom.apiUrlInput.value.trim());
    await writeSecret(KEYS.apiKey, dom.apiKeyInput.value.trim());
    writeLocal(KEYS.authMode, NB.state.currentAuthMode);
    writeLocal(KEYS.model, dom.modelInput.value || DEFS.model);
    writeLocal(KEYS.prompt, dom.promptInput.value.trim() || DEFS.prompt);
    writeLocal(KEYS.fitBounds, String(NB.state.currentFitBounds));
    NB.setStatus("配置已保存。", "ok");
  }

  NB.readLocal = readLocal;
  NB.writeLocal = writeLocal;
  NB.readSecret = readSecret;
  NB.writeSecret = writeSecret;
  NB.setModelValue = setModelValue;
  NB.populateModels = populateModels;
  NB.loadConfig = loadConfig;
  NB.saveConfig = saveConfig;
})(window.NB);
