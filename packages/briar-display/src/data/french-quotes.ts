/**
 * 首页问候卡大字：法语名言池。
 * 与 daily-greetings 下标取模配对；换一句 / 日种子仍走原 index 落库。
 */

export interface FrenchQuote {
	/** 名言正文（大字） */
	text: string
	/** 作者（可选小字） */
	author?: string
}

export const FRENCH_QUOTES: readonly FrenchQuote[] = [
	{ text: 'Je pense, donc je suis.', author: 'René Descartes' },
	{
		text: 'La liberté consiste à pouvoir faire tout ce qui ne nuit pas à autrui.',
		author: 'Déclaration de 1789',
	},
	{ text: 'On ne voit bien qu’avec le cœur.', author: 'Antoine de Saint-Exupéry' },
	{ text: 'L’essentiel est invisible pour les yeux.', author: 'Antoine de Saint-Exupéry' },
	{ text: 'Il n’y a pas de hasard, il n’y a que des rendez-vous.', author: 'Paul Éluard' },
	{ text: 'La vie est un défi à relever, un bonheur à mériter.', author: 'Albert Camus' },
	{
		text: 'Au milieu de l’hiver, j’ai découvert en moi un invincible été.',
		author: 'Albert Camus',
	},
	{ text: 'Il faut imaginer Sisyphe heureux.', author: 'Albert Camus' },
	{ text: 'L’enfer, c’est les autres.', author: 'Jean-Paul Sartre' },
	{
		text: 'On n’est pas libre parce qu’on a choisi, mais parce qu’on choisit.',
		author: 'Jean-Paul Sartre',
	},
	{ text: 'Rien n’est permanent, sauf le changement.', author: 'Citation française' },
	{
		text: 'Le bonheur n’est pas une chose aisée : il est très difficile de le trouver en soi.',
		author: 'Chamfort',
	},
	{
		text: 'La vraie générosité envers l’avenir consiste à tout donner au présent.',
		author: 'Albert Camus',
	},
	{ text: 'Il n’est pas certain que tout soit incertain.', author: 'Blaise Pascal' },
	{ text: 'Le cœur a ses raisons que la raison ne connaît point.', author: 'Blaise Pascal' },
	{ text: 'La parole a été donnée à l’homme pour déguiser sa pensée.', author: 'Talleyrand' },
	{ text: 'Dis-moi ce que tu manges, je te dirai ce que tu es.', author: 'Brillat-Savarin' },
	{ text: 'Science sans conscience n’est que ruine de l’âme.', author: 'Rabelais' },
	{ text: 'Vouloir, c’est pouvoir.', author: 'Proverbe français' },
	{ text: 'Petit à petit, l’oiseau fait son nid.', author: 'Proverbe français' },
	{ text: 'Après la pluie, le beau temps.', author: 'Proverbe français' },
	{ text: 'Qui vivra verra.', author: 'Proverbe français' },
	{ text: 'L’habit ne fait pas le moine.', author: 'Proverbe français' },
	{ text: 'Rien ne sert de courir ; il faut partir à point.', author: 'Jean de La Fontaine' },
	{ text: 'Aide-toi, le ciel t’aidera.', author: 'Jean de La Fontaine' },
	{ text: 'La raison du plus fort est toujours la meilleure.', author: 'Jean de La Fontaine' },
	{ text: 'Il dépend de nous d’être plus ou moins heureux.', author: 'Rousseau' },
	{
		text: 'L’homme est né libre, et partout il est dans les fers.',
		author: 'Jean-Jacques Rousseau',
	},
	{ text: 'Cultivons notre jardin.', author: 'Voltaire' },
	{ text: 'Il faut cultiver notre jardin.', author: 'Voltaire' },
	{ text: 'Le doute est désagréable, mais la certitude est ridicule.', author: 'Voltaire' },
	{ text: 'La parole est d’argent, le silence est d’or.', author: 'Proverbe français' },
	{ text: 'Mieux vaut prévenir que guérir.', author: 'Proverbe français' },
	{ text: 'Chaque jour est une vie en miniature.', author: 'Citation française' },
	{ text: 'Le temps perdu ne se rattrape jamais.', author: 'Proverbe français' },
	{ text: 'Il n’y a que le premier pas qui coûte.', author: 'Proverbe français' },
	{ text: 'Rien n’est trop beau pour celui qui rêve.', author: 'Citation française' },
	{ text: 'La beauté est dans les yeux de celui qui regarde.', author: 'Proverbe français' },
	{
		text: 'Aimer, ce n’est pas se regarder l’un l’autre, c’est regarder ensemble dans la même direction.',
		author: 'Antoine de Saint-Exupéry',
	},
	{
		text: 'On ne découvre pas de terre nouvelle sans consentir à perdre de vue, longtemps, tout rivage.',
		author: 'André Gide',
	},
	{
		text: 'Ce n’est pas assez d’avoir l’esprit bon, le principal est de l’appliquer bien.',
		author: 'Descartes',
	},
	{ text: 'Connais-toi toi-même.', author: 'Maxime classique' },
	{ text: 'La simplicité est la sophistication suprême.', author: 'Citation attribuée' },
	{
		text: 'Il faut viser la lune ; au pire, on atterrit dans les étoiles.',
		author: 'Citation française',
	},
	{
		text: 'Le courage n’est pas l’absence de peur, mais la capacité de la vaincre.',
		author: 'Citation française',
	},
	{
		text: 'Fais de ta vie un rêve, et d’un rêve, une réalité.',
		author: 'Antoine de Saint-Exupéry',
	},
	{
		text: 'Il n’est jamais trop tard pour devenir ce que l’on aurait pu être.',
		author: 'Citation française',
	},
	{
		text: 'La seule façon d’atteindre l’impossible est de croire que c’est possible.',
		author: 'Citation française',
	},
	{ text: 'Ce qui ne me tue pas me rend plus fort.', author: 'Citation populaire' },
	{
		text: 'Vis comme si tu devais mourir demain. Apprends comme si tu devais vivre toujours.',
		author: 'Citation française',
	},
	{ text: 'Le bonheur est parfois caché dans l’inconnu.', author: 'Victor Hugo' },
	{ text: 'Demain, dès l’aube, à l’heure où blanchit la campagne.', author: 'Victor Hugo' },
	{ text: 'La musique est la langue des émotions.', author: 'Citation française' },
	{ text: 'Un livre est une fenêtre par laquelle on s’évade.', author: 'Julien Green' },
	{ text: 'Écrire, c’est une façon de parler sans être interrompu.', author: 'Jules Renard' },
	{
		text: 'La poésie est un écho qui demande un antre pour se répéter.',
		author: 'Citation française',
	},
	{ text: 'Rien de grand ne s’est fait dans le monde sans passion.', author: 'Hegel (trad.)' },
	{ text: 'La patience est amère, mais son fruit est doux.', author: 'Proverbe français' },
	{ text: 'Qui trop embrasse mal étreint.', author: 'Proverbe français' },
	{ text: 'Les voyages forment la jeunesse.', author: 'Proverbe français' },
	{ text: 'L’union fait la force.', author: 'Proverbe français' },
	{ text: 'Impossible n’est pas français.', author: 'Napoléon' },
	{ text: 'Du sublime au ridicule, il n’y a qu’un pas.', author: 'Napoléon' },
	{ text: 'La gloire se repose sur les morts.', author: 'Citation française' },
	{ text: 'Il faut que jeunesse se passe.', author: 'Proverbe français' },
	{ text: 'Tel père, tel fils.', author: 'Proverbe français' },
	{ text: 'Chat échaudé craint l’eau froide.', author: 'Proverbe français' },
	{ text: 'Quand on veut, on peut.', author: 'Proverbe français' },
	{ text: 'Le mieux est l’ennemi du bien.', author: 'Voltaire' },
	{ text: 'Il faut savoir perdre son temps pour en gagner.', author: 'Citation française' },
	{ text: 'La critique est aisée, et l’art est difficile.', author: 'Destouches' },
	{ text: 'Pour être grand, il faut savoir être petit.', author: 'Citation française' },
	{
		text: 'Le sourire coûte moins cher que l’électricité, mais donne autant de lumière.',
		author: 'Abbé Pierre',
	},
	{ text: 'On ne change pas une équipe qui gagne.', author: 'Proverbe français' },
	{ text: 'C’est en forgeant qu’on devient forgeron.', author: 'Proverbe français' },
	{ text: 'L’avenir appartient à ceux qui se lèvent tôt.', author: 'Proverbe français' },
	{ text: 'Loin des yeux, loin du cœur.', author: 'Proverbe français' },
	{ text: 'Qui ne risque rien n’a rien.', author: 'Proverbe français' },
	{ text: 'Tout vient à point à qui sait attendre.', author: 'Proverbe français' },
	{ text: 'Il n’y a pas de sot métier.', author: 'Proverbe français' },
	{ text: 'Bonjour tristesse.', author: 'Françoise Sagan' },
	{ text: 'Exister, c’est oser se jeter dans le monde.', author: 'Simone de Beauvoir' },
	{ text: 'On ne naît pas femme : on le devient.', author: 'Simone de Beauvoir' },
	{ text: 'La nostalgie, c’est le souvenir qui a perdu la mémoire.', author: 'Citation française' },
	{ text: 'Le présent est le seul temps qui nous appartienne.', author: 'Citation française' },
	{ text: 'Respire. Tout le reste suivra.', author: 'Citation française' },
	{ text: 'Soyez vous-même ; tous les autres sont déjà pris.', author: 'Citation attribuée' },
	{ text: 'La vie est trop courte pour boire du mauvais vin.', author: 'Citation française' },
	{ text: 'Un jour sans rire est un jour perdu.', author: 'Chamfort' },
	{ text: 'Rire, c’est déjà se soigner.', author: 'Citation française' },
	{
		text: 'La gentillesse est une langue que les sourds peuvent entendre.',
		author: 'Citation française',
	},
	{ text: 'Fais le bien, et jette-le à la mer.', author: 'Proverbe' },
	{ text: 'Le silence est le cri le plus fort.', author: 'Citation française' },
	{ text: 'Marcher, c’est déjà avancer.', author: 'Citation française' },
	{ text: 'Chaque fin est un nouveau commencement.', author: 'Citation française' },
	{ text: 'Garde ton âme d’enfant.', author: 'Citation française' },
	{ text: 'La lumière luit dans les ténèbres.', author: 'Évangile (trad.)' },
	{ text: 'Espérer, c’est déjà commencer à créer.', author: 'Citation française' },
	{ text: 'La mer est belle, et le ciel est grand.', author: 'Citation française' },
	{ text: 'Reste curieux. Reste vivant.', author: 'Citation française' },
]

/** 用问候池下标稳定映射到法语名言 */
export function frenchQuoteAt(index: number): FrenchQuote {
	const n = FRENCH_QUOTES.length
	const i = ((index % n) + n) % n
	return FRENCH_QUOTES[i]
}
