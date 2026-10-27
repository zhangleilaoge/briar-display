#!/usr/bin/env python3
"""按指定排期的真实一客一策直发测试企微卡片，不经过每日通知链路。"""

import argparse
import datetime
import hashlib
import json
import time
import urllib.parse

import ai_profile_push as base

WECOM_SERVICE = 'com.youzan.wecom.helper.core.api.open.appmsg.AppMsgOpenService'
SHOP_SERVICE = 'com.youzan.guide.api.service.shop.GuideShopReadApiService'
SHOP_META_SERVICE = 'com.youzan.shopcenter.outer.service.shop.ShopMetaReadOuterService'
QW_APP_ID = 'wwbb05cde5d7a0c6d0'
MESSAGE_TYPE = 7


def fail(message, details=None):
    print(f'ERROR {message}')
    if details is not None:
        print(json.dumps(details, ensure_ascii=False, indent=2))
    raise SystemExit(1)


def unwrap_success(response, operation):
    current = response
    for _ in range(3):
        if not isinstance(current, dict):
            break
        if current.get('success') is False or current.get('code') not in (None, 0, 200, '0', '200'):
            fail(f'{operation}返回失败', response)
        if 'data' in current:
            current = current['data']
        elif isinstance(current.get('result'), (dict, list)):
            current = current['result']
        else:
            break
    if current is None or current is False:
        fail(f'{operation}未返回有效数据', response)
    return current


def positive_int(raw):
    try:
        value = int(raw)
    except ValueError:
        raise argparse.ArgumentTypeError('必须是整数')
    if value <= 0:
        raise argparse.ArgumentTypeError('必须大于 0')
    return value


def numeric_id(raw):
    if not raw.isdigit() or not 0 < int(raw) < 2 ** 63:
        raise argparse.ArgumentTypeError('必须是 Long 范围内的纯数字字符串')
    return raw


def valid_date(raw):
    try:
        datetime.date.fromisoformat(raw)
    except ValueError:
        raise argparse.ArgumentTypeError('必须是有效的 yyyy-MM-dd 日期')
    return raw


def read_customer(a, guide):
    response = unwrap_success(base.dubbo_call(
        base.PENDING_SERVICE, 'listTodayPendingCustomers',
        [{'rootKdtId': a.rootKdtId, 'guideId': int(guide['userId']),
          'dateDay': a.dateDay, 'priorityUserId': a.customerId}],
        a.env, base.APP_PROMOTION,
    ), '读取待触达客户')
    if response.get('businessDate') != a.dateDay:
        fail('返回业务日期与指定日期不一致', {'expected': a.dateDay, 'actual': response.get('businessDate')})
    customers = [item for item in base.find_list(response)
                 if isinstance(item, dict) and str(item.get('userId')) == str(a.customerId)]
    if len(customers) != 1:
        fail('指定客户不在该排期待触达列表中，不改选其他客户',
             {'customerId': a.customerId, 'dateDay': a.dateDay, 'pendingCount': response.get('pendingCount')})
    customer = customers[0]
    if customer.get('hasWecomRelation') is not True:
        fail('指定客户与导购没有有效企微好友关系，不发送', {'customerId': a.customerId})
    if str(customer.get('reachTime', ''))[:10] != a.dateDay:
        fail('客户实际排期与指定日期不一致，不发送',
             {'expected': a.dateDay, 'reachTime': customer.get('reachTime')})
    if not isinstance(customer.get('reachMessage'), str) or not customer['reachMessage'].strip():
        fail('客户推荐话术为空，不发送', {'customerId': a.customerId})
    return customer, response.get('pendingCount')


def check_wecom_relation(a, guide):
    mapping = unwrap_success(base.dubbo_call(
        'com.youzan.wecom.helper.core.api.customer.WecomCustomerService', 'listExternalUserId',
        [{'yzKdtId': guide['qwKdtId'], 'yzUserIdList': [a.customerId]}], a.env, 'wecom-helper-core',
    ), '读取导购企微店的客户映射')
    external_id = mapping.get(str(a.customerId)) if isinstance(mapping, dict) else None
    if not isinstance(external_id, str) or not external_id.strip():
        fail('客户在导购绑定的企微店没有 externalUserId 映射，不发送',
             {'customerId': a.customerId, 'wecomKdtId': guide['qwKdtId']})
    result = unwrap_success(base.dubbo_call(
        'com.youzan.wecom.helper.core.api.open.customer.CustomerRelOpenService', 'searchAfterSimple',
        [{'yzKdtId': guide['qwKdtId'],
          'customerSearchReqDTO': {
              'staffIds': [int(guide['staffId'])], 'churnStatus': 0, 'isDeleted': 0,
              'wecomExternalUserIds': [external_id],
          }, 'pageSize': 1}], a.env, 'wecom-helper-core',
    ), '读取导购与客户的有效企微好友关系')
    relations = result.get('respList') if isinstance(result, dict) else None
    if not isinstance(relations, list):
        fail('企微好友关系响应缺少 respList，不发送', {'customerId': a.customerId})
    if not any(isinstance(relation, dict)
               and relation.get('wecomExternalUserId') == external_id
               and str(relation.get('staffId')) == str(guide['staffId'])
               for relation in relations):
        fail('客户与导购实际 staffId 没有有效企微好友关系，不发送',
             {'customerId': a.customerId, 'wecomKdtId': guide['qwKdtId'], 'staffId': guide['staffId']})


def resolve_online_shop(a, guide):
    meta = unwrap_success(base.dubbo_call(
        SHOP_META_SERVICE, 'queryShopMetaInfo', [guide['kdtId']], a.env, 'shopcenter',
    ), '读取店铺信息')
    if meta.get('shopRole') in (0, 1):
        return guide['kdtId']
    shops = unwrap_success(base.dubbo_call(
        SHOP_SERVICE, 'listVaLidOnlineShops',
        [{'operator': {'operatorKdtId': guide['kdtId'], 'operatorId': int(guide['userId'])}}],
        a.env, 'guide',
    ), '读取导购网店')
    items = base.find_list(shops)
    if not items:
        return guide['kdtId']
    selected = next((item for item in items if item.get('orgCategory') == 'mallShop'), items[0])
    try:
        online_shop_id = int(selected['id'])
    except (KeyError, TypeError, ValueError):
        online_shop_id = 0
    if online_shop_id <= 0:
        fail('无法解析有效网店店铺 ID，不发送', selected)
    return online_shop_id


def checked_guide(a):
    guide = base.need_guide(a)
    if guide.get('rootKdtId') != a.rootKdtId:
        fail('导购不属于指定总部', guide)
    if (guide.get('guideType') != 1 or guide.get('belongToQw') != 1
            or not guide.get('qwKdtId') or not guide.get('staffId')):
        fail('导购不是有效付费导购，或缺少企微店铺/员工绑定', guide)
    return guide


def state_query(guide, biz_id):
    return {
        'wecomKdtId': guide['qwKdtId'],
        'bizType': 0,
        'bizId': biz_id,
        'messageType': MESSAGE_TYPE,
        'baseInfo': {'staffIdentities': [{'yzUserId': int(guide['userId'])}]},
        'pageRequest': {'pageNumber': 1, 'pageSize': 20},
    }


def build_status_context(a):
    guide = checked_guide(a)
    return {
        'action': a.action,
        'env': a.env,
        'rootKdtId': a.rootKdtId,
        'guideId': guide['userId'],
        'guideNickname': guide.get('nickname'),
        'wecomKdtId': guide['qwKdtId'],
        'bizId': a.bizId,
        'stateQuery': state_query(guide, a.bizId),
    }


def build_context(a):
    guide = checked_guide(a)
    if int(guide['userId']) == a.customerId:
        fail('客户不能是导购本人')
    customer, pending_count = read_customer(a, guide)
    check_wecom_relation(a, guide)
    online_shop_id = resolve_online_shop(a, guide)
    jump_url = 'https://qiwei.youzan.com/guide/center/ai-helper/strategy-follow?' + urllib.parse.urlencode({
        'appId': QW_APP_ID,
        'kdt_id': online_shop_id,
        'deptId': guide.get('departmentId') or 0,
        'directEnter': 1,
        'customerId': a.customerId,
        'dateDay': a.dateDay,
    })
    fingerprint = hashlib.sha256(json.dumps({
        'env': a.env,
        'rootKdtId': a.rootKdtId,
        'guideId': guide['userId'],
        'customerId': customer['userId'],
        'dateDay': a.dateDay,
        'reachTime': customer['reachTime'],
        'reachTitle': customer.get('reachTitle'),
        'reachMessage': customer['reachMessage'],
    }, ensure_ascii=False, sort_keys=True).encode('utf-8')).hexdigest()[:32]
    task_id = f'ai_profile_wecom_now_{a.env}_{fingerprint}'
    biz_id = str(int(fingerprint[:15], 16))
    name = customer.get('nickName') or customer.get('userName') or '匿名客户'
    title = customer.get('reachTitle') or '客户跟进'
    command = {
        'wecomKdtId': guide['qwKdtId'],
        'bizType': 0,
        'bizId': biz_id,
        'taskId': task_id,
        'baseInfo': {'staffIdentities': [{'yzUserId': int(guide['userId'])}]},
        'mainTitle': {'title': '重点客户跟进'},
        'horizontalContentList': [
            {'keyName': '客户名称', 'value': name},
            {'keyName': '跟进主题', 'value': title},
            {'keyName': '推荐话术', 'value': customer['reachMessage']},
        ],
        'cardAction': {'type': 1, 'url': jump_url},
        'buttonList': [{'type': 1, 'text': '立即跟进', 'style': 1, 'url': jump_url}],
        'pushOption': {'enableDuplicateCheck': 1, 'duplicateCheckInterval': 14400},
    }
    return {
        'action': a.action,
        'env': a.env,
        'rootKdtId': a.rootKdtId,
        'guideId': guide['userId'],
        'guideNickname': guide.get('nickname'),
        'wecomKdtId': guide['qwKdtId'],
        'onlineShopId': online_shop_id,
        'dateDay': a.dateDay,
        'pendingCount': pending_count,
        'customer': customer,
        'bizId': biz_id,
        'taskId': task_id,
        'command': command,
        'stateQuery': state_query(guide, biz_id),
    }


def query_state(context):
    result = unwrap_success(base.dubbo_call(
        WECOM_SERVICE, 'queryPushState', [context['stateQuery']], context['env'], 'wecom-helper-core',
    ), '查询企微推送状态')
    states = base.find_list(result)
    list_keys = ('list', 'items', 'records', 'content', 'data', 'customerList')
    if not isinstance(result, list) and not (isinstance(result, dict)
            and any(isinstance(result.get(key), list) for key in list_keys)):
        fail('企微推送状态响应缺少可识别的状态列表', {'bizId': context['bizId']})
    if any(not isinstance(state, dict) for state in states) or len(states) > 1:
        fail('推送状态不是预期的零条或一条，需人工核查且不重发',
             {'bizId': context['bizId'], 'states': states})
    return states


def show(context, states):
    context['pushStates'] = states
    print(json.dumps(context, ensure_ascii=False, indent=2))


def push_once(context):
    if context['env'] == 'qa':
        return base.DQ.invoke_via_tether(
            WECOM_SERVICE, 'pushButtonTemplateMessage', [context['command']], 'qa',
        )
    request = base.DQ.build_dubbo_request(
        app='wecom-helper-core', service=WECOM_SERVICE, method='pushButtonTemplateMessage',
        args=[context['command']], env='pre', timeout=20000, retries=0,
    )
    return base.DQ.invoke_dubbo_service(request, base.DQ.get_cookies_from_funeng())


def send(context):
    states = query_state(context)
    if states:
        state = states[0]
        if state.get('pushState') == 1 and state.get('wecomErrorCode') == 0:
            context['duplicateSuppressed'] = True
            show(context, states)
            return
        fail('同内容推送任务已存在，不重复发送；可用 status 回查',
             {'bizId': context['bizId'], 'state': state})
    attempt = {
        'env': context['env'],
        'bizId': context['bizId'],
        'taskId': context['taskId'],
        'startedAt': datetime.datetime.now().astimezone().isoformat(timespec='seconds'),
    }
    context['sendAttempt'] = attempt
    print('SEND_ONCE ' + json.dumps(attempt, ensure_ascii=False), flush=True)
    try:
        response = push_once(context)
    except Exception as error:
        fail('已尝试一次发送，受理结果未知；不重发，先用完整 taskId 查天网并用 status 回查',
             {**attempt, 'errorType': type(error).__name__})
    unwrap_success(response, '受理企微推送')
    context['pushAccepted'] = True
    print('PUSH_ACCEPTED ' + json.dumps(attempt, ensure_ascii=False), flush=True)
    for poll_attempt in range(10):
        try:
            states = query_state(context)
        except SystemExit:
            fail('发送已受理，但回查失败；不会自动重发，请用 status 回查', attempt)
        except Exception as error:
            fail('发送已受理，但回查异常；不会自动重发，请用 status 回查',
                 {**attempt, 'errorType': type(error).__name__})
        if states:
            state = states[0]
            if state.get('pushState') == 1 and state.get('wecomErrorCode') == 0:
                show(context, states)
                return
            if state.get('pushState') == 2 or state.get('wecomErrorCode') not in (None, 0):
                fail('企微推送失败，不自动重发', {'bizId': context['bizId'], 'state': state})
        if poll_attempt < 9:
            time.sleep(3)
    fail('发送已受理，但 30 秒内未确认成功；不会自动重发，请用 status 回查',
         {'bizId': context['bizId'], 'pushStates': states})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['preview', 'send', 'status'], nargs='?', default='preview')
    parser.add_argument('--env', choices=['qa', 'pre'], required=True)
    parser.add_argument('--confirm-env', choices=['qa', 'pre'], help='send 时必须与 --env 一致')
    parser.add_argument('--rootKdtId', type=positive_int, required=True)
    parser.add_argument('--guide', required=True, help='导购 userId / 手机号 / 导购表主键 dbId')
    parser.add_argument('--guideKind', choices=['auto', 'userId', 'mobile', 'dbId'], default='auto')
    parser.add_argument('--customerId', type=positive_int)
    parser.add_argument('--dateDay', type=valid_date, help='真实排期日期，不是发送日期')
    parser.add_argument('--bizId', type=numeric_id, help='仅 status：不重建卡片，按已知数字 bizId 独立回查')
    args = parser.parse_args()
    if args.action == 'send' and args.confirm_env != args.env:
        fail('send 必须提供与 --env 一致的 --confirm-env，且不产生任何 Dubbo 调用')
    if args.action == 'status' and args.bizId:
        if args.customerId or args.dateDay:
            fail('使用 --bizId 独立回查时，不要再传 --customerId 或 --dateDay')
        context = build_status_context(args)
    else:
        if args.bizId:
            fail('只有 status 支持 --bizId；preview/send 必须使用客户与真实排期生成任务')
        if not args.customerId or not args.dateDay:
            fail('preview/send 及按内容回查的 status 必须提供 --customerId 和 --dateDay')
        context = build_context(args)
    if args.action == 'send':
        send(context)
    else:
        show(context, query_state(context))


if __name__ == '__main__':
    main()
