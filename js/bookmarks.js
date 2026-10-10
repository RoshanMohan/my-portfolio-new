/* ============================================================
   BOOKMARKS
   Reads the "Public" tab of the bookmarks Google Sheet (published
   to the web as CSV) and renders it. New links are added by email,
   no code changes needed. Setup: tools/bookmarks/SETUP.md
   ============================================================ */

(function () {
    'use strict';

    // Paste the Public tab's "Publish to web" CSV link here (step 4 of the setup guide).
    var BOOKMARKS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTk3kfVpwKl1TmjD4DKy5PbuIthmhiHguctRROy8mNg3hjj9hDT2l0TcP3Ufmk4b_eMJAw1I4DYqMuv/pub?gid=0&single=true&output=csv';

    // Filter buttons appear in this order; any other type in the sheet is added after these.
    var TYPES = ['Video', 'Channel', 'Course', 'Blog', 'Article', 'Paper', 'Book', 'Podcast', 'Tool'];

    var list = document.getElementById('bookmarkList');
    var status = document.getElementById('bookmarkStatus');
    var filters = document.getElementById('bookmarkFilters');
    if (!list || !status || !filters) return;

    if (!BOOKMARKS_CSV_URL) {
        status.textContent = 'Bookmarks coming soon.';
        return;
    }

    fetch(BOOKMARKS_CSV_URL, { cache: 'no-store' })
        .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.text();
        })
        .then(function (text) { render(toBookmarks(parseCSV(text))); })
        .catch(function () {
            status.textContent = 'Couldn’t load bookmarks right now. Please try again later.';
        });

    /* ---- CSV → rows (handles quoted fields, commas and line breaks) ---- */
    function parseCSV(text) {
        var rows = [], row = [], field = '', inQuotes = false;
        for (var i = 0; i < text.length; i++) {
            var c = text[i];
            if (inQuotes) {
                if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
                else if (c === '"') inQuotes = false;
                else field += c;
            } else if (c === '"') inQuotes = true;
            else if (c === ',') { row.push(field); field = ''; }
            else if (c === '\n' || c === '\r') {
                if (c === '\r' && text[i + 1] === '\n') i++;
                row.push(field); rows.push(row); row = []; field = '';
            } else field += c;
        }
        if (field || row.length) { row.push(field); rows.push(row); }
        return rows;
    }

    /* ---- Rows → bookmark objects, newest first ---- */
    function toBookmarks(rows) {
        if (rows.length < 2) return [];
        var header = rows[0].map(function (h) { return h.trim().toLowerCase(); });
        function col(name) { return header.indexOf(name); }
        var c = {
            date: col('date added'), title: col('title'), url: col('url'),
            type: col('type'), note: col('note')
        };

        return rows.slice(1)
            .map(function (r) {
                function get(i) { return i >= 0 && r[i] ? r[i].trim() : ''; }
                var type = get(c.type);
                return {
                    date: get(c.date),
                    title: get(c.title),
                    url: get(c.url),
                    type: type ? type.charAt(0).toUpperCase() + type.slice(1).toLowerCase() : 'Article',
                    note: get(c.note)
                };
            })
            .filter(function (b) { return /^https?:\/\//i.test(b.url); })   // only real web links
            .reverse()                                                       // later rows are newer
            .sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    }

    /* ---- Bookmarks → page ---- */
    function render(bookmarks) {
        if (!bookmarks.length) {
            status.textContent = 'No bookmarks yet.';
            return;
        }
        status.hidden = true;

        bookmarks.forEach(function (b) { list.appendChild(card(b)); });

        // Filter buttons for the types that actually have bookmarks
        var present = bookmarks.map(function (b) { return b.type; });
        var types = TYPES.filter(function (t) { return present.indexOf(t) !== -1; });
        present.forEach(function (t) { if (types.indexOf(t) === -1) types.push(t); });

        ['All'].concat(types).forEach(function (type) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'tag bookmarks__filter' + (type === 'All' ? ' is-active' : '');
            btn.textContent = type === 'All' ? 'All' : type + 's';
            btn.setAttribute('aria-pressed', type === 'All');
            btn.addEventListener('click', function () {
                filters.querySelectorAll('.bookmarks__filter').forEach(function (b) {
                    b.classList.toggle('is-active', b === btn);
                    b.setAttribute('aria-pressed', b === btn);
                });
                list.querySelectorAll('.bookmark').forEach(function (item) {
                    item.hidden = type !== 'All' && item.dataset.type !== type;
                });
            });
            filters.appendChild(btn);
        });
        if (types.length > 1) filters.hidden = false;
    }

    function card(b) {
        var host = '';
        try { host = new URL(b.url).hostname.replace(/^www\./, ''); } catch (e) {}

        var li = document.createElement('li');
        li.className = 'bookmark';
        li.dataset.type = b.type;

        var a = document.createElement('a');
        a.className = 'bookmark__link';
        a.href = b.url;
        a.target = '_blank';
        a.rel = 'noopener';

        a.appendChild(el('span', 'tag bookmark__type', b.type));

        var title = el('span', 'bookmark__title', (b.title || host) + ' ');
        title.appendChild(el('span', 'bookmark__arrow', '↗'));
        a.appendChild(title);

        if (b.note) a.appendChild(el('span', 'bookmark__note', '“' + b.note + '”'));

        var meta = [host, formatDate(b.date)].filter(Boolean).join(' · ');
        if (meta) a.appendChild(el('span', 'bookmark__meta', meta));

        li.appendChild(a);
        return li;
    }

    function el(tag, className, text) {
        var node = document.createElement(tag);
        node.className = className;
        node.textContent = text;
        return node;
    }

    // "2026-10-09" → "Oct 2026"; anything else is shown as-is
    function formatDate(value) {
        var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
        if (!m) return value;
        return new Date(+m[1], +m[2] - 1, +m[3])
            .toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }

})();
