#!/usr/bin/env python3
"""briar-youzan-ai-profile-push：给指定导购推一客一策的一体化脚本。

把 SKILL.md 手动步骤里的「导购解析 / 选客户 / 生成画像话术 / 轮询 / 校验 / 重置」固化成子命令，
例行造数只需要 run 一条命令（轻校验：生成后对比 listTodayPendingCustomers 的 pendingCount）。

导购标识任意给：--guide 支持 userId / 手机号 / 导购表主键 dbId，自动识别
（手机号命中 uic；其余先按 userId 查 getShoppingGuide，查不到再按 dbId 全量扫 listPaged）。
识别不准时用 --guideKind userId|mobile|dbId 显式指定。

依赖 zan-dubbo-invoke 的 dubbo_query.py（复用其 funeng 登录态与 Tether 网关）：
  export ZAN_DUBBO_INVOKE_SKILL_DIR=~/.kimi-code/user-skills/zan-dubbo-invoke   # 默认值，通常不用设

用法：
  python3 ai_profile_push.py run      --env pre --rootKdtId 136579309 --guide 538008751 -n 5
  python3 ai_profile_push.py run      --env pre --rootKdtId 136579309 --guide 18989487289        # 手机号也行
  python3 ai_profile_push.py run      --env pre --rootKdtId 136579309 --guide 538008751 \
      --customers 24097816852,阿蓝     # 指定客户（userId 或昵称，逗号分隔），跳过自动选客户
  python3 ai_profile_push.py resolve  --env pre --rootKdtId 136579309 --guide 100482502          # dbId 解析
  python3 ai_profile_push.py pool     --env pre --rootKdtId 136579309 --guide 538008751
  python3 ai_profile_push.py pending  --env pre --rootKdtId 136579309 --guide 538008751
  python3 ai_profile_push.py generate --env pre --rootKdtId 136579309 --customerId 23730487799
  python3 ai_profile_push.py reset    --env pre --rootKdtId 136579309 --guide 538008751 --customerId 23730487799

写操作（run/generate/reset）：QA 走 Tether 无限制；pre 复用 funeng 登录态直调 Ticket API。禁止 prod。

关键口径（详见 SKILL.md）：
- 一客一策客户按 adminId=guideId 归属；appendCustomer 只改池内 adminId，不建 CRM 归属，
  pool 候选不足时自动从导购的 CRM 专属客户补充（getShoppingGuide 拿 kdtId → listCustomersPaged）。
- 判断「是否今天」用 reachTime；V2 listCustomers 返回的 operateTime 恒为 null。
- reGenState：1=生成中，0=完成，4=画像待重试，3=话术待重试。
- 生成完成 ≠ 立刻进队列：reGenState 归 0 后 listTodayPendingCustomers 读侧有 30s~1min 传播延迟。
- LLM 判定不稳定：operateType=2 / reachTime 陈旧的客户重跑生成可能翻转，run 默认自动重试 2 轮（--rounds）。
- pool 里可能挂着导购自己的账号（userId == guideId），选客户时必须排除。
"""

import argparse
import datetime
import functools
import importlib.util
import json
import os
import re
import sys
import time

print = functools.partial(print, flush=True)  # 后台重定向时实时输出进度

BRAIN_PREFIX = 'com.youzan.scrm.ai.brain.api.service.'
CUS_SERVICE = BRAIN_PREFIX + 'cusoperator.CusServiceV2'
SCENE_SERVICE = BRAIN_PREFIX + 'platform.CusOperatorSceneConfigPlatformService'
PROMOTION_PREFIX = 'com.youzan.guide.promotion.api.service.'
PENDING_SERVICE = PROMOTION_PREFIX + 'ai.profile.GuideAiProfileReadApiService'
TEST_SERVICE = PROMOTION_PREFIX + 'test.TestService'
GUIDE_SERVICE = 'com.youzan.guide.api.service.shoppingguide.ShoppingGuideReadApiService'
CUSTOMER_SERVICE = 'com.youzan.guide.front.api.service.customer.CustomerReadApiService'
UIC_BATCH_SERVICE = 'com.youzan.uic.api.userBatch.service.UserBatchService'

APP_BRAIN = 'scrm-ai-brain'
APP_PROMOTION = 'guide-promotion'

GEN_POLL_TIMEOUT = 300      # 画像+话术异步生成，实测约 40s~2.5min/条
GEN_POLL_INTERVAL = 15
SYNC_POLL_TIMEOUT = 120     # guide-promotion 读侧传播延迟 30s~1min
SYNC_POLL_INTERVAL = 15
DUBBO_RETRIES = 2           # Ticket API 偶发抖动，重试两次
DBID_SCAN_MAX_PAGES = 10


def load_dq():
    skill_dir = os.environ.get(
        'ZAN_DUBBO_INVOKE_SKILL_DIR',
        os.path.expanduser('~/.kimi-code/user-skills/zan-dubbo-invoke'),
    )
    path = os.path.join(skill_dir, 'scripts', 'dubbo_query.py')
    spec = importlib.util.spec_from_file_location('dq', path)
    dq = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(dq)
    return dq


DQ = load_dq()


def dubbo_call(service, method, args, env, app=None):
    """qa 走 Tether（免认证），pre 走 Ticket（funeng 登录态）；模块级调用不经 CLI 的只读白名单。"""
    if env not in ('qa', 'pre'):
        raise SystemExit('仅支持 qa/pre；prod 禁止')
    last = None
    for attempt in range(DUBBO_RETRIES + 1):
        try:
            if env == 'qa':
                return DQ.invoke_via_tether(service, method, args, 'qa')
            req = DQ.build_dubbo_request(
                app=app or DQ.extract_app_from_service(service),
                service=service, method=method, args=args,
                env=env, timeout=20000, retries=0,
            )
            return DQ.invoke_dubbo_service(req, DQ.get_cookies_from_funeng())
        except Exception as e:  # 网络/登录态抖动，重试
            last = e
            if attempt < DUBBO_RETRIES:
                time.sleep(2)
    raise last


def unwrap(result):
    """Ticket/Tether 响应剥掉 code/msg/data 包装（可能嵌套两层），取业务数据节点。"""
    data = result
    for _ in range(3):
        if not isinstance(data, dict):
            break
        inner = data.get('data', data.get('result'))
        if isinstance(inner, (dict, list)):
            data = inner
        else:
            break
    return data


def find_list(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ('list', 'items', 'records', 'content', 'data', 'customerList'):
            if isinstance(data.get(key), list):
                return data[key]
    return []


def today_str():
    return datetime.date.today().isoformat()


def reach_date(reach_time):
    """reachTime 可能是 'yyyy-MM-dd HH:mm:ss' 字符串或毫秒时间戳，返回日期字符串或 None。"""
    if reach_time is None:
        return None
    if isinstance(reach_time, (int, float)):
        return datetime.datetime.fromtimestamp(reach_time / 1000).date().isoformat()
    return str(reach_time)[:10]


# ---------- 导购解析：userId / 手机号 / 导购表主键 dbId ----------

def norm_guide(raw):
    return {
        'userId': str(raw.get('userId')) if raw.get('userId') is not None else None,
        'kdtId': raw.get('kdtId'),
        'nickname': raw.get('nickname'),
        'mobile': raw.get('mobile'),
        'status': raw.get('status'),
        'guideType': raw.get('guideType'),
        'belongToQw': raw.get('belongToQw'),
        'rootKdtId': raw.get('rootKdtId'),
        'qwKdtId': raw.get('qwKdtId'),
        'departmentId': raw.get('departmentId'),
        'staffId': raw.get('staffId'),
    }


def get_guide(env, root_kdt_id, user_id):
    """按 userId 查导购档案；不存在返回 None。status=1 正常、guideType=1 付费、belongToQw=1 企微绑定。"""
    data = unwrap(dubbo_call(
        GUIDE_SERVICE, 'getShoppingGuide',
        [{'rootKdtId': root_kdt_id, 'guideId': int(user_id)}], env,
    ))
    if isinstance(data, dict) and data.get('userId') is not None:
        return norm_guide(data)
    return None


def user_id_by_mobile(env, mobile):
    data = unwrap(dubbo_call(
        UIC_BATCH_SERVICE, 'getMobileUserInfoListByMobileList',
        [{'mobileList': [mobile], 'appName': 'guide'}], env,
    ))
    for item in find_list(data):
        if isinstance(item, dict) and str(item.get('mobile')) == mobile and item.get('userId'):
            return str(item['userId'])
    return None


def user_id_by_dbid(env, root_kdt_id, db_id):
    """导购表主键 dbId → userId：listPaged 全量分页扫 basicInfo.dbId（无直接按 dbId 查的接口）。"""
    for page in range(1, DBID_SCAN_MAX_PAGES + 1):
        data = unwrap(dubbo_call(
            GUIDE_SERVICE, 'listPaged',
            [{'rootKdtId': root_kdt_id, 'pageDTO': {'page': page, 'pageSize': 100}}], env,
        ))
        items = find_list(data)
        for item in items:
            basic = (item or {}).get('basicInfo') or {}
            if str(basic.get('dbId')) == str(db_id) and basic.get('userId') is not None:
                return str(basic['userId'])
        if isinstance(data, dict) and not data.get('hasNext'):
            break
        if not items:
            break
    return None


def resolve_guide(env, root_kdt_id, guide, guide_kind='auto'):
    """任意标识 → 导购档案。auto：手机号格式走 uic；其余先 userId 后 dbId。"""
    s = str(guide).strip()
    kind = guide_kind
    if kind == 'auto':
        kind = 'mobile' if re.fullmatch(r'1\d{10}', s) else 'userId'
    info = None
    if kind == 'mobile':
        uid = user_id_by_mobile(env, s)
        if uid:
            info = get_guide(env, root_kdt_id, uid)
        if not info:
            raise SystemExit(f'手机号 {s} 在 {env} 查不到账号，或该账号不是总部 {root_kdt_id} 下的导购')
    elif kind == 'dbId':
        uid = user_id_by_dbid(env, root_kdt_id, s)
        if uid:
            info = get_guide(env, root_kdt_id, uid)
        if not info:
            raise SystemExit(f'导购表主键 dbId={s} 在总部 {root_kdt_id} 下查不到（扫了 {DBID_SCAN_MAX_PAGES} 页）')
    else:
        info = get_guide(env, root_kdt_id, s)
        if not info and guide_kind == 'auto':
            uid = user_id_by_dbid(env, root_kdt_id, s)
            if uid:
                print(f'按 userId 查不到，命中导购表主键 dbId={s} → userId={uid}')
                info = get_guide(env, root_kdt_id, uid)
        if not info:
            raise SystemExit(f'导购 {s}（按 userId/dbId 都试过）在总部 {root_kdt_id} 下不存在或已清退')
    if info['status'] != 1:
        raise SystemExit(f"导购 {info['nickname'] or info['userId']} status={info['status']}（0=清退 99=停用），不能推")
    if info['guideType'] != 1:
        print(f"WARN 导购 guideType={info['guideType']}（1=付费导购），一客一策可能不下发")
    if info['belongToQw'] != 1:
        print('WARN 导购未绑定企微（belongToQw!=1），企微通知卡不会发')
    return info


def need_guide(a):
    if not getattr(a, 'guide', None):
        raise SystemExit('缺少 --guide（userId / 手机号 / 导购表主键 dbId 均可）')
    return resolve_guide(a.env, a.rootKdtId, a.guide, a.guideKind)


# ---------- 一客一策 pool / 今日队列 ----------

def list_pool(env, root_kdt_id, guide_id):
    """池内客户（adminId=guideId），自动翻页。"""
    pool = []
    page = 1
    while True:
        data = unwrap(dubbo_call(
            CUS_SERVICE, 'listCustomers',
            [{'kdtId': root_kdt_id, 'adminId': int(guide_id), 'pageNum': page, 'pageSize': 50}],
            env, APP_BRAIN,
        ))
        items = find_list(data)
        for item in items:
            if not isinstance(item, dict):
                continue
            uid = item.get('userId')
            if uid is None:
                continue
            pool.append({
                'userId': str(uid),
                'nickName': item.get('nickName') or item.get('customerNickname'),
                'operateType': item.get('operateType'),
                'reGenState': item.get('reGenState'),
                'reachTime': item.get('reachTime'),
                'reachToday': reach_date(item.get('reachTime')) == today_str(),
                'hasReachMessage': bool(item.get('reachMessage')),
            })
        if len(items) < 50:
            break
        page += 1
    return pool


def list_pending(env, root_kdt_id, guide_id):
    data = unwrap(dubbo_call(
        PENDING_SERVICE, 'listTodayPendingCustomers',
        [{'rootKdtId': root_kdt_id, 'guideId': int(guide_id)}],
        env, APP_PROMOTION,
    ))
    items = find_list(data)
    count = data.get('pendingCount') if isinstance(data, dict) else None
    if count is None:
        count = len(items)
    customers = []
    for item in items:
        if not isinstance(item, dict):
            continue
        uid = item.get('userId') or item.get('customerId')
        customers.append({
            'userId': str(uid) if uid is not None else None,
            'nickName': item.get('nickName') or item.get('customerNickname'),
            'hasReachMessage': bool(item.get('reachMessage')),
        })
    return count, [c for c in customers if c['userId']]


def pick_from_pool(pool, occupied, guide_id, n, exclude=frozenset()):
    """排除今日队列已占用、导购自己与 --exclude 指定客户；reachTime 不在今天的优先，其中 operateType=1（曾被判需触达）的优先。"""
    candidates = [
        c for c in pool
        if c['userId'] not in occupied and c['userId'] != str(guide_id) and c['userId'] not in exclude
    ]
    candidates.sort(key=lambda c: (c['reachToday'], c['operateType'] != 1, str(c['reachTime'] or '')))
    return candidates[:n]


def list_crm_customers(env, kdt_id, guide_id):
    """导购的 CRM 专属客户（belongGuideInfo.guideUserId == guideId）。pool 空时的候选来源：
    appendCustomer 会把它们挂进池子，有 CRM 归属才能进今日队列。"""
    data = unwrap(dubbo_call(
        CUSTOMER_SERVICE, 'listCustomersPaged',
        [{
            'operator': {'operatorKdtId': int(kdt_id), 'operatorId': int(guide_id)},
            'formSence': 2,
            'kdtId': int(kdt_id),
            'guideUserIds': [int(guide_id)],
            'page': 1,
            'pageSize': 50,
        }],
        env,
    ))
    customers = []
    for item in find_list(data):
        if not isinstance(item, dict):
            continue
        uid = item.get('userId') or item.get('customerId') or item.get('yzUid')
        belong = (item.get('belongGuideInfo') or {}).get('guideUserId')
        if not uid or (belong and str(belong) != str(guide_id)):
            continue
        customers.append({
            'userId': str(uid),
            'nickName': item.get('nickName') or item.get('name'),
            'operateType': None,
            'reGenState': None,
            'reachTime': None,
            'reachToday': False,
            'hasReachMessage': False,
        })
    return customers


def resolve_customers(env, root_kdt_id, kdt_id, guide_id, raw, pool=None):
    """--customers 指定的客户标识（逗号分隔）→ pool 元素同构 dict 列表。
    纯数字按 userId；其余按 nickName 在 pool（listCustomers）与 CRM 专属客户里精确匹配。
    匹配不到/昵称多命中的逐个 WARN 跳过；全部落空则退出。CRM 查询惰性：pool 能命中就不调。"""
    pool = pool if pool is not None else list_pool(env, root_kdt_id, guide_id)
    crm = None

    def crm_list():
        nonlocal crm
        if crm is None:
            crm = list_crm_customers(env, kdt_id, guide_id)
        return crm

    picked = []
    seen = set()
    for token in [s.strip() for s in raw.split(',') if s.strip()]:
        hit = None
        if token.isdigit():
            hit = next((c for c in pool if c['userId'] == token), None)
            if hit is None:
                hit = next((c for c in crm_list() if c['userId'] == token), None)
            if hit is None:
                hit = {
                    'userId': token, 'nickName': None, 'operateType': None,
                    'reGenState': None, 'reachTime': None, 'reachToday': False,
                    'hasReachMessage': False,
                }
                print(f'WARN userId={token} 不在 pool/CRM 专属客户里，appendCustomer 会新挂入池（无 CRM 归属进不了今日队列，见 SKILL.md 步骤 1B）')
        else:
            matches = [c for c in pool if c.get('nickName') == token]
            if not matches:
                matches = [c for c in crm_list() if c.get('nickName') == token]
            if len(matches) > 1:
                print(f'WARN 昵称 "{token}" 命中 {len(matches)} 个客户（userId: {[c["userId"] for c in matches]}），跳过——请改用 userId 消歧')
                continue
            hit = matches[0] if matches else None
        if hit is None:
            print(f'WARN "{token}" 在 pool 与 CRM 专属客户里都查不到，跳过（用 pool 子命令核对昵称）')
            continue
        if hit['userId'] in seen:
            print(f"WARN userId={hit['userId']} 重复指定，跳过一次")
            continue
        seen.add(hit['userId'])
        picked.append(hit)
    if not picked:
        raise SystemExit('--customers 全部未匹配，收工（用 pool 子命令核对 userId/昵称）')
    return picked


def append_customer(env, root_kdt_id, guide_id, customer_id):
    return unwrap(dubbo_call(
        CUS_SERVICE, 'appendCustomer',
        [{'kdtId': root_kdt_id, 'userId': int(customer_id), 'adminId': int(guide_id),
          'generateImmediately': True, 'sourceScene': 'AI_PROFILE_PUSH_TEST'}],
        env, APP_BRAIN,
    ))


def wait_generated(env, root_kdt_id, guide_id, user_ids):
    """轮询 pool 直到这些客户 reGenState 归 0（或 3/4 待重试），返回 {userId: 状态行|None}。"""
    deadline = time.time() + GEN_POLL_TIMEOUT
    pending = set(user_ids)
    final = {}
    while pending and time.time() < deadline:
        time.sleep(GEN_POLL_INTERVAL)
        pool = {c['userId']: c for c in list_pool(env, root_kdt_id, guide_id)}
        for uid in list(pending):
            state = pool.get(uid, {}).get('reGenState')
            if state is not None and state != 1:
                final[uid] = pool[uid]
                pending.discard(uid)
        if pending:
            print(f'  生成中… 剩余 {len(pending)} 个（{int(deadline - time.time())}s 超时）')
    for uid in pending:
        final[uid] = None
    return final


def judge(uid, state):
    """生成后的客户状态 → (是否进今日队列, 原因)。"""
    if state is None:
        return False, f'{GEN_POLL_TIMEOUT}s 内 reGenState 未归 0'
    if state['reGenState'] in (3, 4):
        return False, f"reGenState={state['reGenState']}（{'话术' if state['reGenState'] == 3 else '画像'}待重试）"
    if state['operateType'] == 2:
        return False, 'operateType=2（LLM 判本轮无需触达）'
    if not state['reachToday']:
        return False, f"reachTime={state['reachTime']} 不在今天（排期未刷新/傍晚生成会排次日 10:00）"
    return True, None


# ---------- 子命令 ----------

def cmd_resolve(a):
    guide = need_guide(a)
    print(json.dumps(guide, ensure_ascii=False))


def cmd_pool(a):
    guide = need_guide(a)
    pool = list_pool(a.env, a.rootKdtId, guide['userId'])
    print(f"导购 {guide['nickname'] or guide['userId']} pool {len(pool)} 个客户：")
    for c in pool:
        print(json.dumps(c, ensure_ascii=False))


def cmd_pending(a):
    guide = need_guide(a)
    count, customers = list_pending(a.env, a.rootKdtId, guide['userId'])
    print(f"导购 {guide['nickname'] or guide['userId']} pendingCount={count}")
    for c in customers:
        print(json.dumps(c, ensure_ascii=False))


def cmd_run(a):
    guide = need_guide(a)
    guide_id = guide['userId']
    print(f"导购：{json.dumps(guide, ensure_ascii=False)}")

    before_count, before = list_pending(a.env, a.rootKdtId, guide_id)
    occupied = {c['userId'] for c in before}
    print(f'推前 pendingCount={before_count}，今日队列已占用 {len(occupied)} 个客户')

    pool = list_pool(a.env, a.rootKdtId, guide_id)
    exclude = {s.strip() for s in (a.exclude or '').split(',') if s.strip()}
    if a.customers:
        picked = resolve_customers(a.env, a.rootKdtId, guide['kdtId'], guide_id, a.customers, pool)
        for c in picked:
            if c['userId'] in occupied:
                print(f"WARN userId={c['userId']} 已在今日队列里，appendCustomer 会触发重新生成（LLM 判定可能翻转）")
            if c['userId'] == str(guide_id):
                print(f'WARN userId={c["userId"]} 是导购自己的账号，不建议推')
    else:
        picked = pick_from_pool(pool, occupied, guide_id, a.n, exclude)
        if len(picked) < a.n:
            print(f'pool 只选到 {len(picked)}/{a.n} 个（pool 共 {len(pool)} 个），从 CRM 专属客户补充…')
            skip = occupied | {c['userId'] for c in picked} | {str(guide_id)} | exclude
            for c in list_crm_customers(a.env, guide['kdtId'], guide_id):
                if len(picked) >= a.n:
                    break
                if c['userId'] not in skip:
                    picked.append(c)
            print(f'CRM 补充后共 {len(picked)}/{a.n} 个候选')
    if not picked:
        raise SystemExit('没有可用客户，收工（pool 空且 CRM 无专属客户）')
    for c in picked:
        print(f"pick userId={c['userId']} nickName={c['nickName']} reachTime={c['reachTime']}")

    for c in picked:
        result = append_customer(a.env, a.rootKdtId, guide_id, c['userId'])
        print(f"appendCustomer userId={c['userId']} -> {json.dumps(result, ensure_ascii=False)[:120]}")

    ok_uids = []
    remaining = [c['userId'] for c in picked]
    for round_i in range(a.rounds):
        if round_i > 0:
            print(f'第 {round_i + 1} 轮：{len(remaining)} 个未就绪客户重新生成（LLM 判定不稳定，重跑可能翻转）…')
            for uid in remaining:
                append_customer(a.env, a.rootKdtId, guide_id, uid)
        print(f'等待异步生成（画像→话术，最长 {GEN_POLL_TIMEOUT}s）…')
        final = wait_generated(a.env, a.rootKdtId, guide_id, remaining)
        still = []
        for uid in remaining:
            ok, reason = judge(uid, final.get(uid))
            if ok:
                ok_uids.append(uid)
                print(f"done userId={uid} {json.dumps(final[uid], ensure_ascii=False)[:200]}")
            else:
                still.append(uid)
                print(f'WARN userId={uid} 不进今日队列：{reason}')
        remaining = still
        if not remaining:
            break

    if not ok_uids:
        raise SystemExit(f'{a.rounds} 轮后仍没有客户满足进队列条件，收工（可 pool 看状态后 generate 单点重试）')

    # 读侧传播延迟 30s~1min，短轮询等 pendingCount 涨上来
    deadline = time.time() + SYNC_POLL_TIMEOUT
    after_count, after = before_count, before
    while time.time() < deadline:
        time.sleep(SYNC_POLL_INTERVAL)
        after_count, after = list_pending(a.env, a.rootKdtId, guide_id)
        if after_count >= before_count + len(ok_uids):
            break
    new_customers = [c for c in after if c['userId'] in set(ok_uids)]
    print(f'推后 pendingCount={after_count}（+{after_count - before_count}），确认进队列 {len(new_customers)}/{len(ok_uids)}：')
    for c in new_customers:
        print(json.dumps(c, ensure_ascii=False))
    if len(new_customers) < len(ok_uids):
        print(f'HINT {len(ok_uids) - len(new_customers)} 个 {SYNC_POLL_TIMEOUT}s 内未确认：'
              '多数是传播延迟，等 1 分钟 pending 复验；仍没有再按 SKILL.md 排查表处理')


def cmd_generate(a):
    """单客户试跑生成（画像→话术），返回 taskNo，各约 40s；用 pool 子命令跟 reGenState。"""
    if not a.customerId:
        raise SystemExit('缺少 --customerId')
    for scene_type, name in [(1, '画像'), (2, '话术')]:
        result = unwrap(dubbo_call(
            SCENE_SERVICE, 'mockGenerate',
            [{'kdtId': a.rootKdtId, 'userId': a.customerId, 'sceneType': scene_type}],
            a.env, APP_BRAIN,
        ))
        print(f'mockGenerate sceneType={scene_type}（{name}）-> {json.dumps(result, ensure_ascii=False)[:150]}')


def cmd_reset(a):
    guide = need_guide(a)
    if not a.customerId:
        raise SystemExit('缺少 --customerId')
    result = unwrap(dubbo_call(
        TEST_SERVICE, 'deleteGuideAiProfileReachRecord',
        [a.rootKdtId, int(guide['userId']), a.customerId], a.env, APP_PROMOTION,
    ))
    print(f'删除触达记录 {result} 行，客户立刻回到今日待触达队列')


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest='cmd', required=True)
    for name, fn in [('run', cmd_run), ('resolve', cmd_resolve), ('pool', cmd_pool),
                     ('pending', cmd_pending), ('generate', cmd_generate), ('reset', cmd_reset)]:
        sp = sub.add_parser(name)
        sp.add_argument('--env', choices=['qa', 'pre'], required=True)
        sp.add_argument('--rootKdtId', type=int, required=True)
        sp.add_argument('--guide', help='导购标识：userId / 手机号 / 导购表主键 dbId')
        sp.add_argument('--guideKind', choices=['auto', 'userId', 'mobile', 'dbId'], default='auto')
        sp.add_argument('-n', type=int, default=2)
        sp.add_argument('--rounds', type=int, default=2, help='未就绪客户自动重生成的轮数（默认 2）')
        sp.add_argument('--exclude', help='逗号分隔的客户 userId，选客户时跳过（用于排除多轮排明日 10:00 的钉子户）')
        sp.add_argument('--customerId', type=int)
        sp.add_argument('--customers', help='逗号分隔的客户标识：userId 或昵称（昵称按 pool/CRM 专属客户精确匹配）；指定后跳过自动选客户，-n 失效')
        sp.set_defaults(fn=fn)
    args = p.parse_args()
    args.fn(args)


if __name__ == '__main__':
    main()
