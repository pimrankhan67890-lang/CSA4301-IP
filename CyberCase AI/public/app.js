const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const state = {
  files: [],
  api: { connected: false, model: 'gemini-3.8-flash', mode: 'not-configured' },
  analysis: null,
  evidence: [],
  mode: 'none',
  activeTab: 'timeline',
  report: '',
  currentView: 'workspace'
};

const allowedExtensions = new Set(['pdf','png','jpg','jpeg','webp','txt','md','eml','csv']);
const maxFileSize = 12 * 1024 * 1024;
const maxTotalSize = 12 * 1024 * 1024;

const sampleAnalysis = {
  caseTitle: 'Suspicious recruitment payment',
  incidentType: 'Fake job or recruitment offer',
  riskLevel: 'Moderate',
  confidence: 'Medium',
  summary: 'The sample scenario describes a recruitment contact requesting a registration payment and then becoming unresponsive. The materials suggest a possible recruitment scam pattern, but the sample does not establish who operated the contact or whether a crime occurred.',
  timeline: [
    { dateTime: '2026-10-11 · 10:14 AM', event: 'A message described a remote job opportunity and asked the applicant to continue the conversation.', source: 'sample-recruitment-message.txt', confidence: 'High' },
    { dateTime: '2026-10-11 · 11:02 AM', event: 'The contact requested a registration fee before the interview. The request should be checked against a verified company recruitment channel.', source: 'sample-chat-export.txt', confidence: 'Medium' },
    { dateTime: '2026-10-11 · 11:18 AM', event: 'A sample payment receipt appears in the evidence set. The transaction details require confirmation against the bank or payment app record.', source: 'sample-payment-receipt.png', confidence: 'Medium' },
    { dateTime: 'Date not established', event: 'The user reports that the contact stopped replying. No independently timestamped follow-up evidence was supplied in this sample.', source: 'User-provided scenario', confidence: 'Low' }
  ],
  entities: [
    { type: 'ORGANIZATION', value: 'Recruitment company name not verified', source: 'sample-recruitment-message.txt', note: 'Verify the company using its official website or published contact details.' },
    { type: 'PAYMENT', value: 'Amount not established in sample', source: 'sample-payment-receipt.png', note: 'Read the original statement or payment app record before relying on this field.' },
    { type: 'CHANNEL', value: 'Messaging application', source: 'sample-chat-export.txt', note: 'The platform alone does not establish whether a message is genuine.' }
  ],
  findings: [
    { title: 'Payment requested before recruitment is verified', detail: 'Requests for upfront fees are a reason to pause and independently verify the employer and the purpose of the payment.', severity: 'Important' },
    { title: 'Transaction requires independent confirmation', detail: 'Compare the uploaded receipt with the transaction shown in the official bank or payment application. A screenshot alone is not proof of settlement.', severity: 'Caution' },
    { title: 'Identity and company ownership remain unverified', detail: 'The materials do not independently establish that the contact represents the named organization.', severity: 'Caution' }
  ],
  missingInformation: ['Exact transaction reference from the official bank/payment record', 'Verified company name and its official recruitment contact', 'Timestamped follow-up messages showing the change in communication', 'Whether the matter has already been reported to the bank or an official portal'],
  recommendedNextSteps: ['Preserve the original messages, files and payment records without editing them.', 'Contact the bank or payment provider promptly if money was transferred.', 'Verify the employer using contact details obtained independently from its official website.', 'If you suspect cybercrime in India, use the official National Cyber Crime Reporting Portal and follow its instructions.', 'Review each fact in this AI-generated summary against the original evidence before sharing it.'],
  evidenceLimitations: ['This is a fictional training scenario, not a real case.', 'No file in this sample is certified as authentic.', 'The analysis does not identify a guilty person or make a legal determination.']
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[ch]));
}
function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
function extOf(name = '') { return name.split('.').pop().toLowerCase(); }
function titleCase(value = '') { return String(value).replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function toast(message, type = 'success', icon = '✳') {
  const el = document.createElement('div');
  el.className = `toast ${type === 'error' ? 'error' : ''}`;
  el.innerHTML = `<span class="toast-icon">${type === 'error' ? '!' : icon}</span><span>${escapeHtml(message)}</span>`;
  $('#toast-stack').append(el);
  window.setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(12px)'; window.setTimeout(() => el.remove(), 280); }, 4200);
}
function showError(message) {
  const box = $('#error-banner');
  box.textContent = message;
  box.hidden = false;
}
function clearError() { $('#error-banner').hidden = true; $('#error-banner').textContent = ''; }

function bootSplash() {
  const splash = $('#splash');
  const appShell = $('#app-shell');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) document.documentElement.classList.add('no-motion');
  let progress = 0;
  let closed = false;
  const captions = ['Opening your workspace', 'Arranging the evidence tools', 'Preparing the case trail', 'Workspace ready'];
  const started = performance.now();
  const duration = reduceMotion ? 160 : 2450;
  function frame(now) {
    progress = Math.min(100, Math.floor(((now - started) / duration) * 100));
    $('#splash-line-fill').style.width = `${progress}%`;
    $('#splash-percent').textContent = `${String(progress).padStart(2, '0')}%`;
    const idx = Math.min(3, Math.floor(progress / 27));
    $('#splash-caption').textContent = captions[idx];
    $('#splash-progress-label').textContent = progress < 35 ? '00 — OPENING WORKSPACE' : progress < 68 ? '01 — ARRANGING TOOLS' : progress < 100 ? '02 — PREPARING CASE TRAIL' : '03 — READY TO REVIEW';
    if (progress < 100) requestAnimationFrame(frame);
    else window.setTimeout(closeSplash, 450);
  }
  function closeSplash() {
    if (closed) return;
    closed = true;
    splash.classList.add('is-gone');
    appShell.classList.add('app-ready');
    setTimeout(() => splash.remove(), 1050);
  }
  $('#skip-splash').addEventListener('click', closeSplash);
  requestAnimationFrame(frame);
}

function initCanvas() {
  const canvas = $('#field-canvas');
  if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = canvas.getContext('2d');
  let width = 0, height = 0, particles = [], raf = 0;
  const resize = () => {
    width = canvas.width = window.innerWidth * Math.min(window.devicePixelRatio || 1, 1.5);
    height = canvas.height = window.innerHeight * Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(Math.min(window.devicePixelRatio || 1, 1.5), 0, 0, Math.min(window.devicePixelRatio || 1, 1.5), 0, 0);
    particles = Array.from({ length: Math.min(52, Math.round(window.innerWidth / 28)) }, () => ({
      x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
      vx: (Math.random() - .5) * .16, vy: (Math.random() - .5) * .16,
      r: Math.random() * 1.3 + .2, a: Math.random() * .23 + .06
    }));
  };
  const draw = () => {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]; p.x += p.vx; p.y += p.vy;
      if (p.x < -10) p.x = window.innerWidth + 10; if (p.x > window.innerWidth + 10) p.x = -10;
      if (p.y < -10) p.y = window.innerHeight + 10; if (p.y > window.innerHeight + 10) p.y = -10;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fillStyle = `rgba(36,130,123,${p.a})`; ctx.fill();
      for (let j = i + 1; j < particles.length; j++) {
        const q = particles[j], dx = p.x - q.x, dy = p.y - q.y, distance = Math.hypot(dx, dy);
        if (distance < 115) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.strokeStyle = `rgba(74,143,128,${.07 * (1 - distance / 115)})`; ctx.lineWidth = .55; ctx.stroke(); }
      }
    }
    raf = requestAnimationFrame(draw);
  };
  resize(); draw();
  window.addEventListener('resize', () => { cancelAnimationFrame(raf); resize(); draw(); }, { passive: true });
}

async function getStatus() {
  try {
    const response = await fetch('/api/status');
    const data = await response.json();
    state.api = data;
    const isLive = Boolean(data.connected);
    $('#api-pill').classList.toggle('live', isLive);
    $('#api-status-label').textContent = isLive ? `GEMINI · ${data.model.toUpperCase()}` : 'GEMINI · NOT CONNECTED';
    $('#sidebar-status').textContent = isLive ? 'GEMINI CONNECTED' : 'GEMINI NOT CONNECTED';
    $('.sidebar-footer').classList.toggle('live', isLive);
    $('#stat-mode').innerHTML = `${isLive ? 'CONNECTED' : 'NOT CONNECTED'}<span class="mini-led" style="${isLive ? 'background:#4bb875' : ''}"></span>`;
    $('#stat-mode-small').textContent = isLive ? `Connected · ${data.model}` : 'Add a Gemini key to analyze';
  } catch {
    state.api.connected = false;
    $('#api-status-label').textContent = 'SERVER OFFLINE';
    $('#sidebar-status').textContent = 'SERVER OFFLINE';
    $('#stat-mode').innerHTML = 'OFFLINE<span class="mini-led"></span>';
    $('#stat-mode-small').textContent = 'Start server to activate workspace';
  }
}

async function hashFile(file) {
  try {
    if (!crypto.subtle) return 'UNAVAILABLE';
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch { return 'UNAVAILABLE'; }
}

async function addFiles(incoming) {
  clearError();
  const newFiles = [...incoming];
  if (!newFiles.length) return;
  const added = [];
  for (const file of newFiles) {
    const ext = extOf(file.name);
    if (!allowedExtensions.has(ext)) { showError(`${file.name}: unsupported type. Use PDF, PNG, JPG, WEBP, TXT, MD, EML or CSV.`); continue; }
    if (file.size > maxFileSize) { showError(`${file.name}: file exceeds the 12 MB per-file limit.`); continue; }
    if (state.files.some(item => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified)) continue;
    if (state.files.length >= 5) { showError('Maximum 5 files per analysis. Remove a file to add another.'); break; }
    const used = state.files.reduce((sum, item) => sum + item.file.size, 0);
    if (used + file.size > maxTotalSize) { showError('Combined file size exceeds 12 MB. Remove a file or choose smaller evidence.'); break; }
    const item = { id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, file, hash: 'HASHING…', hasAppeared: false };
    state.files.push(item);
    added.push(item);
  }
  renderFiles();
  for (const item of added) {
    hashFile(item.file).then(hash => {
      item.hash = hash;
      const card = $$('[data-file-id]', $('#file-list')).find(element => element.dataset.fileId === item.id);
      if (!card) return;
      card.querySelector('.file-hash').textContent = hash === 'UNAVAILABLE' ? hash : `SHA-256 · ${hash.slice(0, 15)}…`;
      card.querySelector('.file-status').textContent = hash === 'UNAVAILABLE' ? 'CHECK FILE' : 'FINGERPRINTED';
    });
  }
}

function renderFiles() {
  const list = $('#file-list');
  $('#file-count').textContent = `${state.files.length} / 5 FILES`;
  const accents = ['#138f88','#668be8','#f27766','#a17ce0','#c08a22'];
  list.innerHTML = state.files.map((item, index) => {
    const ext = extOf(item.file.name).toUpperCase();
    const entering = !item.hasAppeared;
    item.hasAppeared = true;
    const fingerprint = item.hash === 'HASHING…' ? 'Preparing fingerprint…' : item.hash === 'UNAVAILABLE' ? 'Fingerprint unavailable' : `SHA-256 · ${item.hash.slice(0, 15)}…`;
    const status = item.hash === 'HASHING…' ? 'READING' : item.hash === 'UNAVAILABLE' ? 'CHECK FILE' : 'FINGERPRINTED';
    return `<article class="file-item${entering ? ' is-entering' : ''}" style="--file-index:${index};--file-accent:${accents[index % accents.length]}" data-file-id="${escapeHtml(item.id)}"><div class="file-symbol">${escapeHtml(ext.slice(0,4))}</div><div class="file-copy"><div class="file-title-row"><span class="file-name">${escapeHtml(item.file.name)}</span><span class="file-status">${status}</span></div><span class="file-detail"><span>${formatBytes(item.file.size)}</span><span class="file-hash">${escapeHtml(fingerprint)}</span></span></div><button class="remove-file" data-remove-file="${escapeHtml(item.id)}" title="Remove file" aria-label="Remove ${escapeHtml(item.file.name)}">×</button></article>`;
  }).join('');
  $$('[data-remove-file]', list).forEach(button => button.addEventListener('click', () => {
    state.files = state.files.filter(item => item.id !== button.dataset.removeFile);
    renderFiles();
  }));
}

function setLoading(isLoading) {
  $('#analyze-button').disabled = isLoading;
  $('#analyze-button').innerHTML = isLoading ? `<span class="spinner"></span><span>Analyzing evidence…</span>` : `<span class="analyze-glyph">✳</span><span id="analyze-label">Analyze evidence</span><i>↗</i>`;
  if (isLoading) {
    $('#empty-state').hidden = true; $('#analysis-results').hidden = true; $('#loading-state').hidden = false;
    $('#result-badge').className = 'analysis-badge'; $('#result-badge').innerHTML = '<span class="analysis-badge-dot"></span> ANALYZING';
    const captions = ['Reading document structure.', 'Connecting details across evidence.', 'Preparing a reviewable analysis.'];
    let i = 0; $('#loading-copy').textContent = captions[0];
    state.loadingTimer = setInterval(() => { i = (i + 1) % captions.length; $('#loading-copy').textContent = captions[i]; }, 2200);
  } else {
    clearInterval(state.loadingTimer);
  }
}

function getRiskClass(level = '') { return String(level).toLowerCase().replace(/[^a-z-]/g, '-'); }
function normalizeAnalysis(data) {
  const result = { ...data };
  result.caseTitle ||= 'Incident overview'; result.incidentType ||= 'Not classified'; result.riskLevel ||= 'Review'; result.confidence ||= 'Medium'; result.summary ||= 'No summary was returned. Review the evidence manually.';
  for (const key of ['timeline','entities','findings','missingInformation','recommendedNextSteps','evidenceLimitations']) if (!Array.isArray(result[key])) result[key] = [];
  return result;
}
function renderResults(analysis, source = 'live') {
  state.analysis = normalizeAnalysis(analysis); state.mode = source; state.activeTab = 'timeline';
  $('#empty-state').hidden = true; $('#loading-state').hidden = true; $('#analysis-results').hidden = false;
  $('#result-badge').className = 'analysis-badge ready';
  $('#result-badge').innerHTML = `<span class="analysis-badge-dot"></span> ${source === 'sample' ? 'SAMPLE CASE' : 'ANALYSIS COMPLETE'}`;
  $('#results-subtitle').textContent = source === 'sample' ? 'Fictional example · not generated by AI' : 'Structured findings ready for human review';
  $('#result-disclaimer-copy').textContent = source === 'sample'
    ? 'Fictional example only; not generated by AI. Verify all real details against original evidence. It does not establish authenticity, guilt or legal conclusions.'
    : 'AI-assisted organization only. Verify every detail against original evidence. This analysis does not establish authenticity, guilt or legal conclusions.';
  $('#result-title').textContent = state.analysis.caseTitle;
  $('#result-summary').textContent = state.analysis.summary;
  $('#risk-score').textContent = state.analysis.riskLevel;
  $('#risk-orb').className = `risk-orb risk-${getRiskClass(state.analysis.riskLevel)}`;
  $('#result-type').textContent = `Incident · ${state.analysis.incidentType}`;
  $('#result-confidence').textContent = `Extraction confidence · ${state.analysis.confidence}`;
  $('#result-model').textContent = source === 'sample' ? 'SAMPLE CASE · ILLUSTRATIVE' : `MODEL · ${state.api.model.toUpperCase()}`;
  $('#timeline-count').textContent = state.analysis.timeline.length;
  $('#finding-count').textContent = state.analysis.findings.length;
  $('#entity-count').textContent = state.analysis.entities.length;
  $$('.result-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === state.activeTab));
  renderResultTab();
  $('#results-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderResultTab() {
  const panel = $('#result-tab-panel');
  const a = state.analysis;
  if (!a) return;
  if (state.activeTab === 'timeline') {
    panel.innerHTML = a.timeline.length ? `<div class="timeline-list">${a.timeline.map(item => `<div class="timeline-item"><div class="timeline-time">${escapeHtml(item.dateTime || 'Date not established')} <span style="color:#4c676a">· ${escapeHtml(item.confidence || 'Review')}</span></div><div class="timeline-event">${escapeHtml(item.event || 'No event description returned.')}</div><span class="timeline-source">SOURCE / ${escapeHtml(item.source || 'Not specified')}</span></div>`).join('')}</div>` : '<div class="empty-tab">No confirmed timeline events were extracted. Add evidence or review dates manually.</div>';
  } else if (state.activeTab === 'findings') {
    const findings = [...a.findings.map(f => ({title:f.title, detail:f.detail, severity:f.severity})), ...a.evidenceLimitations.map(t => ({title:'Evidence limitation',detail:t,severity:'Caution'})), ...a.missingInformation.map(t => ({title:'Information to verify',detail:t,severity:'Important'}))];
    panel.innerHTML = findings.length ? `<div class="finding-list">${findings.map(f => `<article class="finding-card"><div class="finding-top"><b>${escapeHtml(f.title || 'Observation')}</b><span class="severity-tag ${String(f.severity).toLowerCase()} ">${escapeHtml(f.severity || 'Info')}</span></div><p>${escapeHtml(f.detail || '')}</p></article>`).join('')}</div>` : '<div class="empty-tab">No additional findings returned.</div>';
  } else if (state.activeTab === 'entities') {
    panel.innerHTML = a.entities.length ? `<div class="entity-list">${a.entities.map(e => `<article class="entity-card"><span class="entity-type">${escapeHtml(e.type || 'ENTITY')}</span><div><b class="entity-value">${escapeHtml(e.value || 'Not provided')}</b><p>${escapeHtml(e.note || '')}<br/><span style="color:#58717a">SOURCE / ${escapeHtml(e.source || 'Not specified')}</span></p></div></article>`).join('')}</div>` : '<div class="empty-tab">No entities were extracted. Review the original evidence.</div>';
  } else {
    const items = a.recommendedNextSteps;
    panel.innerHTML = items.length ? `<div class="next-list">${items.map((item, index) => `<div class="next-item"><span class="next-check">${String(index+1).padStart(2,'0')}</span><span>${escapeHtml(item)}</span></div>`).join('')}</div>` : '<div class="empty-tab">No next steps were returned.</div>';
  }
}

async function analyzeEvidence() {
  clearError();
  const description = $('#incident-description').value.trim();
  const incidentType = $('#incident-type').value;
  if (!state.files.length && !description) { showError('Upload at least one evidence file or add a description before analyzing.'); toast('Add evidence or an incident description first.', 'error'); return; }
  if (!state.api.connected) { showError('Gemini is not connected. Add your key to .env and restart the server, or explore the sample case to see how the workspace is organized.'); return; }
  setLoading(true);
  try {
    const form = new FormData();
    form.append('description', description); form.append('incidentType', incidentType);
    state.files.forEach(item => form.append('evidence', item.file, item.file.name));
    const response = await fetch('/api/analyze', { method: 'POST', body: form });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Analysis request failed.');
    state.evidence = data.evidence || [];
    renderResults(data.analysis, 'live');
    toast(`Analysis complete with ${data.model}. Verify findings against the originals.`, 'success');
  } catch (err) {
    $('#loading-state').hidden = true; $('#empty-state').hidden = false;
    showError(err.message || 'Something went wrong. Please try again.');
    toast(err.message || 'Analysis failed.', 'error');
  } finally { setLoading(false); }
}

function loadSampleCase() {
  clearError();
  state.evidence = [
    { name: 'sample-recruitment-message.txt', kind: 'Text / email', bytes: 1842, sha256: 'SAMPLE-HASH-EXAMPLE-01' },
    { name: 'sample-chat-export.txt', kind: 'Text / email', bytes: 2640, sha256: 'SAMPLE-HASH-EXAMPLE-02' },
    { name: 'sample-payment-receipt.png', kind: 'Image', bytes: 191240, sha256: 'SAMPLE-HASH-EXAMPLE-03' }
  ];
  $('#incident-type').value = 'Fake job or recruitment offer';
  $('#incident-description').value = 'Sample training scenario: a contact offered a job, requested a registration payment, and then stopped replying. Use this fictional case to see how the analysis workflow organizes potential evidence.';
  renderResults(structuredClone(sampleAnalysis), 'sample');
  toast('Fictional sample case loaded. These findings are not generated by AI.', 'success');
}

function createLocalReport(analysis, evidence, isSample = false) {
  const a = analysis;
  const lines = [
    'CYBERCASE — DIGITAL INCIDENT EVIDENCE REPORT',
    `Generated: ${new Date().toLocaleString()}`,
    `Case: ${a.caseTitle}`,
    `Incident category: ${a.incidentType}`,
    `Review level: ${a.riskLevel}`,
    '', 'CASE SUMMARY', a.summary, '', 'INCIDENT TIMELINE',
    ...(a.timeline.length ? a.timeline.map(e => `• ${e.dateTime || 'Date not established'} — ${e.event} [Source: ${e.source || 'Not specified'}; confidence: ${e.confidence || 'Not rated'}]`) : ['No timeline entries were returned.']),
    '', 'KEY OBSERVATIONS',
    ...(a.findings.length ? a.findings.map(e => `• [${e.severity || 'Info'}] ${e.title}: ${e.detail}`) : ['No observations were returned.']),
    '', 'EVIDENCE INDEX',
    ...(evidence.length ? evidence.map(e => `• ${e.name || 'Evidence file'} | ${e.kind || 'File'} | ${formatBytes(e.bytes || 0)} | ${isSample ? `Sample reference · not a computed hash: ${e.sha256 || 'Not available'}` : `SHA-256: ${e.sha256 || 'Not available'}`}`) : ['No evidence file manifest available.']),
    '', 'INFORMATION TO VERIFY',
    ...(a.missingInformation.length ? a.missingInformation.map(e => `• ${e}`) : ['No missing-information items were returned.']),
    '', 'SUGGESTED NEXT STEPS',
    ...(a.recommendedNextSteps.length ? a.recommendedNextSteps.map(e => `• ${e}`) : ['Review original evidence and confirm appropriate next steps.']),
    '', 'LIMITATIONS',
    ...(a.evidenceLimitations.length ? a.evidenceLimitations.map(e => `• ${e}`) : ['This report does not independently verify evidence authenticity.']),
    '', 'IMPORTANT NOTICE',
    isSample
      ? 'This illustrative report uses fictional example content and was not generated by AI. It is not legal advice, does not authenticate evidence and does not determine guilt.'
      : 'This AI-assisted document is for organizing and reviewing information. It is not legal advice, does not authenticate evidence and does not determine guilt. Verify all details against original sources before sharing or filing.'
  ];
  return lines.join('\n');
}

async function generateReport() {
  if (!state.analysis) { toast('Analyze or load a case before generating a report.', 'error'); return; }
  const button = $('#make-report'); const original = button.innerHTML;
  button.disabled = true; button.innerHTML = '<span class="spinner"></span> Preparing report…';
  try {
    if (state.mode === 'live' && state.api.connected) {
      const response = await fetch('/api/report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis: state.analysis, description: $('#incident-description').value.trim(), evidence: state.evidence })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Report generation failed.');
      state.report = data.report;
    } else {
      state.report = createLocalReport(state.analysis, state.evidence, state.mode === 'sample');
      toast('Prepared a sample report. Connect Gemini for AI-generated report text.', 'success');
    }
    showReport(state.report);
  } catch (err) {
    toast(err.message || 'Could not generate report.', 'error');
  } finally { button.disabled = false; button.innerHTML = original; }
}

function showReport(report) {
  $('#report-content').textContent = report;
  $('#report-backdrop').hidden = false;
  $('#report-close').focus();
}
function closeReport() { $('#report-backdrop').hidden = true; }
function downloadReport() {
  if (!state.report) return;
  const blob = new Blob([state.report], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = `cybercase-report-${new Date().toISOString().slice(0,10)}.md`;
  document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  toast('Report downloaded.', 'success');
}
function printReport() {
  if (!state.report) return;
  const win = window.open('', '_blank', 'width=900,height=750');
  if (!win) { toast('Pop-up blocked. Use Download report instead.', 'error'); return; }
  win.document.write(`<!doctype html><html><head><title>CyberCase report</title><meta charset="utf-8"><style>body{font:14px/1.65 Arial,sans-serif;color:#17252a;max-width:850px;margin:40px auto;padding:0 25px}h1{font-size:22px}pre{white-space:pre-wrap;font:13px/1.8 Arial,sans-serif}header{border-bottom:2px solid #b7edd3;padding-bottom:14px;margin-bottom:25px}header strong{letter-spacing:3px;color:#17624b}small{color:#5d7274}@media print{body{margin:0;max-width:none}}</style></head><body><header><strong>CYBERCASE</strong><h1>Digital Incident Evidence Report</h1><small>Generated for human review · Verify against original evidence</small></header><pre>${escapeHtml(state.report)}</pre></body></html>`);
  win.document.close();
  setTimeout(() => { try { win.focus(); win.print(); } catch { /* Popup may have been closed by the user. */ } }, 500);
}

function getVault() {
  try { const parsed = JSON.parse(localStorage.getItem('cybercase.vault') || '[]'); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}
function setVault(vault) {
  try { localStorage.setItem('cybercase.vault', JSON.stringify(vault)); return true; }
  catch { toast('Browser storage is full or unavailable. Try removing old cases.', 'error'); return false; }
}
function saveCase() {
  if (!state.analysis) { toast('Analyze or load a case first.', 'error'); return; }
  const vault = getVault();
  const item = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    createdAt: new Date().toISOString(),
    title: state.analysis.caseTitle,
    summary: state.analysis.summary,
    incidentType: state.analysis.incidentType,
    riskLevel: state.analysis.riskLevel,
    mode: state.mode,
    analysis: state.analysis,
    evidence: state.evidence,
    report: state.report || ''
  };
  const next = [item, ...vault.filter(old => old.title !== item.title || old.createdAt !== item.createdAt)].slice(0, 20);
  if (setVault(next)) { renderVault(); toast('Case saved to this browser only. Raw evidence files were not saved.', 'success'); }
}
function renderVault(filter = '') {
  const vault = getVault(); const q = filter.trim().toLowerCase();
  const items = vault.filter(item => `${item.title} ${item.summary} ${item.incidentType}`.toLowerCase().includes(q));
  $('#vault-count').textContent = vault.length;
  $('#vault-summary').textContent = `${vault.length} SAVED CASE${vault.length === 1 ? '' : 'S'}`;
  const list = $('#vault-list');
  if (!items.length) {
    list.innerHTML = `<div class="vault-empty"><div class="empty-circle empty-circle-inner" style="position:relative;margin-bottom:18px;width:68px;height:68px"><span>✳</span></div><b>${q ? 'No matching cases' : 'Your vault is quiet.'}</b><p>${q ? 'Try another search term.' : 'Save an analysis to keep a metadata-only case record in this browser. Uploaded files are not saved.'}</p>${q ? '' : '<button class="secondary-button" id="vault-new-case">Open evidence workspace ↗</button>'}</div>`;
    $('#vault-new-case')?.addEventListener('click', () => switchView('workspace'));
    return;
  }
  list.innerHTML = items.map(item => `<article class="vault-card"><div class="vault-card-top"><span class="vault-card-icon">▤</span><span class="vault-card-date">${escapeHtml(new Date(item.createdAt).toLocaleString())}</span></div><h3>${escapeHtml(item.title || 'Untitled case')}</h3><p>${escapeHtml((item.summary || '').slice(0,170))}${(item.summary || '').length > 170 ? '…' : ''}</p><div class="result-meta"><span>${escapeHtml(item.incidentType || 'Not classified')}</span><span>Risk · ${escapeHtml(item.riskLevel || 'Review')}</span><span>${item.mode === 'sample' ? 'Sample case' : 'Gemini analysis'}</span></div><div class="vault-card-actions"><button data-open-case="${escapeHtml(item.id)}">Open analysis ↗</button>${item.report ? `<button data-open-report="${escapeHtml(item.id)}">View report</button>` : ''}<button data-delete-case="${escapeHtml(item.id)}" style="margin-left:auto">Delete</button></div></article>`).join('');
  $$('[data-open-case]', list).forEach(button => button.addEventListener('click', () => {
    const item = getVault().find(c => c.id === button.dataset.openCase); if (!item) return;
    state.evidence = item.evidence || []; $('#incident-type').value = [...$('#incident-type').options].some(opt => opt.value === item.incidentType) ? item.incidentType : 'Not specified';
    $('#incident-description').value = ''; state.report = item.report || '';
    renderResults(item.analysis, item.mode || 'live'); switchView('workspace'); toast('Opened saved case metadata. Re-upload files if you need to reanalyze them.', 'success');
  }));
  $$('[data-open-report]', list).forEach(button => button.addEventListener('click', () => {
    const item = getVault().find(c => c.id === button.dataset.openReport); if (item) { state.report = item.report; showReport(item.report); }
  }));
  $$('[data-delete-case]', list).forEach(button => button.addEventListener('click', () => {
    if (!confirm('Delete this saved case from this browser? Original evidence files were not saved.')) return;
    setVault(getVault().filter(c => c.id !== button.dataset.deleteCase)); renderVault($('#vault-search').value); toast('Saved case deleted.', 'success');
  }));
}

function switchView(view) {
  state.currentView = view;
  for (const name of ['workspace','vault','how']) $(`#${name}-view`).hidden = name !== view;
  $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === view));
  $('#crumb-current').textContent = view.toUpperCase();
  if (view === 'vault') renderVault($('#vault-search').value);
  $('#sidebar').classList.remove('mobile-open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function bindEvents() {
  $('#dropzone').addEventListener('click', (event) => { if (event.target.id !== 'evidence-input') $('#evidence-input').click(); });
  $('#dropzone').addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); $('#evidence-input').click(); } });
  $('#evidence-input').addEventListener('change', event => { addFiles(event.target.files); event.target.value = ''; });
  for (const name of ['dragenter','dragover']) $('#dropzone').addEventListener(name, event => { event.preventDefault(); $('#dropzone').classList.add('dragover'); });
  for (const name of ['dragleave','drop']) $('#dropzone').addEventListener(name, event => { event.preventDefault(); $('#dropzone').classList.remove('dragover'); });
  $('#dropzone').addEventListener('drop', event => addFiles(event.dataTransfer.files));
  $('#analyze-button').addEventListener('click', analyzeEvidence);
  $('#focus-upload').addEventListener('click', () => { $('#evidence-studio').scrollIntoView({ behavior: 'smooth', block: 'start' }); setTimeout(() => $('#dropzone').focus({preventScroll:true}), 450); });
  $('#load-sample').addEventListener('click', () => { loadSampleCase(); $('#evidence-studio').scrollIntoView({ behavior:'smooth', block:'start' }); });
  $('#empty-sample').addEventListener('click', loadSampleCase);
  $('#save-case').addEventListener('click', saveCase);
  $('#make-report').addEventListener('click', generateReport);
  $$('.result-tab').forEach(tab => tab.addEventListener('click', () => { state.activeTab = tab.dataset.tab; $$('.result-tab').forEach(t => t.classList.toggle('active', t === tab)); renderResultTab(); }));
  $$('.nav-item').forEach(item => item.addEventListener('click', () => switchView(item.dataset.view)));
  $$('[data-scroll]').forEach(item => item.addEventListener('click', () => { switchView('workspace'); setTimeout(() => $(`#${item.dataset.scroll}`).scrollIntoView({ behavior: 'smooth', block:'center' }), 80); }));
  $('#vault-search').addEventListener('input', event => renderVault(event.target.value));
  $('#help-button').addEventListener('click', () => { $('#modal-backdrop').hidden = false; $('#modal-done').focus(); });
  $('#modal-close').addEventListener('click', () => $('#modal-backdrop').hidden = true);
  $('#modal-done').addEventListener('click', () => $('#modal-backdrop').hidden = true);
  $('#modal-backdrop').addEventListener('click', event => { if (event.target.id === 'modal-backdrop') $('#modal-backdrop').hidden = true; });
  $('#report-close').addEventListener('click', closeReport);
  $('#report-backdrop').addEventListener('click', event => { if (event.target.id === 'report-backdrop') closeReport(); });
  $('#report-download').addEventListener('click', downloadReport);
  $('#report-print').addEventListener('click', printReport);
  $('#mobile-menu-toggle').addEventListener('click', () => $('#sidebar').classList.toggle('mobile-open'));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { $('#modal-backdrop').hidden = true; closeReport(); $('#sidebar').classList.remove('mobile-open'); } });
}

async function runHealthCheck() {
  if (!state.api.connected) { toast('Gemini is not configured yet. Add your key to .env first.', 'error'); return; }
  toast('Checking Gemini connection…', 'success', '⌁');
  try {
    const response = await fetch('/api/health-check', { method:'POST' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Connection check failed.');
    toast(`Gemini connection OK · ${data.reply}`, 'success');
  } catch (err) { toast(err.message, 'error'); }
}

window.addEventListener('DOMContentLoaded', () => {
  bootSplash(); initCanvas(); bindEvents(); getStatus(); renderVault();
  // Double-clicking the model status runs an explicit connection check without adding another prominent control.
  $('#api-pill').title = 'Double-click to test the Gemini connection';
  $('#api-pill').style.cursor = 'pointer';
  $('#api-pill').addEventListener('dblclick', runHealthCheck);
});
