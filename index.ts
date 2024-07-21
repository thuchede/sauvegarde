import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { authenticate } from "@google-cloud/local-auth";
import { drive_v3, google } from "googleapis";

// If modifying these scopes, delete token.json.
const SCOPES = ["https://www.googleapis.com/auth/drive.metadata.readonly"];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
	try {
		const content = await fs.promises.readFile(TOKEN_PATH);
		const credentials = JSON.parse(content);
		return google.auth.fromJSON(credentials);
	} catch (err) {
		return null;
	}
}

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
	const content = await fs.readFile(CREDENTIALS_PATH);
	const keys = JSON.parse(content);
	const key = keys.installed || keys.web;
	const payload = JSON.stringify({
		type: "authorized_user",
		client_id: key.client_id,
		client_secret: key.client_secret,
		refresh_token: client.credentials.refresh_token,
	});
	await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
	let client = await loadSavedCredentialsIfExist();
	if (client) {
		return client;
	}
	client = await authenticate({
		scopes: SCOPES,
		keyfilePath: CREDENTIALS_PATH,
	});
	if (client.credentials) {
		await saveCredentials(client);
	}
	return client;
}

/**
 * Lists the names and IDs of up to 10 files.
 * @param {OAuth2Client} authClient An authorized OAuth2 client.
 */
async function listFiles(authClient) {
	const drive = google.drive({ version: "v3", auth: authClient });
	const res = await drive.files.list({
		pageSize: 1000,
		q: [
			`'SOME_ID' in parents`,
			`mimeType = 'application/vnd.google-apps.folder'`,
		],
		fields: "nextPageToken, files(id, name)",
	});
	const files = res.data.files;
	if (files.length === 0) {
		console.log("No files found.");
		return;
	}

	console.log("_____________");
	console.log("Google Drive:");
	console.log("_____________");
	files.map((file) => {
		console.log(`${file.name} (${file.id})`);
	});
	return files;
}
const auth = new google.auth.GoogleAuth({
	keyFile: "./secrets/google-drive-service-account-credentials.json",
	scopes: [
		"https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.appfolder https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.resource https://www.googleapis.com/auth/drive.meet.readonly https://www.googleapis.com/auth/drive.metadata https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/drive.readonly.metadata https://www.googleapis.com/auth/drive.photos.readonly https://www.googleapis.com/auth/drive.readonly",
	],
});

// authorize().then(listFiles).catch(console.error);

const files = fs.readdirSync("/path/to/folder");
console.log("_____________");
console.log("SSD:");
console.log("_____________");
for (const file of files) {
	console.log(file);
}

// let remote_files: { name: string; id: string }[] = [];
// try {
// 	remote_files = await auth.getClient().then(listFiles).catch(console.error);
// } catch {}
// const remote_filenames = remote_files.map((e) => e.name);
//
// console.log("_____________");
// console.log("Missing:");
// console.log("_____________");
//
// const not_exist = files.filter((f) => remote_files.includes(f));
//
// for (const file of not_exist) {
// 	console.log(file);
// }
let remote_files: { name: string; id: string }[] = [];
try {
	remote_files = await auth.getClient().then(listFiles).catch(console.error);
	console.log("_____________");
	console.log("Missing:");
	console.log("_____________");

	const not_exist = files.filter((f) => remote_files.includes(f));

	for (const file of not_exist) {
		console.log(file);
	}
} catch {}
