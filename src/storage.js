(function (NB) {
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

  NB.readConfigFile = readConfigFile;
  NB.writeConfigFile = writeConfigFile;
})(window.NB);
