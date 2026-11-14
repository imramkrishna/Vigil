import { Octokit } from "@octokit/rest";

export function createOctokit(githubToken?: string) {
  return new Octokit({
    auth: githubToken || process.env.GITHUB_TOKEN,
  });
}

