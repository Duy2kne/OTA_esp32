/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GitHubAuth {
  token: string;
  owner: string;
  repo: string;
  branch: string;
}

export interface GitBlobItem {
  path: string;
  mode: '100644' | '100755';
  type: 'blob';
  sha: string;
}

export interface WorkflowRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  head_commit: {
    message: string;
    id: string;
  };
}

export class GitHubService {
  private auth: GitHubAuth;

  constructor(auth: GitHubAuth) {
    this.auth = auth;
  }

  private get headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.auth.token.trim()}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  private get baseUrl(): string {
    return `https://api.github.com/repos/${this.auth.owner}/${this.auth.repo}`;
  }

  /**
   * Verify token and check repository access
   */
  async verifyAccess(): Promise<{ ok: boolean; repoName?: string; permissions?: any; error?: string }> {
    try {
      const res = await fetch(this.baseUrl, { headers: this.headers });
      if (!res.ok) {
        if (res.status === 401) {
          return { ok: false, error: 'Token GitHub không hợp lệ hoặc đã hết hạn.' };
        }
        if (res.status === 404) {
          return {
            ok: false,
            error: `Không tìm thấy repository '${this.auth.owner}/${this.auth.repo}' hoặc Token không có quyền truy cập repo này.`,
          };
        }
        return { ok: false, error: `Lỗi kết nối GitHub API (Mã: ${res.status})` };
      }
      const data = await res.json();
      return {
        ok: true,
        repoName: data.full_name,
        permissions: data.permissions,
      };
    } catch (e: any) {
      return { ok: false, error: e.message || 'Lỗi mạng khi kiểm tra GitHub Token' };
    }
  }

  /**
   * Get file content from repository (utf-8)
   */
  async getFileContent(filePath: string): Promise<string | null> {
    try {
      const res = await fetch(`${this.baseUrl}/contents/${filePath}?ref=${this.auth.branch}`, {
        headers: this.headers,
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.content && data.encoding === 'base64') {
        const cleanContent = data.content.replace(/\s/g, '');
        const binaryString = atob(cleanContent);
        const bytes = Uint8Array.from(binaryString, (c) => c.charCodeAt(0));
        return new TextDecoder().decode(bytes);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Create a Git blob for text or binary content
   */
  async createBlob(content: string, encoding: 'utf-8' | 'base64'): Promise<string> {
    const res = await fetch(`${this.baseUrl}/git/blobs`, {
      method: 'POST',
      headers: {
        ...this.headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content, encoding }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Lỗi tạo Git blob: ${err.message || res.statusText}`);
    }

    const data = await res.json();
    return data.sha;
  }

  /**
   * Perform an atomic commit with multiple files using Git Data API:
   * 1. Get current commit ref
   * 2. Get base tree
   * 3. Create new tree
   * 4. Create commit
   * 5. Update ref (with conflict retry)
   */
  async commitFiles(
    files: Array<{ path: string; content: string; encoding: 'utf-8' | 'base64' }>,
    commitMessage: string,
    maxRetries = 2
  ): Promise<{ commitSha: string }> {
    let attempts = 0;

    while (attempts <= maxRetries) {
      attempts++;
      try {
        // Step 1: Create blobs in parallel
        const blobItems: GitBlobItem[] = [];
        for (const file of files) {
          const sha = await this.createBlob(file.content, file.encoding);
          blobItems.push({
            path: file.path,
            mode: '100644',
            type: 'blob',
            sha,
          });
        }

        // Step 2: Get latest commit on target branch
        const refRes = await fetch(`${this.baseUrl}/git/ref/heads/${this.auth.branch}`, {
          headers: this.headers,
        });

        if (!refRes.ok) {
          const err = await refRes.json().catch(() => ({}));
          throw new Error(`Không lấy được thông tin branch '${this.auth.branch}': ${err.message || refRes.statusText}`);
        }

        const refData = await refRes.json();
        const parentCommitSha = refData.object.sha;

        // Step 3: Get parent commit to obtain base tree
        const commitRes = await fetch(`${this.baseUrl}/git/commits/${parentCommitSha}`, {
          headers: this.headers,
        });
        if (!commitRes.ok) {
          throw new Error('Không lấy được commit cha');
        }
        const commitData = await commitRes.json();
        const baseTreeSha = commitData.tree.sha;

        // Step 4: Create new tree
        const treeRes = await fetch(`${this.baseUrl}/git/trees`, {
          method: 'POST',
          headers: {
            ...this.headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            base_tree: baseTreeSha,
            tree: blobItems,
          }),
        });

        if (!treeRes.ok) {
          const err = await treeRes.json().catch(() => ({}));
          throw new Error(`Không tạo được Git tree mới: ${err.message || treeRes.statusText}`);
        }
        const treeData = await treeRes.json();
        const newTreeSha = treeData.sha;

        // Step 5: Create new commit
        const newCommitRes = await fetch(`${this.baseUrl}/git/commits`, {
          method: 'POST',
          headers: {
            ...this.headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: commitMessage,
            tree: newTreeSha,
            parents: [parentCommitSha],
          }),
        });

        if (!newCommitRes.ok) {
          const err = await newCommitRes.json().catch(() => ({}));
          throw new Error(`Không tạo được commit: ${err.message || newCommitRes.statusText}`);
        }
        const newCommitData = await newCommitRes.json();
        const newCommitSha = newCommitData.sha;

        // Step 6: Update branch ref
        const updateRefRes = await fetch(`${this.baseUrl}/git/refs/heads/${this.auth.branch}`, {
          method: 'PATCH',
          headers: {
            ...this.headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sha: newCommitSha,
            force: false,
          }),
        });

        if (!updateRefRes.ok) {
          if (updateRefRes.status === 422 && attempts <= maxRetries) {
            console.warn(`Xung đột ref trên '${this.auth.branch}', đang thử lại lần ${attempts}...`);
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }
          const err = await updateRefRes.json().catch(() => ({}));
          throw new Error(`Không cập nhật được ref branch '${this.auth.branch}': ${err.message}`);
        }

        return { commitSha: newCommitSha };
      } catch (err: any) {
        if (attempts > maxRetries) throw err;
      }
    }

    throw new Error('Không thể hoàn tất commit sau nhiều lần thử lại.');
  }

  /**
   * Fetch recent GitHub Actions workflow runs to monitor deployment
   */
  async getLatestWorkflowRuns(): Promise<WorkflowRun[]> {
    try {
      const res = await fetch(`${this.baseUrl}/actions/runs?per_page=5`, {
        headers: this.headers,
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.workflow_runs || []).map((run: any) => ({
        id: run.id,
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        html_url: run.html_url,
        created_at: run.created_at,
        updated_at: run.updated_at,
        head_commit: {
          message: run.head_commit?.message || '',
          id: run.head_commit?.id || run.head_sha || '',
        },
      }));
    } catch {
      return [];
    }
  }
}
