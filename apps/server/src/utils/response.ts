import type { Context, TypedResponse } from "hono";
import type { StatusCode } from "hono/utils/http-status";
import { CustomSuperJSON } from "./json";

type HeaderRecord = Record<string, string | string[]>

export function jsonResponse<T = object>(
	c: Context,
	obj: T,
	arg?: StatusCode,
	header?: HeaderRecord
): TypedResponse<T> {
	const body = CustomSuperJSON.stringify(obj);
	c.header('Content-Type', 'application/json');
	return c.newResponse(body, arg, header) as unknown as TypedResponse<T>;
}