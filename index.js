import express from "express";
import cors from "cors";
import cron from "node-cron";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();


const app = express();
app.use(cors()); // Allow all origins
app.use(express.json());

const jobs = {}; // store jobs by id


const apikeyMiddleware = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== process.env.API_KEY) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};

  // Stop all jobs from node-cron without using the jobs object
  cron.getTasks().forEach((task) => task.stop());

app.use(apikeyMiddleware);

// Register a new cron job
app.post("/jobs", (req, res) => {
  const { id, cronTime } = req.body;

  if (!id || !cronTime) {
    return res
      .status(400)
      .json({ error: "id and cronTime required" });
  }
  if (jobs[id]) {
    return res.status(400).json({ error: "Job with this id already exists" });
  }

  try {
    const task = cron.schedule(cronTime, async () => {
      try {
        await axios.get(process.env.N8N_WEBHOOK_URL + `/${id}`, {
          jobId: id,
          runAt: new Date().toISOString(),
        });
        console.log(`Executed job ${id} → ${process.env.N8N_WEBHOOK_URL}`);
      } catch (err) {
        console.log(err);
        console.error(`Error executing job ${id}:`, err.message);
      }
    });


    jobs[id] = { task, cronTime };
    res.json({ message: "Job registered", job: { id, cronTime } });
  } catch (err) {
    res.status(400).json({ error: "Invalid cron expression" });
  }
});

// Unregister a job
app.delete("/jobs/:id", (req, res) => {
  const { id } = req.params;

  const job = jobs[id];
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  job.task.stop();
  delete jobs[id];
  res.json({ message: `Job ${id} removed` });
});

// List jobs
app.get("/jobs", (req, res) => {
  res.json(
    Object.keys(jobs).map((id) => ({
      id,
      cronTime: jobs[id].cronTime,
    }))
  );
});

app.get("/stop-all", (req, res) => {
  // Stop all jobs from node-cron without using the jobs object
  cron.getTasks().forEach((task) => task.stop());
  res.json({ message: "All jobs stopped" });
});

const PORT = 3000;
app.listen(PORT, () =>
  console.log(`Cron manager running on http://localhost:${PORT}`)
);
