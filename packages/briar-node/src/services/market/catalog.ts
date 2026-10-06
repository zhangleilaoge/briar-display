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

/**
 * 美股行业 ETF → 纳斯达克 screener 的 GICS 行业名。
 * 成分股按 GICS 行业从纳斯达克筛选器拉名单（11 个一级行业都有），
 * 主题/细分 ETF（概念 tab）没有对应的免费成分股接口。
 */
export const US_SECTOR_GICS: Record<string, string> = {
	XLK: 'Technology',
	XLC: 'Telecommunications',
	XLF: 'Finance',
	XLV: 'Health Care',
	XLY: 'Consumer Discretionary',
	XLP: 'Consumer Staples',
	XLI: 'Industrials',
	XLE: 'Energy',
	XLB: 'Basic Materials',
	XLU: 'Utilities',
	XLRE: 'Real Estate',
}

/**
 * 人工维护的题材板块（港股 / 美股「概念」tab）。
 * 免费源没有港美股的题材聚合接口，这里用静态名单划定板块，行情按成分股聚合
 * （腾讯 qt 批量报价：涨跌幅等权平均、成交额求和、涨跌家数、领涨股）。
 * 名单是静态数据，新热点手工收录；成员缺失报价时该板块聚合自动按有报价的部分算。
 */
export interface CuratedMember {
	market: 'hk' | 'us'
	/** hk：5 位代码 00700；us：大写代码 AAPL */
	code: string
}

export interface CuratedSectorDef {
	/** 板块代码（slug，全局唯一） */
	code: string
	name: string
	members: CuratedMember[]
}

/** 美股题材板块 */
export const US_CONCEPT_SECTORS: CuratedSectorDef[] = [
	{
		code: 'storage',
		name: '存储',
		members: [
			{ market: 'us', code: 'MU' },
			{ market: 'us', code: 'WDC' },
			{ market: 'us', code: 'STX' },
			{ market: 'us', code: 'SNDK' },
			{ market: 'us', code: 'SIMO' },
		],
	},
	{
		code: 'optical-cpo',
		name: '光模块 / CPO',
		members: [
			{ market: 'us', code: 'COHR' },
			{ market: 'us', code: 'LITE' },
			{ market: 'us', code: 'FN' },
			{ market: 'us', code: 'AAOI' },
			{ market: 'us', code: 'CIEN' },
			{ market: 'us', code: 'CRDO' },
			{ market: 'us', code: 'ALAB' },
		],
	},
	{
		code: 'ai-compute',
		name: 'AI 算力',
		members: [
			{ market: 'us', code: 'NVDA' },
			{ market: 'us', code: 'AMD' },
			{ market: 'us', code: 'AVGO' },
			{ market: 'us', code: 'MRVL' },
			{ market: 'us', code: 'ANET' },
			{ market: 'us', code: 'SMCI' },
			{ market: 'us', code: 'ARM' },
		],
	},
	{
		code: 'ai-software',
		name: 'AI 应用 / 软件',
		members: [
			{ market: 'us', code: 'MSFT' },
			{ market: 'us', code: 'GOOGL' },
			{ market: 'us', code: 'AMZN' },
			{ market: 'us', code: 'META' },
			{ market: 'us', code: 'PLTR' },
			{ market: 'us', code: 'CRM' },
			{ market: 'us', code: 'ORCL' },
			{ market: 'us', code: 'NOW' },
		],
	},
	{
		code: 'semi-equip',
		name: '半导体设备',
		members: [
			{ market: 'us', code: 'AMAT' },
			{ market: 'us', code: 'LRCX' },
			{ market: 'us', code: 'KLAC' },
			{ market: 'us', code: 'ASML' },
			{ market: 'us', code: 'TER' },
		],
	},
	{
		code: 'robotics',
		name: '机器人',
		members: [
			{ market: 'us', code: 'ISRG' },
			{ market: 'us', code: 'ROK' },
			{ market: 'us', code: 'ABB' },
			{ market: 'us', code: 'SYM' },
			{ market: 'us', code: 'PATH' },
		],
	},
	{
		code: 'ev',
		name: '电动车',
		members: [
			{ market: 'us', code: 'TSLA' },
			{ market: 'us', code: 'NIO' },
			{ market: 'us', code: 'XPEV' },
			{ market: 'us', code: 'LI' },
			{ market: 'us', code: 'RIVN' },
			{ market: 'us', code: 'LCID' },
		],
	},
	{
		code: 'adas',
		name: '自动驾驶',
		members: [
			{ market: 'us', code: 'TSLA' },
			{ market: 'us', code: 'MBLY' },
			{ market: 'us', code: 'RIVN' },
			{ market: 'us', code: 'GOOGL' },
			{ market: 'us', code: 'GM' },
		],
	},
	{
		code: 'biotech',
		name: '创新药',
		members: [
			{ market: 'us', code: 'LLY' },
			{ market: 'us', code: 'NVO' },
			{ market: 'us', code: 'VRTX' },
			{ market: 'us', code: 'REGN' },
			{ market: 'us', code: 'AMGN' },
			{ market: 'us', code: 'MRNA' },
		],
	},
	{
		code: 'china-web',
		name: '中概互联网',
		members: [
			{ market: 'us', code: 'BABA' },
			{ market: 'us', code: 'JD' },
			{ market: 'us', code: 'PDD' },
			{ market: 'us', code: 'BIDU' },
			{ market: 'us', code: 'NTES' },
			{ market: 'us', code: 'TCOM' },
			{ market: 'us', code: 'BILI' },
		],
	},
	{
		code: 'lithium-battery',
		name: '锂电 / 储能',
		members: [
			{ market: 'us', code: 'ALB' },
			{ market: 'us', code: 'SQM' },
			{ market: 'us', code: 'QS' },
			{ market: 'us', code: 'ENPH' },
			{ market: 'us', code: 'FLNC' },
		],
	},
	{
		code: 'rare-earth',
		name: '稀土 / 战略金属',
		members: [
			{ market: 'us', code: 'MP' },
			{ market: 'us', code: 'USAR' },
			{ market: 'us', code: 'UUUU' },
			{ market: 'us', code: 'TMC' },
		],
	},
	{
		code: 'gold',
		name: '贵金属',
		members: [
			{ market: 'us', code: 'NEM' },
			{ market: 'us', code: 'GOLD' },
			{ market: 'us', code: 'AEM' },
			{ market: 'us', code: 'KGC' },
			{ market: 'us', code: 'WPM' },
		],
	},
	{
		code: 'oil-gas',
		name: '油气',
		members: [
			{ market: 'us', code: 'XOM' },
			{ market: 'us', code: 'CVX' },
			{ market: 'us', code: 'COP' },
			{ market: 'us', code: 'EOG' },
			{ market: 'us', code: 'OXY' },
			{ market: 'us', code: 'SLB' },
		],
	},
	{
		code: 'nuclear',
		name: '核能 / 铀',
		members: [
			{ market: 'us', code: 'CCJ' },
			{ market: 'us', code: 'UEC' },
			{ market: 'us', code: 'NXE' },
			{ market: 'us', code: 'LEU' },
			{ market: 'us', code: 'SMR' },
			{ market: 'us', code: 'OKLO' },
		],
	},
	{
		code: 'crypto',
		name: '加密货币概念',
		members: [
			{ market: 'us', code: 'COIN' },
			{ market: 'us', code: 'MSTR' },
			{ market: 'us', code: 'MARA' },
			{ market: 'us', code: 'RIOT' },
			{ market: 'us', code: 'CLSK' },
		],
	},
	{
		code: 'quantum',
		name: '量子计算',
		members: [
			{ market: 'us', code: 'IONQ' },
			{ market: 'us', code: 'RGTI' },
			{ market: 'us', code: 'QBTS' },
			{ market: 'us', code: 'QUBT' },
		],
	},
	{
		code: 'defense',
		name: '军工航天',
		members: [
			{ market: 'us', code: 'LMT' },
			{ market: 'us', code: 'RTX' },
			{ market: 'us', code: 'NOC' },
			{ market: 'us', code: 'GD' },
			{ market: 'us', code: 'RKLB' },
		],
	},
	{
		code: 'cloud',
		name: '云计算',
		members: [
			{ market: 'us', code: 'AMZN' },
			{ market: 'us', code: 'MSFT' },
			{ market: 'us', code: 'GOOGL' },
			{ market: 'us', code: 'ORCL' },
			{ market: 'us', code: 'SNOW' },
			{ market: 'us', code: 'DDOG' },
			{ market: 'us', code: 'CRWD' },
			{ market: 'us', code: 'NET' },
		],
	},
	{
		code: 'ecommerce',
		name: '电商零售',
		members: [
			{ market: 'us', code: 'AMZN' },
			{ market: 'us', code: 'EBAY' },
			{ market: 'us', code: 'SHOP' },
			{ market: 'us', code: 'MELI' },
			{ market: 'us', code: 'WMT' },
			{ market: 'us', code: 'COST' },
		],
	},
	{
		code: 'games',
		name: '游戏',
		members: [
			{ market: 'us', code: 'TTWO' },
			{ market: 'us', code: 'EA' },
			{ market: 'us', code: 'RBLX' },
			{ market: 'us', code: 'U' },
		],
	},
	{
		code: 'consumer-elec',
		name: '消费电子',
		members: [
			{ market: 'us', code: 'AAPL' },
			{ market: 'us', code: 'SONY' },
			{ market: 'us', code: 'DELL' },
			{ market: 'us', code: 'HPQ' },
			{ market: 'us', code: 'LOGI' },
		],
	},
]

/** 港股题材板块 */
export const HK_CONCEPT_SECTORS: CuratedSectorDef[] = [
	{
		code: 'china-web',
		name: '中概互联网',
		members: [
			{ market: 'hk', code: '00700' },
			{ market: 'hk', code: '09988' },
			{ market: 'hk', code: '09618' },
			{ market: 'hk', code: '03690' },
			{ market: 'hk', code: '09999' },
			{ market: 'hk', code: '09888' },
			{ market: 'hk', code: '01024' },
		],
	},
	{
		code: 'ai-compute',
		name: 'AI / 算力',
		members: [
			{ market: 'hk', code: '00763' },
			{ market: 'hk', code: '00981' },
			{ market: 'hk', code: '01347' },
			{ market: 'hk', code: '00522' },
		],
	},
	{
		code: 'semi',
		name: '半导体',
		members: [
			{ market: 'hk', code: '00981' },
			{ market: 'hk', code: '01347' },
			{ market: 'hk', code: '00522' },
		],
	},
	{
		code: 'new-consumer',
		name: '新消费 / 潮玩',
		members: [
			{ market: 'hk', code: '09992' },
			{ market: 'hk', code: '02020' },
			{ market: 'hk', code: '02331' },
			{ market: 'hk', code: '06862' },
			{ market: 'hk', code: '09633' },
		],
	},
	{
		code: 'biotech',
		name: '创新药',
		members: [
			{ market: 'hk', code: '01801' },
			{ market: 'hk', code: '06160' },
			{ market: 'hk', code: '03692' },
			{ market: 'hk', code: '02269' },
			{ market: 'hk', code: '02359' },
			{ market: 'hk', code: '01093' },
			{ market: 'hk', code: '01177' },
		],
	},
	{
		code: 'ev',
		name: '新能源车',
		members: [
			{ market: 'hk', code: '01211' },
			{ market: 'hk', code: '09868' },
			{ market: 'hk', code: '02015' },
			{ market: 'hk', code: '09866' },
		],
	},
	{
		code: 'property',
		name: '内房股',
		members: [
			{ market: 'hk', code: '00688' },
			{ market: 'hk', code: '01109' },
			{ market: 'hk', code: '00960' },
			{ market: 'hk', code: '02007' },
		],
	},
	{
		code: 'banks',
		name: '银行',
		members: [
			{ market: 'hk', code: '00939' },
			{ market: 'hk', code: '01398' },
			{ market: 'hk', code: '03988' },
			{ market: 'hk', code: '01288' },
			{ market: 'hk', code: '00005' },
			{ market: 'hk', code: '02388' },
		],
	},
	{
		code: 'insurance',
		name: '保险',
		members: [
			{ market: 'hk', code: '01299' },
			{ market: 'hk', code: '02318' },
			{ market: 'hk', code: '02628' },
		],
	},
	{
		code: 'telecom',
		name: '电讯运营商',
		members: [
			{ market: 'hk', code: '00941' },
			{ market: 'hk', code: '00728' },
			{ market: 'hk', code: '00762' },
		],
	},
	{
		code: 'oil',
		name: '石油石化',
		members: [
			{ market: 'hk', code: '00386' },
			{ market: 'hk', code: '00857' },
			{ market: 'hk', code: '00883' },
		],
	},
	{
		code: 'utility-coal',
		name: '电力煤炭',
		members: [
			{ market: 'hk', code: '01088' },
			{ market: 'hk', code: '00902' },
			{ market: 'hk', code: '00002' },
		],
	},
	{
		code: 'gold-metal',
		name: '黄金有色',
		members: [
			{ market: 'hk', code: '02899' },
			{ market: 'hk', code: '01818' },
			{ market: 'hk', code: '03993' },
		],
	},
	{
		code: 'food-bev',
		name: '食品饮料',
		members: [
			{ market: 'hk', code: '00291' },
			{ market: 'hk', code: '02319' },
			{ market: 'hk', code: '00322' },
		],
	},
	{
		code: 'casino',
		name: '博彩',
		members: [
			{ market: 'hk', code: '00880' },
			{ market: 'hk', code: '01928' },
			{ market: 'hk', code: '00027' },
		],
	},
	{
		code: 'logistics',
		name: '快递物流',
		members: [
			{ market: 'hk', code: '02057' },
			{ market: 'hk', code: '02618' },
			{ market: 'hk', code: '00619' },
		],
	},
]

export const CONCEPT_SECTORS: Record<'hk' | 'us', CuratedSectorDef[]> = {
	hk: HK_CONCEPT_SECTORS,
	us: US_CONCEPT_SECTORS,
}

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
