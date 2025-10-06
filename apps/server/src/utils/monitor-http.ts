import http from 'http'
import https from 'https'
import { performance } from 'perf_hooks'

function redact(h?: Record<string, any>) {
	if (h) {
		return Object.fromEntries(Object.entries(h).map(([k, v]) => /authorization|cookie|set-cookie|x-api-key/i.test(k) ? [k, '[REDACTED]'] : [k, v]))
	}
}

const color = {
	grey: (s: string) => `\x1b[90m${s}\x1b[0m`,
	green: (s: string) => `\x1b[32m${s}\x1b[0m`,
	yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
	red: (s: string) => `\x1b[31m${s}\x1b[0m`,
	blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
	pink: (s: string) => `\x1b[35m${s}\x1b[0m`,
	cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
}


const wrap = <T extends typeof http.request | typeof https.request>(orig: T, scheme: 'http' | 'https') => {
	return function wrapped(this: any, 
		opts: string | URL | (http.RequestOptions & { protocol?: string }),
		cb?: (res: http.IncomingMessage) => void
	) {
		const start = performance.now()

		// Normalize for logging
		let method = 'GET'
		let urlStr = ''
		let headers: Record<string, any> | undefined

		if (typeof opts === 'string' || opts instanceof URL) {
			const u = new URL(opts.toString())
			method = 'GET'
			urlStr = u.toString()
		} else {
			method = (opts.method ?? 'GET').toUpperCase()
			const host = opts.hostname ?? (opts as any).host ?? 'localhost'
			const port = opts.port ? `:${opts.port}` : ''
			const path = opts.path ?? '/'
			const proto = (opts.protocol?.replace(':', '') as 'http'|'https') ?? scheme
			urlStr = `${proto}://${host}${port}${path}`
			headers = opts.headers as any
		}

		// @ts-ignore
		const req = orig.call(this, opts, (res: http.IncomingMessage) => {
			const ms = (performance.now() - start).toFixed(1)
			const status = res.statusCode ?? 0
			const statusColor = status >= 400 ? color.red : color.green
			console.log(`${color.pink('[MONITOR-HTTP]')} ${color.blue('[OUT]')} ${method} ${urlStr} → ${statusColor(String(status))} ${color.cyan(`${ms}ms`)}`)
			cb?.(res)
		})

		req.on('error', (err) => {
			const ms = (performance.now() - start).toFixed(1)
			console.log(`${color.pink('[MONITOR-HTTP]')} ${color.blue('[OUT]')} ${method} ${urlStr} ${color.red('✖')} ${err.message} ${color.cyan(`${ms}ms`)}`)
		})

		// log request headers once per request
		try {
			if (headers) {
				console.log(`${color.grey('  headers:')}`, redact(headers))
			}
		} catch {}

		return req
	} as unknown as T
}

;(http as any).request = wrap(http.request, 'http')
;(http as any).get = function get(opts: any, cb?: any) {
	const req = (http as any).request(opts, cb); req.end(); return req
}
;(https as any).request = wrap(https.request, 'https')
;(https as any).get = function get(opts: any, cb?: any) {
	const req = (https as any).request(opts, cb); req.end(); return req
}

// Wrap global fetch / Undici if present
const g: any = globalThis as any
if (g.fetch) {
	const origFetch = g.fetch
	g.fetch = async (input: any, init?: any) => {
		const start = performance.now()
		const method = (init?.method ?? (input?.method ?? 'GET')).toUpperCase()
		const url = typeof input === 'string' ? input : input?.url
		try {
			const res = await origFetch(input, init)
			const ms = (performance.now() - start).toFixed(1)
			const status = res.status
			const statusColor = status >= 400 ? color.red : color.green
			console.log(`${color.pink('[MONITOR-HTTP]')} ${color.blue('[OUT FETCH]')} ${method} ${url} → ${statusColor(String(status))} ${color.cyan(`${ms}ms`)}`)
			return res
		} catch (e: any) {
			const ms = (performance.now() - start).toFixed(1)
			console.log(`${color.pink('[MONITOR-HTTP]')} ${color.blue('[OUT FETCH]')} ${method} ${url} ${color.red('✖')} ${e?.message} ${color.cyan(`${ms}ms`)}`)
			throw e
		}
	}
}

console.log(`${color.pink('[MONITOR-HTTP]')} ${color.green('Enabled')}`)