export class ClientNotFoundError extends Error {}
export class ClientUnauthorizedError extends Error {}

export class ClientHTTPError extends Error {
	constructor(public status: number, message?: string) {
		super(message || `HTTP Error: ${status}`);
		this.name = "ClientHTTPError";
	}
}