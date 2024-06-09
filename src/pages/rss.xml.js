import rss from '@astrojs/rss'
import { SITE_TITLE, SITE_DESCRIPTION } from '../consts'

export async function GET(context) {
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: [
			{
				title: 'Item 1',
				description: 'Description for Item 1',
				pubDate: new Date(),
				link: 'https://example.com/item1'
			}
		]
	})
}
