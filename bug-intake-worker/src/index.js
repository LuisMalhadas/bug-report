const MESSAGES = {
  en: {
    onlyPost: "Only POST allowed",
    missingFields: "Missing fields.",
    rateLimit: (wait) => `Please wait ${wait} seconds before submitting another report.`,
    githubError: (status, text) => `GitHub API error (${status}):\n\n${text}`,
    internalError: (err) => `Internal error:\n${err}`,
    success: "Bug report submitted. Thank you!"
  },
  pt: {
    onlyPost: "Apenas POST permitido",
    missingFields: "Campos ausentes.",
    rateLimit: (wait) => `Por favor, aguarde ${wait} segundos antes de enviar outro relatório.`,
    githubError: (status, text) => `Erro na API do GitHub (${status}):\n\n${text}`,
    internalError: (err) => `Erro interno:\n${err}`,
    success: "Relatório enviado. Obrigado!"
  },
  es: {
    onlyPost: "Solo se permite POST",
    missingFields: "Faltan campos.",
    rateLimit: (wait) => `Por favor espere ${wait} segundos antes de enviar otro informe.`,
    githubError: (status, text) => `Error en la API de GitHub (${status}):\n\n${text}`,
    internalError: (err) => `Error interno:\n${err}`,
    success: "Informe enviado. ¡Gracias!"
  },
  cat: {
	onlyPost: "Només es permet POST",
	missingFields: "Falten camps.",
	rateLimit: (wait) => `Si us plau, espereu ${wait} segons abans d'enviar un altre informe.`,
	githubError: (status, text) => `Error a l'API de GitHub (${status}):\n\n${text}`,
	internalError: (err) => `Error intern:\n${err}`,
	success: "Informe enviat. Gràcies!"
  },
  eus: {
	onlyPost: "POST soilik onartzen da",
	missingFields: "Eremu batzuk falta dira.",
	rateLimit: (wait) => `Mesedez, itxaron ${wait} segundo beste txosten bat bidali aurretik.`,
	githubError: (status, text) => `GitHub API akatsa (${status}):\n\n${text}`,
	internalError: (err) => `Barne akatsa:\n${err}`,
	success: "Arazo txostena bidalia. Eskerrik asko!"
  }
};

// Helper to choose best language
function getLang(request) {
  const header = request.headers.get("Accept-Language") || "";
  for (let lang of header.split(",")) {
    lang = lang.split(";")[0].trim().toLowerCase();
    if (MESSAGES[lang]) return lang;
    if (MESSAGES[lang.split("-")[0]]) return lang.split("-")[0];
  }
  return "en"; // default
}

export default {
  async fetch(request, env) {
    const lang = getLang(request);
    const msg = MESSAGES[lang];

    try {
      if (request.method !== "POST") {
        return new Response(msg.onlyPost, { status: 405 });
      }

      // Identify the submitter: use IP address
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";

      // Rate-limit
      const last = await env.RATE_LIMIT.get(`last:${ip}`);
      const now = Date.now();
      const cooldown = 5 * 60 * 1000; // 5 minutes

      if (last && now - Number(last) < cooldown) {
        const wait = Math.ceil((cooldown - (now - Number(last))) / 1000);
        return new Response(msg.rateLimit(wait), { status: 429 });
      }

      // Parse form
      const data = await request.formData();
      const description = data.get("description");
      const contact = data.get("contact");

      if (!description || !contact) {
        return new Response(msg.missingFields, { status: 400 });
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
        return new Response(msg.githubError(ghResponse.status, errorText), { status: 500 });
      }

      // Store timestamp
      await env.RATE_LIMIT.put(`last:${ip}`, String(now), { expirationTtl: 60*60 });

      return new Response(msg.success);

    } catch (err) {
      return new Response(msg.internalError(err.message), { status: 500 });
    }
  }
};