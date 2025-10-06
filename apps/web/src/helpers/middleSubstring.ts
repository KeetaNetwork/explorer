export default function middleSubstring(text: string, charToShow: number) {
	if (text.length > charToShow) {
		return(`${text.substring(0, charToShow)}...${text.substring(text.length - charToShow)}`);
	}
	return(text);
}
