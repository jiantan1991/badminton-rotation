# -*- coding: utf-8 -*-
"""羽毛球双打轮转 - 极简后端（静态托管 + 数据接口，零第三方依赖）

用法:
    python3 server.py [端口]     # 默认 8080

目录结构:
    server.py
    static/                      # 前端文件（index.html、css/、js/）
    data/activity.json           # 数据文件（自动创建）

接口:
    GET  /api/activity           # 返回当前活动 JSON（无数据返回 null）
    POST /api/activity           # 保存活动 JSON（body 为活动数据）

部署: 把整个项目（含 static/）上传到服务器后运行即可。
"""
import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

BASE = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE, 'static')
DATA_DIR = os.path.join(BASE, 'data')
DATA_FILE = os.path.join(DATA_DIR, 'activity.json')
ACTIVITIES_DIR = os.path.join(DATA_DIR, 'activities')
MAX_HISTORY = 200


def list_activities():
    """返回历史球局列表（时间倒序），每项 {id, date, matchCount, complete}。"""
    if not os.path.isdir(ACTIVITIES_DIR):
        return []
    items = []
    for name in os.listdir(ACTIVITIES_DIR):
        if not name.endswith('.json'):
            continue
        sid = name[:-len('.json')]
        try:
            with open(os.path.join(ACTIVITIES_DIR, name), encoding='utf-8') as f:
                activity = json.load(f)
        except (ValueError, OSError):
            continue  # 损坏文件跳过
        schedule = activity.get('schedule') or []
        items.append({
            'id': sid,
            'date': sid[:8],
            'matchCount': len(schedule),
            'complete': all(m.get('result') for m in schedule),
        })
    items.sort(key=lambda x: x['id'], reverse=True)
    return items[:MAX_HISTORY]


def archive_activity(activity):
    """存档活动到 ACTIVITIES_DIR，超过 MAX_HISTORY 时淘汰最旧的，返回存档 id。"""
    base = time.strftime('%Y%m%d-%H%M')
    sid = base
    n = 2
    while os.path.exists(os.path.join(ACTIVITIES_DIR, sid + '.json')):
        sid = '%s-%d' % (base, n)
        n += 1
    os.makedirs(ACTIVITIES_DIR, exist_ok=True)
    with open(os.path.join(ACTIVITIES_DIR, sid + '.json'), 'w', encoding='utf-8') as f:
        json.dump(activity, f, ensure_ascii=False)
    # 淘汰：按 id 时间序删除最旧的（同分钟内 -N 后缀需按数字比较，
    # 否则 "-10" 会排到 "-2" 前面，导致刚写入的文件被误删）。
    # 同时保护刚写入的存档：id 复用/排序可能让它排在最前，不能自删。
    def _sort_key(name):
        stem = name[:-len('.json')]
        parts = stem.split('-')
        if len(parts) == 3 and parts[2].isdigit():
            return (parts[0] + '-' + parts[1], int(parts[2]))
        return (stem, 0)

    files = sorted((f for f in os.listdir(ACTIVITIES_DIR) if f.endswith('.json')),
                   key=_sort_key)
    excess = len(files) - MAX_HISTORY
    for name in files:
        if excess <= 0:
            break
        if name == sid + '.json':
            continue
        os.remove(os.path.join(ACTIVITIES_DIR, name))
        excess -= 1
    return sid

CONTENT_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
}


class Handler(BaseHTTPRequestHandler):
    # 允许跨域（微信/其他域名调试时）
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def _send(self, code, body, ctype='application/json'):
        self.send_response(code)
        self.send_header('Content-Type', ctype + '; charset=utf-8')
        self._cors()
        self.end_headers()
        if isinstance(body, str):
            body = body.encode('utf-8')
        if body:
            self.wfile.write(body)

    def do_OPTIONS(self):
        self._send(200, '')

    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/api/activity':
            if os.path.exists(DATA_FILE):
                with open(DATA_FILE, encoding='utf-8') as f:
                    self._send(200, f.read())
            else:
                self._send(200, 'null')
            return
        if path == '/api/activities':
            self._send(200, json.dumps(list_activities(), ensure_ascii=False))
            return
        if path.startswith('/api/activities/'):
            sid = path[len('/api/activities/'):]
            file_path = os.path.join(ACTIVITIES_DIR, sid + '.json')
            if not os.path.isfile(file_path):
                self._send(404, '{"ok":false,"msg":"not found"}')
                return
            with open(file_path, encoding='utf-8') as f:
                self._send(200, f.read())
            return
        # 静态文件
        if path == '/':
            path = '/index.html'
        rel = path.lstrip('/')
        file_path = os.path.normpath(os.path.join(STATIC_DIR, rel))
        if not file_path.startswith(STATIC_DIR) or not os.path.isfile(file_path):
            self._send(404, 'Not Found', 'text/plain')
            return
        ext = os.path.splitext(file_path)[1].lower()
        ctype = CONTENT_TYPES.get(ext, 'application/octet-stream')
        with open(file_path, 'rb') as f:
            self._send(200, f.read(), ctype)

    def do_POST(self):
        if urlparse(self.path).path != '/api/activity':
            # /api/archive 存档接口
            if urlparse(self.path).path == '/api/archive':
                length = int(self.headers.get('Content-Length', 0) or 0)
                body = self.rfile.read(length).decode('utf-8', errors='replace')
                try:
                    activity = json.loads(body)
                except ValueError:
                    self._send(400, '{"ok":false,"msg":"invalid json"}')
                    return
                sid = archive_activity(activity)
                self._send(200, '{"ok":true,"id":"%s"}' % sid)
                return
            self._send(404, 'Not Found', 'text/plain')
            return
        length = int(self.headers.get('Content-Length', 0) or 0)
        body = self.rfile.read(length).decode('utf-8', errors='replace')
        try:
            json.loads(body)  # 校验合法 JSON
        except ValueError:
            self._send(400, '{"ok":false,"msg":"invalid json"}')
            return
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            f.write(body)
        self._send(200, '{"ok":true}')

    def log_message(self, fmt, *args):
        sys.stderr.write('[%s] %s\n' % (self.address_string(), fmt % args))


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    print('羽毛球轮转服务启动: http://0.0.0.0:%d （Ctrl+C 停止）' % port)
    print('数据文件: %s' % DATA_FILE)
    HTTPServer(('0.0.0.0', port), Handler).serve_forever()
