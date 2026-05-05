/*
 * Top navigation injector.
 *
 * Each page in this site loads <script src="../shared/nav.js"></script>
 * (or "shared/nav.js" from the root) and the nav strip is injected at the
 * top of <body>. We embed the nav as a JS template literal (not fetched)
 * so the site works on file:// as well as on GitHub Pages.
 *
 * Active highlight: pages set <body data-page="01-sorting"> and the matching
 * nav link gets `.active`.
 */

(function () {
  // Detect path depth so we can build correct relative URLs from any page.
  // Root pages (index.html at site root) get "" prefix.
  // Child pages (e.g. 01-sorting/index.html) need "../" prefix.
  const path = window.location.pathname;
  const isRoot =
    path.endsWith("/") || path.endsWith("/index.html") ||
    /\/algorithm-playground\/?(index\.html)?$/.test(path);
  // crude heuristic: if URL contains /NN-something/ we're inside a section page
  const inSection = /\/\d{2}-[\w-]+\//.test(path);
  const prefix = inSection ? "../" : "";

  const links = [
    { num: "",    slug: "",                key: "home",     label: "Home"        },
    { num: "01",  slug: "01-sorting",      key: "01-sorting",     label: "Sorting"     },
    { num: "02",  slug: "02-pathfinding",  key: "02-pathfinding", label: "Pathfinding" },
    { num: "03",  slug: "03-maze",         key: "03-maze",        label: "Maze"        },
    { num: "04",  slug: "04-graph",        key: "04-graph",       label: "Graph"       },
    { num: "05",  slug: "05-trees",        key: "05-trees",       label: "Trees"       },
    { num: "06",  slug: "06-hash",         key: "06-hash",        label: "Hash"        },
    { num: "07",  slug: "07-heap",         key: "07-heap",        label: "Heap"        },
    { num: "08",  slug: "08-dp",           key: "08-dp",          label: "DP"          },
    { num: "09",  slug: "09-string",       key: "09-string",      label: "Strings"     },
    { num: "10",  slug: "10-geometry",     key: "10-geometry",    label: "Geometry"    },
  ];

  const activeKey = (document.body.dataset.page || "home").trim();

  const html =
    '<nav class="topnav">' +
      '<a class="brand" href="' + prefix + '">linnps · algorithm playground</a>' +
      links.map((l) => {
        const isActive = activeKey === l.key;
        const href = l.slug ? (prefix + l.slug + "/") : (prefix || "./");
        const cls = "nav-link" + (isActive ? " active" : "");
        return '<a class="' + cls + '" href="' + href + '">' + l.label + '</a>';
      }).join("") +
      '<span class="spacer"></span>' +
      '<a class="ext" href="https://github.com/linnps/algorithm-playground" target="_blank" rel="noopener">source · GitHub ↗</a>' +
    '</nav>';

  document.body.insertAdjacentHTML("afterbegin", html);
})();
