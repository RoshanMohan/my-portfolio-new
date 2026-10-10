/**
 * BOOKMARKS: Gmail → Google Sheet
 *
 * Every 10 minutes, finds emails you sent to yourself at your "+bookmarks" address
 * (e.g. yourname+bookmarks@gmail.com), pulls out the links, looks up each page title,
 * and adds a row to the "Public" tab (or "Private" if the email has #private).
 * The website reads the published Public tab. Setup: tools/bookmarks/SETUP.md
 *
 * Email format (all optional except the link):
 *   Subject: your note, or leave the page title your share sheet puts there
 *   Body:    the link, plus any note and #tags
 *   Tags:    #video #channel #course #blog #article #paper #book #podcast #tool  → sets the type
 *            #private → goes to the Private tab, never shown on the website
 *            any other #tag → saved in the Tags column
 */

const CONFIG = {
  PLUS_TAG: 'bookmarks',          // picks up mail sent to yourname+bookmarks@...
  DONE_LABEL: 'bookmarks-added',  // Gmail label added to emails once processed
  ARCHIVE: true,                  // also archive processed emails, keeping your inbox clean
  PUBLIC_TAB: 'Public',
  PRIVATE_TAB: 'Private',
  EXTRA_SENDERS: [],              // other addresses allowed to add bookmarks, e.g. ['me@work.com']
};

const HEADERS = ['Date Added', 'Title', 'URL', 'Type', 'Note', 'Tags'];

const TYPE_TAGS = {
  video: 'Video', videos: 'Video', channel: 'Channel', course: 'Course', blog: 'Blog',
  article: 'Article', paper: 'Paper', whitepaper: 'Paper', book: 'Book', podcast: 'Podcast', tool: 'Tool',
};

/** Run once: creates the tabs and the 10-minute trigger, then processes anything waiting. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Reuse the blank first sheet of a new spreadsheet as the Public tab
  const first = ss.getSheets()[0];
  if (!ss.getSheetByName(CONFIG.PUBLIC_TAB) && first.getLastRow() === 0) first.setName(CONFIG.PUBLIC_TAB);
  getTab_(ss, CONFIG.PUBLIC_TAB);
  getTab_(ss, CONFIG.PRIVATE_TAB);

  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'processInbox')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('processInbox').timeBased().everyMinutes(10).create();

  processInbox();
}

/** Runs on the trigger: turns new bookmark emails into rows. */
function processInbox() {
  const me = Session.getEffectiveUser().getEmail().toLowerCase();
  const address = me.replace('@', '+' + CONFIG.PLUS_TAG + '@');
  const allowed = [me].concat(CONFIG.EXTRA_SENDERS.map(s => s.toLowerCase()));
  const label = GmailApp.getUserLabelByName(CONFIG.DONE_LABEL) || GmailApp.createLabel(CONFIG.DONE_LABEL);
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  GmailApp.search('to:' + address + ' -label:' + CONFIG.DONE_LABEL, 0, 50).forEach(thread => {
    thread.getMessages().forEach(msg => {
      // Only you can add bookmarks: ignore mail from anyone else who finds the address
      if (allowed.indexOf(senderEmail_(msg.getFrom())) === -1) return;
      addFromMessage_(ss, msg);
    });
    thread.addLabel(label);
    thread.markRead();
    if (CONFIG.ARCHIVE) thread.moveToArchive();
  });
}

function addFromMessage_(ss, msg) {
  const subject = (msg.getSubject() || '').replace(/^\s*((fwd?|re):\s*)+/i, '');
  const body = cleanBody_(msg.getPlainBody() || '');
  const text = subject + '\n' + body;

  const urls = unique_((text.match(/https?:\/\/[^\s<>"'()\[\]]+/g) || [])
    .map(u => cleanUrl_(u.replace(/[.,;:!?]+$/, ''))));
  if (!urls.length) return;

  const tags = unique_((text.match(/(?:^|\s)#[a-z0-9-]+/gi) || [])
    .map(t => t.trim().slice(1).toLowerCase()));
  const isPrivate = tags.indexOf('private') !== -1;
  const tagType = tags.map(t => TYPE_TAGS[t]).filter(Boolean)[0];
  const otherTags = tags.filter(t => t !== 'private' && !TYPE_TAGS[t]);

  const strip = s => s
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/(?:^|\s)#[a-z0-9-]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const subjectText = strip(subject);
  const bodyText = strip(body);

  const tab = getTab_(ss, isPrivate ? CONFIG.PRIVATE_TAB : CONFIG.PUBLIC_TAB);
  const existing = existingUrls_(tab);
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  urls.forEach(url => {
    const key = normalizeUrl_(url);
    if (existing.has(key)) return;   // already bookmarked

    const title = fetchTitle_(url) || subjectText || hostname_(url);
    // The subject is a note only if it isn't just the page title (share sheets put the title there)
    const subjectNote = subjectText && !similar_(subjectText, title) ? subjectText : '';
    const note = [subjectNote, bodyText].filter(Boolean).join(' · ').slice(0, 400);

    // Leading apostrophe keeps the date as plain text, so the website gets "2026-10-09"
    tab.appendRow(["'" + today, title, url, tagType || guessType_(url), note, otherTags.join(', ')]);
    existing.add(key);
  });
}

/* ---------- Helpers ---------- */

function getTab_(ss, name) {
  const tab = ss.getSheetByName(name) || ss.insertSheet(name);
  if (tab.getLastRow() === 0) {
    tab.appendRow(HEADERS);
    tab.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    tab.setFrozenRows(1);
  }
  return tab;
}

function existingUrls_(tab) {
  const urls = new Set();
  if (tab.getLastRow() > 1) {
    tab.getRange(2, 3, tab.getLastRow() - 1, 1).getValues()
      .forEach(row => { if (row[0]) urls.add(normalizeUrl_(String(row[0]))); });
  }
  return urls;
}

/** Drops quoted replies and signatures such as "Sent from my iPhone". */
function cleanBody_(body) {
  const kept = [];
  const lines = body.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^--\s*$/.test(line) || /^sent from my /i.test(line.trim()) || /^on .+ wrote:$/i.test(line.trim())) break;
    if (/^\s*>/.test(line)) continue;
    kept.push(line);
  }
  return kept.join('\n');
}

/** Removes tracking parameters (utm_*, YouTube's si=, fbclid, gclid). */
function cleanUrl_(url) {
  const hashAt = url.indexOf('#');
  const hash = hashAt === -1 ? '' : url.slice(hashAt);
  const base = hashAt === -1 ? url : url.slice(0, hashAt);
  const queryAt = base.indexOf('?');
  if (queryAt === -1) return url;
  const kept = base.slice(queryAt + 1).split('&')
    .filter(p => p && !/^(utm_[a-z]+|si|fbclid|gclid)=/i.test(p));
  return base.slice(0, queryAt) + (kept.length ? '?' + kept.join('&') : '') + hash;
}

function normalizeUrl_(url) {
  return url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');
}

function fetchTitle_(url) {
  try {
    // YouTube videos: oEmbed gives a clean title
    if (/youtube\.com\/watch|youtu\.be\//i.test(url)) {
      const r = UrlFetchApp.fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(url),
        { muteHttpExceptions: true });
      if (r.getResponseCode() === 200) return JSON.parse(r.getContentText()).title;
    }

    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    if (res.getResponseCode() >= 400) return '';
    const headers = res.getHeaders();
    const type = String(headers['Content-Type'] || headers['content-type'] || '');
    if (type && !/html/i.test(type)) return '';   // e.g. a PDF

    const html = res.getContentText().slice(0, 300000);
    const match =
      html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:title["']/i) ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (!match) return '';
    return decodeEntities_(match[1])
      .replace(/\s+/g, ' ')
      .replace(/\s+-\s+YouTube$/, '')
      .trim()
      .slice(0, 200);
  } catch (e) {
    return '';
  }
}

function guessType_(url) {
  const u = url.toLowerCase();
  if (/youtube\.com\/(@|channel\/|c\/|user\/)/.test(u)) return 'Channel';
  if (/youtube\.com|youtu\.be|vimeo\.com/.test(u)) return 'Video';
  if (/\.pdf($|[?#])|arxiv\.org|doi\.org|ieeexplore|sciencedirect|researchgate/.test(u)) return 'Paper';
  if (/amazon\.|goodreads\.com|books\.google|oreilly\.com\/library/.test(u)) return 'Book';
  if (/coursera\.org|edx\.org|udemy\.com|ocw\.mit\.edu/.test(u)) return 'Course';
  if (/podcasts?\.|spotify\.com\/(show|episode)/.test(u)) return 'Podcast';
  if (/github\.com/.test(u)) return 'Tool';
  if (/medium\.com|substack\.com|blog/.test(u)) return 'Blog';
  return 'Article';
}

function hostname_(url) {
  const m = url.match(/^https?:\/\/(?:www\.)?([^\/?#]+)/i);
  return m ? m[1] : url;
}

function senderEmail_(from) {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim().toLowerCase();
}

function similar_(a, b) {
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const x = norm(a), y = norm(b);
  return !!x && !!y && (x.indexOf(y) !== -1 || y.indexOf(x) !== -1);
}

function unique_(items) {
  return items.filter((item, i) => items.indexOf(item) === i);
}

function decodeEntities_(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}
