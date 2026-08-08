# -*- coding: utf-8 -*-
"""把多文件版合并为单文件 badminton-single.html（保留多文件版不动）。
用法: python build_single.py
"""
import pathlib

ROOT = pathlib.Path(__file__).parent

def main():
    html = (ROOT / 'index.html').read_text(encoding='utf-8')

    # 1) 内联 CSS
    css = (ROOT / 'css' / 'style.css').read_text(encoding='utf-8')
    assert '<link rel="stylesheet" href="css/style.css">' in html
    html = html.replace(
        '<link rel="stylesheet" href="css/style.css">',
        '<style>\n' + css + '\n</style>'
    )

    # 2) 内联 JS（保持加载顺序：cloud → rotation → ranking → storage → share → app）
    for name in ['cloud', 'rotation', 'ranking', 'storage', 'share', 'app']:
        js = (ROOT / 'js' / (name + '.js')).read_text(encoding='utf-8')
        tag = '<script src="js/%s.js"></script>' % name
        assert tag in html, '缺少 %s 的引用' % tag
        html = html.replace(tag, '<script>\n' + js + '\n</script>')

    # 3) 校验：不应再有外部引用
    assert 'src="js/' not in html and 'href="css/' not in html

    out = ROOT / 'badminton-single.html'
    out.write_text(html, encoding='utf-8')
    print('OK: 生成 %s (%d 字节)' % (out.name, out.stat().st_size))

if __name__ == '__main__':
    main()
