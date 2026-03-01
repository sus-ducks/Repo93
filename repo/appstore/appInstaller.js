(function () {
	function cleanSegment(value) {
		return String(value || '')
			.trim()
			.replace(/^\/+|\/+$/g, '')
			.replace(/[^a-zA-Z0-9._-]/g, '_');
	}

	function getRepoId(repoUrl) {
		try {
			const parsed = new URL(String(repoUrl || ''));
			const host = cleanSegment(parsed.host || 'repo');
			const path = cleanSegment(parsed.pathname || '');
			return path ? `${host}_${path.replace(/\//g, '_')}` : host;
		} catch (error) {
			return cleanSegment(repoUrl || 'repo');
		}
	}

	function getAppId(appManifest, appPath) {
		const fromManifest = appManifest?.slug || appManifest?.command || appManifest?.name;
		return cleanSegment(appPath || fromManifest || 'app');
	}

	function getInstallPath(repoUrl, appPath, appManifest) {
		const repoId = getRepoId(repoUrl);
		const appId = getAppId(appManifest, appPath);
		return `/c/programs/appstore/${repoId}/${appId}`;
	}

	function joinUrl(base, ...parts) {
		let url = String(base || '').replace(/\/+$/, '');

		for (const part of parts) {
			url += `/${String(part || '').replace(/^\/+|\/+$/g, '')}`;
		}

		return url;
	}

	function joinPath(base, ...parts) {
		let target = String(base || '').replace(/\/+$/, '');

		for (const part of parts) {
			target += `/${String(part || '').replace(/^\/+|\/+$/g, '')}`;
		}

		return target;
	}

	function normalizeFileList(appFiles) {
		if (!Array.isArray(appFiles)) {
			return [];
		}

		return appFiles
			.map((file) => String(file || '').trim())
			.filter(Boolean);
	}

	function getSentinelFile(appFiles) {
		const normalized = normalizeFileList(appFiles);
		if (normalized.includes('app.manifest.json5')) {
			return 'app.manifest.json5';
		}

		return normalized[0] || null;
	}

	function resolveFs() {
		const candidates = [];

		if (typeof window !== 'undefined') {
			candidates.push(window.sys42);

			try {
				if (window.parent && window.parent !== window) {
					candidates.push(window.parent.sys42);
				}
			} catch (error) {
			}

			try {
				if (window.top) {
					candidates.push(window.top.sys42);
				}
			} catch (error) {
			}
		}

		for (const sys42 of candidates) {
			if (sys42 && sys42.fs) {
				return sys42.fs;
			}
		}

		return null;
	}

	async function getFs() {
		const timeoutMs = 4000;
		const intervalMs = 50;
		const endTime = Date.now() + timeoutMs;

		while (Date.now() < endTime) {
			const fs = resolveFs();
			if (fs) {
				return fs;
			}

			await new Promise((resolve) => setTimeout(resolve, intervalMs));
		}

		throw new Error('sys42.fs is not available');
	}

	async function isInstalled(repoUrl, appPath, appManifest, appFiles) {
		const fs = await getFs();
		const installBasePath = getInstallPath(repoUrl, appPath, appManifest);
		const sentinel = getSentinelFile(appFiles);

		if (!sentinel) {
			return false;
		}

		const installedManifestPath = joinPath(installBasePath, sentinel);
		return Boolean(await fs.isFile(installedManifestPath));
	}

	async function writeFileToFs(fs, targetPath, content) {
		if (typeof fs.write === 'function') {
			await fs.write(targetPath, content);
			return;
		}

		if (typeof fs.writeFile === 'function') {
			await fs.writeFile(targetPath, content);
			return;
		}

		throw new Error('sys42.fs.write is not available');
	}

	async function removeFileFromFs(fs, targetPath) {
		if (typeof fs.delete === 'function') {
			await fs.delete(targetPath);
			return;
		}

		if (typeof fs.unlink === 'function') {
			await fs.unlink(targetPath);
			return;
		}

		if (typeof fs.removeFile === 'function') {
			await fs.removeFile(targetPath);
			return;
		}

		if (typeof fs.rm === 'function') {
			await fs.rm(targetPath);
			return;
		}

		throw new Error('No supported file removal method found on sys42.fs');
	}

	async function installApp(appManifest, repoUrl, appPath, appFiles) {
		const fs = await getFs();
		const installBasePath = getInstallPath(repoUrl, appPath, appManifest);
		const files = normalizeFileList(appFiles);

		if (files.length === 0) {
			throw new Error('No files listed for this app');
		}

		for (const file of files) {
			const sourceUrl = joinUrl(repoUrl, appPath, file);
			const response = await fetch(sourceUrl);

			if (!response.ok) {
				throw new Error(`Failed to fetch ${sourceUrl}`);
			}

			const content = await response.text();
			const targetPath = joinPath(installBasePath, file);
			await writeFileToFs(fs, targetPath, content);
		}

		return installBasePath;
	}

	async function uninstallApp(appManifest, repoUrl, appPath, appFiles) {
		const fs = await getFs();
		const installBasePath = getInstallPath(repoUrl, appPath, appManifest);

		if (typeof fs.deleteDir === 'function') {
			await fs.deleteDir(installBasePath);
			return installBasePath;
		}

		const files = normalizeFileList(appFiles);
		for (const file of files) {
			const targetPath = joinPath(installBasePath, file);
			try {
				await removeFileFromFs(fs, targetPath);
			} catch (error) {
			}
		}

		return installBasePath;
	}

	window.AppInstaller = {
		getInstallPath,
		isInstalled,
		installApp,
		uninstallApp
	};
})();
