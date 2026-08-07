# 羽毛球双打轮转系统 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个微信打开即用的纯静态羽毛球双打轮转页面：输入 6 人强/弱名单 → 自动生成 3 场对阵（每人恰好 2 场）→ 记分 → 积分排名 → 生成排名图发群，数据本地保存。

**Architecture:** 无后端、无构建、零依赖的静态多文件站点。算法层（轮转/排名/存储）为纯函数模块（UMD 导出，node 可测、浏览器可用），UI 层（app.js）负责 3 视图切换与交互，数据存 localStorage。

**Tech Stack:** 原生 HTML/CSS/JavaScript（ES5 风格，普通 `<script>` 加载，兼容微信 X5 内核）；node:assert 做算法单测。

**设计文档:** `docs/superpowers/specs/2026-08-07-badminton-rotation-design.md`

## Global Constraints

- 零第三方依赖、无构建工具、无后端 —— 禁止引入任何 npm 包或框架
- 所有 JS 用普通 `<script>` 标签按顺序加载，**禁用 ES modules**；模块用 UMD 模式暴露到 `window.BadRot.<name>`
- 代码 ES5 兼容（`var`/`function` 风格），中文界面文案
- 移动端优先：`<meta name="viewport">`、大按钮（最小 44px 高度）、竖屏卡片布局
- localStorage 键名固定为 `badminton_activity`，集中定义在 `storage.js`
- 每场 `result` 为 `null`（未打）或 `{ scoreA: number, scoreB: number }`
- 积分规则：胜 +2 分；排名顺序 = 总积分 desc → 净胜分 desc → 胜场数 desc → 姓名 asc
- 输入校验：姓名非空、不重复、强组 2~4 人、弱组 2~4 人、总人数必须 = 6
- 算法输入只有三种合法分布：`nS:nW ∈ {2:4, 3:3, 4:2}`，其他组合抛 `Error`

## File Structure

```
badminton-rotation/
├── index.html          # 页面骨架 + 3 个视图容器 + script 加载顺序
├── css/style.css       # 移动端样式
├── js/
│   ├── rotation.js     # 轮转算法（纯函数）
│   ├── ranking.js      # 积分排名（纯函数）
│   ├── storage.js      # localStorage 封装
│   ├── share.js        # Canvas 排名图 + 文字
│   └── app.js          # 视图渲染与流程控制
├── tests/
│   ├── rotation.test.js    # node 单测
│   ├── ranking.test.js     # node 单测
│   └── storage.test.js     # node 单测（mock localStorage）
└── README.md           # 部署说明（CentOS 一条命令）
```

模块间接口（跨任务契约，后续任务照此使用）：

```js
// rotation.js —— Player = { name: string, group: 's'|'w' }
BadRot.rotation.generateSchedule(strongNames: string[], weakNames: string[])
  // -> [{ id: 1..3, teamA: Player[2], teamB: Player[2], resting: Player[], result: null }]

// ranking.js
BadRot.ranking.computeStandings(strongNames, weakNames, schedule)
  // -> [{ name, group, played, wins, points, scored, conceded, net }] 已按排名规则排序
BadRot.ranking.getMatchWinner(match)   // -> 'A' | 'B' | null（null = 未打）
BadRot.ranking.isComplete(schedule)    // -> boolean（3 场全部有 result）

// storage.js
BadRot.storage.KEY                                  // 'badminton_activity'
BadRot.storage.save(activity)                       // 写 localStorage
BadRot.storage.load()                               // -> activity | null（坏数据返回 null 并清除）
BadRot.storage.clear()                              // 删除
BadRot.storage._setImpl(mockStorage)                // 测试注入

// share.js
BadRot.share.renderRankingImage(standings, containerEl)  // canvas→img 挂到容器，返回 canvas
BadRot.share.rankingText(standings)                       // -> 纯文本排名
```

---

### Task 1: 项目脚手架（index.html + style.css）

**Files:**
- Create: `index.html`
- Create: `css/style.css`

**Interfaces:**
- Consumes: 无
- Produces: 页面骨架（3 个视图容器 `#view-setup` / `#view-match` / `#view-result`，每个有 `data-view` 属性）、script 加载顺序（rotation → ranking → storage → share → app）

- [ ] **Step 1: 创建 `index.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>羽毛球双打轮转</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <!-- ① 设置页 -->
  <section id="view-setup" class="view" data-view="setup">
    <h1>🏸 羽毛球双打轮转</h1>
    <p class="hint">组内按实力从强到弱填写，强组 2~4 人、弱组 2~4 人，总共 6 人</p>
    <div class="group-box">
      <h2>强组</h2>
      <div id="strong-inputs" class="name-inputs"></div>
      <button type="button" class="btn ghost" id="btn-add-strong">+ 添加强组队员</button>
    </div>
    <div class="group-box">
      <h2>弱组</h2>
      <div id="weak-inputs" class="name-inputs"></div>
      <button type="button" class="btn ghost" id="btn-add-weak">+ 添加弱组队员</button>
    </div>
    <p id="setup-error" class="error" hidden></p>
    <button type="button" class="btn primary big" id="btn-generate">生成轮转表</button>
  </section>

  <!-- ② 轮转表页 -->
  <section id="view-match" class="view" data-view="match" hidden>
    <div class="topbar">
      <span id="match-progress">第 1/3 场</span>
      <button type="button" class="btn tiny" id="btn-standings">排名</button>
    </div>
    <div id="current-match" class="match-card"></div>
    <div class="score-row">
      <div class="score-col">
        <span id="score-a-label" class="team-label"></span>
        <input type="number" id="score-a" class="score-input" min="0" max="99" inputmode="numeric" placeholder="0">
      </div>
      <span class="vs">:</span>
      <div class="score-col">
        <span id="score-b-label" class="team-label"></span>
        <input type="number" id="score-b" class="score-input" min="0" max="99" inputmode="numeric" placeholder="0">
      </div>
    </div>
    <p id="score-error" class="error" hidden></p>
    <button type="button" class="btn primary big" id="btn-submit-score">提交比分</button>
    <button type="button" class="btn ghost" id="btn-finish-early">提前结束</button>
    <details class="preview">
      <summary>后续场次预览</summary>
      <div id="later-matches"></div>
    </details>
  </section>

  <!-- ③ 结果页 -->
  <section id="view-result" class="view" data-view="result" hidden>
    <h1 id="result-title">🏆 积分排名</h1>
    <ol id="standings-list" class="standings"></ol>
    <button type="button" class="btn primary big" id="btn-share-image">生成排名图</button>
    <button type="button" class="btn ghost" id="btn-copy-text">复制排名文字</button>
    <div id="share-image-wrap"></div>
    <div class="result-actions">
      <button type="button" class="btn ghost" id="btn-rematch">再来一局</button>
      <button type="button" class="btn ghost" id="btn-reshuffle">重新轮转</button>
    </div>
  </section>

  <script src="js/rotation.js"></script>
  <script src="js/ranking.js"></script>
  <script src="js/storage.js"></script>
  <script src="js/share.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: 创建 `css/style.css`**

```css
* { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; background: #f4f6f8; color: #222; max-width: 480px; margin: 0 auto; padding: 16px; }
h1 { font-size: 22px; text-align: center; margin: 12px 0; }
h2 { font-size: 16px; margin: 10px 0 6px; }
.hint { color: #888; font-size: 13px; text-align: center; margin-bottom: 14px; }
.view { display: block; }
.group-box { background: #fff; border-radius: 12px; padding: 12px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.name-inputs input { width: 100%; height: 44px; font-size: 16px; border: 1px solid #ddd; border-radius: 8px; padding: 0 12px; margin-bottom: 8px; }
.btn { height: 44px; border: none; border-radius: 10px; font-size: 16px; cursor: pointer; width: 100%; margin-top: 8px; }
.btn.primary { background: #07c160; color: #fff; }
.btn.ghost { background: #fff; color: #555; border: 1px solid #ddd; }
.btn.big { height: 50px; font-size: 17px; }
.btn.tiny { width: auto; height: 30px; font-size: 13px; margin: 0; padding: 0 10px; }
.error { color: #e64340; font-size: 14px; text-align: center; margin: 8px 0; }
.topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 15px; color: #555; }
.match-card { background: #fff; border-radius: 14px; padding: 18px 12px; text-align: center; box-shadow: 0 2px 6px rgba(0,0,0,.08); }
.match-card .team { font-size: 20px; font-weight: 600; margin: 10px 0; }
.match-card .rest { color: #999; font-size: 13px; margin-top: 10px; }
.score-row { display: flex; justify-content: center; align-items: center; margin: 16px 0; }
.score-col { text-align: center; }
.score-col .team-label { display: block; font-size: 14px; color: #555; margin-bottom: 6px; max-width: 120px; }
.score-input { width: 88px; height: 56px; font-size: 28px; text-align: center; border: 1px solid #ddd; border-radius: 10px; }
.vs { font-size: 24px; color: #999; margin: 0 18px; }
.preview { background: #fff; border-radius: 10px; padding: 10px 12px; margin-top: 12px; font-size: 14px; }
.preview summary { cursor: pointer; color: #555; }
.preview .item { padding: 6px 0; border-bottom: 1px dashed #eee; color: #666; }
.standings { list-style: none; counter-reset: rank; background: #fff; border-radius: 14px; padding: 12px; box-shadow: 0 2px 6px rgba(0,0,0,.08); }
.standings li { display: flex; justify-content: space-between; padding: 12px 8px; border-bottom: 1px solid #f0f0f0; font-size: 16px; }
.standings li:last-child { border-bottom: none; }
.standings li.champion { background: #fff7e6; border-radius: 8px; font-weight: 700; }
.standings .meta { color: #999; font-size: 13px; }
#share-image-wrap { text-align: center; margin-top: 12px; }
#share-image-wrap img { max-width: 100%; border-radius: 10px; }
.result-actions { display: flex; gap: 10px; }
.result-actions .btn { flex: 1; }
#toast { position: fixed; left: 50%; bottom: 40px; transform: translateX(-50%); background: rgba(0,0,0,.75); color: #fff; padding: 10px 18px; border-radius: 20px; font-size: 14px; z-index: 99; display: none; }
```

- [ ] **Step 3: 验证页面骨架**

Run: `cd ~/badminton-rotation && python3 -m http.server 8000`（后台）→ 浏览器打开 `http://localhost:8000`，确认设置页可见、无 JS 报错（此时 js 文件尚未创建，控制台会有 404，属预期；下一步创建后再验）。

- [ ] **Step 4: Commit**

```bash
git add index.html css/style.css
git commit -m "chore: 页面骨架与基础样式"
```

---

### Task 2: rotation.js 轮转算法（TDD）

**Files:**
- Create: `js/rotation.js`
- Test: `tests/rotation.test.js`

**Interfaces:**
- Consumes: 无
- Produces: `BadRot.rotation.generateSchedule(strongNames, weakNames) -> [{id, teamA, teamB, resting, result}]`，Player 形如 `{name, group}`

**算法说明（确定性构造，对 2:4 / 3:3 / 4:2 三种输入封闭）：**
- 3强3弱：场1 `(S0,W0) vs (S1,W1)` 休 `[S2,W2]`；场2 `(S0,W1) vs (S2,W0)` 休 `[S1,W2]`；场3 `(S1,W2) vs (S2,W1)` 休 `[S0,W0]`
- 2强4弱：场1 `(S0,W0) vs (S1,W1)` 休 `[W2,W3]`；场2 `(W0,W1) vs (W2,W3)` 休 `[S0,S1]`（纯弱场）；场3 `(S0,W2) vs (S1,W3)` 休 `[W0,W1]`
- 4强2弱：场1 `(S0,W0) vs (S1,W1)` 休 `[S2,S3]`；场2 `(S0,S2) vs (S1,S3)` 休 `[W0,W1]`（纯强场）；场3 `(S2,W0) vs (S3,W1)` 休 `[S0,S1]`
- 性质（由构造保证）：每人恰好 2 场；每队优先 1强1弱；3 场搭档对两两不同；两队强弱均衡近似

- [ ] **Step 1: 写失败测试 `tests/rotation.test.js`**

```js
'use strict';
const assert = require('assert');
const Rotation = require('../js/rotation.js');

function countOccurrences(schedule) {
  const counts = {};
  schedule.forEach(m => {
    m.teamA.concat(m.teamB).forEach(p => { counts[p.name] = (counts[p.name] || 0) + 1; });
  });
  return counts;
}

function noRepeatPartners(schedule) {
  const seen = new Set();
  for (const m of schedule) {
    for (const team of [m.teamA, m.teamB]) {
      const key = [team[0].name, team[1].name].sort().join('+');
      if (seen.has(key)) return false;
      seen.add(key);
    }
  }
  return true;
}

const S = ['强1', '强2', '强3'];
const W = ['弱1', '弱2', '弱3'];

// 3强3弱
{
  const sched = Rotation.generateSchedule(S, W);
  assert.strictEqual(sched.length, 3, '应有 3 场');
  const counts = countOccurrences(sched);
  for (const n of [...S, ...W]) assert.strictEqual(counts[n], 2, n + ' 应上场 2 次');
  for (const m of sched) {
    assert.strictEqual(m.teamA.length, 2);
    assert.strictEqual(m.teamB.length, 2);
    assert.strictEqual(m.teamA.filter(p => p.group === 's').length, 1, 'A队应 1强1弱');
    assert.strictEqual(m.teamB.filter(p => p.group === 's').length, 1, 'B队应 1强1弱');
    assert.strictEqual(m.result, null);
  }
  assert.ok(noRepeatPartners(sched), '搭档不应重复');
}

// 2强4弱
{
  const sched = Rotation.generateSchedule(['强1', '强2'], ['弱1', '弱2', '弱3', '弱4']);
  assert.strictEqual(sched.length, 3);
  const counts = countOccurrences(sched);
  for (const n of ['强1', '强2', '弱1', '弱2', '弱3', '弱4']) assert.strictEqual(counts[n], 2, n + ' 应上场 2 次');
  assert.ok(sched.some(m => m.teamA.every(p => p.group === 'w') && m.teamB.every(p => p.group === 'w')), '应含 1 场纯弱场');
  assert.ok(noRepeatPartners(sched));
}

// 4强2弱
{
  const sched = Rotation.generateSchedule(['强1', '强2', '强3', '强4'], ['弱1', '弱2']);
  assert.strictEqual(sched.length, 3);
  const counts = countOccurrences(sched);
  for (const n of ['强1', '强2', '强3', '强4', '弱1', '弱2']) assert.strictEqual(counts[n], 2, n + ' 应上场 2 次');
  assert.ok(sched.some(m => m.teamA.every(p => p.group === 's') && m.teamB.every(p => p.group === 's')), '应含 1 场纯强场');
  assert.ok(noRepeatPartners(sched));
}

// 非法输入
assert.throws(() => Rotation.generateSchedule(['a'], ['b', 'c', 'd', 'e', 'f']), /total/i, '总人数非 6 应抛错');
assert.throws(() => Rotation.generateSchedule(['a', 'b'], ['c', 'd']), /total/i, '总人数非 6 应抛错');

console.log('✓ rotation.test.js 全部通过');
```

- [ ] **Step 2: 运行确认失败**

Run: `cd ~/badminton-rotation && node tests/rotation.test.js`
Expected: `Error: Cannot find module '../js/rotation.js'`（或 Module 不存在）

- [ ] **Step 3: 实现 `js/rotation.js`**

```js
/* 轮转算法：生成 3 场双打对阵表（纯函数，UMD 导出） */
(function (global) {
  'use strict';

  function player(name, group) { return { name: name, group: group }; }

  function invalid(total, nS, nW) {
    if (total !== 6) return '总人数必须为 6（当前 ' + total + ' 人）';
    if (nS < 2 || nS > 4) return '强组需 2~4 人（当前 ' + nS + ' 人）';
    if (nW < 2 || nW > 4) return '弱组需 2~4 人（当前 ' + nW + ' 人）';
    return null;
  }

  function generateSchedule(strongNames, weakNames) {
    var S = strongNames.slice();
    var W = weakNames.slice();
    var err = invalid(S.length + W.length, S.length, W.length);
    if (err) throw new Error(err);

    var s = S.map(function (n) { return player(n, 's'); });
    var w = W.map(function (n) { return player(n, 'w'); });

    var schedule = [];
    function add(id, teamA, teamB, resting) {
      schedule.push({ id: id, teamA: teamA, teamB: teamB, resting: resting, result: null });
    }

    if (s.length === 3 && w.length === 3) {
      add(1, [s[0], w[0]], [s[1], w[1]], [s[2], w[2]]);
      add(2, [s[0], w[1]], [s[2], w[0]], [s[1], w[2]]);
      add(3, [s[1], w[2]], [s[2], w[1]], [s[0], w[0]]);
    } else if (s.length === 2 && w.length === 4) {
      add(1, [s[0], w[0]], [s[1], w[1]], [w[2], w[3]]);
      add(2, [w[0], w[1]], [w[2], w[3]], [s[0], s[1]]);
      add(3, [s[0], w[2]], [s[1], w[3]], [w[0], w[1]]);
    } else if (s.length === 4 && w.length === 2) {
      add(1, [s[0], w[0]], [s[1], w[1]], [s[2], s[3]]);
      add(2, [s[0], s[2]], [s[1], s[3]], [w[0], w[1]]);
      add(3, [s[2], w[0]], [s[3], w[1]], [s[0], s[1]]);
    }

    return schedule;
  }

  var Rotation = { generateSchedule: generateSchedule };
  if (typeof module !== 'undefined' && module.exports) { module.exports = Rotation; }
  else { global.BadRot = global.BadRot || {}; global.BadRot.rotation = Rotation; }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: 运行确认通过**

Run: `cd ~/badminton-rotation && node tests/rotation.test.js`
Expected: `✓ rotation.test.js 全部通过`

- [ ] **Step 5: Commit**

```bash
git add js/rotation.js tests/rotation.test.js
git commit -m "feat: 轮转算法生成3场对阵表"
```

---

### Task 3: ranking.js 积分排名（TDD）

**Files:**
- Create: `js/ranking.js`
- Test: `tests/ranking.test.js`

**Interfaces:**
- Consumes: `BadRot.rotation.generateSchedule` 的输出结构
- Produces: `computeStandings(strongNames, weakNames, schedule)`、`getMatchWinner(match)`、`isComplete(schedule)`

- [ ] **Step 1: 写失败测试 `tests/ranking.test.js`**

```js
'use strict';
const assert = require('assert');
const Rotation = require('../js/rotation.js');
const Ranking = require('../js/ranking.js');

const S = ['强1', '强2', '强3'];
const W = ['弱1', '弱2', '弱3'];

// 全部打完：构造一个确定结果（场1 A胜，场2 B胜，场3 A胜）
const sched = Rotation.generateSchedule(S, W);
sched[0].result = { scoreA: 21, scoreB: 15 };
sched[1].result = { scoreA: 18, scoreB: 21 };
sched[2].result = { scoreA: 21, scoreB: 12 };

const st = Ranking.computeStandings(S, W, sched);

// 积分：胜2分
const byName = {};
st.forEach(r => { byName[r.name] = r; });

assert.strictEqual(st.length, 6);
assert.strictEqual(byName['强1'].wins, 1, '强1 场1胜、场2负 → 1胜');
assert.strictEqual(byName['强1'].points, 2, '胜1场=2分');
assert.strictEqual(byName['强1'].played, 2);
assert.strictEqual(byName['强1'].scored, 39, '21+18');
assert.strictEqual(byName['强1'].conceded, 36, '15+21');
assert.strictEqual(byName['强1'].net, 3, '39-36');

// 排名顺序：积分降序
for (let i = 1; i < st.length; i++) {
  assert.ok(st[i - 1].points >= st[i].points, '积分应降序');
}

// 同分比净胜分：构造三人各 1 胜（同 2 分），净胜 强3(+21) > 强1(0) > 强2(-1)
{
  const s2 = Rotation.generateSchedule(S, W);
  s2[0].result = { scoreA: 21, scoreB: 10 };  // 强1弱1 vs 强2弱2 → A胜(强1)
  s2[1].result = { scoreA: 10, scoreB: 21 };  // 强1弱2 vs 强3弱1 → B胜(强3)
  s2[2].result = { scoreA: 21, scoreB: 11 };  // 强2弱3 vs 强3弱2 → A胜(强2)
  const st2 = Ranking.computeStandings(S, W, s2);
  const rank1 = st2.findIndex(r => r.name === '强1');
  const rank2 = st2.findIndex(r => r.name === '强2');
  const rank3 = st2.findIndex(r => r.name === '强3');
  assert.strictEqual(st2.find(r => r.name === '强1').points, 2);
  assert.strictEqual(st2.find(r => r.name === '强2').points, 2);
  assert.strictEqual(st2.find(r => r.name === '强3').points, 2);
  assert.ok(rank3 < rank1 && rank1 < rank2, '同积分时按净胜分降序：强3 > 强1 > 强2');
}

// getMatchWinner
assert.strictEqual(Ranking.getMatchWinner({ result: { scoreA: 21, scoreB: 15 } }), 'A');
assert.strictEqual(Ranking.getMatchWinner({ result: { scoreA: 15, scoreB: 21 } }), 'B');
assert.strictEqual(Ranking.getMatchWinner({ result: null }), null);

// isComplete
const s3 = Rotation.generateSchedule(S, W);
assert.strictEqual(Ranking.isComplete(s3), false);
s3.forEach(m => { m.result = { scoreA: 21, scoreB: 10 }; });
assert.strictEqual(Ranking.isComplete(s3), true);

console.log('✓ ranking.test.js 全部通过');
```

- [ ] **Step 2: 运行确认失败**

Run: `cd ~/badminton-rotation && node tests/ranking.test.js`
Expected: `Error: Cannot find module '../js/ranking.js'`

- [ ] **Step 3: 实现 `js/ranking.js`**

```js
/* 积分排名：输入名单与场次结果，输出排序后的个人统计（纯函数，UMD 导出） */
(function (global) {
  'use strict';

  function getMatchWinner(match) {
    if (!match || !match.result) return null;
    if (match.result.scoreA > match.result.scoreB) return 'A';
    if (match.result.scoreB > match.result.scoreA) return 'B';
    return null; // 平局（正常不会出现，前端已拦截）
  }

  function isComplete(schedule) {
    return schedule.every(function (m) { return !!m.result; });
  }

  function computeStandings(strongNames, weakNames, schedule) {
    var players = [];
    function ensure(name, group) {
      var p = null;
      for (var i = 0; i < players.length; i++) {
        if (players[i].name === name) { p = players[i]; break; }
      }
      if (!p) {
        p = { name: name, group: group, played: 0, wins: 0, points: 0, scored: 0, conceded: 0, net: 0 };
        players.push(p);
      }
      return p;
    }
    strongNames.forEach(function (n) { ensure(n, 's'); });
    weakNames.forEach(function (n) { ensure(n, 'w'); });

    schedule.forEach(function (m) {
      var winner = getMatchWinner(m);
      if (!winner) return;
      var sides = { A: m.teamA, B: m.teamB };
      sides.A.concat(sides.B).forEach(function (p) {
        var rec = ensure(p.name, p.group);
        rec.played += 1;
        if (winner === 'A') {
          rec.scored += m.result.scoreA;
          rec.conceded += m.result.scoreB;
          if (sides.A.indexOf(p) !== -1) { rec.wins += 1; rec.points += 2; }
        } else {
          rec.scored += m.result.scoreB;
          rec.conceded += m.result.scoreA;
          if (sides.B.indexOf(p) !== -1) { rec.wins += 1; rec.points += 2; }
        }
      });
    });

    players.forEach(function (p) { p.net = p.scored - p.conceded; });

    players.sort(function (a, b) {
      if (b.points !== a.points) return b.points - a.points;
      if (b.net !== a.net) return b.net - a.net;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.name.localeCompare(b.name, 'zh');
    });
    return players;
  }

  var Ranking = {
    computeStandings: computeStandings,
    getMatchWinner: getMatchWinner,
    isComplete: isComplete
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = Ranking; }
  else { global.BadRot = global.BadRot || {}; global.BadRot.ranking = Ranking; }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: 运行确认通过**

Run: `cd ~/badminton-rotation && node tests/ranking.test.js`
Expected: `✓ ranking.test.js 全部通过`

- [ ] **Step 5: Commit**

```bash
git add js/ranking.js tests/ranking.test.js
git commit -m "feat: 积分排名计算"
```

---

### Task 4: storage.js 持久化（TDD）

**Files:**
- Create: `js/storage.js`
- Test: `tests/storage.test.js`

**Interfaces:**
- Consumes: 无
- Produces: `BadRot.storage.KEY` / `.save(activity)` / `.load()` / `.clear()` / `._setImpl(mock)`

- [ ] **Step 1: 写失败测试 `tests/storage.test.js`**

```js
'use strict';
const assert = require('assert');
const Storage = require('../js/storage.js');

// mock localStorage（node 环境没有）
const store = {};
const mock = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
Storage._setImpl(mock);

assert.strictEqual(Storage.KEY, 'badminton_activity');

// 初始 load 为 null
assert.strictEqual(Storage.load(), null);

// save 后 load 还原
const activity = { strong: ['a'], weak: ['b'], schedule: [], currentIndex: 0 };
Storage.save(activity);
const loaded = Storage.load();
assert.deepStrictEqual(loaded, activity);
assert.strictEqual(store[Storage.KEY], JSON.stringify(activity));

// 坏数据 → load 返回 null 且清除
store[Storage.KEY] = '{not json';
assert.strictEqual(Storage.load(), null);
assert.ok(!(Storage.KEY in store), '坏数据应被清除');

// clear
Storage.save(activity);
Storage.clear();
assert.strictEqual(Storage.load(), null);

console.log('✓ storage.test.js 全部通过');
```

- [ ] **Step 2: 运行确认失败**

Run: `cd ~/badminton-rotation && node tests/storage.test.js`
Expected: `Error: Cannot find module '../js/storage.js'`

- [ ] **Step 3: 实现 `js/storage.js`**

```js
/* localStorage 封装（UMD 导出），键名集中定义 */
(function (global) {
  'use strict';

  var KEY = 'badminton_activity';
  var impl = null; // 运行时注入（浏览器用 window.localStorage，测试用 mock）

  function storage() {
    if (impl) return impl;
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    return null;
  }

  function save(activity) {
    var s = storage();
    if (!s) return;
    s.setItem(KEY, JSON.stringify(activity));
  }

  function load() {
    var s = storage();
    if (!s) return null;
    var raw = s.getItem(KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      s.removeItem(KEY); // 坏数据静默清除
      return null;
    }
  }

  function clear() {
    var s = storage();
    if (s) s.removeItem(KEY);
  }

  function setImpl(mock) { impl = mock; }

  var Storage = { KEY: KEY, save: save, load: load, clear: clear, _setImpl: setImpl };
  if (typeof module !== 'undefined' && module.exports) { module.exports = Storage; }
  else { global.BadRot = global.BadRot || {}; global.BadRot.storage = Storage; }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: 运行确认通过**

Run: `cd ~/badminton-rotation && node tests/storage.test.js`
Expected: `✓ storage.test.js 全部通过`

- [ ] **Step 5: Commit**

```bash
git add js/storage.js tests/storage.test.js
git commit -m "feat: localStorage 持久化封装"
```

---

### Task 5: app.js 设置页与视图框架

**Files:**
- Create: `js/app.js`（本任务完成：视图切换 + 设置页完整逻辑）

**Interfaces:**
- Consumes: `BadRot.rotation` / `BadRot.ranking` / `BadRot.storage` / `BadRot.share`（share 下任务实现，此处不调用）
- Produces: 页面初始状态 `activity = { strong, weak, schedule, currentIndex }`；`BadRot.app` 供手动验收调试

- [ ] **Step 1: 实现 `js/app.js`（设置页 + 视图框架部分）**

```js
/* 页面流程控制（浏览器专用，无 UMD 导出需求） */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  var activity = null; // { strong, weak, schedule, currentIndex }

  /* ---------- 视图切换 ---------- */
  function showView(name) {
    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i++) {
      views[i].hidden = views[i].getAttribute('data-view') !== name;
    }
    window.scrollTo(0, 0);
  }

  /* ---------- 设置页 ---------- */
  function defaultInputs() {
    return ['', '', ''];
  }
  function buildNameInputs(containerId, values, addBtnId) {
    var container = $(containerId);
    container.innerHTML = '';
    values.forEach(function (v) {
      var input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 8;
      input.placeholder = '姓名';
      input.value = v;
      container.appendChild(input);
    });
    $(addBtnId).addEventListener('click', function () {
      if (container.children.length >= 4) { toast('最多 4 人'); return; }
      var input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 8;
      input.placeholder = '姓名';
      container.appendChild(input);
      input.focus();
    });
  }

  function collectNames(containerId) {
    var out = [];
    var inputs = $(containerId).querySelectorAll('input');
    for (var i = 0; i < inputs.length; i++) {
      var v = inputs[i].value.trim();
      if (v) out.push(v);
    }
    return out;
  }

  function hasDuplicates(arr) {
    for (var i = 0; i < arr.length; i++) {
      for (var j = i + 1; j < arr.length; j++) {
        if (arr[i] === arr[j]) return true;
      }
    }
    return false;
  }

  function validateSetup(strong, weak) {
    var all = strong.concat(weak);
    if (hasDuplicates(all)) return '姓名不能重复';
    if (all.length !== 6) return '总共需要 6 人（当前 ' + all.length + ' 人）';
    if (strong.length < 2 || strong.length > 4) return '强组需 2~4 人（当前 ' + strong.length + ' 人）';
    if (weak.length < 2 || weak.length > 4) return '弱组需 2~4 人（当前 ' + weak.length + ' 人）';
    return null;
  }

  function onGenerate() {
    var strong = collectNames('strong-inputs');
    var weak = collectNames('weak-inputs');
    var err = validateSetup(strong, weak);
    if (err) { showError(err); return; }
    clearError();
    activity = {
      strong: strong,
      weak: weak,
      schedule: BadRot.rotation.generateSchedule(strong, weak),
      currentIndex: 0
    };
    BadRot.storage.save(activity);
    renderMatchView();
    showView('match');
  }

  function showError(msg) {
    var el = $('setup-error');
    el.textContent = msg;
    el.hidden = false;
  }
  function clearError() { $('setup-error').hidden = true; }

  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.style.display = 'none'; }, 1800);
  }

  /* ---------- 后续任务填充的渲染函数（先占位避免报错） ---------- */
  function renderMatchView() {}
  function renderResultView() {}

  /* ---------- 启动 ---------- */
  function init() {
    buildNameInputs('strong-inputs', defaultInputs(), 'btn-add-strong');
    buildNameInputs('weak-inputs', defaultInputs(), 'btn-add-weak');
    $('btn-generate').addEventListener('click', onGenerate);

    var saved = BadRot.storage.load();
    if (saved && saved.schedule && saved.schedule.length === 3) {
      activity = saved;
      if (BadRot.ranking.isComplete(activity.schedule)) { renderResultView(); showView('result'); }
      else { renderMatchView(); showView('match'); }
    } else {
      showView('setup');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
  window.BadRot = window.BadRot || {};
  window.BadRot.app = { getActivity: function () { return activity; } };
})();
```

- [ ] **Step 2: 验证**

Run: `cd ~/badminton-rotation && node -e "require('./js/rotation.js'); require('./js/ranking.js'); require('./js/storage.js'); console.log('模块加载正常')"`
Expected: `模块加载正常`

浏览器打开 `http://localhost:8000`：设置页可增删姓名输入框（最多 4 个/组）；空名单点"生成轮转表"提示"总共需要 6 人"；重复姓名提示"姓名不能重复"。

- [ ] **Step 3: Commit**

```bash
git add js/app.js
git commit -m "feat: 设置页与视图框架"
```

---

### Task 6: app.js 轮转表页（对阵渲染 + 比分流程）

**Files:**
- Modify: `js/app.js`（实现 `renderMatchView`、提交/修改比分、推进场次、提前结束、查看当前排名）

**Interfaces:**
- Consumes: `activity.schedule`、`BadRot.ranking.getMatchWinner`
- Produces: 提交比分后 `schedule[currentIndex].result` 写入并 `storage.save`；打完自动进结果页

- [ ] **Step 1: 在 `js/app.js` 中实现轮转表页逻辑（替换占位的 `renderMatchView`）**

```js
  function teamLabel(team) {
    return team.map(function (p) { return (p.group === 's' ? '💪' : '') + p.name; }).join(' + ');
  }

  function renderMatchView() {
    var m = activity.schedule[activity.currentIndex];
    var progress = '第 ' + (activity.currentIndex + 1) + '/' + activity.schedule.length + ' 场';
    $('match-progress').textContent = progress;

    var card = $('current-match');
    card.innerHTML =
      '<div class="team">' + teamLabel(m.teamA) + '</div>' +
      '<div style="color:#999">VS</div>' +
      '<div class="team">' + teamLabel(m.teamB) + '</div>' +
      '<div class="rest">本场休息：' + m.resting.map(function (p) { return p.name; }).join('、') + '</div>';

    $('score-a-label').textContent = teamLabel(m.teamA);
    $('score-b-label').textContent = teamLabel(m.teamB);

    // 已打过（修改比分场景）
    var scoreA = $('score-a'), scoreB = $('score-b');
    scoreA.value = m.result ? m.result.scoreA : '';
    scoreB.value = m.result ? m.result.scoreB : '';

    // 后续场次预览
    var later = $('later-matches');
    later.innerHTML = '';
    for (var i = activity.currentIndex + 1; i < activity.schedule.length; i++) {
      var lm = activity.schedule[i];
      var item = document.createElement('div');
      item.className = 'item';
      item.textContent = '第 ' + (i + 1) + ' 场：' + teamLabel(lm.teamA) + ' vs ' + teamLabel(lm.teamB);
      later.appendChild(item);
    }
    $('score-error').hidden = true;
  }

  function onSubmitScore() {
    var a = parseInt($('score-a').value, 10);
    var b = parseInt($('score-b').value, 10);
    var err = $('score-error');
    if (isNaN(a) || isNaN(b) || a < 0 || a > 99 || b < 0 || b > 99) {
      err.textContent = '请输入 0~99 的整数比分';
      err.hidden = false; return;
    }
    if (a === b) {
      err.textContent = '两队比分不能相同，请确认胜者';
      err.hidden = false; return;
    }
    err.hidden = true;
    var m = activity.schedule[activity.currentIndex];
    m.result = { scoreA: a, scoreB: b };
    BadRot.storage.save(activity);

    if (activity.currentIndex + 1 >= activity.schedule.length) {
      renderResultView();
      showView('result');
    } else {
      activity.currentIndex += 1;
      BadRot.storage.save(activity);
      renderMatchView();
    }
  }

  function onFinishEarly() {
    renderResultView();
    showView('result');
  }

  function onShowStandings() {
    renderResultView();
    showView('result');
  }
```

- [ ] **Step 2: 在 `init()` 中绑定事件，替换占位实现**

```js
    $('btn-submit-score').addEventListener('click', onSubmitScore);
    $('btn-finish-early').addEventListener('click', onFinishEarly);
    $('btn-standings').addEventListener('click', onShowStandings);
```

- [ ] **Step 3: 验证（手动，浏览器）**

浏览器打开页面 → 输入 6 人 → 生成轮转表 → 检查：
- 当前场次显示两队 + 休息名单，与算法输出一致
- 输入 21:15 → 提交 → 进度变为"第 2/3 场"，第一场比分已存
- 输入 21:21 → 提示"两队比分不能相同"
- 输入 abc → 提示"请输入 0~99 的整数比分"
- 刷新页面 → 恢复到"第 2/3 场"，可继续
- 第 3 场提交后 → 自动进入结果页
- "提前结束"→ 立即进入结果页

- [ ] **Step 4: Commit**

```bash
git add js/app.js
git commit -m "feat: 轮转表页与比分流程"
```

---

### Task 7: app.js 结果页 + share.js 排名图

**Files:**
- Create: `js/share.js`
- Modify: `js/app.js`（实现 `renderResultView`、绑定分享按钮、再来一局、重新轮转）

**Interfaces:**
- Consumes: `BadRot.ranking.computeStandings` 的结果
- Produces: `BadRot.share.renderRankingImage(standings, containerEl)`、`BadRot.share.rankingText(standings)`

- [ ] **Step 1: 创建 `js/share.js`**

```js
/* 排名图生成（Canvas）与排名文字（浏览器专用） */
(function (global) {
  'use strict';

  function rankingText(standings) {
    var lines = ['🏸 羽毛球双打积分排名'];
    standings.forEach(function (r, i) {
      lines.push((i + 1) + '. ' + r.name + '  ' + r.points + '分（' + r.wins + '胜' + r.played + '场，净胜' + (r.net >= 0 ? '+' : '') + r.net + '）');
    });
    return lines.join('\n');
  }

  function renderRankingImage(standings, containerEl) {
    var W = 750, H = 120 + standings.length * 88;
    var dpr = window.devicePixelRatio || 1;
    var canvas = document.createElement('canvas');
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // 背景
    ctx.fillStyle = '#f4f6f8';
    ctx.fillRect(0, 0, W, H);

    // 标题
    ctx.fillStyle = '#222';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏸 羽毛球双打积分排名', W / 2, 80);

    // 每行
    var y = 140;
    standings.forEach(function (r, i) {
      ctx.fillStyle = i === 0 ? '#fff7e6' : '#ffffff';
      ctx.fillRect(30, y - 48, W - 60, 72);
      ctx.strokeStyle = '#eee';
      ctx.strokeRect(30, y - 48, W - 60, 72);

      ctx.textAlign = 'left';
      ctx.fillStyle = i === 0 ? '#d48806' : '#666';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText((i === 0 ? '🏆 ' : '') + (i + 1) + '. ' + r.name, 60, y);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#333';
      ctx.font = 'bold 34px sans-serif';
      ctx.fillText(r.points + ' 分', W - 60, y);

      ctx.fillStyle = '#999';
      ctx.font = '26px sans-serif';
      ctx.fillText(r.wins + '胜 · 净胜' + (r.net >= 0 ? '+' : '') + r.net, W - 60, y + 34);

      y += 88;
    });

    // 日期
    var d = new Date();
    ctx.fillStyle = '#aaa';
    ctx.font = '26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(), W / 2, H - 40);

    var img = document.createElement('img');
    img.src = canvas.toDataURL('image/png');
    containerEl.innerHTML = '';
    containerEl.appendChild(img);
    return canvas;
  }

  var Share = { rankingText: rankingText, renderRankingImage: renderRankingImage };
  global.BadRot = global.BadRot || {};
  global.BadRot.share = Share;
})(window);
```

- [ ] **Step 2: 在 `js/app.js` 实现结果页逻辑（替换占位的 `renderResultView` + 绑定按钮）**

```js
  function renderResultView() {
    var standings = BadRot.ranking.computeStandings(activity.strong, activity.weak, activity.schedule);
    var finished = BadRot.ranking.isComplete(activity.schedule);
    $('result-title').textContent = finished ? '🏆 积分排名（完赛）' : '📊 当前排名（未完赛）';

    var list = $('standings-list');
    list.innerHTML = '';
    standings.forEach(function (r, i) {
      var li = document.createElement('li');
      if (i === 0 && finished) li.className = 'champion';
      var left = document.createElement('span');
      left.textContent = (i === 0 && finished ? '🏆 ' : '') + (i + 1) + '. ' + r.name;
      var meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = r.points + '分 · ' + r.wins + '胜' + r.played + '场 · 净胜' + (r.net >= 0 ? '+' : '') + r.net;
      li.appendChild(left);
      li.appendChild(meta);
      list.appendChild(li);
    });
    $('share-image-wrap').innerHTML = '';
  }

  function onShareImage() {
    var standings = BadRot.ranking.computeStandings(activity.strong, activity.weak, activity.schedule);
    BadRot.share.renderRankingImage(standings, $('share-image-wrap'));
    toast('图片已生成，长按图片保存或发送到微信群');
  }

  function onCopyText() {
    var standings = BadRot.ranking.computeStandings(activity.strong, activity.weak, activity.schedule);
    var text = BadRot.share.rankingText(standings);
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('排名文字已复制'); }
    catch (e) { toast('复制失败，请手动复制'); }
    document.body.removeChild(ta);
  }

  function onRematch() {
    BadRot.storage.clear();
    activity = null;
    buildNameInputs('strong-inputs', defaultInputs(), 'btn-add-strong');
    buildNameInputs('weak-inputs', defaultInputs(), 'btn-add-weak');
    clearError();
    showView('setup');
  }

  function onReshuffle() {
    activity.schedule = BadRot.rotation.generateSchedule(activity.strong, activity.weak);
    activity.currentIndex = 0;
    BadRot.storage.save(activity);
    renderMatchView();
    showView('match');
  }
```

- [ ] **Step 3: 绑定按钮（`init()` 内追加）**

```js
    $('btn-share-image').addEventListener('click', onShareImage);
    $('btn-copy-text').addEventListener('click', onCopyText);
    $('btn-rematch').addEventListener('click', onRematch);
    $('btn-reshuffle').addEventListener('click', onReshuffle);
```

- [ ] **Step 4: 验证（手动，浏览器）**

浏览器完整走一遍：设置 → 3 场记分 → 结果页排名正确（对照计算）→ 生成排名图（出现图片，标题/行/日期可见）→ 复制文字 → 再来一局回到设置页 → 同名单重新轮转回到第 1 场。中途刷新页面断点恢复。

- [ ] **Step 5: Commit**

```bash
git add js/share.js js/app.js
git commit -m "feat: 结果页排名与分享功能"
```

---

### Task 8: 端到端验收 + README 部署说明

**Files:**
- Create: `README.md`
- Modify: 无

- [ ] **Step 1: 运行全部单测**

Run: `cd ~/badminton-rotation && node tests/rotation.test.js && node tests/ranking.test.js && node tests/storage.test.js`
Expected: 三行 `✓ ... 全部通过`

- [ ] **Step 2: 创建 `README.md`**

```markdown
# 🏸 羽毛球双打轮转

微信打开即用的双打轮转小工具：输入 6 人强/弱名单 → 自动生成 3 场对阵
（每人恰好上场 2 次）→ 记分 → 积分排名 → 生成排名图发微信群。

## 使用

1. 打开页面，强组/弱组各填 2~4 人姓名（共 6 人），组内按实力从强到弱填
2. 点"生成轮转表"，按场次打完记分
3. 3 场打完自动出排名；可"生成排名图"长按保存发群
4. 数据保存在本机，重新打开页面自动恢复；"再来一局"开始新活动

## 部署（CentOS 7，一条命令）

```bash
cd /path/to/badminton-rotation
python3 -m http.server 8080 --bind 0.0.0.0
```

微信（同一网络）访问 `http://<服务器IP>:8080`。本地调试：`python3 -m http.server 8000` 后浏览器打开 `http://localhost:8000`。

## 测试

```bash
node tests/rotation.test.js
node tests/ranking.test.js
node tests/storage.test.js
```

## 说明

- 纯静态页面，无后端；数据存浏览器 localStorage（记录员手机），
  群友查看排名请用"生成排名图"分享
- 支持 3强3弱 / 2强4弱 / 4强2弱 三种人数分布，每人恰好上场 2 场
```

- [ ] **Step 3: 最终手动验收清单（浏览器 + 真机微信）**

- [ ] 设置页：增删姓名、非法输入校验提示正确
- [ ] 3强3弱 / 2强4弱 / 4强2弱 三种分布各走一遍，对阵与算法一致
- [ ] 记分 → 比分校验（相同/超范围）→ 场次推进 → 刷新恢复
- [ ] 提前结束 → 当前排名正确
- [ ] 排名图生成、长按保存、复制文字
- [ ] 真机微信打开：布局正常、按钮可点、输入法不遮挡
- [ ] CentOS 上 `python3 -m http.server` 后手机访问正常

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: 部署说明与验收清单"
```
