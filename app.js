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
const groups = [['police','Police departments'], ['sheriff','Sheriff / custody'], ['court','Courts'], ['support','Case reference & congressional assistance']];
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
  return checklistPlans[agencyId]?.groups.flatMap(group => group.items) || [];
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
const context = JSON.parse($('#review-context').textContent);
const fileCategories = [
  ['action','Attorney forms to complete & return'],
  ['records','Court & police records'],
  ['letters','Agency letters & access decisions'],
  ['forms','Original forms & releases'],
  ['reference','RFE & supporting reference'],
  ['communications','Email transcripts & original-message archives'],
  ['other','Additional documents to review']
];
const knownFiles = {
  'fc1e8f6feec48c87f2125f9275cb2391':['action','CORI authorization · signed by James','Nathan must review, sign/date Part II, and return the completed form to the sheriff.'],
  'fa47f44ce7de81702d6ac13bc7a36c1b':['records','Taunton court · docket PDF 2','Preserved as a separate file from the other Taunton docket attachment.'],
  '07cef6b42a2b2000b900753476da35cc':['records','Taunton court · docket PDF 1','Review together with the second docket PDF and the certified court packet.'],
  '4b7e02a7ae29e04e560bf5dec3793778':['forms','Sheriff CORI waiver · blank original','Reference form from the sheriff. Use the copy already signed by James for Nathan’s remaining signature.'],
  'dff1d7fe0343dcbd1038823d1148cbc8':['letters','Sheriff response · public-records denial','The letter offers a personal-access process. It does not say the custody records do not exist.'],
  '94f651b876d4e8d74f41a2b6c7b598d8':['records','Taunton Police · Reports.pdf','Read with the October 21 email confirming all held records and explaining the redactions in general terms.'],
  '285a078730aa54a27fd07411c81772f9':['records','Brockton court · scanned response','Received October 20. Match the contents and certification to the court checklist.']
};
function fileInfo(doc) {
  if (context.documentOverrides?.[doc.id]) return context.documentOverrides[doc.id];
  if (knownFiles[doc.id]) return knownFiles[doc.id];
  if (/Email_Correspondence|Email_Transcript/.test(doc.name)) return ['communications','Email transcript · readable text','Preserves the imported sent and received email text.'];
  if (/Gmail_Record/.test(doc.name)) return ['communications','Original emails & attachments · ZIP','Original .eml messages, attachments and a text transcript for this section.'];
  if (/USCIS_Email_Archive/.test(doc.name)) return ['communications','Complete USCIS email archive · ZIP','Original messages, attachments and the offline reader for this dated archive.'];
  if (/WAC2590104055/.test(doc.name)) return ['reference','USCIS request for evidence · October 14','Source document for counsel’s response review.'];
  if (/25-01727_E25PER/.test(doc.name)) return ['reference','CORI inventory · January 2, 2025','Supporting inventory sent with the records requests; not a substitute for underlying reports.'];
  if (/USCIS_PRF.*completed/.test(doc.name)) return ['forms','Congressional privacy release · completed copy','Previously sent to the congressional office; preserved for reference.'];
  if (/USCIS_PRF/.test(doc.name)) return ['forms','Congressional privacy release · blank original','Reference copy supplied by the congressional office.'];
  return ['other',doc.name,'New upload: review and classify its contents.'];
}
const fileURL = doc => LIVE + '/files/' + encodeURIComponent(doc.id);
function linkNode(text,href,cls='') {
  const link=el('a',cls,text); link.href=href; return link;
}
function departmentMessages(id) { return context.messages.filter(m=>m.agency_ids.includes(id)); }
function statusFor(agency,replies,documents) {
  const known=context.departments[agency.id];
  const newItems=replies.some(r=>!context.knownResponseIds.includes(r.id)) || documents.some(d=>!context.knownDocumentIds.includes(d.id));
  if (newItems) return ['New activity · review status','review'];
  if (known) return [known.title,known.tone];
  if (replies.some(r=>r.type==='records')) return ['Records reported received','review'];
  if (replies.some(r=>r.type!=='followup')) return ['Reply received · review needed','review'];
  return ['Waiting for response','waiting'];
}
function contactNode(agency) {
  const meta=context.departments[agency.id];
  if (!meta) return el('div');
  const section=el('section','contact-section');
  if (!meta.phones.length && !meta.email) return section;
  section.append(el('h3','','Contact this office'));
  const list=el('div','contact-grid');
  for (const phone of meta.phones) {
    const item=el('div');item.append(el('span','label',phone.label),linkNode(phone.number,'tel:+1'+phone.number.replace(/\D/g,''),'phone-link'));list.append(item);
  }
  if (meta.email) {
    const item=el('div');item.append(el('span','label',agency.id==='police-7'?'Request address · call for follow-up':'Email'),linkNode(meta.email,'mailto:'+meta.email));list.append(item);
  }
  section.append(list);
  if (agency.id==='police-7') section.append(el('p','section-note','Their October 21 reply says DO NOT REPLY to that email; call Records for questions.'));
  if (meta.source) section.append(linkNode('Official contact page ↗',meta.source,'source-link'));
  if (agency.id==='sheriff-8'||agency.id==='court-4') section.append(el('p','section-note','Named contact and direct line are also preserved in the agency’s email signature.'));
  return section;
}
function statusNode(agency,replies,documents) {
  const meta=context.departments[agency.id];
  const section=el('section','process-status');
  section.append(el('h3','','Where things stand'));
  if (!meta) {section.append(el('p','','Review the latest correspondence below.'));return section;}
  const [label]=statusFor(agency,replies,documents);
  section.append(el('p','status-date','Status reviewed '+dateLabel(meta.asOf || context.asOf)+' · Next action: '+meta.owner));
  if (label.startsWith('New activity')) section.append(el('p','new-activity','New material was added after this summary. Read the latest saved updates and documents before relying on the status below.'));
  const grid=el('dl','status-grid');
  for (const [term,value] of [['Received / confirmed',meta.received],['Still pending',meta.pending],['Next step',meta.next]]) {
    const row=el('div');row.append(el('dt','',term),el('dd','',value));grid.append(row);
  }
  section.append(grid,el('p','source-note','Basis: '+meta.evidence));
  if (agency.id==='sheriff-8') {
    const doc=documents.find(d=>d.id==='fc1e8f6feec48c87f2125f9275cb2391');
    if(doc) section.append(linkNode('Attorney: download authorization to sign & return ↓',fileURL(doc),'primary-link'));
    section.append(el('p','section-note','Return completed authorization to efahey@pcsdma.org. Submission has not been confirmed.'));
  }
  for (const id of meta.reviewDocumentIds || []) {
    const doc=documents.find(d=>d.id===id);
    if(doc) section.append(linkNode('Nathan: download court records for review ↓',fileURL(doc),'primary-link'));
  }
  return section;
}
function documentRow(doc) {
  const [category,label,note]=fileInfo(doc);
  const row=el('div','document-row'+(category==='action'?' document-action':''));row.dataset.documentId=doc.id;
  const info=el('div');info.append(linkNode(label,fileURL(doc),'document-title'),el('p','section-note',note));
  info.append(el('small','original-name','Original: '+doc.name+' · '+(doc.size>=1048576?(doc.size/1048576).toFixed(1)+' MB':Math.max(1,Math.ceil(doc.size/1024))+' KB')));
  const download=linkNode('Download ↓',fileURL(doc),'download-link');download.setAttribute('aria-label','Download '+label);
  row.append(info,download);return row;
}
function documentsNode(agency,documents) {
  const section=el('section','card-section attachment-section');
  section.append(el('h3','','Attachments by purpose'));
  const counts=documents.filter(d=>['records','letters'].includes(fileInfo(d)[0])).length;
  if(agency.kind!=='support') section.append(el('p','section-note',counts ? 'Agency records and letters are separated from forms and email archives.' : 'No agency records or decision letters are uploaded in this section yet. Saved requests and email archives remain available below.'));
  if(!documents.length) section.append(el('p','section-note','No uploaded files in this section.'));
  for(const [id,title] of fileCategories) {
    const docs=documents.filter(d=>fileInfo(d)[0]===id);
    if(!docs.length) continue;
    const category=el('div','attachment-category');category.dataset.category=id;
    category.append(el('h4','',title+' · '+docs.length));docs.forEach(d=>category.append(documentRow(d)));section.append(category);
  }
  const related=(context.departments[agency.id]?.relatedDocumentIds || []).map(id=>currentData.documents.find(d=>d.id===id)).filter(Boolean);
  if(related.length) {
    const box=el('div','attachment-category related-court-records');
    box.append(el('h4','','Related court records · separate from police reports'));
    for(const doc of related) box.append(linkNode((currentData.emails.find(a=>a.id===doc.agencyId)?.name || 'Court record')+': '+doc.name+' ↓',fileURL(doc),'source-link'));
    section.append(box);
  }
  if(agency.kind==='police'||agency.kind==='sheriff') section.append(linkNode('Shared reference: CORI inventory and RFE →','#case-reference','source-link'));
  return section;
}
function messageNode(message) {
  const item=disclosure('message-'+message.message_id,'','message-disclosure');
  item.dataset.messageId=message.message_id;
  const head=el('span','message-heading');head.append(el('span','direction '+message.direction,message.direction==='sent'?'Sent':'Received'),el('time','',dateLabel(message.date_et)+' · '+message.date_et.slice(11,16)+' ET'));
  item.firstChild.append(head,el('span','message-subject',message.subject||'(No subject)'));
  const envelope=el('div','message-envelope');
  for(const [key,label] of [['from','From'],['to','To'],['cc','Cc']])if(message[key])envelope.append(el('p','',label+': '+message[key]));
  envelope.append(linkNode('Open original in Gmail ↗',message.gmail_url),el('p','section-note','Gmail link requires access to James’s mailbox. Download the original-message ZIP in this section for an offline copy.'));
  if(context.messageNotes?.[message.message_id]) envelope.append(el('p','new-activity',context.messageNotes[message.message_id]));
  if(message.message_id==='1a15f5706139f66c') envelope.append(el('p','new-activity','ATTORNEY ACTION: request the records from a business email, on appropriate letterhead, with James’s signed authorization to release the information to Nathan. Send to records@warehampolice.gov. This reply contains no attachments.'));
  if(message.message_id==='1a15a764d09a9763') envelope.append(el('p','new-activity','ATTORNEY ACTION: review this letter and the waiver. Download the authorization already signed by James above, complete Part II, and return that completed form to the sheriff.'));
  if(message.attachments.length) {
    const list=el('div','email-attachments');list.append(el('p','section-note','Original attachments · also preserved in the email ZIP:'));
    for(const attachment of message.attachments) {
      const doc=currentData.documents.find(d=>d.size===attachment.size && (d.name===attachment.filename || (message.agency_ids.includes(d.agencyId) && attachment.filename==='DOC102126.pdf')));
      const row=el('p');
      if(doc) row.append(linkNode(attachment.filename+' ↓',fileURL(doc)));
      else row.append(el('span','',attachment.filename+' · in original-message ZIP'));
      list.append(row);
    }
    envelope.append(list);
  }
  item.append(envelope,el('pre','message-body',message.body));return item;
}
function communicationsNode(agency,replies) {
  const messages=departmentMessages(agency.id);
  const ownerUpdates=(context.ownerUpdates || []).filter(u=>u.agencyId===agency.id);
  const section=disclosure('communications-'+agency.id,agency.id==='case-reference'?'Archive scope · '+context.messages.length+' emails':('Communications · '+plural(messages.length,'email')+' · '+plural(replies.length,'saved update')),'communications-section');
  if(ownerUpdates.length) section.firstChild.append(el('span','', ' · '+plural(ownerUpdates.length,'phone update')));
  const body=el('div','communications-body');
  for(const update of ownerUpdates) {
    const item=disclosure('owner-update-'+update.id,'Phone update reported '+dateLabel(update.date),'response-disclosure');
    item.append(el('p','section-note',update.source),el('p','text',update.text));body.append(item);
  }
  body.append(el('p','section-note','Preserved correspondence updated October 22, 2026, including the requested Wareham and Attleboro replies. Full message text is preserved, including quoted history; original .eml files and attachments are in the downloadable ZIP. Phone updates are identified in the status summary.'));
  if(messages.length) [...messages].reverse().forEach(m=>body.append(messageNode(m)));
  else body.append(el('p','section-note',agency.id==='case-reference'?'The current full archive covers all '+context.messages.length+' emails. Read individual messages under their department or Congressional assistance.':'No imported emails assigned to this section.'));
  const saved=disclosure('saved-updates-'+agency.id,'Saved response log · '+replies.length,'saved-updates');
  if(!replies.length)saved.append(el('p','section-note','No saved updates.'));
  replies.forEach(r=>saved.append(responseNode(r)));body.append(saved);section.append(body);return section;
}
function agencyCard(agency,replies,documents) {
  const meta=context.departments[agency.id];
  const card=disclosure(agency.id,'','agency-card');card.dataset.kind=agency.kind;
  card.dataset.activity=String(departmentMessages(agency.id).some(m=>m.direction==='received')||replies.some(r=>r.type!=='followup'));
  card.dataset.waiting=String(meta?.waiting||false);card.dataset.attorney=String(meta?.tone==='action');
  card.dataset.search=[agency.name,agency.to,agency.subject,agency.body,JSON.stringify(meta||{}),...replies.map(r=>r.text),...documents.map(d=>d.name),...departmentMessages(agency.id).map(m=>m.subject+' '+m.body)].join(' ').toLowerCase();
  const summary=card.firstChild;summary.className='agency-summary';
  const title=el('span','agency-title');title.append(el('span','agency-name',agency.name),el('span','agency-brief',meta?.short||'Open to review records and communications.'));
  const [status,statusClass]=statusFor(agency,replies,documents);
  const overview=el('span','agency-overview');overview.append(el('span','status-badge '+statusClass,status),el('span','agency-meta',plural(documents.length,'file')+' · '+(agency.id==='case-reference'?context.messages.length+' emails in full archive':plural(departmentMessages(agency.id).length,'email'))));
  const chevron=el('span','chevron','⌄');chevron.setAttribute('aria-hidden','true');summary.append(title,overview,chevron);
  const content=el('div','agency-content');content.append(statusNode(agency,replies,documents),contactNode(agency),documentsNode(agency,documents),communicationsNode(agency,replies));
  if(checklistPlans[agency.id]) content.append(checklistNode(agency));
  if(agency.body) {
    const request=disclosure('request-'+agency.id,'Request reference copy · may differ from sent email','request-disclosure');
    const envelope=el('div','envelope');
    for(const [label,value] of [['To',agency.to],['Subject',agency.subject],['Sent evidence','Original request verified in the October 21 Gmail import. Read the sent email above for the actual message.']]){const p=el('p');p.append(el('span','label',label),el('span','',value));envelope.append(p);}
    request.append(envelope,messageHTML(agency.body));content.append(request);
  }
  card.append(content);return card;
}
function attorneyQueue(data) {
  const container=$('#attorney-actions');container.replaceChildren();
  const form=data.documents.find(d=>d.id==='fc1e8f6feec48c87f2125f9275cb2391');
  const warehamInstructions=data.documents.find(d=>d.name==='Wareham_Police_Response_2026-10-21_1241_ET.txt');
  const actions=[
    ['sheriff-8','01','DOWNLOAD · SIGN · RETURN','Sheriff authorization','James has signed and dated the form. Nathan needs to review and sign/date Part II, then return it to Euvir Fahey at efahey@pcsdma.org. Submission is not yet confirmed.',form],
    ['police-19','02','DOWNLOAD · REQUEST · AUTHORIZE','Wareham records release','Records exist. Nathan must request them from his business email on letterhead, with James’s signed authorization. Send both to Cindy Garron at records@warehampolice.gov. Records have not yet been delivered.',warehamInstructions],
    ['police-7','03','REVIEW · CALL RECORDS','Taunton reports & redactions','Reports and the all-held-records confirmation are saved. Call about redactions, access through counsel, and certification. The latest reply says not to reply by email.',null]
  ];
  for(const [id,n,tag,title,body,doc]of actions){
    const card=el('article','action-card');card.append(el('span','action-number',n),el('p','action-label',tag),el('h3','',title),el('p','',body));
    if(doc)card.append(linkNode(id==='police-19'?'Download Wareham’s instructions ↓':'Download James-signed form ↓',fileURL(doc),'primary-link'));
    card.append(linkNode('View status & correspondence →','#'+id,'action-detail'));container.append(card);
  }
}

function applyFilters() {
  const query = $('#agency-search').value.trim().toLowerCase();
  const filter = $('#agency-filter').value;
  let visible = 0;
  document.querySelectorAll('.agency-card').forEach(card => {
    const matches = filter === 'all' || card.dataset.kind === filter || (filter === 'activity' && card.dataset.activity === 'true') || (filter === 'waiting' && card.dataset.waiting === 'true') || (filter === 'attorney' && card.dataset.attorney === 'true');
    card.hidden = !(matches && card.dataset.search.includes(query));
    if (!card.hidden) visible++;
  });
  document.querySelectorAll('.agency-group').forEach(group => { group.hidden = !group.querySelector('.agency-card:not([hidden])'); });
  $('#result-count').textContent = visible + ' of ' + currentData.emails.length + ' sections';
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
  const departments=data.emails.filter(c=>c.kind!=='support');
  $('#sent-count').textContent = departments.filter(c => c.sent).length + ' / ' + departments.length;
  attorneyQueue(data);
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
    status.textContent = 'Files & response log refreshed · See each department’s status date';
  } catch (error) {
    status.textContent = hasLiveData ? 'Refresh unavailable · Showing last loaded updates' : 'Live updates unavailable · Showing the saved records snapshot';
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
