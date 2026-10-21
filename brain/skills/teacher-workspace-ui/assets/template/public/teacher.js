/* eslint-env browser */
/* eslint func-style: ["error", "declaration", {"allowArrowFunctions": true}] */
/* eslint no-use-before-define: ["error", {"functions": false}] */
const $ = id => document.getElementById(id);
let records = []; let limit = 100; let connection = {initialized: true}; let unlocked = false;
let view = 'records'; let refreshRunning = null; let authEpoch = 0; let analysisController = null;
let conversation = []; let pinnedIds = null; let pinnedMode = null;
const text = (tag, value, className = '') => {
    const node = document.createElement(tag); node.textContent = value;
    if (className) node.className = className;
    return node;
};
const time = value => new Date(value).toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'});
const dateKey = value => new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date(value));
const validGrade = r => r.type === 'grade' && r.status === 'completed' && !r.demoLoaded && !r.programChanged;
const filtered = () => records.filter(r => (!$('student').value || r.studentId === $('student').value) &&
    (!$('task').value || r.task.code === $('task').value) &&
    (!$('record-type').value || r.type === $('record-type').value) &&
    (!$('date-from').value || dateKey(r.timestamp) >= $('date-from').value) &&
    (!$('date-to').value || dateKey(r.timestamp) <= $('date-to').value))
    // The record store preserves save order; stable sort keeps newer saves first when timestamps tie.
    .reverse()
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
/** Refresh select options while preserving a still-valid selection.
 * @param {string} id Select element ID.
 * @param {Array<Array<string>>} entries Value and label pairs.
 * @param {string} allLabel Label for the unfiltered option.
 */
function options (id, entries, allLabel) {
    const select = $(id); const current = select.value; select.replaceChildren(new Option(allLabel, ''));
    for (const [value, label] of entries) select.append(new Option(label, value));
    if (entries.some(([value]) => value === current)) select.value = current;
}
/** Return the mobile workspace to its main pane. */
function closeMobileSidebar () {
    document.querySelector('.workspace').classList.remove('mobile-sidebar');
    if (matchMedia('(max-width:700px)').matches) $('toggle-sidebar').setAttribute('aria-expanded', 'false');
}
/** Show one pane subject to the current teacher authentication state.
 * @param {string} next Pane name.
 */
function showView (next) {
    view = next; closeMobileSidebar();
    const titles = {records: '作答紀錄', analysis: 'AI 分析', settings: '連線設定'};
    $('view-title').textContent = titles[next];
    for (const name of Object.keys(titles)) {
        $(`${name}-view`).hidden =
        name !== next || (!unlocked && !(name === 'settings' && connection.managed && !connection.initialized));
    }
    document.querySelectorAll('.nav-button').forEach(button => {
        button.classList.toggle('active', button.dataset.view === next);
        button.setAttribute('aria-pressed', String(button.dataset.view === next));
    });
    $('selection-bar').hidden = !unlocked || next !== 'records'; updateAnalysisScope();
}
/** Cancel the current request and forget its page-local conversation. */
function resetAnalysis () {
    analysisController?.abort(); analysisController = null;
    conversation = []; pinnedIds = null; pinnedMode = null;
    $('analysis-question').value = '';
    $('chat').replaceChildren();
    const welcome = text('div', '', 'welcome');
    welcome.append(text('div', '✧', 'welcome-icon'), text('h2', '從學生的作答開始理解'),
        text('p', 'AI 協助整理紀錄與提出教學建議。你仍是最後做判斷的老師。'));
    $('chat').append(welcome); $('analysis-status').textContent = ''; $('cancel-analysis').hidden = true;
    updateAnalysisScope();
}
/** Invalidate outstanding refreshes before clearing private teacher data.
 * @param {boolean} resetSettings Whether to discard settings drafts.
 */
function hideTeacherData (resetSettings = true) {
    authEpoch++; unlocked = false; records = [];
    options('student', [], '全部學生'); options('task', [], '全部題目');
    resetAnalysis(); $('analysis-question').value = '';
    if (resetSettings) $('settings-form').reset();
    $('logout').hidden = true; $('setup-panel').hidden = true; render(); showView(view);
}
/** Render searchable student codes from the authenticated record list. */
function renderStudents () {
    const counts = new Map();
    for (const r of records) counts.set(r.studentId, (counts.get(r.studentId) || 0) + 1);
    const search = $('student-search').value.trim().toLocaleLowerCase();
    $('student-count').textContent = `${counts.size} 位`; $('student-list').replaceChildren();
    for (const [id, count] of [...counts].sort(([a], [b]) => a.localeCompare(b, 'zh-TW'))) {
        if (!id.toLocaleLowerCase().includes(search)) continue;
        const button = text('button', '', 'student-row');
        button.append(text('span', id), text('small', `${count} 筆`));
        button.classList.toggle('selected', $('student').value === id);
        button.setAttribute('aria-pressed', String($('student').value === id));
        button.onclick = () => {
            $('student').value = id; scopeChanged(); closeMobileSidebar();
        };
        $('student-list').append(button);
    }
    if (!$('student-list').children.length) {
        $('student-list').append(text('p',
            records.length ? '找不到這個代號。' : '登入並有紀錄後，學生會出現在這裡。'));
    }
}
/** Describe the actual record batch and whether submission is available. */
function updateAnalysisScope () {
    const shown = filtered(); const ids = pinnedIds || shown.slice(0, 200).map(r => r.id);
    const selected = records.filter(r => ids.includes(r.id)).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    $('analysis-scope').textContent = selected.length ?
        `${pinnedIds ? '本次對話固定' : '將使用'} ${selected.length} 筆｜` +
        `${new Set(selected.map(r => r.studentId)).size} 位學生｜` +
        `${time(selected[0].timestamp)} ～ ${time(selected.at(-1).timestamp)}。${
            !pinnedIds && shown.length > 200 ? `目前有 ${shown.length} 筆，只取最新200筆；可用日期縮小範圍。` : ''
        }${pinnedIds ? '更新紀錄不改本次範圍；按「新分析」使用最新資料。' : ''}` :
        '目前沒有可分析的紀錄。請先選學生、調整篩選，或讓學生提交作答。';
    $('send-analysis').disabled = !unlocked || !selected.length || Boolean(analysisController) ||
        ($('analysis-mode').value === 'live' && !connection.aiConfigured);
    if ($('analysis-mode').value === 'live' && !connection.aiConfigured) {
        $('analysis-status').textContent = '尚未設定 AI 金鑰。請到「連線設定」保存，或選本機摘要。';
    }
}
/** Render the filtered score summary and original chronological evidence. */
function render () {
    renderStudents();
    const expanded = new Set([...$('records').querySelectorAll('details[open]')].map(n => n.dataset.recordId));
    const shown = filtered();
    $('selected-title').textContent = $('student').value || '全部學生'; $('record-count').textContent = `${shown.length} 筆`;
    $('metrics').replaceChildren();
    for (const [value, label] of [[new Set(shown.map(r => r.studentId)).size, '目前範圍學生'],
        [shown.filter(validGrade).length, '有效評分'], [shown.filter(r => r.type === 'ai').length, '導師求助（含模擬）']]) {
        const metric = text('div', '', 'metric');
        metric.append(text('strong', String(value)), text('span', label)); $('metrics').append(metric);
    }
    const pairs = new Map();
    for (const record of [...shown].reverse()) {
        const key = JSON.stringify([record.studentId, record.task.code]);
        const pair = pairs.get(key) || {record, latestGrade: null, ai: 0, grades: 0};
        pair.record = record;
        if (record.type === 'ai') pair.ai++;
        else {
            pair.grades++; if (validGrade(record)) pair.latestGrade = record;
        }
        pairs.set(key, pair);
    }
    $('summary').replaceChildren();
    for (const {record, latestGrade, ai, grades} of pairs.values()) {
        const card = text('article', '', 'card');
        card.append(text('strong', `${record.studentId} · ${record.task.title || record.task.code}`),
            text('div', latestGrade ? `${latestGrade.totalScore} / ${latestGrade.maxScore}` : '尚無有效成績', 'score'),
            text('p', `求助 ${ai} 次 · 評分 ${grades} 次`), text('p', `最近活動 ${time(record.timestamp)}`));
        const button = text('button', '查看這位學生的本題紀錄');
        button.onclick = () => {
            $('student').value = record.studentId; $('task').value = record.task.code; scopeChanged();
        };
        card.append(button); $('summary').append(card);
    }
    if (!pairs.size) $('summary').append(text('div', '目前沒有符合篩選的紀錄。請調整日期／題目，或先在學生頁填代號並求助或評分。', 'empty'));
    $('records').replaceChildren();
    for (const record of shown.slice(0, limit)) {
        const details = document.createElement('details'); details.className = 'record';
        details.dataset.recordId = record.id; details.open = expanded.has(record.id);
        const result = record.type === 'ai' ? `導師求助 · ${record.source === 'mock' ? '模擬' : '真模型'}` :
            `評分 ${record.totalScore ?? '無分數'} / ${record.maxScore ?? '—'}`;
        const summary = text('summary', `${time(record.timestamp)} · ${record.studentId} · ` +
            `${record.task.title || record.task.code} · ${result}`);
        for (const label of [record.status === 'failed' ? '失敗' : '', record.demoLoaded ? '範例程式' : '',
            record.programChanged ? '評分時程式變更或無法核對' : ''].filter(Boolean)) summary.append(text('span', label, 'badge'));
        details.append(summary);
        const content = document.createElement('article');
        if (record.type === 'ai') {
            content.append(text('p', `學生提問：${record.question}`),
                text('p', `AI 引導：${record.guidance || '沒有可用回覆'}`), text('p', `AI 追問：${record.followup || '—'}`));
        }
        if (record.errorCode) content.append(text('p', `錯誤代碼：${record.errorCode}`));
        content.append(text('h3', '當時程式（積木結構）'), text('p', '不包含造型、音效與執行後變數值。'),
            text('pre', JSON.stringify(record.program, null, 2)));
        details.append(content); $('records').append(details);
    }
    $('more').hidden = shown.length <= limit; updateAnalysisScope();
}
/** Start a fresh analysis after an explicit filter change. */
function scopeChanged () {
    limit = 100; resetAnalysis(); render();
}
/** Report local and sheet synchronization status without credentials.
 * @param {object} sync Server synchronization status.
 */
function showStatus (sync) {
    if (connection.demo) {
        $('status').textContent = `${sync.total} 筆假資料 · 示範模式不提供試算表同步`;
        return;
    }
    $('status').textContent = `${sync.total} 筆本機紀錄 · ${sync.configured ? `待同步 ${sync.pending} 筆` : '尚未設定試算表，紀錄存本機'
    }${sync.lastSyncError ? ' · 上次同步失敗，本機仍保留' : ''}${sync.more ? ' · 雲端還有紀錄，請再同步' : ''}`;
}
/** Load current records while rejecting responses from an invalidated session.
 * @param {boolean} sync Whether to request sheet synchronization first.
 */
async function refreshOnce (sync) {
    const epoch = authEpoch;
    $('refresh').disabled = $('sync').disabled = true; $('error').hidden = true;
    try {
        const stateResponse = await fetch('/api/tutor/status');
        if (!stateResponse.ok) throw new Error('無法確認教師設定，請確認本機服務。');
        const state = await stateResponse.json();
        if (epoch !== authEpoch) return;
        connection = state;
        $('connection-status').textContent = connection.managed ?
            `教師：${connection.initialized ? '已設定' : '待設定'} · ` +
            `AI：${connection.aiConfigured ? '已設定' : '未設定'} · ` +
            `試算表：${connection.sheetConfigured ? '已設定' : '未設定'}` : '舊版本機服務';
        if (connection.managed && !connection.initialized) {
            hideTeacherData(false); $('setup-panel').hidden = false; $('login').hidden = true;
            $('status').textContent = '第一次使用：請先設定教師密碼，再交給學生。'; showView('settings'); return;
        }
        let syncResult;
        if (sync) {
            const response = await fetch('/api/records/sync', {
                method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'
            });
            if (epoch !== authEpoch) return;
            if (response.status === 401) {
                hideTeacherData(); $('login').hidden = false; $('status').textContent = '請先登入再同步。'; return;
            }
            if (!response.ok) throw new Error('同步未完成；本機紀錄仍保留。請確認登入與試算表設定。');
            syncResult = (await response.json()).sync;
        }
        const response = await fetch('/api/records');
        if (epoch !== authEpoch) return;
        if (response.status === 401) {
            hideTeacherData(); $('login').hidden = false; $('status').textContent = '請先登入教師工作台。'; return;
        }
        if (!response.ok) throw new Error('無法讀取紀錄；請確認本機導師服務仍在執行。');
        const result = await response.json();
        if (epoch !== authEpoch) return;
        const previous = `${$('student').value}|${$('task').value}`;
        records = result.records; unlocked = true;
        $('login').hidden = true;
        $('setup-panel').hidden = !connection.managed; $('logout').hidden = !connection.managed;
        options('student', [...new Set(records.map(r => r.studentId))].sort().map(v => [v, v]), '全部學生');
        options('task', [...new Map(records.map(r => [r.task.code, r.task.title || r.task.code]))], '全部題目');
        if (previous !== `${$('student').value}|${$('task').value}`) resetAnalysis();
        showStatus(syncResult || result.sync); render(); showView(view);
    } catch (error) {
        if (epoch === authEpoch) {
            $('error').textContent = error.message; $('error').hidden = false;
            $('status').textContent = '更新未完成；畫面可能是上次讀取的紀錄。';
        }
    } finally {
        $('refresh').disabled = false; $('sync').disabled = Boolean(connection.demo);
    }
}
/** Coalesce refreshes; disabled controls prevent duplicate sync submissions.
 * @param {boolean} sync Whether this is a synchronization request.
 * @returns {Promise<void>} Completion of the current refresh.
 */
function refresh (sync = false) {
    if (refreshRunning) return refreshRunning;
    const current = refreshOnce(sync);
    refreshRunning = current;
    return current.finally(() => {
        if (refreshRunning === current) refreshRunning = null;
    });
}
/** Open the original record cited by the response without discarding that response.
 * @param {string} id Original record ID.
 */
function showCitation (id) {
    const record = records.find(r => r.id === id);
    if (!record) {
        $('analysis-status').textContent = '此紀錄已不在本機清單，請更新資料。'; return;
    }
    $('student').value = record.studentId; $('task').value = record.task.code;
    $('record-type').value = ''; $('date-from').value = $('date-to').value = '';
    limit = records.length; render(); showView('records');
    const node = [...$('records').children].find(n => n.dataset.recordId === id);
    if (node) {
        node.open = true; node.classList.add('highlighted'); node.scrollIntoView({block: 'center'});
        node.querySelector('summary').focus();
    }
}
/** Render all model text as text nodes, with buttons for validated record IDs.
 * @param {string} question Submitted teacher question.
 * @param {object} reply Validated response from the local backend.
 */
function appendAnalysis (question, reply) {
    $('chat').querySelector('.welcome')
        ?.remove();
    const questionNode = text('div', question, 'message user');
    $('chat').append(questionNode);
    const article = text('article', '', 'message assistant');
    const sourceLabel = `${reply.source === 'mock' ? '本機摘要 · 未呼叫 AI' : `AI 分析 · ${reply.model}`}`;
    article.append(text('div', `${sourceLabel} · ${reply.selection.count} 筆 · ` +
        `${time(reply.selection.from)} ～ ${time(reply.selection.to)}`, 'source-label'));
    for (const [key, title] of [['observations', '直接觀察'], ['interpretations', '待確認的推測'], ['suggestions', '教學建議']]) {
        article.append(text('h3', title));
        if (!reply.result[key].length) {
            article.append(text('p', '目前沒有足夠依據。')); continue;
        }
        const list = document.createElement('ul');
        for (const item of reply.result[key]) {
            const li = text('li', item.text);
            for (const id of item.recordIds) {
                const record = records.find(r => r.id === id);
                const citationLabel = record ? `查看依據：${record.studentId} · ${time(record.timestamp)}` : '查看紀錄依據';
                const button = text('button', citationLabel, 'citation');
                button.onclick = () => showCitation(id); li.append(button);
            }
            list.append(li);
        }
        article.append(list);
    }
    article.append(text('h3', '資料限制'));
    for (const value of reply.result.limitations) article.append(text('p', value));
    if (reply.selection.partial) article.append(text('p', '部分程式或對話只送出摘要；不能當成完整程式分析。'));
    $('chat').append(article);
    $('chat').scrollTop += questionNode.getBoundingClientRect().top - $('chat').getBoundingClientRect().top;
}
$('analysis-form').onsubmit = async event => {
    event.preventDefault();
    if (analysisController || !unlocked) return;
    const question = $('analysis-question').value.trim(); const mode = $('analysis-mode').value;
    const ids = pinnedIds || filtered().slice(0, 200)
        .map(r => r.id);
    if (!question || !ids.length || (mode === 'live' && !connection.aiConfigured)) return;
    const controller = new AbortController(); analysisController = controller;
    const timer = setTimeout(() => controller.abort(), 95000);
    $('cancel-analysis').hidden = false;
    $('analysis-status').textContent = mode === 'live' ? '正在分析選取的紀錄…' : '正在整理本機紀錄…';
    updateAnalysisScope();
    try {
        const response = await fetch('/api/teacher/analyze', {method: 'POST',
            signal: controller.signal,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({mode, question, recordIds: ids, history: conversation.slice(-6)})});
        const reply = await response.json();
        if (analysisController !== controller) return;
        if (response.status === 401) {
            hideTeacherData(); $('login').hidden = false; $('status').textContent = '登入已失效，請重新登入。'; return;
        }
        if (!response.ok) throw new Error(reply.error || '分析未完成，請稍後自行重試。');
        // A reset replaces the controller; the identity check above rejects stale responses.
        // eslint-disable-next-line require-atomic-updates
        pinnedIds = reply.selection.recordIds;
        pinnedMode = mode; appendAnalysis(question, reply);
        conversation.push({role: 'user', text: question},
            {role: 'assistant', text: JSON.stringify(reply.result).slice(0, 6000)});
        conversation = conversation.slice(-6);
        if ($('analysis-question').value.trim() === question) $('analysis-question').value = '';
        $('analysis-status').textContent = reply.source === 'mock' ?
            '本機摘要完成。要理解卡關原因，請改選 AI 分析。' : '分析完成。請核對紀錄依據，再採用建議。';
    } catch (error) {
        if (analysisController === controller) {
            $('analysis-status').textContent = error.name === 'AbortError' ?
                '已停止等待或逾時。模型可能已開始處理，不會自動重送；提問仍保留。' : error.message;
        }
    } finally {
        clearTimeout(timer);
        if (analysisController === controller) {
            analysisController = null; $('cancel-analysis').hidden = true; updateAnalysisScope();
        }
    }
};
$('cancel-analysis').onclick = () => analysisController?.abort();
$('analysis-mode').onchange = () => {
    resetAnalysis();
    updateAnalysisScope();
};
$('new-analysis').onclick = () => resetAnalysis();
$('edit-analysis-scope').onclick = () => showView('records');
$('analyze-selection').onclick = () => showView('analysis');
document.querySelectorAll('[data-prompt]').forEach(button => {
    button.onclick = () => {
        $('analysis-question').value = button.dataset.prompt; $('analysis-question').focus();
    };
});
document.querySelectorAll('.nav-button').forEach(button => {
    button.onclick = () => showView(button.dataset.view);
});
$('open-settings').onclick = () => showView('settings'); $('student-search').oninput = renderStudents;
$('all-students').onclick = () => {
    $('student').value = ''; scopeChanged(); closeMobileSidebar();
};
$('clear-filters').onclick = () => {
    for (const id of ['student', 'task', 'record-type', 'date-from', 'date-to']) $(id).value = ''; scopeChanged();
};
$('toggle-sidebar').onclick = () => {
    const workspace = document.querySelector('.workspace'); const mobile = matchMedia('(max-width:700px)').matches;
    workspace.classList.toggle(mobile ? 'mobile-sidebar' : 'sidebar-closed');
    const expanded = mobile ? workspace.classList.contains('mobile-sidebar') :
        !workspace.classList.contains('sidebar-closed');
    $('toggle-sidebar').setAttribute('aria-expanded', String(expanded));
};
$('refresh').onclick = () => refresh(); $('sync').onclick = () => refresh(true);
$('login').onsubmit = async event => {
    event.preventDefault(); const button = $('login').querySelector('button'); button.disabled = true;
    try {
        const response = await fetch('/api/teacher/login', {method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({password: $('teacher-password').value})});
        $('teacher-password').value = '';
        if (!response.ok) throw new Error('教師登入未完成，請確認密碼。');
        if (refreshRunning) await refreshRunning;
        await refresh();
    } catch (error) {
        $('error').textContent = error.message; $('error').hidden = false;
    } finally {
        button.disabled = false;
    }
};
$('settings-form').onsubmit = async event => {
    event.preventDefault(); $('save-settings').disabled = true;
    const body = {password: $('settings-password').value,
        aiKey: $('settings-ai').value,
        sheetUrl: $('settings-url').value,
        sheetToken: $('settings-token').value,
        clearAi: $('clear-ai').checked,
        clearSheet: $('clear-sheet').checked};
    $('settings-form').reset(); resetAnalysis();
    try {
        const response = await fetch('/api/teacher/settings', {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)
        });
        const result = await response.json();
        if (response.status === 401) {
            hideTeacherData(); $('login').hidden = false; $('status').textContent = '登入已失效，請重新登入後設定。'; return;
        }
        if (!response.ok) throw new Error(result.error || '設定未保存，請重新輸入後再試。');
        $('settings-result').textContent = '已保存到這台電腦。密鑰欄位已清空；下次留白保存會保留原值。';
        if (refreshRunning) await refreshRunning;
        await refresh();
    } catch (error) {
        $('settings-result').textContent = error.message;
    } finally {
        $('save-settings').disabled = false;
    }
};
$('logout').onclick = async () => {
    try {
        const response = await fetch('/api/teacher/logout', {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'
        });
        if (!response.ok) throw new Error('登出未完成，請重試。');
        hideTeacherData(); $('settings-result').textContent = ''; $('login').hidden = false;
        $('status').textContent = '已登出，紀錄與分析對話已清除。';
    } catch (error) {
        $('error').textContent = error.message; $('error').hidden = false;
    }
};
for (const id of ['student', 'task', 'record-type', 'date-from', 'date-to']) $(id).onchange = scopeChanged;
$('more').onclick = () => {
    limit += 100; render();
};
if (location.protocol === 'http:' || location.protocol === 'https:') {
    setInterval(() => {
        if ($('auto-refresh').checked && !document.hidden) refresh();
    }, 10000); refresh();
} else {
    $('status').textContent = '直接開檔僅預覽版型，不會呼叫 API。請在範本資料夾執行 node server.mjs --demo，再開 server.mjs 啟動時印出的教師工作台網址（http://127.0.0.1:<埠號>/teacher.html）。';
    unlocked = true; connection = {managed: true, initialized: false};
    showView('records');
    for (const id of ['refresh', 'sync', 'save-settings', 'send-analysis', 'logout']) $(id).disabled = true;
    $('login').onsubmit = $('settings-form').onsubmit = $('analysis-form').onsubmit = event => event.preventDefault();
}
