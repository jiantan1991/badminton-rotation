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
