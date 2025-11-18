export default {
  async fetch(request, env) {
    try {
      if (request.method !== "POST") {
        return new Response("Only POST allowed", { status: 405 });
      }

      // Identify the submitter: use IP address
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";

      // Rate-limit: check last submission timestamp
      const last = await env.RATE_LIMIT.get(`last:${ip}`);
      const now = Date.now();
      const cooldown = 5 * 60 * 1000; // 5 minutes

      if (last && now - Number(last) < cooldown) {
        const wait = Math.ceil((cooldown - (now - Number(last))) / 1000);
        return new Response(
          `Please wait ${wait} seconds before submitting another report.`,
          { status: 429 }
        );
      }

      // Parse form
      const data = await request.formData();
      const description = data.get("description");
      const contact = data.get("contact");

      if (!description || !contact) {
        return new Response("Missing fields.", { status: 400 });
      }

      const issue = {
        title: "New Bug Report",
        body: `**Description**:\n${description}\n\n**Contact**:\n${contact}`,
      };

      // Send to GitHub
      const ghResponse = await fetch(
        "https://api.github.com/repos/LuisMalhadas/support-platform/issues",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "cloudflare-worker",
          },
          body: JSON.stringify(issue),
        }
      );

      if (!ghResponse.ok) {
        const errorText = await ghResponse.text();
        return new Response(
          `GitHub API error (${ghResponse.status}):\n\n${errorText}`,
          { status: 500 }
        );
      }

      // Store new timestamp to enforce cooldown
      await env.RATE_LIMIT.put(`last:${ip}`, String(now), {
        expirationTtl: 60 * 60, // 1 hour; keeps KV tidy
      });

      return new Response("Bug report submitted. Thank you!");

    } catch (err) {
      return new Response("Internal error:\n" + err.message, { status: 500 });
    }
  }
};
