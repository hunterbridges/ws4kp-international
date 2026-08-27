const SIGNING_SALT = 'thisisasupersecretsaltthatissuperdupersecret';

async function simpleHash(message) {
	const encoder = new TextEncoder();
	const data = encoder.encode(SIGNING_SALT + message);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
	return hashHex.slice(0, 16);
}

function randomUUID() {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);

	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;

	return [...bytes]
		.map((b, i) => {
			const s = b.toString(16).padStart(2, '0');
			return [4, 6, 8, 10].includes(i) ? `-${s}` : s;
		})
		.join('');
}

// This is not secure as the client knows the "secret."
// This is just a lightweight consistency check between client and proxy.
async function createToken() {
	const uuid = randomUUID();

	const signature = await simpleHash(uuid);

	return `${uuid}.${signature}`;
}

export default createToken;
