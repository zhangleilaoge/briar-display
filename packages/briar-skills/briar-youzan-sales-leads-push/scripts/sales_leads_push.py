#!/usr/bin/env python3
"""briar-youzan-sales-leads-push：给指定导购推销售线索的一体化脚本。

把 SKILL.md 手动步骤里的「核查 / 选客户 / 造数 / 验证 / 清理」固化成子命令，
例行造数只需要 run 一条命令（轻校验：生成后对比 listLeadsDetail 总数），
被静默跳过再按 SKILL.md 步骤 7 的天网关键字表排查。

依赖 zan-dubbo-invoke 的 dubbo_query.py（复用其 funeng 登录态与 Tether 网关）：
  export ZAN_DUBBO_INVOKE_SKILL_DIR=~/.kimi-code/user-skills/zan-dubbo-invoke   # 默认值，通常不用设

用法：
  python3 sales_leads_push.py run     --env pre --kdtId 132015756 --rootKdtId 136579309 --guideId 10319972620 -n 3
  python3 sales_leads_push.py precheck --env pre --rootKdtId 136579309 --guideId 10319972620
  python3 sales_leads_push.py list    --env pre --rootKdtId 136579309 --guideId 10319972620
  python3 sales_leads_push.py pick    --env pre --kdtId 132015756 --rootKdtId 136579309 --guideId 10319972620 -n 3
  python3 sales_leads_push.py push    --env pre --rootKdtId 136579309 --guideId 10319972620 --customerId 393811488 --score 75
  python3 sales_leads_push.py cleanup --env pre --rootKdtId 136579309 --leadsNo GL425226900

写操作（push/cleanup）：QA 走 Tether 无限制；pre 复用 funeng 登录态直调 Ticket API。禁止 prod。
"""

import argparse
import importlib.util
import json
import os
import sys
import time

LEADS_PREFIX = 'com.youzan.guide.promotion.api.service.leads.'
COMPUTE_SERVICE = 'com.youzan.guide.promotion.api.service.ai.compute.GuideAiComputeApiService'
CUSTOMER_SERVICE = 'com.youzan.guide.front.api.service.customer.CustomerReadApiService'
TEST_SERVICE = 'com.youzan.guide.promotion.biz.service.test.LeadsTestService'
TOOL_SERVICE = 'com.youzan.guide.promotion.biz.fix.GuideLeadsToolApiService'

ONE_YEAR_MS = 365 * 24 * 3600 * 1000


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
    if env == 'qa':
        return DQ.invoke_via_tether(service, method, args, 'qa')
    if env != 'pre':
        raise SystemExit('仅支持 qa/pre；prod 禁止')
    req = DQ.build_dubbo_request(
        app=app or DQ.extract_app_from_service(service),
        service=service,
        method=method,
        args=args,
        env=env,
        timeout=20000,
        retries=0,
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
    """在响应 data 里找任务/客户/线索列表字段。"""
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ('list', 'items', 'records', 'content', 'data', 'leadsList', 'customerList'):
            if isinstance(data.get(key), list):
                return data[key]
    return []


def now_ms():
    return int(time.time() * 1000)


def list_active_leads(env, root_kdt_id, guide_id):
    data = unwrap(dubbo_call(
        LEADS_PREFIX + 'GuideSalesLeadsService', 'listLeadsDetail',
        [{
            'rootKdtId': root_kdt_id,
            'guideIdList': [guide_id],
            'leadsStatusList': [0],
            'startTime': now_ms() - ONE_YEAR_MS,
            'endTime': now_ms(),
            'page': 1,
            'pageSize': 50,
            'rankOrderBy': 'score',
            'descOrderBy': True,
        }],
        env,
    ))
    items = find_list(data)
    total = None
    if isinstance(data, dict):
        total = data.get('totalCount')
        if total is None and isinstance(data.get('paginator'), dict):
            total = data['paginator'].get('totalCount')
    if total is None:
        total = len(items)
    leads = []
    for item in items:
        if not isinstance(item, dict):
            continue
        customer_id = item.get('customerId') or item.get('userId') or item.get('yzUid')
        leads.append({
            'leadsNo': item.get('leadsNo'),
            'customerId': str(customer_id) if customer_id is not None else None,
            'score': item.get('score') or item.get('totalScore'),
            'guideFollowStatus': item.get('guideFollowStatus'),
        })
    return total, leads


def pick_customers(env, kdt_id, root_kdt_id, guide_id, n, occupied):
    data = unwrap(dubbo_call(
        CUSTOMER_SERVICE, 'listCustomersPaged',
        [{
            'operator': {'operatorKdtId': kdt_id, 'operatorId': guide_id},
            'formSence': 2,
            'kdtId': kdt_id,
            'guideUserIds': [guide_id],
            'page': 1,
            'pageSize': 50,
        }],
        env,
    ))
    picked = []
    for item in find_list(data):
        if not isinstance(item, dict):
            continue
        uid = item.get('userId') or item.get('customerId') or item.get('yzUid')
        belong = (item.get('belongGuideInfo') or {}).get('guideUserId')
        if not uid or str(uid) == str(guide_id) or str(uid) in occupied:
            continue
        if belong and str(belong) != str(guide_id):
            continue
        if not item.get('mobileAuth'):
            continue
        picked.append({'customerId': uid, 'mobile': item.get('mobile')})
        if len(picked) >= n:
            break
    return picked


def push_lead(env, root_kdt_id, guide_id, customer_id, score):
    return unwrap(dubbo_call(
        TEST_SERVICE, 'createUserIdScoreMsg',
        [{
            'yzUid': customer_id,
            'rootKdtId': root_kdt_id,
            'totalScore': score,
            'type': 'DISPLAY',
            'slGuideId': guide_id,
            'processTime': now_ms(),
            'newModel': 1,
            'generateSource': 0,
        }],
        env,
        app='guide-promotion',
    ))


def cmd_precheck(a):
    checks = [
        ('新评分模型白名单 chain_leads_forecast', LEADS_PREFIX + 'GuideSalesLeadsConfigApiService',
         'getLeadsForecastSwitch', [{'rootKdtId': a.rootKdtId}],
         lambda d: d is True or (isinstance(d, dict) and any(v is True for v in d.values()))),
        ('导购在线索生成范围（bizType=1）', LEADS_PREFIX + 'GuideGenerateScopeApiService',
         'checkGuideInGenerateScope', [{'rootKdtId': a.rootKdtId, 'bizType': 1, 'guideId': a.guideId}],
         lambda d: d is True),
        ('AI 算力余额 computeEnough', COMPUTE_SERVICE, 'getAccount',
         [{'rootKdtId': a.rootKdtId, 'kdtId': a.rootKdtId}],
         lambda d: isinstance(d, dict) and d.get('computeEnough') is True),
    ]
    for name, service, method, args, ok in checks:
        data = unwrap(dubbo_call(service, method, args, a.env))
        print(f"{'PASS' if ok(data) else 'FAIL'} {name}: {json.dumps(data, ensure_ascii=False)[:200]}")
    cfg = unwrap(dubbo_call(LEADS_PREFIX + 'GuideSalesLeadsConfigApiService', 'getLeadsConfig',
                            [{'rootKdtId': a.rootKdtId}], a.env))
    rules = [r for r in find_list(cfg) if isinstance(r, dict) and r.get('assignType') == 1]
    enabled = [r for r in rules if r.get('status') == 1]
    print(f"{'PASS' if enabled else 'FAIL'} 分配规则 assignType=1（专属导购）启用: "
          f"{json.dumps(rules, ensure_ascii=False)[:300]}")
    if [r for r in find_list(cfg) if isinstance(r, dict) and r.get('assignType') == 5 and r.get('status') == 1]:
        print('WARN 店长分配规则（assignType=5）启用：高等级会员线索可能进待分配而不是给导购')


def cmd_list(a):
    total, leads = list_active_leads(a.env, a.rootKdtId, a.guideId)
    print(f'生效线索 totalCount={total}')
    for lead in leads:
        print(json.dumps(lead, ensure_ascii=False))


def cmd_pick(a):
    _, leads = list_active_leads(a.env, a.rootKdtId, a.guideId)
    occupied = {lead['customerId'] for lead in leads if lead['customerId']}
    picked = pick_customers(a.env, a.kdtId, a.rootKdtId, a.guideId, a.n, occupied)
    print(f'已占用客户 {len(occupied)} 个，新选出 {len(picked)} 个候选：')
    for c in picked:
        print(json.dumps(c, ensure_ascii=False))


def cmd_push(a):
    print(json.dumps({'pushResult': push_lead(a.env, a.rootKdtId, a.guideId, a.customerId, a.score)},
                     ensure_ascii=False))


def cmd_run(a):
    before_total, before = list_active_leads(a.env, a.rootKdtId, a.guideId)
    before_nos = {lead['leadsNo'] for lead in before if lead['leadsNo']}
    occupied = {lead['customerId'] for lead in before if lead['customerId']}
    print(f'推前生效线索 {before_total} 条，已占用客户 {len(occupied)} 个')

    picked = pick_customers(a.env, a.kdtId, a.rootKdtId, a.guideId, a.n, occupied)
    if len(picked) < a.n:
        print(f'WARN 只选到 {len(picked)}/{a.n} 个合格客户（需专属导购+手机号授权+无生效线索）')
    if not picked:
        raise SystemExit('没有可用客户，收工')

    for i, c in enumerate(picked):
        score = a.baseScore - i * 5
        result = push_lead(a.env, a.rootKdtId, a.guideId, c['customerId'], score)
        print(f"push customerId={c['customerId']} score={score} -> {json.dumps(result, ensure_ascii=False)[:120]}")

    # ES binlog 同步有秒级~数十秒延迟（实测 3 条里 2 条首次即查未追上），短轮询等同步，避免假阴性误导补推超发
    pushed = len(picked)
    new_leads = []
    after_total = before_total
    deadline = time.time() + 40
    while True:
        time.sleep(3)
        after_total, after = list_active_leads(a.env, a.rootKdtId, a.guideId)
        new_leads = [lead for lead in after if lead['leadsNo'] and lead['leadsNo'] not in before_nos]
        if len(new_leads) >= pushed or time.time() > deadline:
            break
    print(f'推后生效线索 {after_total} 条（+{after_total - before_total}），新线索 {len(new_leads)}/{pushed} 条：')
    for lead in new_leads:
        print(json.dumps(lead, ensure_ascii=False))
    if len(new_leads) < pushed:
        print(f'HINT {pushed - len(new_leads)} 条 40s 内未确认：可能是 ES 同步延迟（等 1 分钟再 list 复验），'
              '也可能是静默跳过分支——按 SKILL.md 步骤 7 天网关键字排查（响应顶层是 logEvents）后再决定是否补推')


def cmd_cleanup(a):
    print(json.dumps({'cleanupResult': unwrap(dubbo_call(
        TOOL_SERVICE, 'closeAndDeleteLeads', [a.rootKdtId, a.leadsNo], a.env, app='guide-promotion'))},
        ensure_ascii=False))


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest='cmd', required=True)
    for name, fn in [('precheck', cmd_precheck), ('list', cmd_list), ('pick', cmd_pick),
                     ('push', cmd_push), ('run', cmd_run), ('cleanup', cmd_cleanup)]:
        sp = sub.add_parser(name)
        sp.add_argument('--env', choices=['qa', 'pre'], required=True)
        sp.add_argument('--kdtId', type=int)
        sp.add_argument('--rootKdtId', type=int, required=True)
        sp.add_argument('--guideId', type=int)
        sp.add_argument('-n', type=int, default=3)
        sp.add_argument('--customerId', type=int)
        sp.add_argument('--score', type=int, default=75)
        sp.add_argument('--baseScore', type=int, default=75)
        sp.add_argument('--leadsNo')
        sp.set_defaults(fn=fn)
    args = p.parse_args()
    args.fn(args)


if __name__ == '__main__':
    main()
