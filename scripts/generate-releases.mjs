import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

// Pre-fetch GitHub releases into dist/ so the changelog page loads a static
// file instead of hitting the unauthenticated api.github.com (60 req/hr/IP,
// which 403s for visitors behind shared IPs). The page still falls back to
// the live API if this file is missing, so a fetch failure here is non-fatal.

const REPO = "Minty-Flow/minty-flow-app";
const out = join(import.meta.dirname, "..", "dist", "releases.json");

/** @returns {Promise<unknown[] | null>} */
async function fetchReleases() {
	// gh CLI is authenticated → no rate limit. Preferred.
	try {
		const json = execFileSync(
			"gh",
			["api", `repos/${REPO}/releases`, "--paginate"],
			{ encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] },
		);
		return JSON.parse(json);
	} catch {
		// no gh / not authed — fall through
	}
	try {
		const res = await fetch(`https://api.github.com/repos/${REPO}/releases`, {
			headers: { Accept: "application/vnd.github+json" },
		});
		if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
		return await res.json();
	} catch (err) {
		console.warn(`⚠ releases.json not generated: ${err.message}`);
		return null;
	}
}

const releases = await fetchReleases();
if (releases) {
	// gh is authenticated as a maintainer, so the API also returns unpublished
	// drafts — drop them. Then trim to the fields the page uses.
	const slim = releases
		.filter((r) => !r.draft)
		.map((r) => ({
			tag_name: r.tag_name,
			name: r.name,
			published_at: r.published_at,
			body: r.body,
			html_url: r.html_url,
		}));
	writeFileSync(out, JSON.stringify(slim), "utf-8");
	console.log(`✓ releases.json (${slim.length} releases)`);
}
