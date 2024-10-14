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
  const title = issue.title || "Untitled issue"; // GitHub issue title
  const description = issue.body || "No description provided"; // GitHub issue body
  const githubIssueUrl = issue.html_url; // URL to GitHub issue
  const priority = issue.priority || 1; // Set priority (default to 1 if not provided)

  // Create the full description for the Todoist task
  const todoistDescription = `${description}\n\nLink to GitHub issue: ${githubIssueUrl}`;

  try {
    await axios.post(
      TODOIST_API_URL,
      {
        content: title, // Task title
        description: todoistDescription, // Task description with GitHub link
        project_id: TODOIST_PROJECT_ID, // Add task to a specific Todoist project
        priority: mapGitHubPriorityToTodoistPriority(priority), // Map GitHub priority to Todoist priority
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
  const contentType = payload.projects_v2_item.content_type;

  if (contentType === "Issue" || contentType === "DraftIssue") {
    const issue = {
      title: payload.projects_v2_item.title || "No title", // Get issue title
      body: payload.projects_v2_item.body || "", // Get issue description/body
      html_url: `https://github.com/${payload.organization.login}/issues/${payload.projects_v2_item.id}`, // Construct GitHub issue URL
      priority: extractPriorityFromChanges(payload.changes), // Extract priority (if applicable)
    };

    return issue;
  }

  return null;
}

// Extract priority from GitHub webhook changes (if available)
function extractPriorityFromChanges(changes) {
  if (
    changes &&
    changes.field_value &&
    changes.field_value.field_name === "Priority"
  ) {
    // Assuming priorities are mapped in a GitHub project field
    return changes.field_value.new_value; // Adjust based on how priority is stored in your GitHub project
  }

  return 1; // Default priority (low)
}

// Endpoint to receive GitHub webhooks
app.post("/github-webhook", async (req, res) => {
  const event = req.headers["x-github-event"];
  const payload = req.body;

  if (event === "projects_v2_item" && payload) {
    const issue = extractIssueDataFromPayload(payload);

    if (issue) {
      // Create Todoist task using real data from GitHub issue
      await createTodoistTask(issue);
    } else {
      console.log("No issue data found in the GitHub payload");
    }
  }

  res.status(200).send("Webhook received");
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
