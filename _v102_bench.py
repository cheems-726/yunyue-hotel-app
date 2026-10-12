#!/usr/bin/env python3
# V102 T4：真实 API 并发复核（真实 JWT + 读写混合）
# 用法: python3 v102_bench.py <BASE> <workers> <reqs_per_worker>
import sys, json, time, base64, threading, urllib.request, urllib.error, urllib.parse, statistics

BASE = sys.argv[1].rstrip('/')
W = int(sys.argv[2]) if len(sys.argv) > 2 else 6
R = int(sys.argv[3]) if len(sys.argv) > 3 else 100
ANON = sys.argv[4] if len(sys.argv) > 4 else ''
EMAIL = '20240102@yunyue.study'
PW = 'test123456'


def req(method, path, body=None, token=None, extra=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    h = {'apikey': ANON, 'Content-Type': 'application/json'}
    if token:
        h['Authorization'] = 'Bearer ' + token
    if extra:
        h.update(extra)
    r = urllib.request.Request(url, data=data, headers=h, method=method)
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            resp.read()
            return (time.perf_counter() - t0) * 1000, resp.status, None
    except urllib.error.HTTPError as e:
        try:
            e.read()
        except Exception:
            pass
        return (time.perf_counter() - t0) * 1000, e.code, 'HTTP'
    except Exception as e:
        return (time.perf_counter() - t0) * 1000, 0, type(e).__name__


# 登录拿 token
_, st, _ = req('GET', '/auth/v1/health')
print('health:', st)
d = json.loads(urllib.request.urlopen(urllib.request.Request(
    BASE + '/auth/v1/token?grant_type=password', method='POST',
    data=json.dumps({'email': EMAIL, 'password': PW}).encode(),
    headers={'Content-Type': 'application/json', 'apikey': ANON})).read())
TOKEN = d['access_token']
SUB = json.loads(base64.urlsafe_b64decode(TOKEN.split('.')[1] + '=='))['sub']
print('login ok, sub =', SUB)

lat = []
locks = threading.Lock()
codes = {}
GK = '酒管2401|2'   # 目标组档（本组学生的组）


def worker(wid):
    local = []
    for i in range(R):
        k = i % 10
        if k < 7:      # 70% 读自己的组档
            ms, c, e = req('GET', '/rest/v1/game_states?select=user_id,week&group_key=eq.' + urllib.parse.quote(GK), token=TOKEN)
        elif k < 9:    # 20% RPC
            ms, c, e = req('POST', '/rest/v1/rpc/class_day_now', body={}, token=TOKEN)
        else:          # 10% 写 decision_log
            ms, c, e = req('POST', '/rest/v1/decision_log', body={
                'user_id': SUB, 'group_key': GK, 'week': 1, 'decision_id': f'bench-{wid}-{i}',
                'answer': '压测', 'feedback': '压测行'}, token=TOKEN, extra={'Prefer': 'return=minimal'})
        local.append((ms, c, e))
    with locks:
        lat.extend(local)



t0 = time.time()
ths = [threading.Thread(target=worker, args=(w,)) for w in range(W)]
for t in ths:
    t.start()
for t in ths:
    t.join()
wall = (time.time() - t0) * 1000

ms_list = sorted(x[0] for x in lat)
ok = [x for x in lat if 200 <= x[1] < 300]
fail = [x for x in lat if not (200 <= x[1] < 300)]
def p(q):
    return ms_list[min(len(ms_list) - 1, int(len(ms_list) * q))]
print(f'总请求={len(lat)} 成功={len(ok)} 失败={len(fail)} 并发={W}')
print(f'墙钟={wall:.0f}ms 吞吐={len(lat)/(wall/1000):.1f} req/s')
print(f'p50={p(0.50):.1f}ms p90={p(0.90):.1f}ms p95={p(0.95):.1f}ms p99={p(0.99):.1f}ms max={ms_list[-1]:.1f}ms mean={statistics.mean(ms_list):.1f}ms')
if fail:
    from collections import Counter
    print('失败码分布:', Counter((x[1], x[2]) for x in fail).most_common(5))
