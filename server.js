const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

require("dotenv").config({ path: "./.env" });

const app = express();
app.use(bodyParser.json());
app.use(express.json());

const TODOIST_API_URL = "https://api.todoist.com/rest/v2/tasks";
const TODOIST_API_TOKEN = process.env.TODOIST_API_TOKEN;
const TODOIST_PROJECT_ID = process.env.TODOIST_PROJECT_ID;

async function taskExists(issue) {
  try {
    const response = await axios.get(TODOIST_API_URL, {
      headers: {
        Authorization: `Bearer ${TODOIST_API_TOKEN}`,
      },
      params: {
        project_id: TODOIST_PROJECT_ID,
      },
    });

    const tasks = response.data;

    // Check if a task with the same title (or issue number) already exists
    return tasks.some((task) => task.content.includes(issue.title));
  } catch (error) {
    console.error("Error checking Todoist tasks:", error.message);
    return false;
  }
}

// Helper function to create a Todoist task
async function createTodoistTask(issue) {
  console.log("create issue", issue);
  const exists = await taskExists(issue);

  if (exists) {
    console.log(
      `Task for issue "${issue.title}" already exists in Todoist. Skipping...`,
    );
    return;
  }

  try {
    await axios.post(
      TODOIST_API_URL,
      {
        content: `GitHub Issue: ${issue.title}`,
        description: issue.body || "No description provided",
        project_id: TODOIST_PROJECT_ID,
      },
      {
        headers: {
          Authorization: `Bearer ${TODOIST_API_TOKEN}`,
        },
      },
    );

    console.log(`Created Todoist task for issue "${issue.title}".`);
  } catch (error) {
    console.error("Error creating Todoist task:", error.message);
  }
}

// Endpoint to receive GitHub webhooks
app.post("/github-webhook", (req, res) => {
  // Access the GitHub event type
  const event = req.headers["x-github-event"];
  console.log(req);

  // Log the body content (this is the important part for your webhook)
  console.log("Received event:", event);
  console.log("Payload:", req.body);

  // Example of extracting some details
  if (event === "projects_v2_item") {
    const action = req.body.action;
    const projectItem = req.body.projects_v2_item;
    const organization = req.body.organization;

    console.log(`Action: ${action}`);
    console.log(`Project Item ID: ${projectItem.id}`);
    console.log(`Organization: ${organization.login}`);
  }

  // Send a response back to GitHub to acknowledge receipt
  res.status(200).send("Webhook received");
});

// Start the server
const PORT = process.env.PORT || 8090;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
