import fs from "node:fs";
import chalk from "chalk";
import pino from "pino";

export function error(...args: unknown[]) {
	console.log(chalk.red(...args));
}

export function warn(...args: unknown[]) {
	console.log(chalk.yellow(...args));
}

export function info(...args: unknown[]) {
	console.log(chalk.cyan(...args));
}

export function success(...args: unknown[]) {
	console.log(chalk.green(...args));
}

const multistream = pino.multistream;

const streams = [
	{
		level: "debug",
		stream: fs.createWriteStream("./sauvegarde-debug.log", { flags: "a" }),
	},
	{
		level: "error",
		stream: fs.createWriteStream("./sauvegarde-error.log", { flags: "a" }),
	},
];

const pinoOptions = {
	levels: {
		silent: Number.POSITIVE_INFINITY,
		fatal: 60,
		error: 50,
		warn: 50,
		info: 30,
		debug: 20,
		trace: 10,
	},
	dedupe: true,
};

export const initLogger = (logLevel: string) =>
	pino({ level: logLevel }, multistream(streams, pinoOptions));
