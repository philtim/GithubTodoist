const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json()); // Use built-in JSON parser

const TODOIST_API_URL = "https://api.todoist.com/rest/v2/tasks";
const { TODOIST_API_TOKEN, TODOIST_PROJECT_ID, PORT } = process.env;

async function createTodoistTask({ title, body, url, issueId }) {
  try {
    const response = await axios.post(
      TODOIST_API_URL,
      {
        content: title,
        description: `${body}\n\nLink to GitHub issue:\n ${url}`,
        project_id: TODOIST_PROJECT_ID,
        labels: [`github_issue_${issueId}`], // Add a label with the GitHub issue ID
      },
      {
        headers: { Authorization: `Bearer ${TODOIST_API_TOKEN}` },
      },
    );
    console.log(`Created Todoist task: "${title}" with ID ${response.data.id}`);
    return response.data.id; // Return the Todoist task ID
  } catch (error) {
    console.error("Error creating Todoist task:", error.message);
  }
}

async function findTodoistTaskByGitHubIssueId(issueId) {
  try {
    const response = await axios.get(TODOIST_API_URL, {
      headers: { Authorization: `Bearer ${TODOIST_API_TOKEN}` },
      params: { project_id: TODOIST_PROJECT_ID },
    });

    const task = response.data.find((task) =>
      task.labels.includes(`github_issue_${issueId}`),
    );

    return task ? task.id : null;
  } catch (error) {
    console.error("Error finding Todoist task:", error.message);
    return null;
  }
}

async function deleteTodoistTask(taskId) {
  try {
    await axios.delete(`${TODOIST_API_URL}/${taskId}`, {
      headers: { Authorization: `Bearer ${TODOIST_API_TOKEN}` },
    });
    console.log(`Deleted Todoist task with ID ${taskId}`);
  } catch (error) {
    console.error("Error deleting Todoist task:", error.message);
  }
}

const extractData = (type, payload) => {
  let title;

  if (type === "issue") {
    title = `Issue ${payload.number}: ${payload.title}`;
  } else if (type === "pr") {
    title = `PR: ${payload.title}`;
  } else {
    title = payload.title || "Untitled";
  }

  return {
    title,
    body: payload.body || "",
    url: payload.html_url,
  };
};

const handleIssue = async (payload) => {
  if (payload.action === "assigned" && payload.assignee?.login === "philtim") {
    const issueData = extractData("issue", payload.issue);
    await createTodoistTask({ ...issueData, issueId: payload.issue.id });
  } else if (["closed", "deleted"].includes(payload.action)) {
    const taskId = await findTodoistTaskByGitHubIssueId(payload.issue.id);
    if (taskId) {
      await deleteTodoistTask(taskId);
    }
  }
};

const handlePullRequest = async (payload) => {
  if (
    ["opened", "reopened", "assigned"].includes(payload.action) &&
    payload.assignee?.login === "philtim"
  ) {
    const prData = extractData("pr", payload.pull_request);
    await createTodoistTask({ ...prData, issueId: payload.pull_request.id });
  } else if (["closed", "deleted"].includes(payload.action)) {
    const taskId = await findTodoistTaskByGitHubIssueId(
      payload.pull_request.id,
    );
    if (taskId) {
      await deleteTodoistTask(taskId);
    }
  }
};

const eventHandlers = {
  issues: handleIssue,
  pull_request: handlePullRequest,
};

app.post("/github-webhook", async (req, res) => {
  const event = req.headers["x-github-event"];
  const payload = req.body;

  console.log(event);
  console.log("----------");
  console.log(payload.action);

  const handler = eventHandlers[event];
  if (handler) {
    await handler(payload);
  } else {
    console.log(`No event handler found for ${event}`);
  }

  res.sendStatus(200);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
