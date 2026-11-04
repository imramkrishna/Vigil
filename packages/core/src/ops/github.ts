import { getServiceByName, listOpsServices } from "./queries";

export interface GitHubCommitDeploy {
  service: string;
  sha: string;
  author: string;
  deployedAt: string;
  message: string;
  url: string;
  configDiff: Record<string, unknown>;
  status: string;
}

function parseGitHubRepo(repoUrl: string): { owner: string; repo: string } | null {
  const match = repoUrl
    .trim()
    .match(/(?:github\.com\/|^)([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i);
  if (!match?.[1] || !match?.[2]) return null;
  return { owner: match[1], repo: match[2] };
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Vigil-Ops-Copilot",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

export async function fetchGitHubCommitsForRepo(params: {
  serviceName: string;
  repoUrl: string;
  branch?: string | null;
  limit?: number;
}): Promise<GitHubCommitDeploy[]> {
  const parsed = parseGitHubRepo(params.repoUrl);
  if (!parsed) return [];

  const branch = params.branch?.trim() || "main";
  const limit = Math.min(params.limit ?? 5, 10);
  const listUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/commits?sha=${encodeURIComponent(branch)}&per_page=${limit}`;

  try {
    const res = await fetch(listUrl, { headers: githubHeaders() });
    if (!res.ok) return [];

    const commits = (await res.json()) as Array<{
      sha: string;
      html_url: string;
      commit: {
        message: string;
        author?: { name?: string; date?: string };
      };
      author?: { login?: string };
    }>;

    const results: GitHubCommitDeploy[] = await Promise.all(
      commits.slice(0, limit).map(async (c) => {
        const shortSha = c.sha.slice(0, 7);
        let diffSummary: Record<string, unknown> = {
          message: c.commit.message.split("\n")[0],
        };

        try {
          const detailRes = await fetch(
            `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/commits/${c.sha}`,
            { headers: githubHeaders() }
          );
          if (detailRes.ok) {
            const detail = (await detailRes.json()) as {
              stats?: { additions?: number; deletions?: number; total?: number };
              files?: Array<{
                filename: string;
                status: string;
                additions: number;
                deletions: number;
                patch?: string;
              }>;
            };
            diffSummary = {
              message: c.commit.message,
              stats: detail.stats,
              files: (detail.files ?? []).slice(0, 8).map((f) => ({
                file: f.filename,
                status: f.status,
                diffStat: `+${f.additions} -${f.deletions}`,
                patch: f.patch ? f.patch.slice(0, 500) : undefined,
              })),
            };
          }
        } catch {
          // Keep basic commit summary if detail fetch fails
        }

        return {
          service: params.serviceName,
          sha: shortSha,
          author: c.author?.login ?? c.commit.author?.name ?? "unknown",
          deployedAt: c.commit.author?.date ?? new Date().toISOString(),
          message: c.commit.message.split("\n")[0] ?? "",
          url: c.html_url,
          configDiff: diffSummary,
          status: "deployed",
        };
      })
    );

    return results;
  } catch {
    return [];
  }
}

export async function fetchGitHubDeploysForOrg(
  orgId: string,
  serviceName?: string,
  limit = 5
): Promise<GitHubCommitDeploy[]> {
  const services = serviceName?.trim()
    ? await getServiceByName(orgId, serviceName)
    : await listOpsServices(orgId);

  const withRepos = services.filter((s) => Boolean(s.repoUrl?.trim()));
  if (withRepos.length === 0) return [];

  const nested = await Promise.all(
    withRepos.slice(0, 3).map((s) =>
      fetchGitHubCommitsForRepo({
        serviceName: s.name,
        repoUrl: s.repoUrl!,
        branch: s.githubBranch,
        limit,
      })
    )
  );

  return nested
    .flat()
    .sort((a, b) => new Date(b.deployedAt).getTime() - new Date(a.deployedAt).getTime())
    .slice(0, limit);
}
