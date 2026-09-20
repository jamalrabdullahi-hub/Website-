/* Garsoore — static content pages (terms, returns, privacy, help).
   These are the only pages whose words live in the HTML rather than in a render function, so each block is written
   twice: .lang-so and .lang-en. The language switch shows one and hides the other — no machine translation of the
   sentences people will hold us to. */
(function () {
  window.STATIC = true;
  function apply() {
    var en = window.RF && RF.i18n && RF.i18n.lang() === "en";
    [].forEach.call(document.querySelectorAll(".lang-so"), function (x) { x.hidden = en; });
    [].forEach.call(document.querySelectorAll(".lang-en"), function (x) { x.hidden = !en; });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply); else apply();
})();
