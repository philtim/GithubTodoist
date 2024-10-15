const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json()); // Use built-in JSON parser

const TODOIST_API_URL = "https://api.todoist.com/rest/v2/tasks";
const { TODOIST_API_TOKEN, TODOIST_PROJECT_ID, PORT } = process.env;

async function createTodoistTask({ title, body, url }) {
  try {
    await axios.post(
      TODOIST_API_URL,
      {
        content: title,
        description: `${body}\n\nLink to GitHub issue:\n ${url}`,
        project_id: TODOIST_PROJECT_ID,
      },
      {
        headers: { Authorization: `Bearer ${TODOIST_API_TOKEN}` },
      },
    );
    console.log(`Created Todoist task: "${title}"`);
  } catch (error) {
    console.error("Error creating Todoist task:", error.message);
  }
}

const extractData = (type, payload) => {
  let title;

  if (type === "issue") {
    title = `Issue ${payload.number}: ${payload.title}`;
  } else if (type === "pull_request") {
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
    await createTodoistTask(extractData("issue", payload.issue));
  } else if (payload.action === "edited") {
    console.log("Issue edited");
  } else if (["closed", "deleted"].includes(payload.action)) {
    console.log("Issue closed or deleted");
  }
};

const handlePullRequest = async (payload) => {
  if (
    ["opened", "reopened"].includes(payload.action) &&
    payload.assignee?.login === "philtim"
  ) {
    await createTodoistTask(extractData("pr", payload.pull_request));
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
  console.log(payload);

  const handler = eventHandlers[event];
  if (handler) {
    await handler(payload);
  } else {
    console.log(`No event handler found for ${event}`);
  }

  res.sendStatus(200);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
