import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../public/teacher.js', import.meta.url), 'utf8');
test('實際教師頁篩選和成績迴圈採同時刻最後保存的有效成績', () => {
    const earlier = {id: 'earlier-event-01', studentId: 'DEMO_01', task: {code: 'q1', title: '測試題'},
        timestamp: '2026-10-04T00:00:00.000Z', type: 'grade', status: 'completed', totalScore: 20, maxScore: 40,
        programChanged: false, demoLoaded: false};
    const latest = {...earlier, id: 'latest-event-01', totalScore: 40};
    const ignored = [{...earlier, id: 'ignored-demo-01', totalScore: 0, demoLoaded: true},
        {...earlier, id: 'ignored-changed-01', totalScore: 0, programChanged: true},
        {...earlier, id: 'ignored-failed-01', status: 'failed', totalScore: null}];
    // Execute actual UI source snippets. Do not duplicate its sorting or grading implementation.
    const validGrade = source.match(/const validGrade = [\s\S]+?;\r?\n/)[0];
    const filtered = source.match(/const filtered = [\s\S]+?;\r?\n/)[0];
    const scoreLoop = source.match(/const pairs = new Map\(\);[\s\S]+?(?=    \$\('summary'\).replaceChildren\(\);)/)[0];
    const result = vm.runInNewContext('const records=input; const $=()=>({value:""});' + validGrade + filtered +
        'const shown=filtered();' + scoreLoop + '({score:[...pairs.values()][0].latestGrade.totalScore,newest:shown[0].id})',
    {input: [earlier, latest, ...ignored]});
    assert.equal(result.score, 40); assert.equal(result.newest, ignored.at(-1).id);
});
test('實際file分支停止API及提交操作；僅驗證程式分支，不代表瀏覽器開檔實測', () => {
    const elements = new Map(); let calls = 0, view;
    const dollar = id => {
        if (!elements.has(id)) elements.set(id, {disabled: false, textContent: '', checked: true});
        return elements.get(id);
    };
    const branch = source.slice(source.lastIndexOf("if (location.protocol === 'http:'"));
    vm.runInNewContext(branch, {location: {protocol: 'file:'}, $: dollar,
        showView: value => {view = value;}, fetch: () => {calls++;}, refresh: () => {calls++;},
        setInterval: () => {calls++;}});
    assert.equal(calls, 0); assert.equal(view, 'records');
    for (const id of ['save-settings', 'send-analysis', 'sync', 'refresh', 'logout']) assert.equal(dollar(id).disabled, true);
    for (const id of ['login', 'settings-form', 'analysis-form']) {
        let prevented = false; dollar(id).onsubmit({preventDefault: () => {prevented = true;}}); assert.equal(prevented, true);
    }
});
test('實際重設函式清除對話和草稿；取消等待只中止請求而保留草稿', () => {
    const elements = new Map(); let aborted = 0;
    const dollar = id => {
        if (!elements.has(id)) elements.set(id, {value:'舊範圍的提問',textContent:'',hidden:false,replaceChildren() {},append() {}});
        return elements.get(id);
    };
    const reset = source.match(/function resetAnalysis \(\) \{[\s\S]+?\n\}/)[0];
    const context = vm.createContext({$:dollar,text:()=>({append(){}}),updateAnalysisScope:()=>{},
        analysisController:{abort:()=>{aborted++;}},conversation:[{role:'user',text:'old'}],pinnedIds:['old-record'],pinnedMode:'live'});
    vm.runInContext(reset+';resetAnalysis();',context);
    assert.equal(dollar('analysis-question').value,''); assert.equal(context.conversation.length,0);
    assert.equal(context.pinnedIds,null); assert.equal(context.analysisController,null); assert.equal(aborted,1);
    dollar('analysis-question').value = '保留的草稿';
    context.analysisController = {abort:()=>{aborted++;}};
    const cancel = source.match(/\$\('cancel-analysis'\)\.onclick = [^\n]+;/)[0];
    vm.runInContext(cancel,context); dollar('cancel-analysis').onclick();
    assert.equal(dollar('analysis-question').value,'保留的草稿'); assert.equal(aborted,2);
    const modeHandler = source.match(/\$\('analysis-mode'\)\.onchange = [\s\S]+?\n\};/)[0];
    context.analysisController = null; context.pinnedMode = null;
    vm.runInContext(modeHandler,context); dollar('analysis-mode').onchange();
    assert.equal(dollar('analysis-question').value,'');
});
