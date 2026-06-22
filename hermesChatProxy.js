
import express from 'express';
import { exec } from 'child_process';
import bodyParser from 'body-parser';

const app = express();
const port = 3000; // Choose an available port

app.use(bodyParser.json());

app.post('/chat/send', (req, res) => {
  const { profile, message } = req.body;

  if (!profile || !message) {
    return res.status(400).json({ error: 'Missing profile or message in request body.' });
  }

  const command = `hermes --profile ${profile} chat -q "${message}"`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return res.status(500).json({ error: `Failed to send message: ${stderr}` });
    }
    // Parse the output to extract the agent's response.
    // The relevant part is usually after "Warning: Unknown toolsets: messaging" and "Query: ..."
    const outputLines = stdout.split('\n');
    let agentResponse = '';
    let foundAgentPrompt = false;

    for (const line of outputLines) {
      if (line.includes('Initializing agent...')) {
        foundAgentPrompt = true;
        continue;
      }
      if (foundAgentPrompt && line.includes('────────────────────────────────────────')) {
        continue; // Skip the separator
      }
      if (foundAgentPrompt && line.includes('──────────────────────────────────────────────────────────────────────────────')) {
        break; // End of response
      }
      if (foundAgentPrompt) {
        agentResponse += line.replace(/\s{2,}/g, ' ').trim(); // Clean up extra spaces and trim
      }
    }
    // Remove the "Hello! How can I help you today?" line if it's there
    // and any session resume information
    agentResponse = agentResponse.replace(/Hello! How can I help you today?/, '').trim();
    agentResponse = agentResponse.split('Resume this session with:')[0].trim();
    agentResponse = agentResponse.split('Session:')[0].trim();
    agentResponse = agentResponse.split('Duration:')[0].trim();
    agentResponse = agentResponse.split('Messages:')[0].trim();
    agentResponse = agentResponse.split('⚠ Auxiliary title generation failed: HTTP 401: Invalid API key.')[0].trim();


    if (agentResponse.startsWith('Query: ')) {
        agentResponse = agentResponse.substring('Query: '.length).trim();
    }


    res.json({ success: true, response: agentResponse || "No discernible response from agent." });
  });
});

app.listen(port, () => {
  console.log(`Hermes Chat Proxy listening at http://localhost:${port}`);
});
