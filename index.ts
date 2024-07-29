import path from "node:path";
import {program} from 'commander'
import checkbox from '@inquirer/checkbox'
import {getDryRunGoogleDriveClient, getGoogleDriveClient} from "./drive.ts";
import {filterListOfFile, getSourceDirContent} from "./files.ts";

function addDotToExtensionIfMissing(value: string) {
	return value.startsWith('.') ? value : `.${value}`;
}


program
	.name('sync-photo-util')
	.description('CLI to upload specific files to Google drive')
	.version('0.0.0-alpha1')
	.option('--dry-run', 'display folder and number of files to be uploaded')
	.option('--check', 'display how many folders there is to sync')
	.option('--select', 'display a prompt to select folder to upload')
	.option('--ext <ext>', 'select file extension to upload', addDotToExtensionIfMissing) // TODO: add support for comma separated or list
	.argument('<source>', 'folder to scan')
	.argument('<target>','folder to upload to in Google Drive')

program.parse();
const options = program.opts();
const [sourceDir, targetDir] = program.args;

console.log(sourceDir, '>', targetDir)
console.log('options ==>', options)

try {
	const sourceDirContent = getSourceDirContent(sourceDir);

	const driveClient = options.dryRun ? getDryRunGoogleDriveClient() : getGoogleDriveClient();
	const targetRootFolderId = await driveClient.getFolderId(targetDir)
	const remoteFolders = await driveClient.listFolderContent(targetRootFolderId)
	let missingFolders = sourceDirContent.filter((localFolderName) => !remoteFolders.includes(localFolderName));

	console.log('missingFolders>', missingFolders);

	if (options.check) {
		console.log(`There is ${missingFolders.length} folder(s) to sync`);
		process.exit(0);
	}
	if (options.select) {
		missingFolders = await checkbox({
			message: 'Select the folder(s) you want to sync',
			choices: missingFolders.map(f => ({name: f, value: f})),
		});
		console.log('[SELECT] folders:', missingFolders);
	}
	for (const folder of missingFolders) {
		console.log('[START] ', folder);
		const folderId = await driveClient.createFolder(folder, targetRootFolderId)
		console.log(`[FOLDER] ${folder} created with id ${folderId}`);
		const parentDir = path.join(sourceDir, folder)
		const allFiles = getSourceDirContent(parentDir)
		const filteredFiles = options.ext
			? filterListOfFile(allFiles, parentDir, options.ext)
			: allFiles;
		console.log(`[Uploading] ${filteredFiles.length} files`);

		let fileUploaded = 0

		console.log(`[Uploading] ${filteredFiles.length} files`);
		for (const file of filteredFiles) {
			const fullPathToFile = path.join(parentDir, file)
			const fileId = await driveClient.uploadFile(fullPathToFile, folderId)
			console.log(`[Upload] complete for ${file} -> ${fileId}`);
			fileUploaded++;
		}

		console.log(`[DONE] ${folder} - ${fileUploaded} files uploaded`);
	}
} catch (e) {
	console.error(e)
}
