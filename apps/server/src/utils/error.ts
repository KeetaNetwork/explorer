import { StatusCodes } from 'http-status-codes';

/**
 * Names of classes of User Errors
 */
type ErrorUserKinds = 'GENERIC' | 'API_VALIDATION_INPUT' | 'OPEN_BANKING_INVALID_TOKEN' | 'UNAUTHORIZED' | 'NOT_FOUND' | 'BAD_REQUEST' | 'FORBIDDEN' | 'CONFLICT' | 'UNAVAILABLE' | 'NOT_ALLOWED';

/**
 * Structure of user errors
 */
export type ErrorUserJSON = {
	ok: false;
	error: {
		message: string;
		kind: ErrorUserKinds;
		hint?: unknown;
	};
};

/**
 * Errors which may be presented to the user
 */
export class ErrorUser extends Error {
	userError = true;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	static isErrorUser(input: any): input is ErrorUser {
		if (typeof input !== 'object') {
			return(false);
		}

		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		if (input.userError !== true) {
			return(false);
		}

		return(true);
	}

	toJSON(): ErrorUserJSON {
		return({
			ok: false,
			error: {
				message: this.message,
				kind: 'GENERIC'
			}
		});
	}
}

/**
 * Prisma Error Codes
 * https://www.prisma.io/docs/reference/api-reference/error-reference#error-codes
 */
export enum PrismaErrorCodes {
	ForeignKeyConstraintFailed = 'P2003',
	UniqueConstraintFailed = 'P2002',
	InconsistentColumnData = 'P2023',
	RecordNotFound = 'P2025'
}

export class Unauthorized extends ErrorUser {
	toJSON(): ErrorUserJSON {
		const parentJson = super.toJSON();
		return({
			...parentJson,
			error: {
				message: parentJson.error.message,
				kind: 'UNAUTHORIZED'
			}
		});
	}
}

export class NotFoundError extends ErrorUser {
	toJSON(): ErrorUserJSON {
		const parentJson = super.toJSON();
		return({
			...parentJson,
			error: {
				message: parentJson.error.message,
				kind: 'NOT_FOUND'
			}
		});
	}
}

export class BadRequestError extends ErrorUser {
	toJSON(): ErrorUserJSON {
		const parentJson = super.toJSON();
		return({
			...parentJson,
			error: {
				message: parentJson.error.message,
				kind: 'BAD_REQUEST'
			}
		});
	}
}

export class ForbiddenError extends ErrorUser {
	toJSON(): ErrorUserJSON {
		const parentJson = super.toJSON();
		return({
			...parentJson,
			error: {
				message: parentJson.error.message,
				kind: 'FORBIDDEN'
			}
		});
	}
}

export class NotAllowedError extends ErrorUser {
	toJSON(): ErrorUserJSON {
		const parentJson = super.toJSON();
		return({
			...parentJson,
			error: {
				message: parentJson.error.message,
				kind: 'NOT_ALLOWED'
			}
		});
	}
}

export class ValidationError extends ErrorUser {
	constructor(msg: string, private field?: string) {
		super(msg);
	}

	toJSON(): ErrorUserJSON {
		const parentJson = super.toJSON();
		return({
			...parentJson,
			error: {
				message: parentJson.error.message,
				kind: 'API_VALIDATION_INPUT',
				hint: {
					field: this?.field
				}
			}
		});
	}
}

export class ConflictError extends ErrorUser {
	constructor(msg: string, private field?: string) {
		super(msg);
	}

	toJSON(): ErrorUserJSON {
		const parentJson = super.toJSON();
		return({
			...parentJson,
			error: {
				message: parentJson.error.message,
				kind: 'CONFLICT',
				hint: {
					field: this?.field
				}
			}
		});
	}
}

export class UnavailableError extends ErrorUser {
	constructor(msg: string, private field?: string) {
		super(msg);
	}

	toJSON(): ErrorUserJSON {
		const parentJson = super.toJSON();
		return({
			...parentJson,
			error: {
				message: parentJson.error.message,
				kind: 'UNAVAILABLE',
				hint: {
					field: this?.field
				}
			}
		});
	}
}

export class OpenBankingInvalidTokenError extends ValidationError {
	toJSON(): ErrorUserJSON {
		const parentJson = super.toJSON();
		parentJson.error.kind = 'OPEN_BANKING_INVALID_TOKEN';
		return(parentJson);
	}
}

export class OpenBankingError extends BadRequestError {}

export class BaasError extends Error {
	constructor(public status: number, public msg: string, public info?: object) {
		super(msg);
	}
}

export class DuplicateProvider extends ValidationError {
	constructor(name: string) {
		const msg = `Duplicate provider: ${name}`;
		super(msg);
	}
}

export class ApiError extends BaasError {
	constructor(msg: string) {
		super(StatusCodes.BAD_REQUEST, msg);
	}
}

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export function getHttpStatusForError(error: unknown | Error): number {
	if (error instanceof Unauthorized) {
		return(StatusCodes.UNAUTHORIZED);
	}

	if (error instanceof ValidationError) {
		return(StatusCodes.UNPROCESSABLE_ENTITY);
	}

	if (error instanceof ForbiddenError) {
		return(StatusCodes.FORBIDDEN);
	}

	if (error instanceof NotFoundError) {
		return(StatusCodes.NOT_FOUND);
	}

	if (error instanceof BadRequestError) {
		return(StatusCodes.BAD_REQUEST);
	}

	if (error instanceof ConflictError) {
		return(StatusCodes.CONFLICT);
	}

	if (error instanceof NotAllowedError) {
		return(StatusCodes.METHOD_NOT_ALLOWED);
	}

	if (error instanceof UnavailableError) {
		return(StatusCodes.SERVICE_UNAVAILABLE);
	}

	return(StatusCodes.INTERNAL_SERVER_ERROR);
}
