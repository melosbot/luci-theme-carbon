'use strict';
'require baseclass';
'require carbon.vendor.markdown_it as markdownIt';

// Release notes are untrusted text. Disable raw HTML and resolve relative links
// against the project, never against the authenticated router interface.
const repository = 'https://github.com/mrjoechen/luci-theme-carbon/blob/main/';
function safeURL(value, image) {
	try {
		if (typeof value !== 'string' || /[\x00-\x1f\x7f]|%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(value)) return null;
		const url = new URL(value, repository);
		return /^(https?:|mailto:)$/.test(url.protocol) && (!image || url.protocol !== 'mailto:') ? url.href : null;
	}
	catch (e) { return null; }
}

const parser = markdownIt.create({ html: false, linkify: true, breaks: false, maxNesting: 32 });
parser.validateLink = value => safeURL(value, false) !== null;
parser.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
	const token = tokens[index];
	token.attrSet('href', safeURL(token.attrGet('href'), false));
	token.attrSet('target', '_blank');
	token.attrSet('rel', 'noopener noreferrer');
	return renderer.renderToken(tokens, index, options);
};
const renderImage = parser.renderer.rules.image;
parser.renderer.rules.image = (tokens, index, options, env, renderer) => {
	const token = tokens[index], src = safeURL(token.attrGet('src'), true);
	if (!src) return parser.utils.escapeHtml(token.content);
	token.attrSet('src', src);
	token.attrSet('loading', 'lazy');
	token.attrSet('referrerpolicy', 'no-referrer');
	return renderImage(tokens, index, options, env, renderer);
};

return baseclass.extend({
	render(text) { return parser.render(String(text || '')); }
});
