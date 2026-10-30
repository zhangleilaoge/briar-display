import iris from '@/assets/decor/stationery-stickers/01-00-iris.png'
import mapleLeaf from '@/assets/decor/stationery-stickers/01-01-maple-leaf.png'
import waxSeal from '@/assets/decor/stationery-stickers/01-02-wax-seal.png'
import twine from '@/assets/decor/stationery-stickers/01-03-twine.png'
import pencil from '@/assets/decor/stationery-stickers/01-04-pencil.png'
import postcard from '@/assets/decor/stationery-stickers/01-05-postcard.png'
import paperPlane from '@/assets/decor/stationery-stickers/01-06-paper-plane.png'
import postageStamp from '@/assets/decor/stationery-stickers/01-07-postage-stamp.png'
import binderClip from '@/assets/decor/stationery-stickers/01-08-binder-clip.png'
import leafBookmark from '@/assets/decor/stationery-stickers/01-09-leaf-bookmark.png'
import journal from '@/assets/decor/stationery-stickers/01-10-journal.png'
import laceDoily from '@/assets/decor/stationery-stickers/01-11-lace-doily.png'
import quill from '@/assets/decor/stationery-stickers/01-12-quill.png'
import inkwell from '@/assets/decor/stationery-stickers/01-13-inkwell.png'
import brassKey from '@/assets/decor/stationery-stickers/01-14-brass-key.png'
import pocketWatch from '@/assets/decor/stationery-stickers/01-15-pocket-watch.png'
import lavender from '@/assets/decor/stationery-stickers/01-16-lavender.png'
import ticket from '@/assets/decor/stationery-stickers/01-17-ticket.png'
import bow from '@/assets/decor/stationery-stickers/01-18-bow.png'
import envelope from '@/assets/decor/stationery-stickers/01-19-envelope.png'

export const SCRAPBOOK_STICKERS = [
	iris,
	mapleLeaf,
	waxSeal,
	twine,
	pencil,
	postcard,
	paperPlane,
	postageStamp,
	binderClip,
	leafBookmark,
	journal,
	laceDoily,
	quill,
	inkwell,
	brassKey,
	pocketWatch,
	lavender,
	ticket,
	bow,
	envelope,
].map((image) => (typeof image === 'string' ? image : image.src))
