const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());

const TODOIST_API_URL = "https://api.todoist.com/rest/v2/tasks";
const TODOIST_API_TOKEN = process.env.TODOIST_API_TOKEN;
const TODOIST_PROJECT_ID = process.env.TODOIST_PROJECT_ID;

// Helper function to create a Todoist task
async function createTodoistTask(issue) {
  const title = issue.title || "Untitled issue";
  const description = issue.body || "No description provided";
  const githubIssueUrl = issue.url;

  const todoistDescription = `${description}\n\nLink to GitHub issue:\n ${githubIssueUrl}`;

  try {
    await axios.post(
      TODOIST_API_URL,
      {
        content: title,
        description: todoistDescription,
        project_id: TODOIST_PROJECT_ID,
      },
      {
        headers: {
          Authorization: `Bearer ${TODOIST_API_TOKEN}`,
        },
      },
    );

    console.log(`Created Todoist task for issue "${title}".`);
  } catch (error) {
    console.error("Error creating Todoist task:", error.message);
  }
}

// Map GitHub priority to Todoist priority levels
function mapGitHubPriorityToTodoistPriority(priority) {
  // Assuming GitHub uses a 1-4 priority scale similar to Todoist
  // Map priorities: 1 (low) -> 1, 2 (medium) -> 2, 3 (high) -> 3, 4 (urgent) -> 4
  switch (priority) {
    case 4:
      return 4; // Urgent
    case 3:
      return 3; // High
    case 2:
      return 2; // Medium
    default:
      return 1; // Low (default if no priority is set)
  }
}

// Extract relevant data from GitHub webhook payload
function extractIssueDataFromPayload(payload) {
  return {
    title: `${payload.title}: ${payload.number}` || "No title",
    body: payload.body || "",
    url: payload.url,
  };
}

app.post("/github-webhook", async (req, res) => {
  const event = req.headers["x-github-event"];
  const payload = req.body;

  console.log(event);
  console.log("----------");
  console.log(payload);

  if (event === "issues") {
    const issue = extractIssueDataFromPayload(payload.issue);
    await createTodoistTask(issue);
  } else {
    console.log("No issue data found in the GitHub payload");
  }

  res.status(200).send("Webhook received");
});

// Start the server
const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
