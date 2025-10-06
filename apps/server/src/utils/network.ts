import { KeetaNetLib } from "@/utils/keetanet";

export function isValidPublicKey(key?: string | null): key is NonNullable<string> {
	if (!key) return false
	if (!key.startsWith("keeta_")) return false
	if (key.length !== 67 && key.length !== 69) return false
	try {
		return !!KeetaNetLib.lib.Account.fromPublicKeyString(key)
	} catch {
		return false
	}
}