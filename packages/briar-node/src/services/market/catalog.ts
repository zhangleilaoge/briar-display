import type { MarketId } from '@briar/shared'

/**
 * 全球板块的静态配置：大盘指数代码、固定代理列表（无动态板块源的市场才用）、韩国行业名翻译。
 * 能动态拉取板块清单的市场（A股/韩国）不在这里列板块。
 */

export interface IndexDef {
	/** 东财 secid（ulist.np），如 1.000001 */
	em?: string
	/** 腾讯 qt 代码（东财失败时兜底），如 sh000001 */
	tencent?: string
	/** Naver 实时轮询代码 */
	naver?: { kind: 'domestic' | 'world'; code: string }
	name: string
}

/** 各市场大盘指数（按数据源实测能拿到的选） */
export const MARKET_INDICES: Record<MarketId, IndexDef[]> = {
	cn: [
		{ em: '1.000001', tencent: 'sh000001', name: '上证指数' },
		{ em: '0.399001', tencent: 'sz399001', name: '深证成指' },
		{ em: '0.399006', tencent: 'sz399006', name: '创业板指' },
		{ em: '1.000688', tencent: 'sh000688', name: '科创50' },
	],
	hk: [
		{ em: '100.HSI', tencent: 'hkHSI', name: '恒生指数' },
		{ em: '124.HSTECH', tencent: 'hkHSTECH', name: '恒生科技' },
		{ em: '100.HSCEI', tencent: 'hkHSCEI', name: '国企指数' },
	],
	us: [
		{ em: '100.SPX', tencent: 'usINX', name: '标普500' },
		{ em: '100.NDX', tencent: 'usIXIC', name: '纳斯达克' },
		{ em: '100.DJIA', tencent: 'usDJI', name: '道琼斯' },
	],
	jp: [
		{ em: '100.N225', naver: { kind: 'world', code: '.N225' }, name: '日经225' },
		{ naver: { kind: 'world', code: '.TOPX' }, name: 'TOPIX' },
	],
	kr: [
		{ naver: { kind: 'domestic', code: 'KOSPI' }, em: '100.KS11', name: 'KOSPI' },
		{ naver: { kind: 'domestic', code: 'KOSDAQ' }, name: 'KOSDAQ' },
		{ naver: { kind: 'domestic', code: 'KPI200' }, em: '100.KOSPI200', name: 'KOSPI200' },
	],
}

export interface ProxyDef {
	code: string
	/** 短名（热力图色块用）；名称以数据源返回为准，这里只做简称 */
	name: string
}

/**
 * 恒生综合行业指数（12 个行业，恒指公司官方行业分类）。
 * 东财/腾讯/新浪都没有港股「行业板块」聚合行情，只能用行业指数代理。
 */
export const HK_INDUSTRY_INDICES: ProxyDef[] = [
	{ code: 'HSCIIT', name: '资讯科技' },
	{ code: 'HSCIFN', name: '金融' },
	{ code: 'HSCICD', name: '非必需性消费' },
	{ code: 'HSCICS', name: '必需性消费' },
	{ code: 'HSCICH', name: '医疗保健' },
	{ code: 'HSCIPC', name: '地产建筑' },
	{ code: 'HSCIIN', name: '工业' },
	{ code: 'HSCIMT', name: '原材料' },
	{ code: 'HSCIEN', name: '能源' },
	{ code: 'HSCIUT', name: '公用事业' },
	{ code: 'HSCITC', name: '电讯' },
	{ code: 'HSCICO', name: '综合企业' },
]

/** 美股：11 个 SPDR 行业 ETF（GICS 一级行业代理） */
export const US_SECTOR_ETFS: ProxyDef[] = [
	{ code: 'XLK', name: '信息技术' },
	{ code: 'XLF', name: '金融' },
	{ code: 'XLV', name: '医疗保健' },
	{ code: 'XLY', name: '可选消费' },
	{ code: 'XLP', name: '必需消费' },
	{ code: 'XLI', name: '工业' },
	{ code: 'XLE', name: '能源' },
	{ code: 'XLB', name: '原材料' },
	{ code: 'XLU', name: '公用事业' },
	{ code: 'XLRE', name: '房地产' },
	{ code: 'XLC', name: '通信服务' },
]

/** 美股：细分行业 / 主题 ETF（「概念」tab 代理） */
export const US_THEME_ETFS: ProxyDef[] = [
	{ code: 'SMH', name: '半导体' },
	{ code: 'IGV', name: '软件' },
	{ code: 'CIBR', name: '网络安全' },
	{ code: 'SKYY', name: '云计算' },
	{ code: 'BOTZ', name: '机器人与AI' },
	{ code: 'ARKK', name: '颠覆式创新' },
	{ code: 'KWEB', name: '中概互联网' },
	{ code: 'XBI', name: '生物科技' },
	{ code: 'IBB', name: '大盘生物技术' },
	{ code: 'XPH', name: '制药' },
	{ code: 'IHI', name: '医疗器械' },
	{ code: 'KBE', name: '银行' },
	{ code: 'KRE', name: '地区银行' },
	{ code: 'ITB', name: '住宅建筑' },
	{ code: 'XHB', name: '家居建材' },
	{ code: 'XRT', name: '零售' },
	{ code: 'XOP', name: '油气开采' },
	{ code: 'OIH', name: '油服' },
	{ code: 'GDX', name: '金矿' },
	{ code: 'REMX', name: '稀土战略金属' },
	{ code: 'URA', name: '铀' },
	{ code: 'LIT', name: '锂电池' },
	{ code: 'TAN', name: '太阳能' },
	{ code: 'ICLN', name: '清洁能源' },
	{ code: 'XAR', name: '航天军工' },
	{ code: 'JETS', name: '航空' },
	{ code: 'IYT', name: '交通运输' },
	{ code: 'PAVE', name: '基建' },
	{ code: 'MOO', name: '农业' },
]

/** 日本：野村 NEXT FUNDS TOPIX-17 行业 ETF（1617–1633.T，东证 17 行业代理） */
export const JP_TOPIX17_ETFS: ProxyDef[] = [
	{ code: '1617', name: '食品' },
	{ code: '1618', name: '能源资源' },
	{ code: '1619', name: '建筑・材料' },
	{ code: '1620', name: '原材料・化学' },
	{ code: '1621', name: '医药品' },
	{ code: '1622', name: '汽车・运输机械' },
	{ code: '1623', name: '钢铁・有色' },
	{ code: '1624', name: '机械' },
	{ code: '1625', name: '电机・精密' },
	{ code: '1626', name: '信息通信・服务' },
	{ code: '1627', name: '电力・燃气' },
	{ code: '1628', name: '运输・物流' },
	{ code: '1629', name: '商社・批发' },
	{ code: '1630', name: '零售' },
	{ code: '1631', name: '银行' },
	{ code: '1632', name: '金融（除银行）' },
	{ code: '1633', name: '房地产' },
]

/** 韩国 Naver 业种（WICS 分类）中文名；清单是动态拉的，没收录的新业种原样显示韩文 */
export const KR_INDUSTRY_ZH: Record<string, string> = {
	소프트웨어: '软件',
	전자제품: '电子产品',
	전자장비와기기: '电子设备与仪器',
	전기제품: '电气产品',
	건강관리장비와용품: '医疗设备与用品',
	판매업체: '分销商',
	화학: '化学',
	생명과학도구및서비스: '生命科学工具与服务',
	에너지장비및서비스: '能源设备与服务',
	가스유틸리티: '燃气公用事业',
	핸드셋: '手机',
	비철금속: '有色金属',
	통신장비: '通信设备',
	생물공학: '生物技术',
	복합기업: '综合企业',
	철강: '钢铁',
	포장재: '包装材料',
	건강관리기술: '医疗技术',
	전기장비: '电气设备',
	IT서비스: 'IT服务',
	상업서비스와공급품: '商业服务与用品',
	출판: '出版',
	항공사: '航空公司',
	무역회사와판매업체: '贸易与分销',
	컴퓨터와주변기기: '计算机与外设',
	기계: '机械',
	'섬유,의류,신발,호화품': '纺织服装与奢侈品',
	종이와목재: '纸业与木材',
	건강관리업체및서비스: '医疗服务',
	전기유틸리티: '电力公用事业',
	디스플레이장비및부품: '显示设备及零部件',
	창업투자: '创业投资',
	다각화된소비자서비스: '多元化消费服务',
	방송과엔터테인먼트: '广播与娱乐',
	손해보험: '财产保险',
	가구: '家具',
	제약: '制药',
	전문소매: '专业零售',
	자동차: '汽车',
	기타: '其他',
	건축자재: '建筑材料',
	석유와가스: '石油与天然气',
	화장품: '化妆品',
	'호텔,레스토랑,레저': '酒店餐饮休闲',
	교육서비스: '教育服务',
	광고: '广告',
	부동산: '房地产',
	자동차부품: '汽车零部件',
	레저용장비와제품: '休闲设备与用品',
	사무용전자제품: '办公电子产品',
	가정용기기와용품: '家用电器与用品',
	디스플레이패널: '显示面板',
	건설: '建筑',
	무선통신서비스: '无线通信服务',
	음료: '饮料',
	은행: '银行',
	식품: '食品',
	증권: '证券',
	담배: '烟草',
	항공화물운송과물류: '航空货运与物流',
	운송인프라: '交通基础设施',
	양방향미디어와서비스: '互动媒体与服务',
	카드: '信用卡',
	다각화된통신서비스: '综合电信服务',
	해운사: '航运',
	복합유틸리티: '综合公用事业',
	건축제품: '建筑产品',
	식품과기본식료품소매: '食品零售',
	백화점과일반상점: '百货商店',
	기타금융: '其他金融',
	인터넷과카탈로그소매: '互联网零售',
	도로와철도운송: '公路与铁路运输',
	생명보험: '人寿保险',
	게임엔터테인먼트: '游戏娱乐',
	조선: '造船',
	반도체와반도체장비: '半导体与设备',
	가정용품: '家庭用品',
	우주항공과국방: '航空航天与国防',
	문구류: '文具',
}
