import { KeetaNetLib } from "../src/utils/keetanet";

function getArg(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	if (index !== -1 && index + 1 < process.argv.length) {
		return process.argv[index + 1];
	}
	return undefined;
}

const seed = getArg('--seed');
if (!seed) {
	console.error('Seed is required. Use --seed <seed>');
	process.exit(1);
}

const account = KeetaNetLib.lib.Account.fromSeed(seed, 0)
const userClient = KeetaNetLib.UserClient.fromNetwork("test", account)

// TOKEN keeta_anvszk7yurhk3advetf6tmuf6c56kzuiaue3vxbn5mg5it2gppjgaugv6djlg
// ADDRESS keeta_aabihd5brhpwfuvvwywuuuf472zrxcw453ibr7dyamueqyhkm5tcvpve5y6wqqy

// WWWW
const token = KeetaNetLib.lib.Account.fromPublicKeyString("keeta_anvszk7yurhk3advetf6tmuf6c56kzuiaue3vxbn5mg5it2gppjgaugv6djlg");

// KTA
// const token = Client.lib.Account.fromPublicKeyString("keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52");

// Destination account to send tokens to
const destination = KeetaNetLib.lib.Account.fromPublicKeyString("keeta_aabihd5brhpwfuvvwywuuuf472zrxcw453ibr7dyamueqyhkm5tcvpve5y6wqqy");

while (true) {
	const amount = BigInt(Math.floor(Math.random() * 1000) + 1); // Random amount between 1 and 1000
	console.log("Sending...", { amount })
	
	await userClient.send(destination, amount, token).then((result) => {
		console.log("Result:", result);
	}).catch(async (error) => {
		console.error("Error:", error);
		console.log("Recovery...");
		await userClient.recover();
	}).finally(() => {
		console.log("Done");
	});

	// Wait for 3 seconds before sending the next transaction
	console.log("Waiting for 5 seconds before sending the next transaction...");
	await new Promise(resolve => setTimeout(resolve, 5_000));
}

