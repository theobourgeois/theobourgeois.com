import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
	type: 'content',
	schema: z.object({
		title: z.string(),
		description: z.string(),
		createdAt: z.coerce.date(),
		image: z.string(),
	}),
});

export const collections = { posts };