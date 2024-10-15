const express = require("express");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const { TodoistApi } = require("@doist/todoist-api-typescript");
require("dotenv").config();

const app = express();
app.use(express.json());

const { TODOIST_API_TOKEN, TODOIST_PROJECT_ID, TODOIST_SECTION_ID, PORT } =
  process.env;
const TODOIST_DONE_SECTION_ID = "170393795";
const TODOIST_SYNC_API_URL = "https://api.todoist.com/sync/v9/sync";

const api = new TodoistApi(TODOIST_API_TOKEN);

function generateUUID() {
  return uuidv4();
}

async function createTodoistTask({ title, body, url, issueId }) {
  try {
    const task = await api.addTask({
      content: title,
      description: `${body}\n\nLink to GitHub issue:\n ${url}`,
      projectId: TODOIST_PROJECT_ID,
      sectionId: TODOIST_SECTION_ID,
      labels: [`github_issue_${issueId}`],
    });
    console.log(`Created Todoist task: "${title}" with ID ${task.id}`);
    return task.id;
  } catch (error) {
    console.error("Error creating Todoist task:", error.message);
  }
}

async function findTodoistTaskByGitHubIssueId(issueId) {
  try {
    const tasks = await api.getTasks({ projectId: TODOIST_PROJECT_ID });
    const task = tasks.find((task) =>
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
    await api.deleteTask(taskId);
    console.log(`Deleted Todoist task with ID ${taskId}`);
  } catch (error) {
    console.error("Error deleting Todoist task:", error.message);
  }
}

async function updateTodoistTask({ taskId, title, body, url }) {
  try {
    await api.updateTask(taskId, {
      content: title,
      description: `${body}\n\nLink to GitHub issue:\n ${url}`,
    });
    console.log(`Updated Todoist task: "${title}" with ID ${taskId}`);
  } catch (error) {
    console.error("Error updating Todoist task:", error.message);
  }
}

async function moveAndCloseTask({ taskId, title }) {
  try {
    const moveCommand = {
      type: "item_move",
      uuid: generateUUID(),
      args: {
        id: taskId,
        section_id: TODOIST_DONE_SECTION_ID,
      },
    };

    const response = await axios.post(
      TODOIST_SYNC_API_URL,
      {
        commands: JSON.stringify([moveCommand]),
      },
      {
        headers: {
          Authorization: `Bearer ${TODOIST_API_TOKEN}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    if (response.data.sync_status[moveCommand.uuid] === "ok") {
      console.log(
        `Moved Todoist task: "${title}" with ID ${taskId} to Done section`,
      );
    } else {
      console.error(
        `Failed to move Todoist task: "${title}" with ID ${taskId}`,
      );
    }

    await api.closeTask(taskId);
    console.log(`Marked Todoist task: "${title}" as done`);
  } catch (error) {
    console.error("Error updating Todoist task:", error.message);
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

// Higher-order function to check if the assignee is 'philtim'
const withAssigneeCheck = (handler) => async (payload) => {
  if (payload.issue?.assignee?.login !== "philtim") return;
  await handler(payload);
};

const handleAssigned = async (payload) => {
  const taskId = await findTodoistTaskByGitHubIssueId(payload.issue.id);
  const issueData = extractData("issue", payload.issue);

  if (taskId) {
    await updateTodoistTask({ taskId, ...issueData });
  } else {
    await createTodoistTask({ ...issueData, issueId: payload.issue.id });
  }
};

const handleEdited = async (payload) => {
  const taskId = await findTodoistTaskByGitHubIssueId(payload.issue.id);
  if (taskId) {
    const issueData = extractData("issue", payload.issue);
    await updateTodoistTask({ taskId, ...issueData });
  }
};

const handleClosed = async (payload) => {
  const taskId = await findTodoistTaskByGitHubIssueId(payload.issue.id);
  if (taskId) {
    const issueData = extractData("issue", payload.issue);
    await moveAndCloseTask({ taskId, ...issueData });
  }
};

const handleDeleted = async (payload) => {
  const taskId = await findTodoistTaskByGitHubIssueId(payload.issue.id);
  if (taskId) {
    await deleteTodoistTask(taskId);
  }
};

const handleIssue = async (payload) => {
  // Map actions to handlers without invoking them immediately
  const actionHandlers = {
    assigned: withAssigneeCheck(handleAssigned),
    edited: withAssigneeCheck(handleEdited),
    closed: withAssigneeCheck(handleClosed),
    deleted: withAssigneeCheck(handleDeleted),
  };

  // Retrieve the correct handler based on the action
  const handler = actionHandlers[payload.action];

  // Execute the action handler if it exists, passing in the payload
  if (handler) {
    await handler(payload);
  } else {
    console.log(`No handler for action: ${payload.action}`);
  }
};

const handlePullRequest = async (payload) => {
  if (
    ["opened", "reopened", "assigned"].includes(payload.action) &&
    payload.assignee?.login === "philtim"
  ) {
    const prData = extractData("pr", payload.pull_request);
    await createTodoistTask({ ...prData, issueId: payload.pull_request.id });
  } else if (payload.action === "edited") {
    const taskId = await findTodoistTaskByGitHubIssueId(
      payload.pull_request.id,
    );
    if (taskId) {
      const prData = extractData("pr", payload.pull_request);
      await updateTodoistTask({ taskId, ...prData });
    }
  } else if (payload.action === "closed" && payload.pull_request.merged) {
    const taskId = await findTodoistTaskByGitHubIssueId(
      payload.pull_request.id,
    );
    if (taskId) {
      const prData = extractData("pr", payload.pull_request);
      await moveAndCloseTask({ taskId, ...prData });
    }
  } else if (["deleted"].includes(payload.action)) {
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

  console.log("START: ----------");
  console.log("EVENT: ", event);
  console.log("ACTION: ", payload.action);

  const handler = eventHandlers[event];
  if (handler) {
    await handler(payload);
  } else {
    console.log(`No event handler found for ${event}`);
  }

  res.sendStatus(200);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
