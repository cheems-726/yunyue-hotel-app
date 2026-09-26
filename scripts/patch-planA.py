# -*- coding: utf-8 -*-
# 方案A：① capacitor.config 加 server.url（+断网兜底页） ② version.js 递增 0.47/47
# ③ 版本可见（帮助页常驻） ④ build.py 同步写 src/version.js（根治"界面版本号永远不动"）
import io, json, re

def rep(path, pairs, label=''):
    s = io.open(path, encoding='utf-8', newline='').read()
    okall = True
    for i, (old, new) in enumerate(pairs, 1):
        n = s.count(old)
        print(('  v ' if n == 1 else '  x ') + path + ' 锚点' + str(i) + ' 命中 ' + str(n) + ' 次：' + old.split('\n')[0][:50])
        if n != 1:
            okall = False
            continue
        s = s.replace(old, new)
    if okall:
        io.open(path, 'w', encoding='utf-8', newline='').write(s)
        print('  -> 已写盘 ' + path + (' ' + label if label else ''))
    else:
        print('  -> 未写盘 ' + path)
    return okall

# ── ① capacitor.config.json：APK 改为"加载线上网页的壳" ──
cfg_path = 'capacitor.config.json'
cfg = json.load(io.open(cfg_path, encoding='utf-8'))
cfg['server'] = {
    'url': 'https://www.2026911301.xyz',
    'cleartext': False,
    'errorPath': 'index.html'
}
cfg['android'] = {**cfg.get('android', {}), 'allowMixedContent': False}
io.open(cfg_path, 'w', encoding='utf-8').write(json.dumps(cfg, ensure_ascii=False, indent=2) + '\n')
print('  v capacitor.config.json 已加 server.url=https://www.2026911301.xyz（errorPath=index.html 作断网兜底=内嵌快照）')

# ── ② version.js 递增（0.46 → 0.47） ──
a = rep('src/version.js', [
    ("export const APP_VERSION = '0.46'", "export const APP_VERSION = '0.47'"),
    ('export const APP_VERSION_CODE = 46', 'export const APP_VERSION_CODE = 47'),
])

# ── ③ 版本可见：帮助页「常见操作指引」常驻一行（学生/老师一眼比对） ──
b = rep('src/App.jsx', [
    ("""    { icon: '📝', title: '常见操作指引', body: '改名：我的页 → 点名字旁✏️ → 输入新名字。导出备份：我的页 → 数据备份 → 导出。查看排名：教师端或帮老师查。查看历史：我的页 → 经营操作记录。' },""",
     """    { icon: '📝', title: '常见操作指引', body: `改名：我的页 → 点名字旁✏️ → 输入新名字。导出备份：我的页 → 数据备份 → 导出。查看排名：教师端或帮老师查。查看历史：我的页 → 经营操作记录。\\n\\n当前 App 版本 v${APP_VERSION}（${APP_VERSION_CODE}）——若与老师通知的版本号不一致，说明你用的还是旧版：网页版刷新即可，安卓 App 请找管理员要新版安装包。` },"""),
])

# ── ④ build.py 同步写 src/version.js（根治：以前 gradle 涨、界面不涨） ──
c = rep('build.py', [
    ("""def read_version():""",
     """def write_web_version(vn, vc):
    \"\"\"把版本同步写进前端 src/version.js（🔴 2026-09-22 补：以前只涨 gradle，
    界面显示的 APP_VERSION 一直停在 0.46，导致"版本可见"不可信）\"\"\"
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src", "version.js")
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write("// 由 build.py 自动生成\\n")
        f.write("export const APP_VERSION = '%s'\\n" % vn)
        f.write("export const APP_VERSION_CODE = %d\\n" % vc)
    print("  已同步前端版本号 -> src/version.js (%s / %s)" % (vn, vc))


def read_version():"""),
])

print('\n结果：capacitor=OK version=' + str(a) + ' 帮助页版本可见=' + str(b) + ' build.py同步=' + str(c))
