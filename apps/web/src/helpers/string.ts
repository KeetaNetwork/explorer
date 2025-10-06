export function toSentenceCase(str: string): string {
	if (!str || !str.length) {
		return(str);
	}
	return(str.charAt(0).toUpperCase() + str.slice(1).toLowerCase());
}

function normalize(str: string) {
	return str.replace(/^-+|-+$/g, '').replace(/-+/g, '-');
}

export function toCamelCase(str: string) {
	return normalize(str).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

export function toPascalCase(str: string) {
	const camel = toCamelCase(str);
	return camel.charAt(0).toUpperCase() + camel.slice(1);
};

export function toTitleCase(str: string) {
	return normalize(str)
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/\b\w/g, c => c.toUpperCase());
}
