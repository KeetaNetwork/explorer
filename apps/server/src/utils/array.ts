export function splitEvenly<T>(items: T[], targetPerList = 40): T[][] {
	const itemsCount = items.length;

	// edge case: Empty array
	if (itemsCount === 0) {
		return([]);
	}

	// edge case: Number of items is less than or equal to targetPerList
	if (itemsCount <= targetPerList) {
		return([items]);
	}

	const numberOfLists = Math.ceil(itemsCount / targetPerList);
	const base = Math.floor(itemsCount / numberOfLists);
	let itemsRemainder = itemsCount % numberOfLists;

	const retval: T[][] = [];
	let i = 0;
	for (let b = 0; b < numberOfLists; b++) {
		const size = base + (itemsRemainder > 0 ? 1 : 0);
		retval.push(items.slice(i, i + size));
		i += size;
		if (itemsRemainder > 0) itemsRemainder--;
	}
	
	return(retval);
}
