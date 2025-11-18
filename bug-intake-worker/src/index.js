/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Only POST allowed", { status: 405 });
    }

    const data = await request.formData();
    const description = data.get("description");
    const contact = data.get("contact");

    const issue = {
      title: "New Bug Report",
      body: `**Description**:\n${description}\n\n**Contact**:\n${contact}`,
    };

    const response = await fetch(
      "https://api.github.com/repos/LuisMalhadas/support-platform/issues",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
          "Accept": "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(issue),
      }
    );

    if (!response.ok) {
      return new Response("GitHub issue creation failed.", { status: 500 });
    }

    return new Response("Bug report submitted. Thank you!");
  }
};
