import fs from "node:fs";
import path from "node:path";

/**
 * Gets the local source directory list of folder
 * @param sourceDir the local directory to process
 * @param [showHidden=false] include hidden files in the list
 */
export function getSourceDirContent(
	sourceDir: string,
	showHidden = false,
): string[] {
	const dirContent = fs
		.readdirSync(sourceDir)
		.filter((f) => !f.startsWith(".") || showHidden);
	return dirContent;
}
/**
 * Filter a list of file name based on the extension
 * @param files the list of files to filter
 * @param folder the parent directory of the files
 * @param [extension] file extension to show
 */
export function filterListOfFile(
	files: string[],
	folder: string,
	extension: string,
): string[] {
	return files.filter(
		(file) =>
			!path
				.extname(path.join(folder, file))
				.localeCompare(extension, undefined, { sensitivity: "base" }),
	);
}
