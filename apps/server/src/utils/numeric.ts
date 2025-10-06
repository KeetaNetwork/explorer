export class Numeric {
	#value: bigint;

	constructor(value: bigint | string | number) {
		this.#value = BigInt(value);
	}

	abs(): Numeric {
		return new Numeric(this.isNegative() ? -this.#value : this.#value);
	}

	isNegative(): boolean {
		return(this.#value < 0n);
	}

	toString() {
		return(this.#value.toString());
	}

	valueOf() {
		return(this.#value);
	}

	toJSON() {
		return(this.#value.toString());
	}
}

export default Numeric;
