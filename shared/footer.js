/*
 * Footer injector — appended at end of <body>. Same lib reuse pattern as nav.
 */
(function () {
  const html =
    '<footer class="site-footer">' +
      'Pure HTML / CSS / JS · no build step · runs anywhere · ' +
      '<a href="https://github.com/linnps/algorithm-playground" target="_blank" rel="noopener">view source ↗</a>' +
    '</footer>';
  document.body.insertAdjacentHTML("beforeend", html);
})();
