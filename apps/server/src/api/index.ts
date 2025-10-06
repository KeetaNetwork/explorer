import { Hono } from "hono";
import network from "./network";
import token from "./token";
import transaction from "./transaction";
import account from "./account";
import websocket from "./websocket";
import storage from "./storage";

const api = new Hono()
    /**
     * Add routes to the API
     */
	.route('/account', account)
	.route('/network', network)
	.route('/storage', storage)
	.route('/token', token)
	.route('/transaction', transaction)
	.route('/ws', websocket)

export default api
export type ApiRoute = typeof api