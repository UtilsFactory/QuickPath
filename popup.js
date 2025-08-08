function normalizePath(raw) {
  var path = raw.trim();
  if (!path) return '';
  path = path.replace(/^\/+/, '');
  return '/' + path;
}

document.addEventListener('DOMContentLoaded', function () {
  var addBtn       = document.getElementById('add-btn');
  var newPathInput = document.getElementById('new-path');
  var container    = document.getElementById('rules-container');
  var paths        = [];

  // Load + normalize stored paths
  function loadPaths() {
    chrome.storage.local.get('paths', function (result) {
      var stored     = result.paths || [];
      var normalized = stored
        .map(normalizePath)
        .filter(function (p) { return p; })
        .filter(function (p, i, arr) { return arr.indexOf(p) === i; });

      if (JSON.stringify(normalized) !== JSON.stringify(stored)) {
        chrome.storage.local.set({ paths: normalized }, function () {
          paths = normalized;
          renderAll();
        });
      } else {
        paths = normalized;
        renderAll();
      }
    });
  }

  // Render every row
  function renderAll() {
    container.innerHTML = '';

    paths.forEach(function (path, idx) {
      var row = document.createElement('div');
      row.className = 'rule';

      // 1. Delete button
      var delBtn = document.createElement('button');
      delBtn.innerHTML = '🗑️';
      delBtn.title     = 'Delete';
      delBtn.addEventListener('click', function () {
        paths.splice(idx, 1);
        chrome.storage.local.set({ paths: paths }, loadPaths);
      });
      row.appendChild(delBtn);

      // 2. Text input
      var input = document.createElement('input');
      input.type  = 'text';
      input.value = path;
      input.addEventListener('change', function () {
        var norm = normalizePath(input.value);
        if (!norm) return;
        paths[idx] = norm;
        chrome.storage.local.set({ paths: paths }, loadPaths);
      });
      row.appendChild(input);

      // 3. ▶ Open button
      var runBtn = document.createElement('button');
      runBtn.textContent = '▶';
      runBtn.title       = 'Open in all tabs';
      runBtn.addEventListener('click', function () {
        openPath(path);
      });
      row.appendChild(runBtn);

      // 4. ⋮⋮ Drag handle
      var handle = document.createElement('span');
      handle.textContent = '⋮⋮';
      handle.title       = 'Drag to reorder';
      handle.draggable   = true;

      handle.addEventListener('dragstart', function (e) {
        dragSrc = row;
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      handle.addEventListener('dragend', function () {
        row.classList.remove('dragging');
        updateOrder();
      });

      row.addEventListener('dragover', handleDragOver);

      row.appendChild(handle);
      container.appendChild(row);
    });
  }

  // Add new path
  addBtn.addEventListener('click', function () {
    var norm = normalizePath(newPathInput.value);
    if (!norm) return;
    paths.push(norm);
    chrome.storage.local.set({ paths: paths }, function () {
      newPathInput.value = '';
      loadPaths();
    });
  });

  // Navigate all HTTP(S) tabs to the new path
  function openPath(rawPath) {
    var path = normalizePath(rawPath);
    chrome.tabs.query({ currentWindow: true }, function (tabs) {
      tabs.forEach(function (tab) {
        if (!tab.id || !tab.url) return;
        try {
          var u = new URL(tab.url);
          if (['http:', 'https:'].indexOf(u.protocol) === -1) return;
          var to = u.origin + path;
          chrome.tabs.update(tab.id, { url: to });
        } catch (err) {
          // skip non-URL pages
        }
      });
    });
  }

  var dragSrc = null;

  function handleDragOver(e) {
    e.preventDefault();
    var target = e.target.closest('.rule');
    if (!target || target === dragSrc) return;

    var rect    = target.getBoundingClientRect();
    var halfway = rect.top + rect.height / 2;
    if (e.clientY > halfway) target.after(dragSrc);
    else target.before(dragSrc);
  }

  // Read new order & save
  function updateOrder() {
    var updated = Array.from(
      container.querySelectorAll('.rule input'),
      function (inp) { return normalizePath(inp.value); }
    );
    paths = updated;
    chrome.storage.local.set({ paths: paths }, loadPaths);
  }

  // Kick things off
  loadPaths();
});
