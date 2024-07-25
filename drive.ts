import fs from "node:fs";
import {drive} from "@googleapis/drive";
import {auth} from "@googleapis/oauth2";

export type RemoteFile = { name: string; id: string }

export interface DriveClient {
    getFolderId(name: string): Promise<string>;
    listFolderContent(id: string): Promise<string[]>;
    createFolder(name: string, parentFolderId: string): Promise<string>;
    uploadFile(fileLocation: string, parentFolderId: string): Promise<string>;
}

export class GoogleDriveClient implements DriveClient {
    private readonly auth;
    private readonly drive;

    constructor() {
        this.auth = new auth.GoogleAuth({
            keyFile: "./secrets/google-drive-service-account-credentials.json",
            scopes: [
                "https://www.googleapis.com/auth/drive " +
                "https://www.googleapis.com/auth/drive.appdata " +
                "https://www.googleapis.com/auth/drive.appfolder " +
                "https://www.googleapis.com/auth/drive.file " +
                "https://www.googleapis.com/auth/drive.resource " +
                "https://www.googleapis.com/auth/drive.meet.readonly " +
                "https://www.googleapis.com/auth/drive.metadata " +
                "https://www.googleapis.com/auth/drive.metadata.readonly " +
                "https://www.googleapis.com/auth/drive.readonly.metadata " +
                "https://www.googleapis.com/auth/drive.photos.readonly " +
                "https://www.googleapis.com/auth/drive.readonly",
            ],
        });
        this.drive = drive({version: 'v3', auth: this.auth});
    }

    async getFolderId(name: string): Promise<string> {
        const res = await this.drive.files.list({
            pageSize: 1000,
            q: `name = '${name}' and mimeType = 'application/vnd.google-apps.folder'`,
            fields: "nextPageToken, files(id)",
        });

        const files = res.data.files;
        if (!files) {
            console.error("No files found");
            throw new Error("No files found");
        }
        if (files.length !== 1) {
            console.error("More then 1 file found");
            throw new Error("More then 1 file found");
        }
        if (!files[0].id) {
            console.error("File id not defined");
            throw new Error("File id not defined");
        }
        return files[0].id;
    }

    async listFolderContent(id: string): Promise<string[]> {
        const res = await this.drive.files.list({
            // pageSize: 1000
            q: `'${id}' in parents and mimeType = 'application/vnd.google-apps.folder'`,
            fields: "nextPageToken, files(name)",
        });
        const files = res.data.files;
        if (!files || files.length === 0) {
            console.log("No files found.");
            return [];
        }
        return files
            .filter(e => !!e.name)
            .map(e => (e.name as string));
    }

    async createFolder(name: string, parentFolderId: string): Promise<string> {
        const fileMetadata = {
            name: name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentFolderId]
        };
        const file = await this.drive.files.create({
            requestBody: fileMetadata,
            fields: 'id',
        });
        if (file.data.id) {
            return file.data.id;
        }
        throw new Error(`[ERROR] failed to create folder ${name}`)
    }


    async uploadFile(fileLocation: string, parentFolderId: string): Promise<string> {
        const filename = fileLocation.split('/').at(-1);
        const fileMetadata = {
            name: filename,
            parents: [parentFolderId],
        };
        const media = {
            body: fs.createReadStream(fileLocation),
            resumable: true
        };

        const file = await this.drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id',
        });
        console.log('File Id:', file.data.id);
        if (file.data.id) {
            return file.data.id;
        }
        throw new Error(`[ERROR] failed to upload file ${fileLocation}`)
    }
}

export class DryRunGoogleDriveClient extends GoogleDriveClient {
    createFolder(name: string, _: string): Promise<string> {
        console.log(`Skipping folder creation for ${name} because '--dry-run' option is selected`);
        return Promise.resolve("");
    }

    uploadFile(fileLocation: string, _: string): Promise<string> {
        console.log(`Skipping file upload for ${fileLocation} because '--dry-run' option is selected`);
        return Promise.resolve("");
    }
}

export function getGoogleDriveClient(): DriveClient {
    return new GoogleDriveClient();
}

export function getDryRunGoogleDriveClient(): DriveClient {
    return new DryRunGoogleDriveClient();
}
