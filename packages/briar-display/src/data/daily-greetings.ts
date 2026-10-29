/**
 * 首页每日一句：打招呼 + 人生哲理 / 科学 / 文化短句。
 * 按 Asia/Shanghai 日历日稳定抽取，同一天同一条，跨日换新；亦可「换一句」随机。
 * 大字标题由 french-quotes 按池下标叠加；本池 line 为中文副句（不含代码/技术梗）。
 * 每条带 kind，用于明信片分类贴纸。
 */

import { frenchQuoteAt } from '@/data/french-quotes'

export type GreetingKind = 'proverb' | 'joke' | 'encourage' | 'witty' | 'seasonal' | 'calm'

export interface DailyGreeting {
	/** 大字标题：现为法语名言（由 frenchQuoteAt 叠加；池内原中文招呼仅作占位） */
	greet: string
	/** 作者小字（法语名言） */
	author?: string
	/** 哲理 / 科学 / 文化短句（小字，中文） */
	line: string
	/** 语气分类 */
	kind: GreetingKind
}

export const GREETING_KIND_LABEL: Record<GreetingKind, string> = {
	proverb: '名言',
	joke: '笑话',
	encourage: '加油',
	witty: '俏皮',
	seasonal: '时令',
	calm: '静心',
}

export const DAILY_GREETINGS: readonly DailyGreeting[] = [
	{ greet: '早上好', line: '路遥知马力，日久见人心。', kind: 'proverb' },
	{ greet: '早安', line: '三人行，必有我师焉。', kind: 'proverb' },
	{ greet: '午安', line: '学而不思则罔，思而不学则殆。', kind: 'proverb' },
	{ greet: '下午好', line: '工欲善其事，必先利其器。', kind: 'proverb' },
	{ greet: '晚上好', line: '不积跬步，无以至千里。', kind: 'proverb' },
	{ greet: '夜里好', line: '知之者不如好之者，好之者不如乐之者。', kind: 'proverb' },
	{ greet: '嗨', line: '欲速则不达。', kind: 'proverb' },
	{ greet: '你好呀', line: '塞翁失马，焉知非福。', kind: 'proverb' },
	{ greet: '嘿', line: '己所不欲，勿施于人。', kind: 'proverb' },
	{ greet: '朋友', line: '海内存知己，天涯若比邻。', kind: 'proverb' },
	{ greet: '又见面了', line: '少壮不努力，老大徒伤悲。', kind: 'proverb' },
	{ greet: '欢迎回来', line: '书山有路勤为径，学海无涯苦作舟。', kind: 'proverb' },
	{ greet: '来啦', line: '纸上得来终觉浅，绝知此事要躬行。', kind: 'proverb' },
	{ greet: '坐下喝杯茶', line: '山重水复疑无路，柳暗花明又一村。', kind: 'proverb' },
	{ greet: '慢慢看', line: '会当凌绝顶，一览众山小。', kind: 'encourage' },
	{ greet: '今天也加油', line: '天生我材必有用。', kind: 'encourage' },
	{ greet: '先喝口水', line: '长风破浪会有时，直挂云帆济沧海。', kind: 'encourage' },
	{ greet: '别急', line: '落红不是无情物，化作春泥更护花。', kind: 'proverb' },
	{ greet: '今天也来逛逛', line: '谁言寸草心，报得三春晖。', kind: 'proverb' },
	{ greet: '新的一天', line: '静以修身，俭以养德。', kind: 'calm' },
	{ greet: '下午好呀', line: '非淡泊无以明志，非宁静无以致远。', kind: 'calm' },
	{ greet: '早安呀', line: '千里之行，始于足下。', kind: 'proverb' },
	{ greet: '晚安前先看看', line: '不经一事，不长一智。', kind: 'proverb' },
	{ greet: '周末好', line: '吃一堑，长一智。', kind: 'encourage' },
	{ greet: '工作日加油', line: '失败是成功之母。', kind: 'encourage' },
	{ greet: '歇一会儿', line: '有志者事竟成。', kind: 'encourage' },
	{ greet: '抬头看看', line: '天下无难事，只怕有心人。', kind: 'encourage' },
	{ greet: '深呼吸', line: '滴水穿石，不是力量大，而是功夫深。', kind: 'encourage' },
	{ greet: '微笑一下', line: '种瓜得瓜，种豆得豆。', kind: 'proverb' },
	{ greet: '给自己鼓鼓掌', line: '一分耕耘，一分收获。', kind: 'proverb' },
	{ greet: '早上好', line: '磨刀不误砍柴工。', kind: 'proverb' },
	{ greet: '早安', line: '临渊羡鱼，不如退而结网。', kind: 'proverb' },
	{ greet: '午安', line: '当局者迷，旁观者清。', kind: 'proverb' },
	{ greet: '下午好', line: '兼听则明，偏信则暗。', kind: 'proverb' },
	{ greet: '晚上好', line: '满招损，谦受益。', kind: 'proverb' },
	{ greet: '夜里好', line: '知足常乐。', kind: 'calm' },
	{ greet: '嗨', line: '赠人玫瑰，手有余香。', kind: 'proverb' },
	{ greet: '你好呀', line: '良言一句三冬暖。', kind: 'proverb' },
	{ greet: '嘿', line: '诚实是最好的策略。', kind: 'proverb' },
	{ greet: '朋友', line: '时间是最好的老师。', kind: 'proverb' },
	{ greet: '又见面了', line: '机会总是留给有准备的人。', kind: 'proverb' },
	{ greet: '欢迎回来', line: '细节决定成败。', kind: 'proverb' },
	{ greet: '来啦', line: '行动胜于言语。', kind: 'proverb' },
	{ greet: '坐下喝杯茶', line: '今日事，今日毕。', kind: 'encourage' },
	{ greet: '慢慢看', line: '早起的鸟儿有虫吃。', kind: 'proverb' },
	{ greet: '今天也加油', line: '积少成多，聚沙成塔。', kind: 'proverb' },
	{ greet: '先喝口水', line: '水滴石穿，绳锯木断。', kind: 'encourage' },
	{ greet: '别急', line: '宝剑锋从磨砺出，梅花香自苦寒来。', kind: 'encourage' },
	{ greet: '今天也来逛逛', line: '不畏浮云遮望眼。', kind: 'encourage' },
	{ greet: '新的一天', line: '守得云开见月明。', kind: 'encourage' },
	{ greet: '下午好呀', line: '一寸光阴一寸金。', kind: 'proverb' },
	{ greet: '早安呀', line: '光阴似箭，日月如梭。', kind: 'proverb' },
	{ greet: '晚安前先看看', line: '逝者如斯夫，不舍昼夜。', kind: 'proverb' },
	{ greet: '周末好', line: '往者不可谏，来者犹可追。', kind: 'proverb' },
	{ greet: '工作日加油', line: '前事不忘，后事之师。', kind: 'proverb' },
	{ greet: '歇一会儿', line: '温故而知新。', kind: 'proverb' },
	{ greet: '抬头看看', line: '学而时习之，不亦说乎。', kind: 'proverb' },
	{ greet: '深呼吸', line: '有朋自远方来，不亦乐乎。', kind: 'proverb' },
	{ greet: '微笑一下', line: '人而无信，不知其可也。', kind: 'proverb' },
	{ greet: '给自己鼓鼓掌', line: '君子坦荡荡，小人长戚戚。', kind: 'proverb' },
	{ greet: '早上好', line: '富贵不能淫，贫贱不能移。', kind: 'proverb' },
	{ greet: '早安', line: '天行健，君子以自强不息。', kind: 'encourage' },
	{ greet: '午安', line: '地势坤，君子以厚德载物。', kind: 'proverb' },
	{ greet: '下午好', line: '勿以恶小而为之，勿以善小而不为。', kind: 'proverb' },
	{ greet: '晚上好', line: '见贤思齐焉，见不贤而内自省也。', kind: 'proverb' },
	{ greet: '夜里好', line: '三思而后行。', kind: 'proverb' },
	{ greet: '嗨', line: '预则立，不预则废。', kind: 'proverb' },
	{ greet: '你好呀', line: '知己知彼，百战不殆。', kind: 'proverb' },
	{ greet: '嘿', line: '祸兮福所倚，福兮祸所伏。', kind: 'proverb' },
	{ greet: '朋友', line: '上善若水，水善利万物而不争。', kind: 'calm' },
	{ greet: '又见面了', line: '大道至简。', kind: 'calm' },
	{ greet: '欢迎回来', line: '大音希声，大象无形。', kind: 'calm' },
	{ greet: '来啦', line: '知者不惑，仁者不忧，勇者不惧。', kind: 'proverb' },
	{ greet: '坐下喝杯茶', line: '己欲立而立人，己欲达而达人。', kind: 'proverb' },
	{ greet: '慢慢看', line: '博学之，审问之，慎思之，明辨之，笃行之。', kind: 'proverb' },
	{ greet: '今天也加油', line: '吾日三省吾身。', kind: 'calm' },
	{ greet: '先喝口水', line: '人皆可以为尧舜。', kind: 'encourage' },
	{ greet: '别急', line: '穷则独善其身，达则兼济天下。', kind: 'proverb' },
	{ greet: '今天也来逛逛', line: '不以物喜，不以己悲。', kind: 'calm' },
	{ greet: '新的一天', line: '先天下之忧而忧，后天下之乐而乐。', kind: 'proverb' },
	{ greet: '下午好呀', line: '天下兴亡，匹夫有责。', kind: 'proverb' },
	{ greet: '早安呀', line: '读万卷书，行万里路。', kind: 'encourage' },
	{ greet: '晚安前先看看', line: '生活不止眼前的苟且，还有诗和远方。', kind: 'encourage' },
	{ greet: '周末好', line: '人生如逆旅，我亦是行人。', kind: 'calm' },
	{ greet: '工作日加油', line: '此心安处是吾乡。', kind: 'calm' },
	{ greet: '歇一会儿', line: '采菊东篱下，悠然见南山。', kind: 'calm' },
	{ greet: '抬头看看', line: '行到水穷处，坐看云起时。', kind: 'calm' },
	{ greet: '深呼吸', line: '宠辱不惊，看庭前花开花落。', kind: 'calm' },
	{ greet: '微笑一下', line: '去留无意，望天上云卷云舒。', kind: 'calm' },
	{ greet: '给自己鼓鼓掌', line: '人生得意须尽欢，莫使金樽空对月。', kind: 'witty' },
	{ greet: '早上好', line: '但愿人长久，千里共婵娟。', kind: 'proverb' },
	{ greet: '早安', line: '两情若是久长时，又岂在朝朝暮暮。', kind: 'proverb' },
	{ greet: '午安', line: '莫愁前路无知己，天下谁人不识君。', kind: 'encourage' },
	{ greet: '下午好', line: '海阔凭鱼跃，天高任鸟飞。', kind: 'encourage' },
	{ greet: '晚上好', line: '黑发不知勤学早，白首方悔读书迟。', kind: 'encourage' },
	{ greet: '夜里好', line: '业精于勤，荒于嬉。', kind: 'encourage' },
	{ greet: '嗨', line: '一屋不扫，何以扫天下。', kind: 'proverb' },
	{ greet: '你好呀', line: '不义而富且贵，于我如浮云。', kind: 'proverb' },
	{ greet: '嘿', line: '岁寒，然后知松柏之后凋。', kind: 'proverb' },
	{ greet: '朋友', line: '近朱者赤，近墨者黑。', kind: 'proverb' },
	{ greet: '又见面了', line: '君子之交淡如水。', kind: 'proverb' },
	{ greet: '欢迎回来', line: '患难见真情。', kind: 'proverb' },
	{ greet: '来啦', line: '亡羊补牢，犹未为晚。', kind: 'encourage' },
	{ greet: '坐下喝杯茶', line: '未雨绸缪。', kind: 'proverb' },
	{ greet: '慢慢看', line: '防微杜渐。', kind: 'proverb' },
	{ greet: '今天也加油', line: '千里之堤，溃于蚁穴。', kind: 'proverb' },
	{ greet: '先喝口水', line: '差之毫厘，谬以千里。', kind: 'proverb' },
	{ greet: '别急', line: '过犹不及。', kind: 'proverb' },
	{ greet: '今天也来逛逛', line: '言必信，行必果。', kind: 'proverb' },
	{ greet: '新的一天', line: '敏而好学，不耻下问。', kind: 'encourage' },
	{ greet: '下午好呀', line: '学如逆水行舟，不进则退。', kind: 'encourage' },
	{ greet: '早安呀', line: '人生没有白走的路，每一步都算数。', kind: 'encourage' },
	{ greet: '晚安前先看看', line: '把简单的事情坚持做，就是不简单。', kind: 'encourage' },
	{ greet: '周末好', line: '真正的自由，是选择的责任。', kind: 'calm' },
	{ greet: '工作日加油', line: '幸福不是终点，而是路上的风景。', kind: 'calm' },
	{ greet: '歇一会儿', line: '比较是快乐的小偷。', kind: 'witty' },
	{ greet: '抬头看看', line: '种一棵树最好的时间是十年前，其次是现在。', kind: 'encourage' },
	{ greet: '深呼吸', line: '完成比完美更重要。', kind: 'encourage' },
	{ greet: '微笑一下', line: '少即是多。', kind: 'calm' },
	{ greet: '给自己鼓鼓掌', line: '慢即是快。', kind: 'calm' },
	{ greet: '早上好', line: '接纳不完美，是成熟的开始。', kind: 'calm' },
	{ greet: '早安', line: '温柔是一种力量。', kind: 'calm' },
	{ greet: '午安', line: '善良不必张扬，但要坚定。', kind: 'proverb' },
	{ greet: '下午好', line: '先理解，再被理解。', kind: 'proverb' },
	{ greet: '晚上好', line: '倾听是最高级的尊重。', kind: 'calm' },
	{ greet: '夜里好', line: '边界感，是爱自己的方式。', kind: 'calm' },
	{ greet: '嗨', line: '休息不是偷懒，是为了走更远。', kind: 'calm' },
	{ greet: '你好呀', line: '今天的耐心，是明天的从容。', kind: 'encourage' },
	{ greet: '嘿', line: '把难事拆成小步，一步也能前进。', kind: 'encourage' },
	{ greet: '朋友', line: '勇气不是不害怕，而是害怕也去做。', kind: 'encourage' },
	{ greet: '又见面了', line: '成长往往发生在舒适区之外。', kind: 'encourage' },
	{ greet: '欢迎回来', line: '你对待时间的方式，就是对待生命的方式。', kind: 'proverb' },
	{ greet: '来啦', line: '心若向阳，无谓悲伤。', kind: 'encourage' },
	{ greet: '坐下喝杯茶', line: '人生海海，各自灿烂。', kind: 'calm' },
	{ greet: '慢慢看', line: '岁月不居，时节如流。', kind: 'seasonal' },
	{ greet: '今天也加油', line: '一花一世界，一叶一菩提。', kind: 'calm' },
	{ greet: '先喝口水', line: '相由心生，境随心转。', kind: 'calm' },
	{ greet: '别急', line: '心安即是归处。', kind: 'calm' },
	{ greet: '今天也来逛逛', line: '知止而后有定。', kind: 'calm' },
	{ greet: '新的一天', line: '定而后能静，静而后能安。', kind: 'calm' },
	{ greet: '下午好呀', line: '反者道之动。', kind: 'proverb' },
	{ greet: '早安呀', line: '柔弱胜刚强。', kind: 'proverb' },
	{ greet: '晚安前先看看', line: '大智若愚，大巧若拙。', kind: 'proverb' },
	{ greet: '周末好', line: '知人者智，自知者明。', kind: 'proverb' },
	{ greet: '工作日加油', line: '胜人者有力，自胜者强。', kind: 'encourage' },
	{ greet: '歇一会儿', line: '知足不辱，知止不殆。', kind: 'calm' },
	{ greet: '抬头看看', line: '天地有大美而不言。', kind: 'calm' },
	{ greet: '深呼吸', line: '独与天地精神往来。', kind: 'calm' },
	{ greet: '微笑一下', line: '及时当勉励，岁月不待人。', kind: 'encourage' },
	{ greet: '给自己鼓鼓掌', line: '盛年不重来，一日难再晨。', kind: 'encourage' },
	{ greet: '早上好', line: '问渠那得清如许？为有源头活水来。', kind: 'proverb' },
	{ greet: '早安', line: '等闲识得东风面，万紫千红总是春。', kind: 'seasonal' },
	{ greet: '午安', line: '春风又绿江南岸。', kind: 'seasonal' },
	{ greet: '下午好', line: '随风潜入夜，润物细无声。', kind: 'seasonal' },
	{ greet: '晚上好', line: '接天莲叶无穷碧，映日荷花别样红。', kind: 'seasonal' },
	{ greet: '夜里好', line: '停车坐爱枫林晚，霜叶红于二月花。', kind: 'seasonal' },
	{ greet: '嗨', line: '忽如一夜春风来，千树万树梨花开。', kind: 'seasonal' },
	{ greet: '你好呀', line: '一年之计在于春，一日之计在于晨。', kind: 'seasonal' },
	{ greet: '嘿', line: '瑞雪兆丰年。', kind: 'seasonal' },
	{ greet: '朋友', line: '春困秋乏夏打盹，冬日围炉正当时。', kind: 'seasonal' },
	{ greet: '又见面了', line: '清明时节雨纷纷。', kind: 'seasonal' },
	{ greet: '欢迎回来', line: '白露身不露，寒露脚不露。', kind: 'seasonal' },
	{ greet: '来啦', line: '冬至大如年。', kind: 'seasonal' },
	{ greet: '坐下喝杯茶', line: '月到中秋分外明。', kind: 'seasonal' },
	{ greet: '慢慢看', line: '每逢佳节倍思亲。', kind: 'seasonal' },
	{ greet: '今天也加油', line: '爆竹声中一岁除，春风送暖入屠苏。', kind: 'seasonal' },
	{ greet: '先喝口水', line: '好奇心，是科学的起点。', kind: 'encourage' },
	{ greet: '别急', line: '提出好问题，比急着给答案更珍贵。', kind: 'proverb' },
	{ greet: '今天也来逛逛', line: '证据说话，偏见闭嘴。', kind: 'proverb' },
	{ greet: '新的一天', line: '可证伪，才是科学命题的气质。', kind: 'witty' },
	{ greet: '下午好呀', line: '测量即认识的开始。', kind: 'proverb' },
	{ greet: '早安呀', line: '误差不可怕，可怕的是装作没有误差。', kind: 'witty' },
	{ greet: '晚安前先看看', line: '简化模型是为了看清本质，不是为了假装世界简单。', kind: 'calm' },
	{ greet: '周末好', line: '星空在上，规律在心。', kind: 'calm' },
	{ greet: '工作日加油', line: '我们都是星尘的孩子。', kind: 'calm' },
	{ greet: '歇一会儿', line: '光年之外，仍是同一套物理。', kind: 'calm' },
	{ greet: '抬头看看', line: '时间是相对的，珍惜是绝对的。', kind: 'witty' },
	{ greet: '深呼吸', line: '熵增是宇宙的脾气，整理是我们的反抗。', kind: 'witty' },
	{ greet: '微笑一下', line: '能量守恒：你付出的，总会以某种形式回来。', kind: 'proverb' },
	{ greet: '给自己鼓鼓掌', line: '作用力与反作用力：世界很少单方面回应你。', kind: 'witty' },
	{ greet: '早上好', line: '惯性：改变方向，总要多费一点力。', kind: 'encourage' },
	{ greet: '早安', line: '引力让星球相依，也让我们脚踏实地。', kind: 'calm' },
	{ greet: '午安', line: '原子空空如也，却撑起了坚实世界。', kind: 'witty' },
	{ greet: '下午好', line: '量子世界允许不确定，生活偶尔也该允许。', kind: 'calm' },
	{ greet: '晚上好', line: '薛定谔的猫教会我们：未观测前，多一种可能。', kind: 'witty' },
	{ greet: '夜里好', line: '光速是上限，想象力不是。', kind: 'encourage' },
	{ greet: '嗨', line: 'DNA 是生命写给自己的信。', kind: 'calm' },
	{ greet: '你好呀', line: '进化不追求完美，只追求够用。', kind: 'witty' },
	{ greet: '嘿', line: '适者生存，不只是强壮，更是适配。', kind: 'proverb' },
	{ greet: '朋友', line: '光合作用：叶子把阳光变成糖。', kind: 'seasonal' },
	{ greet: '又见面了', line: '碳循环把我们和远古森林连在一起。', kind: 'calm' },
	{ greet: '欢迎回来', line: '水是极性分子，也是生命的溶剂。', kind: 'calm' },
	{ greet: '来啦', line: '晶体生长需要时间与耐心。', kind: 'calm' },
	{ greet: '坐下喝杯茶', line: '催化剂加快反应，但不改变结果的方向。', kind: 'proverb' },
	{ greet: '慢慢看', line: '酸碱中和：极端相遇，归于平和。', kind: 'calm' },
	{ greet: '今天也加油', line: '元素周期表是化学的地图。', kind: 'proverb' },
	{ greet: '先喝口水', line: '同位素告诉考古学家：时间可以称量。', kind: 'witty' },
	{ greet: '别急', line: '地质年代里，人类只是短暂的一页。', kind: 'calm' },
	{ greet: '今天也来逛逛', line: '板块漂移：大地也在缓慢旅行。', kind: 'calm' },
	{ greet: '新的一天', line: '化石是石头写的传记。', kind: 'calm' },
	{ greet: '下午好呀', line: '磁场保护我们，免受太阳风直击。', kind: 'calm' },
	{ greet: '早安呀', line: '臭氧层薄薄一层，托起了呼吸。', kind: 'calm' },
	{ greet: '晚安前先看看', line: '温室效应本是毯子，过厚才成问题。', kind: 'proverb' },
	{ greet: '周末好', line: '气候变化是集体行动的考卷。', kind: 'encourage' },
	{ greet: '工作日加油', line: '生物多样性是星球的保险柜。', kind: 'proverb' },
	{ greet: '歇一会儿', line: '混沌不是无序，是对初值极度敏感。', kind: 'calm' },
	{ greet: '抬头看看', line: '分形：局部像整体，自然爱自相似。', kind: 'calm' },
	{ greet: '深呼吸', line: '斐波那契数列藏在松果与向日葵里。', kind: 'seasonal' },
	{ greet: '微笑一下', line: '黄金比例未必神秘，却常让人觉得美。', kind: 'calm' },
	{ greet: '给自己鼓鼓掌', line: '对称破缺，才有丰富的世界。', kind: 'witty' },
	{ greet: '早上好', line: '信息可以被复制，理解不能。', kind: 'proverb' },
	{ greet: '早安', line: '噪声里也有信号，耐心去滤波。', kind: 'encourage' },
	{ greet: '午安', line: '统计告诉我们趋势，个例讲述故事。', kind: 'proverb' },
	{ greet: '下午好', line: '相关不是因果——别被巧合绑架。', kind: 'witty' },
	{ greet: '晚上好', line: '大数定律：足够多次，规律会现身。', kind: 'proverb' },
	{ greet: '夜里好', line: '贝叶斯：新证据来了，信念该更新。', kind: 'encourage' },
	{ greet: '嗨', line: '零假设是谦逊：先假设自己可能错了。', kind: 'calm' },
	{ greet: '你好呀', line: '实验可重复，才配称为发现。', kind: 'proverb' },
	{ greet: '嘿', line: '失败的实验也是数据。', kind: 'encourage' },
	{ greet: '朋友', line: '望远镜延长眼睛，显微镜延长细节。', kind: 'calm' },
	{ greet: '又见面了', line: '光谱是星光的指纹。', kind: 'calm' },
	{ greet: '欢迎回来', line: '红移诉说宇宙在膨胀。', kind: 'calm' },
	{ greet: '来啦', line: '黑洞不吃光，只是光逃不走。', kind: 'witty' },
	{ greet: '坐下喝杯茶', line: '暗物质看不见，却拉着星系转。', kind: 'calm' },
	{ greet: '慢慢看', line: '中微子几乎不与你互动，却穿你而过。', kind: 'witty' },
	{ greet: '今天也加油', line: '声波是空气的涟漪。', kind: 'calm' },
	{ greet: '先喝口水', line: '共鸣：同频的事物更容易互相听见。', kind: 'proverb' },
	{ greet: '别急', line: '棱镜把白光拆成彩虹，分析把问题拆成部分。', kind: 'proverb' },
	{ greet: '今天也来逛逛', line: '折射让筷子「断」了——眼见未必为实。', kind: 'witty' },
	{ greet: '新的一天', line: '热胀冷缩，材料在呼吸。', kind: 'seasonal' },
	{ greet: '下午好呀', line: '绝对零度不可达，完美亦然。', kind: 'calm' },
	{ greet: '早安呀', line: '永动机不存在：没有免费的午餐。', kind: 'witty' },
	{ greet: '晚安前先看看', line: '热力学第二定律：收拾房间总要费劲。', kind: 'witty' },
	{ greet: '周末好', line: 'GPS 要校正相对论，否则你会迷路。', kind: 'witty' },
	{ greet: '工作日加油', line: '疫苗教会免疫系统记住敌人。', kind: 'encourage' },
	{ greet: '歇一会儿', line: '抗生素不是糖果，耐药是警钟。', kind: 'proverb' },
	{ greet: '抬头看看', line: '睡眠是大脑的夜间维护。', kind: 'calm' },
	{ greet: '深呼吸', line: '运动分泌的不只是汗，还有清晰。', kind: 'encourage' },
	{ greet: '微笑一下', line: '神经可塑性：练习会改写大脑地图。', kind: 'encourage' },
	{ greet: '给自己鼓鼓掌', line: '习惯是回路，改习惯是重新接线。', kind: 'encourage' },
	{ greet: '早上好', line: '注意力是稀缺资源，像能量一样守恒。', kind: 'proverb' },
	{ greet: '早安', line: '记忆会重构，别把回忆当成录像。', kind: 'witty' },
	{ greet: '午安', line: '确认偏误：我们爱找支持自己的证据。', kind: 'witty' },
	{ greet: '下午好', line: '幸存者偏差：看见的成功，藏着看不见的失败。', kind: 'proverb' },
	{ greet: '晚上好', line: '奥卡姆剃刀：能简单就别复杂。', kind: 'proverb' },
	{ greet: '夜里好', line: '第一性原理：回到事物本身去想。', kind: 'encourage' },
	{ greet: '嗨', line: '科学是暂时的正确，等待更好的推翻。', kind: 'calm' },
	{ greet: '你好呀', line: '站在巨人肩上，不是为了仰望，是为了望远。', kind: 'encourage' },
	{ greet: '嘿', line: '牛顿看见苹果，也看见了月亮同一套力。', kind: 'calm' },
	{ greet: '朋友', line: '达尔文让我们明白：变化是常态。', kind: 'proverb' },
	{ greet: '又见面了', line: '爱因斯坦：想象力比知识更重要。', kind: 'encourage' },
	{ greet: '欢迎回来', line: '居里夫人：生活中没有什么可怕，只有需要理解。', kind: 'encourage' },
	{ greet: '来啦', line: '费曼：如果你不能简单地解释，你就还没真正懂。', kind: 'proverb' },
	{ greet: '坐下喝杯茶', line: '波普尔：科学靠证伪进步。', kind: 'proverb' },
	{ greet: '慢慢看', line: '阿基米德：给我一个支点，我能撬动地球。', kind: 'encourage' },
	{ greet: '今天也加油', line: '圆周率无理却有序，像某些人生。', kind: 'witty' },
	{ greet: '先喝口水', line: '质数是整数世界的原子。', kind: 'calm' },
	{ greet: '别急', line: '无穷不是数，是一种方向。', kind: 'calm' },
	{ greet: '今天也来逛逛', line: '门捷列夫按性质排元素，空位预言了未来。', kind: 'encourage' },
	{ greet: '新的一天', line: '孟德尔的豌豆：遗传规律藏在花园里。', kind: 'seasonal' },
	{ greet: '下午好呀', line: '霍金：望向星空，是望向我们的来处。', kind: 'calm' },
	{ greet: '早安呀', line: '卡尔·萨根：我们是认识宇宙的方式，宇宙认识自己。', kind: 'calm' },
	{ greet: '晚安前先看看', line: '地球是一颗苍蓝弹珠，值得温柔以待。', kind: 'calm' },
	{ greet: '周末好', line: '火星上的日落是蓝色的——换个星球，常识也会换。', kind: 'witty' },
	{ greet: '工作日加油', line: '土星的环是碎冰块的芭蕾。', kind: 'calm' },
	{ greet: '歇一会儿', line: '木星的大红斑是一座持续数百年的风暴。', kind: 'witty' },
	{ greet: '抬头看看', line: '彗星拖着尾巴拜访，像远方的信使。', kind: 'seasonal' },
	{ greet: '深呼吸', line: '流星是尘埃燃烧的告别。', kind: 'seasonal' },
	{ greet: '微笑一下', line: '月相盈亏，潮汐随之起落。', kind: 'seasonal' },
	{ greet: '给自己鼓鼓掌', line: '日食是影子的精确约会。', kind: 'seasonal' },
	{ greet: '早上好', line: '极光是太阳粒子与大气的舞蹈。', kind: 'seasonal' },
	{ greet: '早安', line: '彩虹需要阳光与雨滴同时在场。', kind: 'seasonal' },
	{ greet: '午安', line: '露珠是夜晚凝结的句子。', kind: 'seasonal' },
	{ greet: '下午好', line: '霜花是水汽的晶体书法。', kind: 'seasonal' },
	{ greet: '晚上好', line: '云是天空的草稿。', kind: 'seasonal' },
	{ greet: '夜里好', line: '风是空气从高压走向低压的旅程。', kind: 'calm' },
	{ greet: '嗨', line: '洋流是地球的暖气管道。', kind: 'calm' },
	{ greet: '你好呀', line: '珊瑚礁是海洋的热带雨林。', kind: 'calm' },
	{ greet: '嘿', line: '候鸟认路，靠星空与磁场。', kind: 'seasonal' },
	{ greet: '朋友', line: '蜜蜂跳舞交流蜜源——语言不止人类。', kind: 'witty' },
	{ greet: '又见面了', line: '蚂蚁社会证明：简单规则能涌现复杂秩序。', kind: 'proverb' },
	{ greet: '欢迎回来', line: '蘑菇是地下网络的果实。', kind: 'calm' },
	{ greet: '来啦', line: '树木通过菌根互通消息。', kind: 'calm' },
	{ greet: '坐下喝杯茶', line: '年轮记录旱涝，是木头里的日记。', kind: 'seasonal' },
	{ greet: '慢慢看', line: '种子等待合适的温度与水——耐心是策略。', kind: 'encourage' },
	{ greet: '今天也加油', line: '发芽是对黑暗的回答。', kind: 'encourage' },
	{ greet: '先喝口水', line: '根系向下，是为了让叶子向上。', kind: 'encourage' },
	{ greet: '别急', line: '落叶归根，是养分的循环，不是告别。', kind: 'seasonal' },
	{ greet: '今天也来逛逛', line: '诗是语言的晶体。', kind: 'calm' },
	{ greet: '新的一天', line: '书法是纸上的舞蹈。', kind: 'calm' },
	{ greet: '下午好呀', line: '水墨意在笔先，留白也是画。', kind: 'calm' },
	{ greet: '早安呀', line: '京剧的唱念做打，是浓缩的人生。', kind: 'proverb' },
	{ greet: '晚安前先看看', line: '古琴七弦，弹的是心境。', kind: 'calm' },
	{ greet: '周末好', line: '茶道：一期一会，珍惜此刻。', kind: 'calm' },
	{ greet: '工作日加油', line: '围棋十九道，黑白里有宇宙。', kind: 'calm' },
	{ greet: '歇一会儿', line: '象棋楚河汉界，提醒进退有度。', kind: 'proverb' },
	{ greet: '抬头看看', line: '成语是压缩的故事。', kind: 'proverb' },
	{ greet: '深呼吸', line: '神话是古人给未知的名字。', kind: 'calm' },
	{ greet: '微笑一下', line: '史书是镜子，照见兴衰。', kind: 'proverb' },
	{ greet: '给自己鼓鼓掌', line: '博物馆让时间停在展柜里。', kind: 'calm' },
	{ greet: '早上好', line: '考古一层一层挖，像读倒着写的书。', kind: 'witty' },
	{ greet: '早安', line: '敦煌壁画里的飞天，至今还在飞。', kind: 'calm' },
	{ greet: '午安', line: '兵马俑沉默列阵，诉说统一的野心。', kind: 'proverb' },
	{ greet: '下午好', line: '长城是防御，也是连结群山的线。', kind: 'proverb' },
	{ greet: '晚上好', line: '丝绸之路把丝绸与故事一起带走。', kind: 'proverb' },
	{ greet: '夜里好', line: '瓷器是火与土的契约。', kind: 'calm' },
	{ greet: '嗨', line: '园林借景，把远山请入自家院。', kind: 'calm' },
	{ greet: '你好呀', line: '苏州园林：咫尺山林。', kind: 'calm' },
	{ greet: '嘿', line: '方言是乡音的活化石。', kind: 'proverb' },
	{ greet: '朋友', line: '民歌从田野长出来。', kind: 'seasonal' },
	{ greet: '又见面了', line: '戏曲脸谱：红忠白奸，颜色也在说话。', kind: 'witty' },
	{ greet: '欢迎回来', line: '皮影戏：一灯如豆，百戏人生。', kind: 'calm' },
	{ greet: '来啦', line: '剪纸窗花，把吉祥贴在光上。', kind: 'seasonal' },
	{ greet: '坐下喝杯茶', line: '刺绣一针一线，时间变成图案。', kind: 'calm' },
	{ greet: '慢慢看', line: '漆器层层打磨，光泽来自耐心。', kind: 'encourage' },
	{ greet: '今天也加油', line: '金石篆刻：方寸之间见天地。', kind: 'calm' },
	{ greet: '先喝口水', line: '图书馆是安静的广场。', kind: 'calm' },
	{ greet: '别急', line: '一本好书是可以随身携带的花园。', kind: 'encourage' },
	{ greet: '今天也来逛逛', line: '重读经典，每次都遇见不同的自己。', kind: 'calm' },
	{ greet: '新的一天', line: '笔记是与作者的二次对话。', kind: 'encourage' },
	{ greet: '下午好呀', line: '电影是每秒二十四格的梦。', kind: 'calm' },
	{ greet: '早安呀', line: '摄影凝固瞬间，也选择瞬间。', kind: 'calm' },
	{ greet: '晚安前先看看', line: '建筑是凝固的音乐。', kind: 'calm' },
	{ greet: '周末好', line: '音乐是流动的建筑。', kind: 'calm' },
	{ greet: '工作日加油', line: '民间故事里藏着集体的智慧。', kind: 'proverb' },
	{ greet: '歇一会儿', line: '寓言用动物说人话。', kind: 'witty' },
	{ greet: '抬头看看', line: '童话不是骗小孩，是给希望命名。', kind: 'encourage' },
	{ greet: '深呼吸', line: '讽刺是笑着说严肃的话。', kind: 'witty' },
	{ greet: '微笑一下', line: '幽默是智慧的氧气。', kind: 'witty' },
	{ greet: '给自己鼓鼓掌', line: '礼仪不是虚伪，是对他人空间的承认。', kind: 'proverb' },
	{ greet: '早上好', line: '节日让时间有了形状。', kind: 'seasonal' },
	{ greet: '早安', line: '仪式感是生活对自己的郑重。', kind: 'calm' },
	{ greet: '午安', line: '乡愁是空间的迟到。', kind: 'calm' },
	{ greet: '下午好', line: '旅行打开眼睛，也打开偏见。', kind: 'encourage' },
	{ greet: '晚上好', line: '异乡的餐桌，是最快的文化课。', kind: 'witty' },
	{ greet: '夜里好', line: '手作温度，是机器替代不了的。', kind: 'calm' },
	{ greet: '嗨', line: '匠人精神：把一件事做到刚好与极致之间。', kind: 'encourage' },
	{ greet: '你好呀', line: '师徒制传递的不只是技艺，还有态度。', kind: 'proverb' },
	{ greet: '嘿', line: '非遗需要传承，也需要年轻人的新用法。', kind: 'encourage' },
	{ greet: '朋友', line: '汉字方块里，藏着象形的远古目光。', kind: 'calm' },
	{ greet: '又见面了', line: '偏旁部首，是意义的积木。', kind: 'witty' },
	{ greet: '欢迎回来', line: '造纸术让知识变轻，传播变远。', kind: 'encourage' },
	{ greet: '来啦', line: '印刷术让一书变万卷。', kind: 'encourage' },
	{ greet: '坐下喝杯茶', line: '指南针让海变成路。', kind: 'encourage' },
	{ greet: '慢慢看', line: '四大发明是文明的杠杆。', kind: 'proverb' },
	{ greet: '今天也加油', line: '仁者爱人。', kind: 'proverb' },
	{ greet: '先喝口水', line: '和而不同。', kind: 'proverb' },
	{ greet: '别急', line: '诗言志，歌永言。', kind: 'proverb' },
	{ greet: '今天也来逛逛', line: '外师造化，中得心源。', kind: 'proverb' },
	{ greet: '新的一天', line: '读史使人明智，读诗使人灵秀。', kind: 'encourage' },
	{ greet: '下午好呀', line: '逻辑是思维的语法。', kind: 'proverb' },
	{ greet: '早安呀', line: '批判性思维：先怀疑结论，再检查前提。', kind: 'encourage' },
	{ greet: '晚安前先看看', line: '美育不是教你好看，是教你感受。', kind: 'encourage' },
	{ greet: '周末好', line: '古物无声，看的人把它唤醒。', kind: 'calm' },
	{ greet: '工作日加油', line: '传统不是博物馆的标本，是可呼吸的生活。', kind: 'encourage' },
	{ greet: '歇一会儿', line: '创新不是背叛传统，是让传统继续活。', kind: 'encourage' },
	{ greet: '抬头看看', line: '文化交流像花粉：相遇才结果。', kind: 'proverb' },
	{ greet: '深呼吸', line: '理解他者，是文明的成人礼。', kind: 'encourage' },
	{ greet: '微笑一下', line: '多元不是混乱，是生态。', kind: 'proverb' },
	{ greet: '给自己鼓鼓掌', line: '包容不是纵容，是给差异留座位。', kind: 'proverb' },
	{ greet: '早上好', line: '对话比独白更接近真理。', kind: 'proverb' },
	{ greet: '早安', line: '写信是慢的对话，值得偶尔重拾。', kind: 'calm' },
	{ greet: '午安', line: '观星让人谦卑。', kind: 'calm' },
	{ greet: '下午好', line: '听雨让人安静。', kind: 'seasonal' },
	{ greet: '晚上好', line: '煮一壶茶的时间，刚好够想清楚一件事。', kind: 'calm' },
	{ greet: '夜里好', line: '散步是思想的助产士。', kind: 'calm' },
	{ greet: '嗨', line: '整理书桌，也是整理思绪。', kind: 'calm' },
	{ greet: '你好呀', line: '黎明前最暗，也最接近光。', kind: 'encourage' },
	{ greet: '嘿', line: '日落不是结束，是换一种光照。', kind: 'seasonal' },
	{ greet: '朋友', line: '潮涨潮落，提醒我们：有来有往。', kind: 'seasonal' },
	{ greet: '又见面了', line: '种子埋进土里，不是消失，是蓄力。', kind: 'encourage' },
	{ greet: '欢迎回来', line: '石头上也能开花——只要缝隙里有土。', kind: 'encourage' },
	{ greet: '来啦', line: '桥梁的意义在于连接两岸的人。', kind: 'proverb' },
	{ greet: '坐下喝杯茶', line: '路是人走出来的，也是人维护的。', kind: 'proverb' },
	{ greet: '慢慢看', line: '灯塔不为某一艘船亮，而为所有可能迷路的船。', kind: 'encourage' },
	{ greet: '今天也加油', line: '地图不是领土，别把描述当成世界本身。', kind: 'witty' },
	{ greet: '先喝口水', line: '命名是认识的第一步。', kind: 'proverb' },
	{ greet: '别急', line: '故事塑造我们，我们也重写故事。', kind: 'calm' },
	{ greet: '今天也来逛逛', line: '原谅别人，是给自己减负。', kind: 'calm' },
	{ greet: '新的一天', line: '道歉需要勇气，接受道歉需要胸怀。', kind: 'encourage' },
	{ greet: '下午好呀', line: '承诺是未来的押金。', kind: 'proverb' },
	{ greet: '早安呀', line: '信任慢建快毁。', kind: 'proverb' },
	{ greet: '晚安前先看看', line: '友谊需要维护，像花园需要浇水。', kind: 'encourage' },
	{ greet: '周末好', line: '独处不是孤独，是与自己约会。', kind: 'calm' },
	{ greet: '工作日加油', line: '简单生活，不是贫乏，是聚焦。', kind: 'calm' },
	{ greet: '歇一会儿', line: '富足感来自够用，不是更多。', kind: 'calm' },
	{ greet: '抬头看看', line: '节制是自由的一种形式。', kind: 'proverb' },
	{ greet: '深呼吸', line: '纪律是自由的脚手架。', kind: 'encourage' },
	{ greet: '微笑一下', line: '习惯要么成就你，要么消耗你。', kind: 'encourage' },
	{ greet: '给自己鼓鼓掌', line: '早晨的一小时，决定白天的调性。', kind: 'encourage' },
	{ greet: '早上好', line: '把感谢写下来，快乐会显影。', kind: 'encourage' },
	{ greet: '早安', line: '把恐惧说出来，它会缩小一圈。', kind: 'encourage' },
	{ greet: '午安', line: '把失败当学费，才不算白交。', kind: 'encourage' },
	{ greet: '下午好', line: '把成功当偶然，下一次才更稳。', kind: 'calm' },
	{ greet: '晚上好', line: '把批评当镜子，而不是石头。', kind: 'encourage' },
	{ greet: '夜里好', line: '把赞美当鼓励，而不是终点。', kind: 'encourage' },
	{ greet: '嗨', line: '把「必须」换成「选择」，责任感会清晰。', kind: 'proverb' },
	{ greet: '你好呀', line: '把「总有一天」落成「今天一小步」。', kind: 'encourage' },
	{ greet: '嘿', line: '把「别人怎么看」放轻，把「我怎么看」放正。', kind: 'calm' },
	{ greet: '朋友', line: '科学教我们求真，人文教我们求善与美。', kind: 'proverb' },
	{ greet: '又见面了', line: '真善美不必对立，可以并肩。', kind: 'calm' },
	{ greet: '欢迎回来', line: '理性护航热情，热情点燃理性。', kind: 'encourage' },
	{ greet: '来啦', line: '知识改变命运，见识改变选择。', kind: 'encourage' },
	{ greet: '坐下喝杯茶', line: '见识来自阅读、行走与认真交谈。', kind: 'encourage' },
	{ greet: '慢慢看', line: '教育不是灌满一桶水，是点燃一把火。', kind: 'encourage' },
	{ greet: '今天也加油', line: '教师打开门，走路的是学生自己。', kind: 'proverb' },
	{ greet: '先喝口水', line: '孩子问为什么，是科学精神的原初形态。', kind: 'witty' },
	{ greet: '别急', line: '保护好奇心，像保护火种。', kind: 'encourage' },
	{ greet: '今天也来逛逛', line: '诚实面对无知，是学习的资格证。', kind: 'proverb' },
	{ greet: '新的一天', line: '说「我不知道」并不丢脸。', kind: 'encourage' },
	{ greet: '下午好呀', line: '说「我错了」是更新模型。', kind: 'encourage' },
	{ greet: '早安呀', line: '说「谢谢」让循环继续。', kind: 'encourage' },
	{ greet: '晚安前先看看', line: '说「对不起」让裂缝有机会愈合。', kind: 'encourage' },
	{ greet: '周末好', line: '说「我在」比很多道理更有用。', kind: 'calm' },
	{ greet: '工作日加油', line: '陪伴是最长情的告白。', kind: 'calm' },
	{ greet: '歇一会儿', line: '时间会证明，耐心会兑现。', kind: 'encourage' },
	{ greet: '抬头看看', line: '人间值得，因为尚有未完成的好奇。', kind: 'encourage' },
	{ greet: '深呼吸', line: '今天也请好好吃饭，好好睡觉，好好对人。', kind: 'encourage' },
	{ greet: '微笑一下', line: '深呼吸一次：世界还在，你也在。', kind: 'calm' },
	{ greet: '给自己鼓鼓掌', line: '抬头看看天：云在走，你也可以慢一点。', kind: 'seasonal' },
	{ greet: '早上好', line: '微笑不费什么，却能改写片刻空气。', kind: 'encourage' },
	{ greet: '早安', line: '给自己鼓鼓掌：走到今天，已经很不容易。', kind: 'encourage' },
	{ greet: '午安', line: '一页书、一杯水，足以安顿一个午后。', kind: 'calm' },
	{ greet: '下午好', line: '文化是共同的记忆，也是共同的未来。', kind: 'proverb' },
	{ greet: '晚上好', line: '文明进步，最终要落到每个人的尊严上。', kind: 'proverb' },
	{ greet: '夜里好', line: '科学使人强大，人文使人温柔。', kind: 'proverb' },
	{ greet: '嗨', line: '愿你既有星辰大海，也有人间烟火。', kind: 'encourage' },
	{ greet: '你好呀', line: '青青子衿，悠悠我心。', kind: 'proverb' },
	{ greet: '嘿', line: '画龙点睛，细节成就整体。', kind: 'witty' },
	{ greet: '朋友', line: '授人以鱼不如授人以渔。', kind: 'proverb' },
	{ greet: '又见面了', line: '桃李不言，下自成蹊。', kind: 'proverb' },
	{ greet: '欢迎回来', line: '尺有所短，寸有所长。', kind: 'proverb' },
	{ greet: '来啦', line: '兼收并蓄，博采众长。', kind: 'encourage' },
	{ greet: '坐下喝杯茶', line: '厚积薄发。', kind: 'encourage' },
	{ greet: '慢慢看', line: '宁静致远。', kind: 'calm' },
	{ greet: '今天也加油', line: '淡泊明志。', kind: 'calm' },
	{ greet: '先喝口水', line: '海纳百川，有容乃大。', kind: 'proverb' },
	{ greet: '别急', line: '壁立千仞，无欲则刚。', kind: 'proverb' },
	{
		greet: '今天也来逛逛',
		line: '己所不欲勿施于人，是恕；己所欲施于人，是仁的开始。',
		kind: 'proverb',
	},
	{ greet: '新的一天', line: '观书有感：源头活水，方能清澈。', kind: 'calm' },
	{ greet: '下午好呀', line: '格物致知。', kind: 'proverb' },
	{ greet: '早安呀', line: '知行合一。', kind: 'proverb' },
	{ greet: '晚安前先看看', line: '致良知。', kind: 'calm' },
	{ greet: '周末好', line: '乐以忘忧。', kind: 'calm' },
	{ greet: '工作日加油', line: '发愤忘食。', kind: 'encourage' },
	{ greet: '歇一会儿', line: '学而不厌，诲人不倦。', kind: 'encourage' },
	{ greet: '抬头看看', line: '切问而近思。', kind: 'proverb' },
	{ greet: '深呼吸', line: '如切如磋，如琢如磨。', kind: 'encourage' },
	{ greet: '微笑一下', line: '言之无文，行之不远。', kind: 'proverb' },
	{ greet: '给自己鼓鼓掌', line: '文质彬彬，然后君子。', kind: 'proverb' },
]

/** 将池条目的大字替换为法语名言（小字 line / kind 不变） */
function withFrench<T extends DailyGreeting>(entry: T, index: number): T & { author?: string } {
	const q = frenchQuoteAt(index)
	return { ...entry, greet: q.text, author: q.author }
}

/** 以 Asia/Shanghai 的 YYYY-MM-DD 为种子，映射到 [0, n) */
export function dailyIndex(dateKey: string, n: number): number {
	let h = 2166136261
	for (let i = 0; i < dateKey.length; i++) {
		h ^= dateKey.charCodeAt(i)
		h = Math.imul(h, 16777619)
	}
	return Math.abs(h) % n
}

/** 上海时区日历日 YYYY-MM-DD */
export function shanghaiDateKey(d = new Date()): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Shanghai',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(d)
}

/** 按时段问候（上海时区），用于明信片顶栏，替代固定「今日一句」 */
const TOD_BUCKETS: { start: number; labels: readonly string[] }[] = [
	{ start: 5, labels: ['早上好', '早安', '清晨好'] },
	{ start: 11, labels: ['中午好', '午安'] },
	{ start: 13, labels: ['下午好', '午后好'] },
	{ start: 18, labels: ['晚上好', '傍晚好'] },
	{ start: 22, labels: ['夜里好', '夜深了'] },
	{ start: 0, labels: ['夜里好', '夜深了'] },
]

/** 上海当前小时 0–23 */
export function shanghaiHour(d = new Date()): number {
	const h = new Intl.DateTimeFormat('en-US', {
		timeZone: 'Asia/Shanghai',
		hour: 'numeric',
		hourCycle: 'h23',
	}).format(d)
	return Number(h)
}

/** 按时段选一句自然问候；同一小时内稳定（避免秒级闪烁） */
export function pickTimeOfDayGreeting(d = new Date()): string {
	const hour = shanghaiHour(d)
	const bucket =
		TOD_BUCKETS.find((b) => b.start !== 0 && hour >= b.start && hour < nextStart(b.start)) ||
		TOD_BUCKETS.find((b) => b.start === 0)!
	const dateKey = shanghaiDateKey(d)
	return bucket.labels[dailyIndex(`${dateKey}-h${hour}`, bucket.labels.length)]
}

function nextStart(start: number): number {
	const starts = [5, 11, 13, 18, 22, 24]
	return starts.find((s) => s > start) ?? 24
}

export function pickDailyGreeting(
	d = new Date(),
): DailyGreeting & { dateKey: string; dateLabel: string } {
	const dateKey = shanghaiDateKey(d)
	const index = dailyIndex(dateKey, DAILY_GREETINGS.length)
	const entry = withFrench(DAILY_GREETINGS[index], index)
	const [y, m, day] = dateKey.split('-')
	return { ...entry, dateKey, dateLabel: `${y}/${m}/${day}` }
}

/** 换一句：从池中随机取，避开当前索引与今日种子索引 */
export function pickRandomGreeting(
	avoidIndexes: Iterable<number> = [],
): DailyGreeting & { index: number; dateKey: string; dateLabel: string } {
	const dateKey = shanghaiDateKey()
	const [y, m, day] = dateKey.split('-')
	const dateLabel = `${y}/${m}/${day}`
	const blocked = new Set(avoidIndexes)
	blocked.add(dailyIndex(dateKey, DAILY_GREETINGS.length))
	const n = DAILY_GREETINGS.length
	let index = Math.floor(Math.random() * n)
	for (let i = 0; i < 12 && blocked.has(index); i++) {
		index = Math.floor(Math.random() * n)
	}
	if (blocked.has(index)) {
		// 兜底：线性找第一个不在黑名单的
		for (let i = 0; i < n; i++) {
			if (!blocked.has(i)) {
				index = i
				break
			}
		}
	}
	return { ...withFrench(DAILY_GREETINGS[index], index), index, dateKey, dateLabel }
}

/** 今日种子对应的下标，方便「换一句」避开 */
export function dailyGreetingIndex(d = new Date()): number {
	return dailyIndex(shanghaiDateKey(d), DAILY_GREETINGS.length)
}

/** 按池下标取问候（越界回落到日种子） */
export function pickGreetingAt(
	index: number,
	d = new Date(),
): DailyGreeting & { index: number; dateKey: string; dateLabel: string } {
	const dateKey = shanghaiDateKey(d)
	const [y, m, day] = dateKey.split('-')
	const dateLabel = `${y}/${m}/${day}`
	const n = DAILY_GREETINGS.length
	const i = Number.isInteger(index) && index >= 0 && index < n ? index : dailyIndex(dateKey, n)
	return { ...withFrench(DAILY_GREETINGS[i], i), index: i, dateKey, dateLabel }
}
