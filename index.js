const core = require('@actions/core');
const github = require('@actions/github');

const getAllRepositories = async (octokit, org)=>{
    let needGetMorePages = true;
    let page = 1;
    let repositories = [];

    while (needGetMorePages) {

        const {data} = await octokit.rest.repos.listForOrg({
            org: org,
            per_page: 100,
            page: page
        });

        if (data.length === 0) {
            needGetMorePages = false;
        }

        page = page + 1;
        repositories = repositories.concat(data);
    }

    return repositories

}

async function getPullRequests(octokit, repo) {
    const {data: pullRequests} = await octokit.request('GET /repos/{owner}/{repo}/pulls?state=open', {
        owner: repo.owner.login,
        repo: repo.name,
    });

    return pullRequests;
}

const main = async () => {
    try {
        /**
         * We need to fetch all the inputs that were provided to our action
         * and store them in variables for us to use.
         **/
        const token = core.getInput('token', { required: true });
        const org = core.getInput('organization', { required: true });

        const octokit = new github.getOctokit(token);

        const repositories = await getAllRepositories(octokit, org)

        let report = {};
        let summary = {}

        for (const repo of repositories) {
            const pullRequests = await getPullRequests(octokit, repo);

            summary ={
                ...summary,
                [repo.name]: pullRequests.length
            }

            pullRequests.forEach(pr => {
                report = {
                    ...report,
                    [repo.name]: [...(report[repo.name] || []),
                        {
                            title: pr.title,
                            url: pr.url,
                            created_at: pr.created_at,
                            updated_at: pr.updated_at,
                            created_by: pr.user.login
                        }
                    ]
                };
            });
        }

        const summaryTable = Object.keys(summary)
            .filter(it => summary[it] > 0)
            .sort()
            .map( it => `|${it}| ${summary[it]}| \n`).join('')

        const body = `## Open PRs Summary \n| Name | Open PRs | \n| - | - | \n${summaryTable}`

        await octokit.rest.issues.createComment({
            owner: org,
            repo: 'tech-team-metrics',
            issue_number: '1',
            body:body ,
        });


    } catch (error) {
        core.setFailed(error.message);
    }
};

// Call the main function to run the action
main();