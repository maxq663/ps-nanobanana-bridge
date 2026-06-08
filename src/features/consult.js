(function (NB) {
  function showConsultDialog(name) {
    NB.setStatus("咨询：" + name + " — 二维码功能即将上线。", "ok");
  }

  NB.$("consultWoxin").addEventListener("click", function () { showConsultDialog("我心"); });
  NB.$("consultHuixin").addEventListener("click", function () { showConsultDialog("绘欣"); });
  NB.$("consultQianning").addEventListener("click", function () { showConsultDialog("浅柠"); });
})(window.NB);
