import {
	Cloud,
	CloudDrizzle,
	CloudFog,
	CloudLightning,
	CloudMoon,
	CloudRain,
	CloudSun,
	type LucideIcon,
	Moon,
	Snowflake,
	Sun,
} from 'lucide-react'
import { wmoInfo } from './weather'

const ICONS: Record<string, LucideIcon> = {
	sun: Sun,
	moon: Moon,
	'cloud-sun': CloudSun,
	'cloud-moon': CloudMoon,
	cloud: Cloud,
	fog: CloudFog,
	drizzle: CloudDrizzle,
	rain: CloudRain,
	snow: Snowflake,
	storm: CloudLightning,
}

export function WeatherIcon({
	code,
	isDay = true,
	className,
}: {
	code: number
	isDay?: boolean
	className?: string
}) {
	const Icon = ICONS[wmoInfo(code, isDay).kind] ?? Cloud
	return <Icon aria-hidden className={className} strokeWidth={1.55} />
}
