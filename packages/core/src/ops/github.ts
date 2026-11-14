import { createOctokit } from "../config/octokit";
import {
  getOrgGitHubToken,
  getServiceByName,
  listOpsServices,
} from "./queries";

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

export function parseGitHubRepo(
  repoUrl: string
): { owner: string; repo: string } | null {
  const match = repoUrl
    .trim()
    .match(/(?:github\.com\/|^)([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i);
  if (!match?.[1] || !match?.[2]) return null;
  return { owner: match[1], repo: match[2] };
}

export async function fetchGitHubCommitsForRepo(params: {
  serviceName: string;
  repoUrl: string;
  branch?: string | null;
  limit?: number;
  githubToken?: string;
}): Promise<GitHubCommitDeploy[]> {
  const parsed = parseGitHubRepo(params.repoUrl);
  if (!parsed) return [];

  const octokit = createOctokit(params.githubToken);
  const branch = params.branch?.trim() || "main";
  const limit = Math.min(params.limit ?? 5, 10);

  try {
    const { data: commits } = await octokit.rest.repos.listCommits({
      owner: parsed.owner,
      repo: parsed.repo,
      sha: branch,
      per_page: limit,
    });

    const results: GitHubCommitDeploy[] = await Promise.all(
      commits.slice(0, limit).map(async (c) => {
        const shortSha = c.sha.slice(0, 7);
        const firstLine = c.commit.message.split("\n")[0] ?? "";
        let diffSummary: Record<string, unknown> = {
          message: firstLine,
        };

        try {
          const { data: detail } = await octokit.rest.repos.getCommit({
            owner: parsed.owner,
            repo: parsed.repo,
            ref: c.sha,
          });

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
        } catch {
          // Keep basic commit summary if detail fetch fails
        }

        return {
          service: params.serviceName,
          sha: shortSha,
          author: c.author?.login ?? c.commit.author?.name ?? "unknown",
          deployedAt: c.commit.author?.date ?? new Date().toISOString(),
          message: firstLine,
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
  limit = 5,
  githubToken?: string
): Promise<GitHubCommitDeploy[]> {
  const services = serviceName?.trim()
    ? await getServiceByName(orgId, serviceName)
    : await listOpsServices(orgId);

  const withRepos = services.filter((s) => Boolean(s.repoUrl?.trim()));
  if (withRepos.length === 0) return [];

  const resolvedToken = githubToken ?? (await getOrgGitHubToken(orgId));

  const nested = await Promise.all(
    withRepos.slice(0, 3).map((s) =>
      fetchGitHubCommitsForRepo({
        serviceName: s.name,
        repoUrl: s.repoUrl!,
        branch: s.githubBranch,
        limit,
        githubToken: resolvedToken,
      })
    )
  );

  return nested
    .flat()
    .sort(
      (a, b) =>
        new Date(b.deployedAt).getTime() - new Date(a.deployedAt).getTime()
    )
    .slice(0, limit);
}

export async function fetchGitHubFileContent(params: {
  repoUrl: string;
  filePath: string;
  branch?: string | null;
  githubToken?: string;
}): Promise<string | null> {
  const parsed = parseGitHubRepo(params.repoUrl);
  if (!parsed) return null;

  const octokit = createOctokit(params.githubToken);

  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: parsed.owner,
      repo: parsed.repo,
      path: params.filePath.replace(/^\/+/, ""),
      ref: params.branch?.trim() || "main",
    });

    if (!Array.isArray(data) && data.type === "file" && "content" in data) {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }
    return null;
  } catch {
    return null;
  }
}

export async function createGitHubIssueForRepo(params: {
  repoUrl: string;
  title: string;
  body: string;
  labels?: string[];
  githubToken?: string;
}): Promise<{ number: number; url: string } | null> {
  const parsed = parseGitHubRepo(params.repoUrl);
  if (!parsed) return null;

  const octokit = createOctokit(params.githubToken);

  try {
    const { data } = await octokit.rest.issues.create({
      owner: parsed.owner,
      repo: parsed.repo,
      title: params.title,
      body: params.body,
      labels: params.labels,
    });

    return {
      number: data.number,
      url: data.html_url,
    };
  } catch {
    return null;
  }
}
