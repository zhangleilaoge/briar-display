#!/usr/bin/env python3
"""briar-youzan-ai-profile-push：给指定导购推一客一策的一体化脚本。

把 SKILL.md 手动步骤里的「选客户 / 生成画像话术 / 轮询 / 校验 / 重置」固化成子命令，
例行造数只需要 run 一条命令（轻校验：生成后对比 listTodayPendingCustomers 的 pendingCount）。

依赖 zan-dubbo-invoke 的 dubbo_query.py（复用其 funeng 登录态与 Tether 网关）：
  export ZAN_DUBBO_INVOKE_SKILL_DIR=~/.kimi-code/user-skills/zan-dubbo-invoke   # 默认值，通常不用设

用法：
  python3 ai_profile_push.py run      --env pre --rootKdtId 136579309 --guideId 10319972620 -n 2
  python3 ai_profile_push.py pool     --env pre --rootKdtId 136579309 --guideId 10319972620
  python3 ai_profile_push.py pending  --env pre --rootKdtId 136579309 --guideId 10319972620
  python3 ai_profile_push.py generate --env pre --rootKdtId 136579309 --customerId 23730487799
  python3 ai_profile_push.py reset    --env pre --rootKdtId 136579309 --guideId 10319972620 --customerId 23730487799

写操作（run/generate/reset）：QA 走 Tether 无限制；pre 复用 funeng 登录态直调 Ticket API。禁止 prod。

关键口径（详见 SKILL.md）：
- 一客一策客户按 adminId=guideId 归属；appendCustomer 只改池内 adminId，不建 CRM 归属，
  所以选客户只能从 pool（listCustomers adminId=guideId 查到的）里挑。
- 判断「是否今天」用 reachTime；V2 listCustomers 返回的 operateTime 恒为 null。
- reGenState：1=生成中，0=完成，4=画像待重试，3=话术待重试。
- 生成完成 ≠ 立刻进队列：reGenState 归 0 后 listTodayPendingCustomers 读侧有 30s~1min 传播延迟。
- pool 里可能挂着导购自己的账号（userId == guideId），选客户时必须排除。
"""

import argparse
import datetime
import importlib.util
import json
import os
import sys
import time

BRAIN_PREFIX = 'com.youzan.scrm.ai.brain.api.service.'
CUS_SERVICE = BRAIN_PREFIX + 'cusoperator.CusServiceV2'
SCENE_SERVICE = BRAIN_PREFIX + 'platform.CusOperatorSceneConfigPlatformService'
PROMOTION_PREFIX = 'com.youzan.guide.promotion.api.service.'
PENDING_SERVICE = PROMOTION_PREFIX + 'ai.profile.GuideAiProfileReadApiService'
TEST_SERVICE = PROMOTION_PREFIX + 'test.TestService'

APP_BRAIN = 'scrm-ai-brain'
APP_PROMOTION = 'guide-promotion'

GEN_POLL_TIMEOUT = 300      # 画像+话术异步生成，实测约 40s~2.5min/条
GEN_POLL_INTERVAL = 15
SYNC_POLL_TIMEOUT = 120     # guide-promotion 读侧传播延迟 30s~1min
SYNC_POLL_INTERVAL = 15


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


def dubbo_call(service, method, args, env, app):
    """qa 走 Tether（免认证），pre 走 Ticket（funeng 登录态）；模块级调用不经 CLI 的只读白名单。"""
    if env == 'qa':
        return DQ.invoke_via_tether(service, method, args, 'qa')
    if env != 'pre':
        raise SystemExit('仅支持 qa/pre；prod 禁止')
    req = DQ.build_dubbo_request(
        app=app, service=service, method=method, args=args,
        env=env, timeout=20000, retries=0,
    )
    return DQ.invoke_dubbo_service(req, DQ.get_cookies_from_funeng())


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


def list_pool(env, root_kdt_id, guide_id):
    data = unwrap(dubbo_call(
        CUS_SERVICE, 'listCustomers',
        [{'kdtId': root_kdt_id, 'adminId': guide_id, 'pageNum': 1, 'pageSize': 50}],
        env, APP_BRAIN,
    ))
    pool = []
    for item in find_list(data):
        if not isinstance(item, dict):
            continue
        uid = item.get('userId')
        pool.append({
            'userId': str(uid) if uid is not None else None,
            'nickName': item.get('nickName') or item.get('customerNickname'),
            'operateType': item.get('operateType'),
            'reGenState': item.get('reGenState'),
            'reachTime': item.get('reachTime'),
            'reachToday': reach_date(item.get('reachTime')) == today_str(),
            'hasReachMessage': bool(item.get('reachMessage')),
        })
    return [c for c in pool if c['userId']]


def list_pending(env, root_kdt_id, guide_id):
    data = unwrap(dubbo_call(
        PENDING_SERVICE, 'listTodayPendingCustomers',
        [{'rootKdtId': root_kdt_id, 'guideId': guide_id}],
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


def pick_from_pool(pool, occupied, guide_id, n):
    """排除今日队列已占用与导购自己；reachTime 不在今天的优先，其中 operateType=1（曾被判需触达）的优先。"""
    candidates = [
        c for c in pool
        if c['userId'] not in occupied and c['userId'] != str(guide_id)
    ]
    candidates.sort(key=lambda c: (c['reachToday'], c['operateType'] != 1, str(c['reachTime'] or '')))
    return candidates[:n]


def append_customer(env, root_kdt_id, guide_id, customer_id):
    return unwrap(dubbo_call(
        CUS_SERVICE, 'appendCustomer',
        [{'kdtId': root_kdt_id, 'userId': int(customer_id), 'adminId': guide_id,
          'generateImmediately': True, 'sourceScene': 'AI_PROFILE_PUSH_TEST'}],
        env, APP_BRAIN,
    ))


def wait_generated(env, root_kdt_id, guide_id, user_ids):
    """轮询 pool 直到这些客户 reGenState 归 0（或 3/4 待重试），返回 {userId: 状态行}。"""
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


def cmd_run(a):
    before_count, before = list_pending(a.env, a.rootKdtId, a.guideId)
    occupied = {c['userId'] for c in before}
    print(f'推前 pendingCount={before_count}，今日队列已占用 {len(occupied)} 个客户')

    pool = list_pool(a.env, a.rootKdtId, a.guideId)
    picked = pick_from_pool(pool, occupied, a.guideId, a.n)
    if len(picked) < a.n:
        print(f'WARN 只选到 {len(picked)}/{a.n} 个候选（pool {len(pool)} 个，排除已占用与导购自己）')
    if not picked:
        raise SystemExit('没有可用客户，收工（pool 空 = 没有 CRM 归属该导购的客户，appendCustomer 不建归属）')
    for c in picked:
        print(f"pick userId={c['userId']} nickName={c['nickName']} reachTime={c['reachTime']}")

    for c in picked:
        result = append_customer(a.env, a.rootKdtId, a.guideId, c['userId'])
        print(f"appendCustomer userId={c['userId']} -> {json.dumps(result, ensure_ascii=False)[:120]}")

    print(f'等待异步生成（画像→话术，最长 {GEN_POLL_TIMEOUT}s）…')
    final = wait_generated(a.env, a.rootKdtId, a.guideId, [c['userId'] for c in picked])

    ok_uids = []
    for c in picked:
        uid = c['userId']
        state = final.get(uid)
        if state is None:
            print(f'WARN userId={uid} {GEN_POLL_TIMEOUT}s 内 reGenState 未归 0，跳过校验')
            continue
        problem = None
        if state['reGenState'] in (3, 4):
            problem = f"reGenState={state['reGenState']}（{'话术' if state['reGenState'] == 3 else '画像'}待重试）"
        elif state['operateType'] == 2:
            problem = 'operateType=2（LLM 判本轮无需触达，重跑 generate 或换客户）'
        elif not state['reachToday']:
            problem = f"reachTime={state['reachTime']} 不在今天（傍晚生成会排次日 10:00）"
        if problem:
            print(f'WARN userId={uid} 生成完成但不进今日队列：{problem}')
        else:
            ok_uids.append(uid)
        print(f"done userId={uid} {json.dumps(state, ensure_ascii=False)[:200]}")

    if not ok_uids:
        raise SystemExit('没有客户满足进队列条件，pendingCount 不会涨，收工')

    # 读侧传播延迟 30s~1min，短轮询等 pendingCount 涨上来
    deadline = time.time() + SYNC_POLL_TIMEOUT
    after_count, after = before_count, before
    while time.time() < deadline:
        time.sleep(SYNC_POLL_INTERVAL)
        after_count, after = list_pending(a.env, a.rootKdtId, a.guideId)
        if after_count >= before_count + len(ok_uids):
            break
    new_customers = [c for c in after if c['userId'] in set(ok_uids)]
    print(f'推后 pendingCount={after_count}（+{after_count - before_count}），确认进队列 {len(new_customers)}/{len(ok_uids)}：')
    for c in new_customers:
        print(json.dumps(c, ensure_ascii=False))
    if len(new_customers) < len(ok_uids):
        print(f'HINT {len(ok_uids) - len(new_customers)} 个 {SYNC_POLL_TIMEOUT}s 内未确认：'
              '多数是传播延迟，等 1 分钟 pending 复验；仍没有再按 SKILL.md 排查表处理')


def cmd_pool(a):
    pool = list_pool(a.env, a.rootKdtId, a.guideId)
    print(f'pool {len(pool)} 个客户（adminId={a.guideId}）：')
    for c in pool:
        print(json.dumps(c, ensure_ascii=False))


def cmd_pending(a):
    count, customers = list_pending(a.env, a.rootKdtId, a.guideId)
    print(f'pendingCount={count}')
    for c in customers:
        print(json.dumps(c, ensure_ascii=False))


def cmd_generate(a):
    """单客户试跑生成（画像→话术），返回 taskNo，各约 40s；用 pool 子命令跟 reGenState。"""
    for scene_type, name in [(1, '画像'), (2, '话术')]:
        result = unwrap(dubbo_call(
            SCENE_SERVICE, 'mockGenerate',
            [{'kdtId': a.rootKdtId, 'userId': a.customerId, 'sceneType': scene_type}],
            a.env, APP_BRAIN,
        ))
        print(f'mockGenerate sceneType={scene_type}（{name}）-> {json.dumps(result, ensure_ascii=False)[:150]}')


def cmd_reset(a):
    result = unwrap(dubbo_call(
        TEST_SERVICE, 'deleteGuideAiProfileReachRecord',
        [a.rootKdtId, a.guideId, a.customerId], a.env, APP_PROMOTION,
    ))
    print(f'删除触达记录 {result} 行，客户立刻回到今日待触达队列')


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest='cmd', required=True)
    for name, fn in [('run', cmd_run), ('pool', cmd_pool), ('pending', cmd_pending),
                     ('generate', cmd_generate), ('reset', cmd_reset)]:
        sp = sub.add_parser(name)
        sp.add_argument('--env', choices=['qa', 'pre'], required=True)
        sp.add_argument('--rootKdtId', type=int, required=True)
        sp.add_argument('--guideId', type=int)
        sp.add_argument('-n', type=int, default=2)
        sp.add_argument('--customerId', type=int)
        sp.set_defaults(fn=fn)
    args = p.parse_args()
    args.fn(args)


if __name__ == '__main__':
    main()
