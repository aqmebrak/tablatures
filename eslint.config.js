import svelte from 'eslint-plugin-svelte';
import ts from 'typescript-eslint';

export default ts.config(
	...ts.configs.recommended,
	...svelte.configs.recommended,
	...svelte.configs.prettier,
	{
		files: ['**/*.svelte', '**/*.svelte.ts'],
		languageOptions: {
			parserOptions: {
				parser: ts.parser
			}
		}
	},
	{
		ignores: ['build/', '.svelte-kit/', '.vercel/', '.output/', 'dist/', 'node_modules/']
	}
);
