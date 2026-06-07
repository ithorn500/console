(function () {
  const data = window.ARCHITECTURE_SITE_DATA;
  let docs = [...data.docs];
  let diagrams = [...data.diagrams];

  const navList = document.getElementById("navList");
  const reader = document.getElementById("reader");
  const overview = document.getElementById("overview");
  const title = document.getElementById("contentTitle");
  const kicker = document.getElementById("contentKicker");
  const rawLink = document.getElementById("rawLink");
  const searchInput = document.getElementById("searchInput");
  const tabButtons = Array.from(document.querySelectorAll(".tab-button"));

  let activeView = "docs";
  let activeFile = "architecture-diagram-review-2026-06-05.md";

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function slug(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function stateClass(state) {
    return slug(state || "current");
  }

  function matchesSearch(item, term) {
    if (!term) {
      return true;
    }
    const haystack = [
      item.title,
      item.file,
      item.group,
      item.state,
      item.authority,
      item.type,
      item.summary
    ].join(" ").toLowerCase();
    return haystack.includes(term.toLowerCase());
  }

  function groupBy(items, key) {
    return items.reduce((groups, item) => {
      const group = item[key] || "Other";
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {});
  }

  function setActiveView(view) {
    activeView = view;
    tabButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.view === view);
    });
    renderNav();

    if (view === "diagrams") {
      showDiagramGallery();
      return;
    }

    if (view === "review") {
      loadDoc("architecture-diagram-review-2026-06-05.md");
      return;
    }

    loadDoc(activeFile || docs[0].file);
  }

  async function loadAutoIndex() {
    try {
      const response = await fetch("architecture-auto-index.json", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const autoIndex = await response.json();
      const docFiles = new Set(docs.map((item) => item.file));
      const diagramFiles = new Set(diagrams.map((item) => item.file));
      for (const item of autoIndex.docs || []) {
        if (!docFiles.has(item.file)) {
          docs.push(item);
          docFiles.add(item.file);
        }
      }
      for (const item of autoIndex.diagrams || []) {
        if (!diagramFiles.has(item.file)) {
          diagrams.unshift(item);
          diagramFiles.add(item.file);
        }
      }
    } catch (error) {
      // Static-file mode still works with the curated manifest.
    }
  }

  function renderOverview() {
    const imageCount = diagrams.filter((diagram) => diagram.type === "Image").length;
    const currentSources = diagrams.filter((diagram) => diagram.state === "Current" || diagram.state === "Canonical").length;
    const canonicalDocs = docs.filter((doc) => doc.state === "Canonical").length;
    overview.innerHTML = [
      metric("Current sources", currentSources, "Markdown diagram sources or current captured diagrams."),
      metric("Image snapshots", imageCount, "PNG/JPG diagrams preserved as historical/reference evidence."),
      metric("Canonical docs", canonicalDocs, "Documents marked as normative current architecture authority."),
      metric("Reader files", docs.length, "Curated architecture documents available in this site.")
    ].join("");
  }

  function metric(label, value, body) {
    return `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)} - ${escapeHtml(body)}</span></div>`;
  }

  function renderNav() {
    const term = searchInput.value.trim();
    if (activeView === "diagrams") {
      const filtered = diagrams.filter((item) => matchesSearch(item, term));
      navList.innerHTML = renderNavGroup("Diagrams", filtered, true);
      return;
    }

    const filtered = docs.filter((item) => matchesSearch(item, term));
    const groups = groupBy(filtered, "group");
    navList.innerHTML = Object.keys(groups)
      .map((group) => renderNavGroup(group, groups[group], false))
      .join("") || `<div class="empty">No matches.</div>`;
  }

  function renderNavGroup(group, items, diagramMode) {
    if (!items.length) {
      return "";
    }
    const buttons = items.map((item) => {
      const active = activeFile === item.file ? " active" : "";
      const action = diagramMode ? "diagram" : "doc";
      return `
        <button class="nav-item${active}" type="button" data-action="${action}" data-file="${escapeHtml(item.file)}">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.summary || item.file)}</span>
          <span class="nav-meta">
            <span class="status-pill ${stateClass(item.state)}">${escapeHtml(item.state)}</span>
          </span>
        </button>
      `;
    }).join("");
    return `<section class="nav-group"><div class="nav-group-title">${escapeHtml(group)}</div>${buttons}</section>`;
  }

  function renderMarkdown(markdown) {
    const lines = markdown.replace(/\r\n/g, "\n").split("\n");
    const html = [];
    let paragraph = [];
    let list = [];
    let table = [];
    let code = null;

    function flushParagraph() {
      if (paragraph.length) {
        html.push(`<p>${inline(paragraph.join(" "))}</p>`);
        paragraph = [];
      }
    }

    function flushList() {
      if (list.length) {
        html.push(`<ul>${list.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`);
        list = [];
      }
    }

    function flushTable() {
      if (!table.length) {
        return;
      }
      const rows = table.map((line) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
      const header = rows[0] || [];
      const body = rows.slice(2);
      html.push("<table><thead><tr>" + header.map((cell) => `<th>${inline(cell)}</th>`).join("") + "</tr></thead><tbody>" +
        body.map((row) => "<tr>" + row.map((cell) => `<td>${inline(cell)}</td>`).join("") + "</tr>").join("") +
        "</tbody></table>");
      table = [];
    }

    for (const line of lines) {
      const fence = line.match(/^```(.*)$/);
      if (fence) {
        if (code) {
          html.push(`<pre><code class="language-${escapeHtml(code.lang)}">${escapeHtml(code.lines.join("\n"))}</code></pre>`);
          code = null;
        } else {
          flushParagraph();
          flushList();
          flushTable();
          code = { lang: fence[1].trim(), lines: [] };
        }
        continue;
      }
      if (code) {
        code.lines.push(line);
        continue;
      }

      if (!line.trim()) {
        flushParagraph();
        flushList();
        flushTable();
        continue;
      }

      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      if (heading) {
        flushParagraph();
        flushList();
        flushTable();
        const level = heading[1].length;
        html.push(`<h${level} id="${slug(heading[2])}">${inline(heading[2])}</h${level}>`);
        continue;
      }

      if (/^\|.+\|$/.test(line)) {
        flushParagraph();
        flushList();
        table.push(line);
        continue;
      }

      const bullet = line.match(/^\s*[-*]\s+(.+)$/);
      if (bullet) {
        flushParagraph();
        flushTable();
        list.push(bullet[1]);
        continue;
      }

      paragraph.push(line.trim());
    }

    flushParagraph();
    flushList();
    flushTable();
    return html.join("\n");
  }

  function inline(value) {
    let output = escapeHtml(value);
    output = output.replace(/`([^`]+)`/g, "<code>$1</code>");
    output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, text, href) {
      return `<a href="${escapeHtml(href)}">${text}</a>`;
    });
    return output;
  }

  async function loadDoc(file) {
    activeFile = file;
    const doc = docs.find((item) => item.file === file) || diagrams.find((item) => item.file === file);
    title.textContent = doc ? doc.title : file;
    kicker.textContent = doc ? `${doc.state} - ${doc.authority || doc.type || "Document"}` : "Document";
    rawLink.href = file;
    rawLink.textContent = "Raw file";
    renderNav();

    try {
      const response = await fetch(file);
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const markdown = await response.text();
      reader.className = "reader";
      reader.innerHTML = renderMarkdown(markdown);
      window.location.hash = `doc=${encodeURIComponent(file)}`;
    } catch (error) {
      reader.innerHTML = `<div class="empty">Unable to load ${escapeHtml(file)}. Serve this folder over HTTP and open index.html.</div>`;
    }
  }

  function showDiagramGallery() {
    title.textContent = "Diagram Gallery";
    kicker.textContent = "Current sources and historical snapshots";
    rawLink.href = "architecture-diagram-review-2026-06-05.md";
    rawLink.textContent = "Review note";
    const term = searchInput.value.trim();
    const filtered = diagrams.filter((item) => matchesSearch(item, term));
    reader.className = "reader";
    reader.innerHTML = `<div class="diagram-grid">${filtered.map(renderDiagramCard).join("")}</div>` || `<div class="empty">No matches.</div>`;
    window.location.hash = "diagrams";
  }

  function renderDiagramCard(item) {
    const imageFile = item.previewImage || (item.type === "Image" ? item.file : "");
    const image = imageFile
      ? `<img src="${escapeHtml(imageFile)}" alt="${escapeHtml(item.title)}" loading="lazy" />`
      : `<div class="diagram-source">${escapeHtml(item.type)}</div>`;
    const primaryAction = imageFile
      ? `<button type="button" data-action="image" data-file="${escapeHtml(imageFile)}">Open image</button>`
      : "";
    const sourceAction = item.file.endsWith(".md")
      ? `<button type="button" data-action="doc" data-file="${escapeHtml(item.file)}">Read source</button>`
      : "";
    const actions = primaryAction || sourceAction
      ? `<div class="diagram-actions">${primaryAction}${sourceAction}</div>`
      : "";
    return `
      <section class="diagram-item">
        <div class="diagram-preview">${image}</div>
        <div class="diagram-body">
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.summary)}</p>
          <div class="nav-meta"><span class="status-pill ${stateClass(item.state)}">${escapeHtml(item.state)}</span></div>
          ${actions}
        </div>
      </section>
    `;
  }

  function openImage(file) {
    const diagram = diagrams.find((item) => item.file === file);
    activeFile = file;
    title.textContent = diagram ? diagram.title : file;
    kicker.textContent = diagram ? `${diagram.state} - ${diagram.type}` : "Image";
    rawLink.href = file;
    rawLink.textContent = "Open raw image";
    renderNav();
    reader.className = "reader image-reader";
    reader.innerHTML = `<img src="${escapeHtml(file)}" alt="${escapeHtml(diagram ? diagram.title : file)}" />`;
    window.location.hash = `image=${encodeURIComponent(file)}`;
  }

  navList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }
    const action = button.dataset.action;
    const file = button.dataset.file;
    if (action === "diagram") {
      const item = diagrams.find((diagram) => diagram.file === file);
      if (item && item.type === "Image") {
        openImage(file);
      } else {
        loadDoc(file);
      }
      return;
    }
    loadDoc(file);
  });

  reader.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }
    if (button.dataset.action === "image") {
      openImage(button.dataset.file);
    } else {
      loadDoc(button.dataset.file);
    }
  });

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => setActiveView(button.dataset.view));
  });

  searchInput.addEventListener("input", () => {
    renderNav();
    if (activeView === "diagrams") {
      showDiagramGallery();
    }
  });

  async function boot() {
    await loadAutoIndex();
    renderOverview();

    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    if (hash === "diagrams") {
      setActiveView("diagrams");
    } else if (params.has("image")) {
      setActiveView("diagrams");
      openImage(params.get("image"));
    } else if (params.has("doc")) {
      setActiveView("docs");
      loadDoc(params.get("doc"));
    } else {
      setActiveView("review");
    }
  }

  boot();
})();
