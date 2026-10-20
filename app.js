'use strict';
const LIVE = 'https://records.143-244-168-180.sslip.io';
const $ = selector => document.querySelector(selector);
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};
const types = {reply:'Reply received', records:'Records received', unavailable:'Unavailable / restricted', followup:'Follow-up sent'};
const groups = [['court','Courts'], ['police','Police departments'], ['sheriff','Sheriff / custody']];
const dateLabel = value => new Date(value.slice(0,10) + 'T12:00:00').toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
const plural = (count, word) => count + ' ' + word + (count === 1 ? '' : 's');
let currentData, fingerprint = '', hasLiveData = false;
const checklistPlans = JSON.parse($('#rfe-checklist-data').textContent);
const CHECKLIST_KEY = 'records-rfe-2026-10-14-checks-v1';
let checklistSaved = true;
let checkedItems = new Set();
try {
  const saved = JSON.parse(localStorage.getItem(CHECKLIST_KEY) || '[]');
  if (Array.isArray(saved)) checkedItems = new Set(saved.filter(key => typeof key === 'string'));
} catch (error) { checklistSaved = false; }

function checklistItems(agencyId) {
  return checklistPlans[agencyId].groups.flatMap(group => group.items);
}
function updateChecklistProgress(agencyId) {
  const items = checklistItems(agencyId);
  const count = items.filter(item => checkedItems.has(agencyId + ':' + item.id)).length;
  document.querySelectorAll('[data-check-progress="' + agencyId + '"]').forEach(node => {
    node.textContent = count + ' / ' + items.length + ' checked';
  });
  document.querySelectorAll('.checklist-storage').forEach(node => {
    node.textContent = checklistSaved
      ? 'Checks save only in this browser at this page address. They are not shared with counsel or synced to the other page.'
      : 'Browser saving is unavailable. Checks are kept for this visit only.';
  });
}
function checklistNode(agency) {
  const plan = checklistPlans[agency.id];
  const section = disclosure('checklist-' + agency.id, '', 'rfe-checklist');
  const progress = el('span', 'checklist-progress');
  progress.dataset.checkProgress = agency.id;
  section.firstChild.append(el('span', '', 'RFE checklist'), progress);
  const body = el('div', 'checklist-body');
  body.append(el('p', 'checklist-intro', plan.intro));
  body.append(el('p', 'section-note', 'Check an item after reviewing all relevant records or confirming it does not apply. Unchecked means not yet reviewed—not automatically missing. Uploading a file does not check anything off.'));
  body.append(el('p', 'checklist-storage'));
  for (const group of plan.groups) {
    const fieldset = el('fieldset', 'checklist-group');
    fieldset.append(el('legend', '', group.title));
    for (const item of group.items) {
      const key = agency.id + ':' + item.id;
      const label = el('label', 'checklist-item');
      const input = el('input');
      input.type = 'checkbox';
      input.id = 'check-' + agency.id + '-' + item.id;
      input.dataset.checkKey = key;
      input.checked = checkedItems.has(key);
      const text = el('span', 'checklist-copy');
      const detail = el('span', 'checklist-detail', item.detail);
      detail.id = input.id + '-detail';
      input.setAttribute('aria-describedby', detail.id);
      text.append(el('span', 'checklist-label', item.title), detail, el('span', 'checklist-source', item.source));
      input.addEventListener('change', () => {
        if (input.checked) checkedItems.add(key);
        else checkedItems.delete(key);
        try {
          localStorage.setItem(CHECKLIST_KEY, JSON.stringify([...checkedItems]));
          checklistSaved = true;
        } catch (error) { checklistSaved = false; }
        updateChecklistProgress(agency.id);
      });
      label.append(input, text);
      fieldset.append(label);
    }
    body.append(fieldset);
  }
  body.append(el('p', 'checklist-note', plan.unavailable));
  const actions = el('div', 'checklist-actions');
  const copy = el('button', '', 'Copy unchecked items');
  copy.type = 'button';
  const status = el('span', 'section-note');
  status.setAttribute('role', 'status');
  const fallback = el('textarea', 'checklist-copy-fallback');
  fallback.readOnly = true;
  fallback.hidden = true;
  fallback.setAttribute('aria-label', 'Unchecked checklist items to copy');
  copy.addEventListener('click', async () => {
    const remaining = checklistItems(agency.id).filter(item => !checkedItems.has(agency.id + ':' + item.id));
    fallback.hidden = true;
    if (!remaining.length) {
      status.textContent = 'All checklist items are checked.';
      return;
    }
    const text = agency.name + ' — items still to review / follow up\nUnchecked items have not yet been verified; they are not necessarily missing.\n\n'
      + remaining.map(item => '• ' + item.title + '\n' + item.detail + '\n' + item.source).join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = plural(remaining.length, 'unchecked item') + ' copied.';
    } catch (error) {
      fallback.value = text;
      fallback.hidden = false;
      fallback.focus();
      fallback.select();
      status.textContent = 'Select and copy the text below.';
    }
  });
  actions.append(copy, status);
  body.append(actions, fallback, el('p', 'checklist-source', 'Source: your USCIS RFE dated October 14, 2026, printed pages 2–4. Case routing uses the supplied January 2, 2025 CORI and saved requests. These checks track your review, not USCIS acceptance or a legal finding.'));
  section.append(body);
  return section;
}

function messageHTML(text) {
  const box = el('div', 'email');
  for (const part of text.split(/\n\s*\n/)) box.append(el('p', '', part));
  return box;
}
function disclosure(id, label, cls) {
  const node = el('details', cls);
  node.id = id;
  node.append(el('summary', '', label));
  return node;
}
function responseNode(response) {
  const node = disclosure('update-' + response.id, '', 'response-disclosure');
  node.firstChild.append(el('span', '', types[response.type] || 'Update'), el('time', 'muted', dateLabel(response.date)));
  node.append(el('p', 'text', response.text));
  return node;
}
function statusFor(replies, documents) {
  if (documents.length) return ['Documents available', 'received'];
  if (replies.some(r => r.type === 'records')) return ['Records reported received', 'received'];
  const latest = replies.find(r => r.type !== 'followup');
  if (latest) return [latest.type === 'unavailable' ? 'Unavailable / restricted' : 'Reply received', latest.type === 'unavailable' ? 'restricted' : 'replied'];
  return ['Awaiting reply', 'waiting'];
}
function agencyCard(agency, replies, documents) {
  const card = disclosure(agency.id, '', 'agency-card');
  card.dataset.kind = agency.kind;
  card.dataset.activity = String(documents.length > 0 || replies.some(r => r.type !== 'followup'));
  card.dataset.waiting = String(!replies.some(r => r.type !== 'followup') && !documents.length);
  card.dataset.search = [agency.name, agency.to, agency.subject, agency.body, ...replies.map(r => r.text), ...documents.map(d => d.name)].join(' ').toLowerCase();
  const summary = card.firstChild;
  summary.className = 'agency-summary';
  const title = el('span', 'agency-title');
  title.append(el('span', 'agency-name', agency.name), el('span', 'agency-meta', (agency.kind === 'sheriff' ? 'Custody records' : plural(agency.cases, 'known case')) + ' · ' + (agency.sent ? 'Request sent' : 'Not marked sent')));
  const [status, statusClass] = statusFor(replies, documents);
  const overview = el('span', 'agency-overview');
  overview.append(el('span', 'status-badge ' + statusClass, status), el('span', 'agency-meta', plural(documents.length, 'document') + ' · ' + plural(replies.length, 'update')));
  const checklistCount = el('span', 'agency-meta checklist-card-progress');
  checklistCount.dataset.checkProgress = agency.id;
  overview.append(checklistCount);
  const chevron = el('span', 'chevron', '⌄');
  chevron.setAttribute('aria-hidden', 'true');
  summary.append(title, overview, chevron);
  const content = el('div', 'agency-content');
  const docs = el('section', 'card-section');
  docs.append(el('h3', '', 'Documents'), el('p', 'section-note', documents.length ? 'Original files available to open or download.' : 'No documents uploaded yet.'));
  for (const doc of documents) {
    const row = el('div', 'document-row');
    const info = el('div');
    const link = el('a', '', doc.name);
    link.href = LIVE + '/files/' + encodeURIComponent(doc.id);
    info.append(link, el('small', '', (doc.size >= 1048576 ? (doc.size / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.ceil(doc.size / 1024)) + ' KB') + ' · Uploaded ' + dateLabel(doc.createdAt)));
    const download = el('a', 'download-link', 'Download ↓');
    download.href = link.href;
    download.setAttribute('aria-label', 'Download ' + doc.name);
    row.append(info, download);
    docs.append(row);
  }
  const updates = el('section', 'card-section');
  updates.append(el('h3', '', 'Replies & follow-up'));
  if (!replies.length) updates.append(el('p', 'section-note', 'No response recorded yet.'));
  else replies.forEach(r => updates.append(responseNode(r)));
  const request = disclosure('request-' + agency.id, 'Original email request', 'request-disclosure');
  const envelope = el('div', 'envelope');
  for (const [label, value] of [['To', agency.to], ['Subject', agency.subject], ['Sent status', agency.sent ? 'Confirmed by James · ' + dateLabel(agency.sentConfirmedOn) : 'Not marked sent']]) {
    const p = el('p');
    p.append(el('span', 'label', label), el('span', '', value));
    envelope.append(p);
  }
  request.append(envelope, messageHTML(agency.body));
  content.append(checklistNode(agency), docs, updates, request);
  card.append(content);
  return card;
}
function applyFilters() {
  const query = $('#agency-search').value.trim().toLowerCase();
  const filter = $('#agency-filter').value;
  let visible = 0;
  document.querySelectorAll('.agency-card').forEach(card => {
    const matches = filter === 'all' || card.dataset.kind === filter || (filter === 'activity' && card.dataset.activity === 'true') || (filter === 'waiting' && card.dataset.waiting === 'true');
    card.hidden = !(matches && card.dataset.search.includes(query));
    if (!card.hidden) visible++;
  });
  document.querySelectorAll('.agency-group').forEach(group => { group.hidden = !group.querySelector('.agency-card:not([hidden])'); });
  $('#result-count').textContent = visible + ' of ' + currentData.emails.length + ' agencies';
  $('#empty-results').hidden = visible !== 0;
}
function render(data) {
  currentData = data;
  const nextFingerprint = JSON.stringify(data);
  if (nextFingerprint === fingerprint) return;
  const openIds = new Set([...document.querySelectorAll('details[open]')].map(node => node.id));
  const focused = document.activeElement;
  const focusedControlId = focused?.id;
  const focusId = focused?.closest('details')?.id;
  const focusIsSummary = focused?.tagName === 'SUMMARY';
  $('#sent-count').textContent = data.emails.filter(c => c.sent).length + ' / ' + data.emails.length;
  $('#reply-count').textContent = new Set(data.responses.filter(r => r.type !== 'followup').map(r => r.agencyId)).size;
  $('#files-count').textContent = (data.documents || []).length;
  const container = $('#requests');
  container.replaceChildren();
  for (const [kind, name] of groups) {
    const agencies = data.emails.filter(c => c.kind === kind);
    if (!agencies.length) continue;
    const section = el('section', 'agency-group');
    section.setAttribute('aria-labelledby', 'group-' + kind);
    const heading = el('h3', 'group-title', name);
    heading.id = 'group-' + kind;
    heading.append(el('span', '', String(agencies.length)));
    section.append(heading);
    for (const agency of agencies) {
      const replies = data.responses.filter(r => r.agencyId === agency.id).sort((a,b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
      const documents = (data.documents || []).filter(d => d.agencyId === agency.id);
      section.append(agencyCard(agency, replies, documents));
    }
    container.append(section);
  }
  openIds.forEach(id => { const node = document.getElementById(id); if (node) node.open = true; });
  if (focusIsSummary && focusId) document.getElementById(focusId)?.firstChild.focus({preventScroll:true});
  else if (focusedControlId) document.getElementById(focusedControlId)?.focus({preventScroll:true});
  data.emails.forEach(agency => updateChecklistProgress(agency.id));
  fingerprint = nextFingerprint;
  applyFilters();
}
function openHash() {
  const card = document.getElementById(location.hash.slice(1));
  if (!card?.classList.contains('agency-card')) return;
  $('#agency-search').value = '';
  $('#agency-filter').value = 'all';
  applyFilters();
  card.open = true;
  card.scrollIntoView({block:'start'});
}
async function load() {
  const status = $('#sync-status');
  try {
    const response = await fetch(LIVE + '/api/progress', {cache:'no-store', signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw Error('Unavailable');
    const data = await response.json();
    render(data);
    hasLiveData = true;
    status.textContent = 'Up to date · Refreshes every minute';
  } catch (error) {
    status.textContent = hasLiveData ? 'Refresh unavailable · Showing last loaded updates' : 'Live updates unavailable · Saved Oct 20 request list only; replies and documents may be missing';
  }
}
$('#agency-search').addEventListener('input', applyFilters);
$('#agency-filter').addEventListener('change', applyFilters);
$('#expand-all').addEventListener('click', () => document.querySelectorAll('.agency-card:not([hidden])').forEach(card => {card.open = true;}));
$('#collapse-all').addEventListener('click', () => document.querySelectorAll('.agency-card:not([hidden])').forEach(card => {card.open = false;}));
render(JSON.parse($('#saved-data').textContent));
openHash();
load();
setInterval(() => {if (!document.hidden) load();}, 60000);
window.addEventListener('hashchange', openHash);
window.addEventListener('storage', event => {
  if (event.key !== CHECKLIST_KEY && event.key !== null) return;
  try {
    const saved = JSON.parse(event.newValue || '[]');
    if (!Array.isArray(saved)) return;
    checkedItems = new Set(saved.filter(key => typeof key === 'string'));
    document.querySelectorAll('[data-check-key]').forEach(input => {
      input.checked = checkedItems.has(input.dataset.checkKey);
    });
    currentData.emails.forEach(agency => updateChecklistProgress(agency.id));
  } catch (error) { /* Keep current checks if another tab writes invalid data. */ }
});
let printState;
window.addEventListener('beforeprint', () => {
  printState = new Set([...document.querySelectorAll('details[open]')].map(node => node.id));
  document.querySelectorAll('details').forEach(node => {node.open = true;});
});
window.addEventListener('afterprint', () => {
  if (!printState) return;
  document.querySelectorAll('details').forEach(node => {node.open = printState.has(node.id);});
  printState = null;
});
