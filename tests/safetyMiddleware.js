const BLOCKED_WORDS = [
  "ignore previous instructions",
  "ignore previous directives",
  "bypass",
  "override",
  "jailbreak",
  "system prompt",
  "ignore instructions",
  "print 'sandwich'"
];

function safetyMiddleware(req, res, next) {
  const { prompt } = req.body || {};

  if (!prompt || typeof prompt !== "string") {
    return next();
  }

  const normalizedPrompt = prompt.toLowerCase();
  const isDangerous = BLOCKED_WORDS.some(keyword => normalizedPrompt.includes(keyword));

  if (isDangerous) {
    return res.status(403).json({
      status: "ATTACK_BLOCKED",
      message: "Request blocked by VAIMA Security Guardrails. Malicious prompt injection pattern recognized."
    });
  }

  next();
}

module.exports = safetyMiddleware;
