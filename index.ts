import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {authenticate} from "@google-cloud/local-auth";
import {google} from "googleapis";

import {program} from 'commander'

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

	// console.log("_____________");
	// console.log("Google Drive:");
	// console.log("_____________");
	// files.map((file) => {
	// 	console.log(`${file.name} (${file.id})`);
	// });
	return files;
}
const auth = new google.auth.GoogleAuth({
	keyFile: "./secrets/google-drive-service-account-credentials.json",
	scopes: [
		"https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.appfolder https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.resource https://www.googleapis.com/auth/drive.meet.readonly https://www.googleapis.com/auth/drive.metadata https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/drive.readonly.metadata https://www.googleapis.com/auth/drive.photos.readonly https://www.googleapis.com/auth/drive.readonly",
	],
});

// authorize().then(listFiles).catch(console.error);

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

async function createDirectory(auth, directoryName: string, parentDirectoryId: string) {

	const service = google.drive({version: 'v3', auth});
	const fileMetadata = {
		name: directoryName,
		mimeType: 'application/vnd.google-apps.folder',
		parents: [parentDirectoryId]
	};
	const file = await service.files.create({
		requestBody: fileMetadata,
		fields: 'id',
	});
	console.log('Folder Id:', file.data.id);
	if (file.data.id) {
		return file.data.id;
	}
	throw new Error('No folder created')
}

const ROOT_FOLDER = 'RAW'

async function findRootFolderID(authClient) {

	const drive = google.drive({ version: "v3", auth: authClient });
	const res = await drive.files.list({
		pageSize: 1000,
		q: [
			`name = '${ROOT_FOLDER}'`,
			`mimeType = 'application/vnd.google-apps.folder'`,
		],
		fields: "nextPageToken, files(id)",
	});

	const files = res.data.files;
	if (files.length !== 1) {
		console.log("More then 1 file found");
		return -1;
	}
	return files[0].id;
}

async function uploadFile(auth, filename: string, parentFolderId: string) {
	const service = google.drive({version: 'v3', auth});

	// const mimeType= mime.getType('data/file-1.rw2')
	// const mimeType2= lookup('data/file-1.rw2')
	// console.log('mm>', mimeType)
	// console.log('mT>', mimeType2)
	const fileMetadata = {
		name: filename,
		parents: [parentFolderId],
	};
	const media = {
		body: fs.createReadStream('data/file-1.rw2'),
		resumable: true
	};

	const file = await service.files.create({
		requestBody: fileMetadata,
		media: media,
		fields: 'id',
	});
	console.log('File Id:', file.data.id);
	return file.data.id;
}

function addDotToExtensionIfMissing(value: string) {
	return value.startsWith('.') ? value : `.${value}`;
}


program
	.name('sync-photo-util')
	.description('CLI to upload specific files to Google drive')
	.version('0.0.0-alpha1')
	.option('--ext <ext>', 'select file extension to upload', addDotToExtensionIfMissing) // TODO: add support for comma separated or list
	.argument('<source>', 'folder to scan')
	.argument('<target>','folder to upload to in Google Drive')

program.parse();
const options = program.opts();
const [sourceDir, targetDir] = program.args;

console.log(sourceDir, '>', targetDir)
console.log('==>', options)

const files = fs.readdirSync(sourceDir)
	.filter(f => !f.startsWith("."));

const remote_files: { name: string; id: string }[] = [];
try {
	const client = await auth.getClient();
	// remote_files = await listFiles(client);
	// const remote_files_names = remote_files.map(f => f.name);
	// console.log("_____________");
	// console.log("Missing:");
	// console.log("_____________");
	//
	// const not_exist = files.filter((f) => !remote_files_names.includes(f));
	for (const folder of files) {
		console.log(folder);
		const allFiles = fs.readdirSync(path.join(sourceDir, folder))
		const filteredFiles = options.ext
			? allFiles.filter(f => !path.extname(path.join(sourceDir,folder, f)).localeCompare(options.ext, undefined, {sensitivity: 'base'}))
			: allFiles;

		// traverse
		for (const f of filteredFiles) {
			console.log('- ', f);
		}
	}


	// const TEST_FOLDER_CLI = "TEST_FOLDER_CLI"
	//
	// console.log("__________");
	// console.log(`Making dir: ${TEST_FOLDER_CLI}`);
	// console.log("__________");
	//
	// const rootId = await findRootFolderID(client)
	//
	// console.log(`ROOT folder '${ROOT_FOLDER}' id is >>`, rootId)
	//
	// const createdFolderId = await createDirectory(client, TEST_FOLDER_CLI, rootId )
	// console.log(`Folder '${TEST_FOLDER_CLI}' created with id:`, createdFolderId)

	// uploadFile(auth, "file-1.RW2", createdFolderId)



} catch (e) {
	console.error(e)
}
