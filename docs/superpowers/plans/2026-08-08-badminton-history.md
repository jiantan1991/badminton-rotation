# 历史球局功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每次完整球局获得唯一 ID；"再来一局"自动存档；用户通过历史列表查看任意历史球局的完整情况（名单/比分/排名）。

**Architecture:** 服务器端（server.py）在 `data/activities/` 下按 ID 存文件（方案 A），新增 3 个 API（列表/详情/存档），存档超 200 条自动删最旧；前端新增 cloud.js 封装与 app.js 历史视图（列表 + 只读详情）；"再来一局"先存档后开新局；无后端时降级为 localStorage 本地历史。

**Tech Stack:** Python 3 标准库（http.server，零依赖）；ES5 原生 JS（无构建、无框架）；node 断言脚本测试。

## Global Constraints

- ES5 风格 JS（var/function，禁止 let/const/箭头函数/class/Set），普通 `<script>` 按序加载
- 中文界面文案；移动端优先（max-width 480px 卡片式）
- 零第三方依赖；server.py 只用 Python 标准库
- 历史球局最多 200 条，超出删最旧（服务器与本地一致）
- 历史球局只读（不修改/删除）
- 球局 ID 格式 `yyyymmdd-HHMM`（服务器生成），同分钟冲突加 `-2` 后缀
- 测试命令：`node tests/rotation.test.js && node tests/ranking.test.js && node tests/storage.test.js`
- 不执行 git add/commit 之外的 git 操作；git 身份 `-c user.name="jiantan1991" -c user.email="jiantan1991@users.noreply.github.com"`

---

### Task 1: server.py 历史球局 API

**Files:**
- Modify: `server/server.py`

**Interfaces:**
- Produces:
  - `GET /api/activities` → `[{id, date, matchCount, complete}]`（时间倒序，≤200 条；无历史返回 `[]`）
  - `GET /api/activities/<id>` → 球局完整 activity JSON（不存在 → 404）
  - `POST /api/archive`（body=活动 JSON）→ `{"ok":true,"id":"20260808-1930"}`；超 200 条删最旧

- [ ] **Step 1: 实现历史存储辅助函数**

在 `server/server.py` 的 `DATA_DIR` 定义后追加：

```python
ACTIVITIES_DIR = os.path.join(DATA_DIR, 'activities')
MAX_HISTORY = 200  # 历史球局上限，超出删最旧

def list_activities():
    """返回历史球局列表（时间倒序，最多 200 条）"""
    if not os.path.isdir(ACTIVITIES_DIR):
        return []
    items = []
    for fn in os.listdir(ACTIVITIES_DIR):
        if not fn.endswith('.json'):
            continue
        sid = fn[:-5]
        try:
            with open(os.path.join(ACTIVITIES_DIR, fn), encoding='utf-8') as f:
                data = json.load(f)
        except (ValueError, OSError):
            continue
        schedule = data.get('schedule') or []
        items.append({
            'id': sid,
            'date': sid,
            'matchCount': len(schedule),
            'complete': all(m.get('result') for m in schedule)
        })
    items.sort(key=lambda x: x['id'], reverse=True)  # 时间倒序
    return items[:MAX_HISTORY]

def archive_activity(activity):
    """存档活动为新球局，返回 id；超上限删最旧"""
    os.makedirs(ACTIVITIES_DIR, exist_ok=True)
    now = time.strftime('%Y%m%d-%H%M')
    sid = now
    n = 2
    while os.path.exists(os.path.join(ACTIVITIES_DIR, sid + '.json')):
        sid = '%s-%d' % (now, n)
        n += 1
    with open(os.path.join(ACTIVITIES_DIR, sid + '.json'), 'w', encoding='utf-8') as f:
        json.dump(activity, f, ensure_ascii=False)
    # 淘汰：文件数超过上限时删最旧
    files = sorted(os.listdir(ACTIVITIES_DIR))
    while len(files) > MAX_HISTORY:
        os.remove(os.path.join(ACTIVITIES_DIR, files[0]))
        files = files[1:]
    return sid
```

- [ ] **Step 2: 在 server.py 顶部补 import**

```python
import time
```

- [ ] **Step 3: 在 `do_GET` 中新增路由**

在 `do_GET` 的 `if path == '/api/activity':` 分支之后追加：

```python
        if path == '/api/activities':
            self._send(200, json.dumps(list_activities(), ensure_ascii=False))
            return
        if path.startswith('/api/activities/'):
            sid = path[len('/api/activities/'):]
            fpath = os.path.join(ACTIVITIES_DIR, sid + '.json')
            if os.path.isfile(fpath):
                with open(fpath, encoding='utf-8') as f:
                    self._send(200, f.read())
            else:
                self._send(404, '{"ok":false,"msg":"not found"}')
            return
```

- [ ] **Step 4: 在 `do_POST` 中新增 archive 路由**

在 `do_POST` 的 `/api/activity` 分支之后追加：

```python
        if urlparse(self.path).path == '/api/archive':
            length = int(self.headers.get('Content-Length', 0) or 0)
            body = self.rfile.read(length).decode('utf-8', errors='replace')
            try:
                activity = json.loads(body)
            except ValueError:
                self._send(400, '{"ok":false,"msg":"invalid json"}')
                return
            sid = archive_activity(activity)
            self._send(200, json.dumps({'ok': True, 'id': sid}, ensure_ascii=False))
            return
```

- [ ] **Step 5: 语法检查**

Run: `python -c "import py_compile; py_compile.compile('server/server.py', doraise=True)"`
Expected: 无输出（成功）

- [ ] **Step 6: 功能测试（本地起服务 curl 验证）**

Run:
```bash
cd ~/badminton-rotation/server && rm -rf data && python server.py 8091 &
sleep 1
B=http://127.0.0.1:8091
curl -s $B/api/activities                       # 期望 []
curl -s -X POST -H "Content-Type: application/json" -d '{"strong":["a"],"schedule":[{"result":{"scoreA":1,"scoreB":2}},{"result":null}]}' $B/api/archive   # 期望 {"ok":true,"id":"..."}
curl -s $B/api/activities                       # 期望 1 条，complete=false（第2场无 result）
ID=$(curl -s $B/api/activities | python -c "import sys,json;print(json.load(sys.stdin)[0]['id'])")
curl -s $B/api/activities/$ID                   # 期望活动数据
curl -s -o /dev/null -w "%{http_code}" $B/api/activities/nonexist   # 期望 404
kill %1
```

- [ ] **Step 7: Commit**

```bash
cd ~/badminton-rotation && git add server/server.py && git -c user.name="jiantan1991" -c user.email="jiantan1991@users.noreply.github.com" commit -m "feat: 历史球局 API（列表/详情/存档+200条淘汰）"
```

---

### Task 2: cloud.js 历史 API 封装

**Files:**
- Modify: `js/cloud.js`

**Interfaces:**
- Consumes: 服务器 API（Task 1）：`GET /api/activities`、`GET /api/activities/<id>`、`POST /api/archive`
- Produces:
  - `BadRot.cloud.archiveActivity(activity, cb)` → `cb({ok, id})` 或 `cb(null)`（失败/未启用）
  - `BadRot.cloud.fetchActivities(cb)` → `cb(list)` 或 `cb([])`（失败/未启用）
  - `BadRot.cloud.fetchActivityById(id, cb)` → `cb(activity)` 或 `cb(null)`

- [ ] **Step 1: 在 `BadRot.cloud` 对象中追加三个方法**

在 `js/cloud.js` 的 `pushActivity` 之后、`global.BadRot.cloud = {` 之前追加：

```js
  // 存档当前活动为新历史球局（成功 → cb({ok:true,id})）
  function archiveActivity(activity, cb) {
    cb = cb || function () {};
    if (!enabled) { cb(null); return; }
    global.fetch(CONFIG.apiBase.replace('/activity', '/archive'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activity)
    })
      .then(function (resp) { return resp.json(); })
      .then(function (data) { cb(data); })
      .catch(function () { cb(null); });
  }

  // 拉取历史球局列表
  function fetchActivities(cb) {
    cb = cb || function () {};
    if (!enabled) { cb([]); return; }
    global.fetch(CONFIG.apiBase.replace('/activity', '/activities'))
      .then(function (resp) { return resp.json(); })
      .then(function (list) { cb(Array.isArray(list) ? list : []); })
      .catch(function () { cb([]); });
  }

  // 按 ID 拉取单个历史球局
  function fetchActivityById(id, cb) {
    cb = cb || function () {};
    if (!enabled) { cb(null); return; }
    global.fetch(CONFIG.apiBase.replace('/activity', '/activities/') + id)
      .then(function (resp) {
        if (resp.status !== 200) { cb(null); return; }
        return resp.json();
      })
      .then(function (data) { cb(data || null); })
      .catch(function () { cb(null); });
  }
```

在导出对象中追加：

```js
    archiveActivity: archiveActivity,
    fetchActivities: fetchActivities,
    fetchActivityById: fetchActivityById,
```

- [ ] **Step 2: 语法检查**

Run: `node --check js/cloud.js`
Expected: 无输出（成功）

- [ ] **Step 3: 逻辑测试（fetch mock，临时脚本）**

写 `C:/Users/admin/AppData/Local/Temp/hermes-verify-cloud-history.js`：

```js
'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = 'C:/Users/admin/badminton-rotation/';

const calls = [];
const mockFetch = (url, opts) => {
  calls.push([url, opts && opts.method]);
  if (url.includes('/archive')) return Promise.resolve({ json: () => Promise.resolve({ ok: true, id: '20260808-1930' }) });
  if (url.includes('/activities/')) return Promise.resolve({ status: 200, json: () => Promise.resolve({ strong: ['a'] }) });
  return Promise.resolve({ json: () => Promise.resolve([{ id: 'x', matchCount: 12 }]) });
};
const code = fs.readFileSync(path + 'js/cloud.js', 'utf8');
const sandbox = { window: {}, console, fetch: mockFetch };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const cloud = sandbox.BadRot.cloud;
cloud.init(ok => {
  assert.strictEqual(ok, true);
  cloud.archiveActivity({ strong: ['a'] }, r => { assert.strictEqual(r.id, '20260808-1930'); });
  cloud.fetchActivities(list => { assert.strictEqual(list.length, 1); assert.strictEqual(list[0].id, 'x'); });
  cloud.fetchActivityById('20260808-1930', a => { assert.strictEqual(a.strong[0], 'a'); });
  setTimeout(() => {
    assert.ok(calls.some(c => c[0].includes('/archive') && c[1] === 'POST'), '应 POST /api/archive');
    assert.ok(calls.some(c => c[0].includes('/activities/20260808-1930')), '应按 ID 拉取');
    console.log('PASS cloud.js 历史 API');
    process.exit(0);
  }, 30);
});
```

Run: `node C:/Users/admin/AppData/Local/Temp/hermes-verify-cloud-history.js`
Expected: `PASS cloud.js 历史 API`，随后删除该临时脚本。

- [ ] **Step 4: Commit**

```bash
cd ~/badminton-rotation && git add js/cloud.js && git -c user.name="jiantan1991" -c user.email="jiantan1991@users.noreply.github.com" commit -m "feat: cloud.js 历史球局 API 封装"
```

---

### Task 3: storage.js 本地历史（无后端降级）

**Files:**
- Modify: `js/storage.js`
- Test: `tests/storage.test.js`

**Interfaces:**
- Produces:
  - `BadRot.storage.saveHistory(activity)` → 返回 `{id, date, matchCount, complete}`（存 localStorage `badminton_history`，上限 200 删最旧）
  - `BadRot.storage.loadHistory()` → 列表数组（时间倒序）
  - `BadRot.storage.loadHistoryById(id)` → activity 或 null

- [ ] **Step 1: 写失败测试**

在 `tests/storage.test.js` 末尾追加：

```js
// ---- 本地历史（无后端降级）----
{
  const h1 = { strong: ['a'], weak: ['b'], schedule: [{ result: { scoreA: 1, scoreB: 2 } }, { result: null }] };
  const meta = Storage.saveHistory(h1);
  assert.ok(meta && meta.id && meta.matchCount === 2 && meta.complete === false, 'saveHistory 应返回元数据');
  const list = Storage.loadHistory();
  assert.strictEqual(list.length, 1, '列表应有 1 条');
  const loaded = Storage.loadHistoryById(meta.id);
  assert.strictEqual(loaded.strong[0], 'a', '按 ID 应能读回');
  assert.strictEqual(Storage.loadHistoryById('nonexist'), null, '不存在返回 null');
}
```

- [ ] **Step 2: 运行确认失败**

Run: `node tests/storage.test.js`
Expected: FAIL，`Storage.saveHistory is not a function`

- [ ] **Step 3: 实现本地历史**

在 `js/storage.js` 的 `exportText` 函数之后、`var Storage = {` 之前追加：

```js
  var HISTORY_KEY = 'badminton_history';
  var MAX_HISTORY = 200;

  function loadHistory() {
    var s = storage();
    if (!s) return [];
    try {
      var arr = JSON.parse(s.getItem(HISTORY_KEY) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function saveHistory(activity) {
    var arr = loadHistory();
    var now = new Date();
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    var base = '' + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + '-' + pad(now.getHours()) + pad(now.getMinutes());
    var id = base, n = 2;
    while (arr.some(function (h) { return h.id === id; })) { id = base + '-' + n; n += 1; }
    var schedule = activity.schedule || [];
    var meta = {
      id: id,
      date: id,
      matchCount: schedule.length,
      complete: schedule.every(function (m) { return !!m.result; })
    };
    arr.push(meta);
    while (arr.length > MAX_HISTORY) { arr.shift(); }
    s.setItem(HISTORY_KEY, JSON.stringify(arr));
    s.setItem(HISTORY_KEY + '_' + id, JSON.stringify(activity));
    return meta;
  }

  function loadHistoryById(id) {
    var s = storage();
    if (!s) return null;
    try {
      var raw = s.getItem(HISTORY_KEY + '_' + id);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
```

在 `var Storage = {` 对象中追加导出：

```js
    saveHistory: saveHistory,
    loadHistory: loadHistory,
    loadHistoryById: loadHistoryById,
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node tests/storage.test.js`
Expected: 全部通过（含新历史用例）

- [ ] **Step 5: Commit**

```bash
cd ~/badminton-rotation && git add js/storage.js tests/storage.test.js && git -c user.name="jiantan1991" -c user.email="jiantan1991@users.noreply.github.com" commit -m "feat: 本地历史球局存储（localStorage 降级，200条上限）"
```

---

### Task 4: app.js 历史逻辑（存档 + 视图渲染）

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `BadRot.cloud.archiveActivity/fetchActivities/fetchActivityById`（Task 2）、`BadRot.storage.saveHistory/loadHistory/loadHistoryById`（Task 3）、`BadRot.ranking.computeStandings`（已有）
- Produces: `onShowHistory()`、`onHistoryBack()`、`onHistorySelect(id)`、`onHistoryDetailBack()`；`renderHistoryList()`、`renderHistoryDetail(activity, meta)`

- [ ] **Step 1: 实现存档辅助函数（在 `saveActivity` 附近）**

在 `js/app.js` 的 `saveActivity` 函数之后追加：

```js
  // 存档当前活动为历史球局：服务器优先，失败/无后端时降级本地
  function archiveCurrent(stepNext) {
    var act = activity;
    if (BadRot.cloud.isEnabled()) {
      BadRot.cloud.archiveActivity(act, function (res) {
        if (res && res.ok) { stepNext(); }
        else { toast('历史存档失败，请检查网络后重试'); }
      });
    } else {
      BadRot.storage.saveHistory(act);
      stepNext();
    }
  }
```

- [ ] **Step 2: 改造 onRematch**

将 `js/app.js` 的 `onRematch` 替换为：

```js
  function onRematch() {
    if (activity) {
      archiveCurrent(function () {
        BadRot.storage.clear();
        activity = null;
        viewIndex = 0;
        buildNameInputs('strong-inputs', defaultInputs(), 'btn-add-strong');
        buildNameInputs('weak-inputs', defaultInputs(), 'btn-add-weak');
        clearError();
        showView('setup');
      });
    } else {
      BadRot.storage.clear();
      viewIndex = 0;
      buildNameInputs('strong-inputs', defaultInputs(), 'btn-add-strong');
      buildNameInputs('weak-inputs', defaultInputs(), 'btn-add-weak');
      clearError();
      showView('setup');
    }
  }
```

- [ ] **Step 3: 实现历史视图渲染函数（在 `onBackProgress` 之后追加）**

```js
  /* ---------- 历史球局 ---------- */
  function onShowHistory() {
    renderHistoryList();
    showView('history');
  }

  function renderHistoryList() {
    var listEl = $('history-list');
    listEl.innerHTML = '';
    var done = function (list) {
      if (!list || !list.length) {
        var empty = document.createElement('div');
        empty.className = 'item';
        empty.textContent = '暂无历史球局';
        listEl.appendChild(empty);
        return;
      }
      list.forEach(function (h) {
        var row = document.createElement('div');
        row.className = 'item history-row';
        row.textContent = '🗓️ ' + h.date + ' · ' + h.matchCount + '场 · ' + (h.complete ? '已完成' : '进行中');
        (function (id) {
          row.addEventListener('click', function () { onHistorySelect(id); });
        })(h.id);
        listEl.appendChild(row);
      });
    };
    if (BadRot.cloud.isEnabled()) { BadRot.cloud.fetchActivities(done); }
    else { done(BadRot.storage.loadHistory()); }
  }

  function onHistorySelect(id) {
    var show = function (act, meta) {
      if (!act || !act.schedule) { toast('球局不存在'); return; }
      renderHistoryDetail(act, meta || { id: id });
      showView('history-detail');
    };
    if (BadRot.cloud.isEnabled()) {
      BadRot.cloud.fetchActivityById(id, function (act) { show(act); });
    } else {
      show(BadRot.storage.loadHistoryById(id));
    }
  }

  function renderHistoryDetail(act, meta) {
    $('history-detail-title').textContent = '🗓️ 球局 ' + meta.id;
    // 名单
    var roster = $('history-roster');
    roster.innerHTML = '';
    var line = document.createElement('div');
    line.className = 'item';
    line.textContent = '强组：' + act.strong.join('、') + '　弱组：' + act.weak.join('、');
    roster.appendChild(line);
    // 每场比分
    var scores = $('history-scores');
    scores.innerHTML = '';
    act.schedule.forEach(function (m, i) {
      var item = document.createElement('div');
      item.className = 'item';
      var r = m.result;
      item.textContent = '第 ' + (i + 1) + ' 场：' + teamLabel(m.teamA) + ' vs ' + teamLabel(m.teamB) +
        (r ? ' → ' + r.scoreA + ':' + r.scoreB + (r.scoreA > r.scoreB ? ' ✅' : '') : '（未打）');
      scores.appendChild(item);
    });
    // 排名
    var standings = BadRot.ranking.computeStandings(act.strong, act.weak, act.schedule);
    var list = $('history-standings');
    list.innerHTML = '';
    standings.forEach(function (r, i) {
      var li = document.createElement('li');
      li.textContent = (i + 1) + '. ' + r.name + ' ' + r.points + '分 · ' + r.wins + '胜' + r.played + '场 · 净胜' + (r.net >= 0 ? '+' : '') + r.net;
      list.appendChild(li);
    });
  }

  function onHistoryBack() { showView('setup'); }
  function onHistoryDetailBack() { renderHistoryList(); showView('history'); }
```

- [ ] **Step 4: init 中绑定按钮**

在 `js/app.js` 的 init 中（`$('btn-generate')...` 绑定附近）追加：

```js
    $('btn-show-history').addEventListener('click', onShowHistory);
    $('btn-history-back').addEventListener('click', onHistoryBack);
    $('btn-history-detail-back').addEventListener('click', onHistoryDetailBack);
```

- [ ] **Step 5: 语法检查 + 回归**

Run: `node --check js/app.js && node tests/rotation.test.js && node tests/ranking.test.js && node tests/storage.test.js`
Expected: 全部通过

- [ ] **Step 6: Commit**

```bash
cd ~/badminton-rotation && git add js/app.js && git -c user.name="jiantan1991" -c user.email="jiantan1991@users.noreply.github.com" commit -m "feat: 历史球局视图与自动存档（再来一局时）"
```

---

### Task 5: index.html + css 视图结构

**Files:**
- Modify: `index.html`
- Modify: `css/style.css`

**Interfaces:**
- Produces（app.js Task 4 引用的元素 ID）：
  - `btn-show-history`（设置页入口）、`history-list`、`btn-history-back`
  - `history-detail-title`、`history-roster`、`history-scores`、`history-standings`、`btn-history-detail-back`

- [ ] **Step 1: 设置页加历史入口**

在 `index.html` 设置页的 `btn-generate` 按钮之后追加：

```html
    <button type="button" class="btn ghost" id="btn-show-history">📋 历史球局</button>
```

- [ ] **Step 2: 新增两个视图容器**

在 `index.html` 的 `</section>`（view-result 结束）之后、`<script` 之前追加：

```html
  <!-- ④ 历史列表页 -->
  <section id="view-history" class="view" data-view="history" hidden>
    <div class="topbar">
      <button type="button" class="btn tiny" id="btn-history-back">⬅ 返回</button>
      <span>📋 历史球局</span>
    </div>
    <div class="preview" id="history-list"></div>
  </section>

  <!-- ⑤ 历史详情页 -->
  <section id="view-history-detail" class="view" data-view="history-detail" hidden>
    <div class="topbar">
      <button type="button" class="btn tiny" id="btn-history-detail-back">⬅ 返回列表</button>
      <span id="history-detail-title">🗓️ 球局</span>
    </div>
    <div class="preview" id="history-roster"></div>
    <div class="preview">
      <div class="preview-head">每场比分</div>
      <div id="history-scores"></div>
    </div>
    <div class="preview">
      <div class="preview-head">最终排名</div>
      <ol class="standings" id="history-standings"></ol>
    </div>
  </section>
```

- [ ] **Step 3: 构建 + 检查**

Run: `python build_single.py && python build_server.py`
Expected: 两个构建成功；`grep -c "view-history" badminton-single.html` ≥ 2

- [ ] **Step 4: Commit**

```bash
cd ~/badminton-rotation && git add index.html css/style.css && git -c user.name="jiantan1991" -c user.email="jiantan1991@users.noreply.github.com" commit -m "feat: 历史球局视图结构"
```

---

### Task 6: 端到端验收 + 部署

**Files:**
- 无代码改动（验证 + 部署）

- [ ] **Step 1: 本地端到端（真实浏览器）**

```bash
cd ~/badminton-rotation/server && rm -rf data && python server.py 8080 &
```

浏览器打开 `http://127.0.0.1:8080/`，验证：
1. 填 6 人 → 生成 → 提交 1 场比分
2. 点"再来一局" → toast 存档成功 → 回到设置页（数据清空）
3. 点"📋 历史球局" → 列表出现 1 条（日期 · 12场 · 进行中）
4. 点该条 → 详情页显示：名单、每场比分（场1 有比分其余"未打"）、排名
5. 点"⬅ 返回列表" → 列表仍在；"⬅ 返回" → 设置页
6. 再点"再来一局"（无活动时）→ 直接清空开新局（不报错）
7. 服务器 `curl http://127.0.0.1:8080/api/activities` 返回 1 条；`ls data/activities/` 有文件

- [ ] **Step 2: 部署到服务器**

```bash
cd ~/badminton-rotation && scp -P 22 server/server.py root@122.51.174.4:/opt/badminton/
cd ~/badminton-rotation && scp -P 22 -r server/static/* root@122.51.174.4:/opt/badminton/static/
```

SSH 服务器：`systemctl restart badminton`

- [ ] **Step 3: 公网验证**

```bash
curl -s http://122.51.174.4:8080/api/activities   # 期望 []
curl -s -o /dev/null -w "%{http_code}" http://122.51.174.4:8080/   # 期望 200
```

- [ ] **Step 4: 推送 GitHub**

```bash
cd ~/badminton-rotation && git add -A && git -c user.name="jiantan1991" -c user.email="jiantan1991@users.noreply.github.com" commit -m "docs: 更新设计说明" && git push origin main
```

（若无可提交内容则跳过 commit，仅 push 已有提交）
