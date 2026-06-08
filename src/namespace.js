window.NB = {};
NB._listeners = {};
NB.on = function (event, fn) {
  (NB._listeners[event] = NB._listeners[event] || []).push(fn);
};
NB.emit = function (event, data) {
  (NB._listeners[event] || []).forEach(function (fn) { fn(data); });
};
