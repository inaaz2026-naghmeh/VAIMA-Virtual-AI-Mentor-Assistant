/**
 * Mock controller for high-compliance expert system with built-in network failure fault tolerance
 */
async function askExpert(req, res) {
  const { prompt, failNetworkSim = false } = req.body || {};

  try {
    if (!prompt) {
      return res.status(400).json({ error: "Prompt parameter is required." });
    }

    // Simulate standard connection error or internal LLM crash if requested
    if (failNetworkSim) {
      throw new Error("EAI_LIMIT_EXCEEDED: Host gemini-3.5-flash failed DNS resolution or returned a 500 error.");
    }

    // Simulate standard successful response from model grounded under 0.15 temperature
    return res.status(200).json({
      status: "SUCCESS",
      model: "gemini-3.5-flash-grounded",
      text: `[Grounded Output] Executing operations instruction sequence corresponding to: "${prompt}". Proceed with caution following standard safety manuals.`
    });

  } catch (error) {
    console.warn(`[EVAL FALLBACK TRIGGERED] AI connection error caught: ${error.message}`);

    // High fidelity offline-first graceful procedural fallback response
    return res.status(503).json({
      status: "FALLBACK",
      source: "Offline RAG Procedural Engine",
      message: "The primary language model is currently busy or unreachable. Engaging local high-compliance fallback procedure securely.",
      suggestedAction: "Check local safety handbook or contact Supervisor Sarah."
    });
  }
}

module.exports = { askExpert };
