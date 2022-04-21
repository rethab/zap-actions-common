import {Context} from '@actions/github/lib/context';
import {
    RestEndpointMethodTypes
} from '@octokit/plugin-rest-endpoint-methods/dist-types/generated/parameters-and-response-types';
import { Octokit } from '@octokit/rest';
import { getRunnerID } from './action-helper';
import { info } from '@actions/core'

export type Issue = RestEndpointMethodTypes["search"]["issuesAndPullRequests"]["response"]["data"]["items"][0]

export async function findOpenIssue(octokit: Octokit, context: Context, issueTitle: string): Promise<Issue | undefined> {
    const { owner, repo } = context.repo;
    const {data: {items: issues}} = await octokit.rest.search.issuesAndPullRequests({
        q: encodeURI(`is:issue state:open repo:${owner}/${repo} ${issueTitle}`).replace(/%20/g,'+'),
        sort: 'updated'
    });

    // Sometimes search API returns recently closed issue as an open issue
    for (const issue of issues) {
        if(issue && issue.state === 'open' && issue.user?.login === 'github-actions[bot]') {
            return issue;
        }
    }

    return undefined;
}

export async function findPreviousRunnerId(octokit: Octokit, context: Context, issue: Issue) {
    info(`Ongoing open issue has been identified #${issue.number}`);
    // If there is no comments then read the body
    if (issue.comments !== 0) {
        const lastBotComment = await findLastBotCommentInIssue(octokit, context, issue.number);
        if (lastBotComment) {
            return getRunnerID(lastBotComment.body ?? '');
        }
    }

    return getRunnerID(issue.body ?? '');
}

type IssueComment = RestEndpointMethodTypes["issues"]["listComments"]["response"]["data"][0];

async function findLastBotCommentInIssue(octokit: Octokit, context: Context, issueNumber: number): Promise<IssueComment | undefined> {
    const {owner, repo} = context.repo;
    let {data} = await octokit.issues.listComments({
        owner: owner,
        repo: repo,
        issue_number: issueNumber,
    });

    let lastCommentIndex = data.length - 1;
    for (let i = lastCommentIndex; i >= 0; i--) {
        if (data[i]!!.user?.login === 'github-actions[bot]') {
            return data[i];
        }
    }

    return undefined;
}
