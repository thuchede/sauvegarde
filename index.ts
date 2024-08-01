import path from "node:path";
import checkbox from "@inquirer/checkbox";
import cliProgress from "cli-progress";
import { program } from "commander";
import { getDryRunGoogleDriveClient, getGoogleDriveClient } from "./drive.ts";
import { filterListOfFile, getSourceDirContent } from "./files.ts";
import { error, info, initLogger, success, warn } from "./logger.ts";
import * as packageJson from "./package.json" with { type: "json" };

function addDotToExtensionIfMissing(value: string) {
	return value.startsWith(".") ? value : `.${value}`;
}

program
	.name("sync-photo-util")
	.description("CLI to upload specific files to Google drive")
	.version(packageJson.version)
	.option("--dry-run", "display folder and number of files to be uploaded")
	.option("--log-level <level>", "set specific log level", "info")
	.option("--check", "display how many folders there is to sync")
	.option("--select", "display a prompt to select folder to upload")
	.option(
		"--ext <ext>",
		"select file extension to upload",
		addDotToExtensionIfMissing,
	) // TODO: add support for comma separated or list
	.argument("<source>", "folder to scan")
	.argument("<target>", "folder to upload to in Google Drive");

program.parse();
const [sourceDir, targetDir] = program.args;
const options = program.opts();

const logger = initLogger(options.logLevel);

try {
	const sourceDirContent = getSourceDirContent(sourceDir);

	const driveClient = options.dryRun
		? getDryRunGoogleDriveClient()
		: getGoogleDriveClient();
	const targetRootFolderId = await driveClient.getFolderId(targetDir);
	const remoteFolders = await driveClient.listFolderContent(targetRootFolderId);
	let missingFolders = sourceDirContent.filter(
		(localFolderName) => !remoteFolders.includes(localFolderName),
	);

	logger.debug(
		`${missingFolders.length} missing folder${missingFolders.length === 1 ? "" : "s"}`,
	);

	if (options.check) {
		info(
			`There's ${missingFolders.length} folder${missingFolders.length === 1 ? "" : "s"} to sync`,
		);
		process.exit(0);
	}

	if (options.select) {
		missingFolders = await checkbox({
			message: "Select the folders you want to sync",
			choices: missingFolders.map((f) => ({ name: f, value: f })),
		});
		logger.debug({ selected: missingFolders }, "manual selection");
	} else {
		logger.debug({ selected: missingFolders }, "auto selection");
	}

	let folderProcessed = 0;
	const bar1 = new cliProgress.SingleBar(
		{},
		cliProgress.Presets.shades_classic,
	);

	for (const folder of missingFolders) {
		logger.debug(`[START] upload for ${folder}`);
		let folderId: string;
		try {
			folderId = await driveClient.createFolder(folder, targetRootFolderId);
		} catch (e) {
			logger.error({ error: e }, `[ERROR] failed to create folder ${folder}`);
			error(`[ERROR] failed to create folder ${folder}`);
			continue;
		}
		info(`[PROCESSING] ${folder}`);
		logger.debug(`[CREATE] folder ${folder} with id ${folderId}`);
		const parentDir = path.join(sourceDir, folder);
		const allFiles = getSourceDirContent(parentDir);
		const filteredFiles = options.ext
			? filterListOfFile(allFiles, parentDir, options.ext)
			: allFiles;
		logger.debug(`[UPLOADING] ${filteredFiles.length} files`);
		bar1.start(filteredFiles.length, 0);

		let fileUploaded = 0;
		for (const file of filteredFiles) {
			const fullPathToFile = path.join(parentDir, file);
			try {
				const fileId = await driveClient.uploadFile(fullPathToFile, folderId);
				logger.debug(`[UPLOADED] file ${file} with id ${fileId}`);
				fileUploaded++;
				bar1.update(fileUploaded);
			} catch (e) {
				logger.error({ error: e }, `[UPLOAD] failed to upload file ${file}`);
			}
		}
		bar1.stop();
		logger.debug(`[UPLOADED] ${fileUploaded}/${filteredFiles.length} files`);

		success(`${folder} - ${fileUploaded} files uploaded`);
		folderProcessed++;
	}

	if (folderProcessed !== missingFolders.length) {
		warn(
			`[INCOMPLETE] upload ${folderProcessed}/${missingFolders.length} folder uploaded`,
		);
	} else {
		success(`[SUCCESS] ${folderProcessed} folder uploaded`);
	}
} catch (e) {
	logger.fatal({ error: e }, "[FATAL] unexpected error");
	error(e);
	process.exit(1);
}
