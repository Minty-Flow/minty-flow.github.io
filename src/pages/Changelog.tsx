import {
	Check,
	ChevronDown,
	Copy,
	ExternalLink,
	GitCommit,
	Plus,
	Search,
	Sparkles,
	Wrench,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { APP } from "@/constants/app";
import { useSEO } from "@/hooks/useSEO";
import { cn } from "@/lib/utils";

type ChangeType = "new" | "improved" | "fixed";
const CHANGE_ORDER: ChangeType[] = ["new", "improved", "fixed"];
const INITIAL_VISIBLE = 3;

interface Change {
	type: ChangeType;
	text: string;
}

interface Release {
	version: string;
	date: string;
	title: string;
	description: string;
	url: string;
	changes: Change[];
}

interface GitHubRelease {
	tag_name: string;
	name: string;
	published_at: string;
	body: string | null;
	html_url: string;
}

// Static file generated at deploy time (scripts/generate-releases.mjs). The
// live API is only a fallback — visitors behind shared IPs get 403s from it.
const RELEASES_STATIC = `${import.meta.env.BASE_URL}releases.json`;
const RELEASES_API =
	"https://api.github.com/repos/Minty-Flow/minty-flow-app/releases";

async function fetchReleases(): Promise<GitHubRelease[]> {
	try {
		const res = await fetch(RELEASES_STATIC);
		if (res.ok) return (await res.json()) as GitHubRelease[];
	} catch {
		// fall through to the live API
	}
	const res = await fetch(RELEASES_API, {
		headers: { Accept: "application/vnd.github+json" },
	});
	if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
	return (await res.json()) as GitHubRelease[];
}

const TYPE_META: Record<
	ChangeType,
	{ label: string; tone: string; icon: typeof Plus }
> = {
	new: { label: "New", tone: "text-primary", icon: Plus },
	improved: { label: "Improved", tone: "text-foreground/75", icon: Sparkles },
	fixed: { label: "Fixed", tone: "text-muted-foreground", icon: Wrench },
};

function escapeRegex(s: string) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Highlight({ text, query }: { text: string; query: string }) {
	if (!query.trim()) return <>{text}</>;
	const regex = new RegExp(`(${escapeRegex(query)})`, "gi");
	const parts = text.split(regex);
	return (
		<>
			{parts.map((part, i) =>
				part.toLowerCase() === query.toLowerCase() ? (
					<mark
						key={i.toString()}
						className="rounded-sm bg-primary/20 px-0.5 text-foreground"
					>
						{part}
					</mark>
				) : (
					<span key={i.toString()}>{part}</span>
				),
			)}
		</>
	);
}

function parseBody(body: string | null): {
	changes: Change[];
	description: string;
} {
	if (!body?.trim()) return { changes: [], description: "" };
	const changes: Change[] = [];
	let currentType: ChangeType | null = null;
	const descLines: string[] = [];
	let inChanges = false;

	for (const line of body.split("\n")) {
		const trimmed = line.trim();
		if (/^###\s+new$/i.test(trimmed)) {
			inChanges = true;
			currentType = "new";
		} else if (/^###\s+improved$/i.test(trimmed)) {
			inChanges = true;
			currentType = "improved";
		} else if (/^###\s+fixed$/i.test(trimmed)) {
			inChanges = true;
			currentType = "fixed";
		} else if (!inChanges && trimmed && !trimmed.startsWith("#")) {
			descLines.push(trimmed);
		} else if (
			inChanges &&
			(trimmed.startsWith("- ") || trimmed.startsWith("* ")) &&
			currentType
		) {
			const text = trimmed.slice(2).trim();
			if (text) changes.push({ type: currentType, text });
		}
	}

	return { changes, description: descLines.join(" ") };
}

function formatDate(iso: string) {
	return new Date(iso).toLocaleDateString("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
	});
}

function toRelease(gh: GitHubRelease): Release {
	const { changes, description } = parseBody(gh.body);
	return {
		version: gh.tag_name.replace(/^v/i, ""),
		date: formatDate(gh.published_at),
		title: gh.name || gh.tag_name,
		description,
		url: gh.html_url,
		changes,
	};
}

function ReleaseEntry({
	release,
	latest,
	copied,
	query,
	onCopy,
}: {
	release: Release;
	latest: boolean;
	copied: boolean;
	query: string;
	onCopy: () => void;
}) {
	return (
		<article
			id={`v${release.version}`}
			className="group relative scroll-mt-24 pl-10 pb-14"
		>
			{/* Timeline dot */}
			<span className="absolute left-0 top-1.5 flex size-7 items-center justify-center">
				<span
					className={cn(
						"absolute inset-0 rounded-full transition-all",
						latest
							? "bg-primary/20 ring-2 ring-primary"
							: "bg-card ring-1 ring-border group-hover:ring-primary/50",
					)}
				/>
				<GitCommit
					className={cn(
						"relative size-3.5",
						latest ? "text-primary" : "text-muted-foreground",
					)}
				/>
			</span>

			<header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<h2 className="font-mono text-sm font-medium text-foreground">
					v{release.version}
				</h2>
				<span className="text-sm text-muted-foreground">{release.date}</span>
				{latest && (
					<span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-primary-foreground">
						Latest
					</span>
				)}
				<button
					type="button"
					onClick={onCopy}
					className="ml-auto inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
				>
					{copied ? (
						<>
							<Check className="size-3" />
							Copied
						</>
					) : (
						<>
							<Copy className="size-3" />
							Copy link
						</>
					)}
				</button>
			</header>

			<a
				href={release.url}
				target="_blank"
				rel="noopener noreferrer"
				className="mt-3 inline-flex items-start gap-2"
			>
				<h3 className="font-display text-2xl font-bold tracking-tight text-foreground transition-colors hover:text-primary">
					<Highlight text={release.title} query={query} />
				</h3>
				<ExternalLink className="mt-2 size-3.5 shrink-0 text-muted-foreground/50" />
			</a>

			{release.description && (
				<p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
					<Highlight text={release.description} query={query} />
				</p>
			)}

			{release.changes.length > 0 && (
				<div className="mt-6 flex flex-col gap-5">
					{CHANGE_ORDER.map((type) => {
						const items = release.changes.filter((c) => c.type === type);
						if (items.length === 0) return null;
						const meta = TYPE_META[type];
						const Icon = meta.icon;
						return (
							<section key={type}>
								<h4
									className={cn(
										"flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider",
										meta.tone,
									)}
								>
									<Icon className="size-3" />
									{meta.label}
								</h4>
								<ul className="mt-2 flex flex-col gap-1.5 border-l border-border/60 pl-4">
									{items.map((c, j) => (
										<li
											key={j.toString()}
											className="text-sm leading-relaxed text-foreground/85"
										>
											<Highlight text={c.text} query={query} />
										</li>
									))}
								</ul>
							</section>
						);
					})}
				</div>
			)}
		</article>
	);
}

export function Changelog() {
	const [releases, setReleases] = useState<Release[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [query, setQuery] = useState("");
	const [showAll, setShowAll] = useState(false);
	const [copiedVersion, setCopiedVersion] = useState<string | null>(null);

	useSEO({
		title: "Changelog — Minty Flow",
		description:
			"See what's new in Minty Flow. Every feature release, improvement, and bug fix — documented with each version.",
		canonical: "https://minty-flow.github.io/changelog",
	});

	useEffect(() => {
		let cancelled = false;
		fetchReleases()
			.then((data) => {
				if (cancelled) return;
				setReleases(data.map(toRelease));
			})
			.catch((err: unknown) => {
				if (!cancelled)
					setError(err instanceof Error ? err.message : "Failed to load");
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const searching = query.trim() !== "";
	const matchingReleases = (releases ?? []).filter((r) => {
		if (!searching) return true;
		const q = query.toLowerCase();
		return (
			r.title.toLowerCase().includes(q) ||
			r.description.toLowerCase().includes(q) ||
			r.changes.some((c) => c.text.toLowerCase().includes(q))
		);
	});
	const visibleReleases =
		searching || showAll
			? matchingReleases
			: matchingReleases.slice(0, INITIAL_VISIBLE);
	const hiddenCount = matchingReleases.length - visibleReleases.length;

	function copyLink(url: string, version: string) {
		navigator.clipboard
			.writeText(url)
			.then(() => {
				setCopiedVersion(version);
				setTimeout(
					() => setCopiedVersion((v) => (v === version ? null : v)),
					2000,
				);
			})
			.catch(() => {});
	}

	return (
		<main className="mx-auto max-w-4xl px-5 sm:px-6">
			<section className="max-w-2xl pt-14 md:pt-20">
				<h1 className="font-display text-4xl font-extrabold tracking-[-0.035em] text-foreground md:text-5xl">
					What&rsquo;s new
				</h1>
				<p className="mt-4 text-muted-foreground">
					Every release, pulled straight from GitHub. Newest first.
				</p>
			</section>

			<section className="pb-24 pt-10">
				{/* Controls */}
				<div className="sticky top-20 z-10 -mx-2 mb-10 rounded-[1.125rem] border border-border bg-card/85 p-2 backdrop-blur sm:mx-0 sm:p-3">
					<div className="relative w-full">
						<Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
						<input
							type="text"
							placeholder="Search changes"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							className="w-full rounded-[0.85rem] border border-border bg-background py-2 pl-9 pr-8 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/25"
						/>
						{query && (
							<button
								type="button"
								onClick={() => setQuery("")}
								className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
								aria-label="Clear search"
							>
								<X className="size-3.5" />
							</button>
						)}
					</div>
				</div>

				<div className="relative">
					{/* Timeline rail */}
					<span
						aria-hidden
						className="pointer-events-none absolute left-3.5 top-5 bottom-0 w-px -translate-x-1/2 bg-linear-to-b from-primary/40 via-border to-transparent"
					/>

					{/* Loading */}
					{releases === null &&
						error === null &&
						[1, 2, 3].map((i) => (
							<div key={i} className="animate-pulse pl-10 pb-14">
								<div className="mb-4 flex items-center gap-3">
									<div className="h-4 w-12 rounded bg-muted" />
									<div className="h-4 w-32 rounded bg-muted" />
								</div>
								<div className="mb-3 h-7 w-2/3 rounded bg-muted" />
								<div className="mb-5 h-4 w-full max-w-md rounded bg-muted" />
								<div className="flex flex-col gap-3 rounded-2xl border border-border/60 p-5">
									{[80, 65, 90].map((w, j) => (
										<div key={j.toString()} className="flex items-center gap-4">
											<div className="h-3 w-16 rounded bg-muted" />
											<div
												className="h-4 rounded bg-muted"
												style={{ width: `${w}%` }}
											/>
										</div>
									))}
								</div>
							</div>
						))}

					{/* Error */}
					{error && (
						<div className="rounded-2xl border border-border/60 bg-card/60 py-16 text-center backdrop-blur">
							<p className="text-sm text-muted-foreground">
								Could not load releases.{" "}
								<a
									href={APP.links.githubReleases}
									target="_blank"
									rel="noopener noreferrer"
									className="text-foreground underline-offset-4 hover:underline"
								>
									View on GitHub
								</a>
							</p>
						</div>
					)}

					{/* Empty */}
					{releases && matchingReleases.length === 0 && (
						<div className="rounded-2xl border border-border/60 bg-card/60 py-16 text-center backdrop-blur">
							<p className="text-sm text-muted-foreground">
								No releases match{" "}
								<span className="text-foreground">"{query}"</span>.
							</p>
							<button
								type="button"
								onClick={() => setQuery("")}
								className="mt-3 cursor-pointer text-xs text-foreground underline-offset-4 hover:underline"
							>
								Clear search
							</button>
						</div>
					)}

					{/* Entries */}
					{visibleReleases.map((release) => (
						<ReleaseEntry
							key={release.version}
							release={release}
							latest={releases?.[0]?.version === release.version}
							copied={copiedVersion === release.version}
							query={query}
							onCopy={() => copyLink(release.url, release.version)}
						/>
					))}

					{hiddenCount > 0 && (
						<div className="pl-10 pb-14">
							<button
								type="button"
								onClick={() => setShowAll(true)}
								className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-4 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
							>
								<ChevronDown className="size-3" />
								Show {hiddenCount} older{" "}
								{hiddenCount === 1 ? "release" : "releases"}
							</button>
						</div>
					)}
				</div>

				{releases && releases.length > 0 && (
					<div className="mt-8 text-center">
						<a
							href={APP.links.githubReleases}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-4 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
						>
							View all releases on GitHub
							<ExternalLink className="size-3" />
						</a>
					</div>
				)}
			</section>
		</main>
	);
}
