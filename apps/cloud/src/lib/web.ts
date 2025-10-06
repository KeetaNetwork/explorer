import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

interface WebConfig {
	/**
	 * Server URL to use
	 */
	serverUrl: string;

	/**
	 * Default network to use
	 */
	defaultNetwork: string;

	/**
	 * Available networks
	 */
	availableNetworks: string[];
}

export class Web extends pulumi.ComponentResource {

	public backendBucket!: gcp.compute.BackendBucket;

	constructor(name: string, config: WebConfig, opts?: pulumi.ComponentResourceOptions) {
		super('Explorer:GCP:Web', name, config, opts);

		/*
		 * Locate the directory of this script (we can't use __dirname because we are an ES Module)
		 */
		const scriptDir = path.dirname(new URL(import.meta.url).pathname)

		/*
		 * Locate the "web" directory that contains the static website
		 */
		let webDir: string | undefined = undefined
		for (const checkWebDir of [path.join(path.dirname(scriptDir), "web")]) {
			if (fs.existsSync(checkWebDir) && fs.existsSync(path.join(checkWebDir, "index.html"))) {
				webDir = path.normalize(checkWebDir)
				break
			}
		}

		if (webDir === undefined) {
			throw new Error('Could not locate the "web" directory containing the static website')
		}

		/*
		 * Copy the "web" directory to a temporary directory so we can mangle
		 * the files with the Parameters
		 */
		const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "keeta-explorer-web-"))
		fs.cpSync(webDir, tempDir, {
			recursive: true,
			preserveTimestamps: true,
			verbatimSymlinks: true,
		})

		/*
		 * Modify the assets to include the KeetaNet Network and Explorer URL
		 */
		for (const fileTail of fs.readdirSync(path.join(tempDir, "assets"))) {
			const file = path.join(tempDir, "assets", fileTail)
			const fileInfo = fs.statSync(file)
			if (!fileInfo.isFile()) {
				continue
			}

			const data = fs.readFileSync(file, "utf8")
			let newData = data

			newData = newData.replace(/9a25e997-ff93-434e-8c6a-ba3879006334/g, config.serverUrl)
			newData = newData.replace(/85dd0881-25bf-4b91-8b8d-8e90959ac1aa/g, config.defaultNetwork)
			newData = newData.replace(/3e57729e-6517-441a-9f4e-fdc424b1d06d/g, config.availableNetworks.join(","))

			if (newData !== data) {
				fs.writeFileSync(file, newData, "utf8")
			}
		}

		/*
		 * Create a bucket to host the website
		 */
		const bucket = new gcp.storage.Bucket(`${name}-bucket`, {
			location: "us",
			/*
			 * Since this is non-authoritative, we can force
			 * destroy the bucket and disable soft-delete
			 */
			forceDestroy: true,
			softDeletePolicy: {
				retentionDurationSeconds: 0,
			},
			website: {
				mainPageSuffix: "index.html",
				notFoundPage: "index.html",
			},
			/*
			 * Enable uniform bucket-level access so that we
			 * only need to set IAM permissions on the bucket
			 */
			uniformBucketLevelAccess: true,
		})

		/*
		 * Grant the "everybody" group read access to the bucket
		 */
		new gcp.storage.BucketIAMMember(
			`${name}-bucket-viewer`,
			{
				bucket: bucket.name,
				role: "roles/storage.objectViewer",
				member: "allUsers",
			},
			{
				deletedWith: bucket,
			},
		)

		/*
		 * Create a GCP Load Balancer to front the bucket
		 */
		const backendBucket = new gcp.compute.BackendBucket(`${name}-backend`, {
			bucketName: bucket.name,
			enableCdn: false,
		})

		this.backendBucket = backendBucket

		/*
		 * Sync the "web" directory with the bucket
		 */
		new GoogleCloudFolderWithArgs(`${name}-dir-v2`, {
			bucketName: bucket.name,
			path: tempDir,
			deleteAfterUpload: true,
			filter: function (file) {
				if (file === ".done") {
					return false
				}
				return true
			},
			options: {
				object: {
					/*
					 * For Bucket Objects, set the cache control based on the
					 * file name
					 */
					cacheControl: "public, max-age=300",
				},
				generated: function (fileName: string) {
					/*
					 * For Bucket Objects, set the cache control based on the
					 * file name
					 */
					let ttl: number
					if (fileName === "index.html") {
						/** The index.html file should be cached for 10 seconds */
						ttl = 10
					} else if (fileName.startsWith("assets/")) {
						/** The assets should be cached for 1 day since they have hashed names */
						ttl = 86400
					} else {
						/** Everything else should be cached for 5 minutes */
						ttl = 300
					}

					return {
						cacheControl: `public, max-age=${ttl}`,
					}
				},
			},
		})

		this.registerOutputs({
			backendBucket: this.backendBucket,
		})
	}
}

/**
 * Reimplement the GoogleCloudFolder but with support for specifying
 * options to pass through for each file
 */
export interface GoogleCloudFolderArgs {
	/**
	 * The name of the bucket to sync to
	 */
	bucketName: pulumi.Input<string>

	/**
	 * The path to sync
	 */
	path: string

	/**
	 * The options to pass to the bucket object
	 */
	options: {
		/**
		 * The options to set for every object
		 */
		object?: Partial<Omit<gcp.storage.BucketObjectArgs, "bucket" | "source" | "name">>

		/**
		 * A function to generate the options for each object
		 * based on the path
		 */
		generated?: (path: string) => Partial<Omit<gcp.storage.BucketObjectArgs, "bucket" | "source" | "name">>
	}

	/**
	 * Delete the source directory after the upload is complete
	 *
	 * (default is false)
	 */
	deleteAfterUpload?: boolean

	/**
	 * Filter to apply to the files in the directory
	 */
	filter?: (file: string) => boolean
}

class GoogleCloudFolderWithArgs extends pulumi.ComponentResource {
	readonly bucket: pulumi.Output<string>
	readonly path: pulumi.Output<string>

	private static getAllFiles(startDir: string): string[] {
		const files: string[] = []

		for (const file of fs.readdirSync(startDir)) {
			const filePath = path.join(startDir, file)
			const fileInfo = fs.statSync(filePath)
			if (fileInfo.isDirectory()) {
				for (const subFile of GoogleCloudFolderWithArgs.getAllFiles(filePath)) {
					files.push(path.join(file, subFile))
				}
			} else {
				files.push(file)
			}
		}
		return files
	}

	private static getComputedContentTypeFromFilename(fileName: string): string {
		const ext = path.extname(fileName).toLowerCase()
		switch (ext) {
			case ".html":
				return "text/html"
			case ".css":
				return "text/css"
			case ".js":
				return "application/javascript"
			case ".json":
				return "application/json"
			case ".png":
				return "image/png"
			case ".jpg":
			case ".jpeg":
				return "image/jpeg"
			case ".gif":
				return "image/gif"
			case ".svg":
				return "image/svg+xml"
			case ".woff2":
				return "font/woff2"
			case ".woff":
				return "font/woff"
			case ".md":
				return "text/markdown"
			case ".ts":
				return "application/typescript"
			case ".txt":
				return "text/plain"
			case ".xml":
				return "application/xml"
			default:
				return "application/octet-stream"
		}
	}

	constructor(name: string, args: GoogleCloudFolderArgs, opts?: pulumi.ComponentResourceOptions) {
		super("keeta:synced-folder:GoogleCloudFolderWithArgs", name, args, opts)

		let files = GoogleCloudFolderWithArgs.getAllFiles(args.path)
		if (args.filter !== undefined) {
			files = files.filter(args.filter)
		}

		this.bucket = pulumi.output(args.bucketName)
		this.path = pulumi.output(args.path)

		const objects: gcp.storage.BucketObject[] = []
		for (const file of files) {
			const filePath = path.join(args.path, file)

			/*
			 * If the file is a directory, skip it
			 */
			const fileInfo = fs.statSync(filePath)
			if (fileInfo.isDirectory()) {
				continue
			}

			const resourceName = `${name}-${file.replace(/[^A-Za-z0-9/.]/g, "-")}`

			const object = new gcp.storage.BucketObject(
				resourceName,
				{
					bucket: args.bucketName,
					source: new pulumi.asset.FileAsset(filePath),
					name: file,
					contentType: GoogleCloudFolderWithArgs.getComputedContentTypeFromFilename(file),
					...args.options.object,
					...args.options.generated?.(file),
				},
				{
					parent: this,
					deleteBeforeReplace: true,
				},
			)

			objects.push(object)
		}

		if (args.deleteAfterUpload) {
			pulumi
				.all(
					objects.map(function (object) {
						return object.urn
					}),
				)
				.apply(function () {
					fs.rmSync(args.path, {
						recursive: true,
					})
				})
		}
	}
}
