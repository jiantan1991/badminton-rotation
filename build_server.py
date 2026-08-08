# -*- coding: utf-8 -*-
"""部署准备：把前端文件复制到 server/static/（部署到云服务器时上传 server/ 目录即可）
用法: python build_server.py
"""
import pathlib
import shutil

ROOT = pathlib.Path(__file__).parent
SRC = ROOT
DST = ROOT / 'server' / 'static'

# 清理旧目录
if DST.exists():
    shutil.rmtree(DST)
DST.mkdir(parents=True)

# 复制前端文件（index.html、css/、js/，不含 vendor 与单文件）
shutil.copy2(SRC / 'index.html', DST / 'index.html')
shutil.copytree(SRC / 'css', DST / 'css')
shutil.copytree(SRC / 'js', DST / 'js')

# 移除 vendor（自家后端模式不需要 CloudBase SDK）
vendor = DST / 'js' / 'vendor'
if vendor.exists():
    shutil.rmtree(vendor)

print('OK: 前端已复制到 server/static/')
print('部署：把 server/ 目录上传到云服务器，运行 python3 server.py 8080')
