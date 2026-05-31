/**
 * Refactored Express QA Controller with ChromaDB Semantic Retrieval.
 * Plugs semantic vector searching directly into the RAG expert prompt pipeline.
 */
const { getSafetyCollection } = require('./vectorStore');

/**
 * Handles QA queries under high-compliance RAG strategy with Semantic Vector Searching
 * @param {Express.Request} req 
 * @param {Express.Response} res 
 */
async function askExpert(req, res) {
  const { prompt } = req.body || {};

  try {
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: "Required parameter 'prompt' is missing or malformed." });
    }

    console.log(`🔍 Executing vector-based semantic search for operator query: "${prompt}"`);

    // 1. Retrieve the active Chroma safety manuals collection
    const collection = await getSafetyCollection();

    // 2. Query the collection for the top 3 most semantically aligned manual chapters/passages
    const searchResult = await collection.query({
      queryTexts: [prompt],
      nResults: 3
    });

    // 3. Assemble and combine the retrieved contextual fragments
    let retrievedContext = "";
    if (searchResult && searchResult.documents && searchResult.documents[0]) {
      const topDocs = searchResult.documents[0];
      const metadataDocs = searchResult.metadatas[0] || [];
      
      retrievedContext = topDocs.map((docText, index) => {
        const title = metadataDocs[index] ? metadataDocs[index].title : "Grounded Safety Guideline";
        const fileName = metadataDocs[index] ? metadataDocs[index].fileName : "Manual file";
        return `--- DOCUMENT: ${title} (${fileName}) ---\n${docText}`;
      }).join('\n\n');
    }

    if (!retrievedContext || retrievedContext.trim() === "") {
      retrievedContext = "[No specific security manual entry matched the semantic criteria. Defaulting to standard high-compliance protocol rules.]";
    }

    console.log(`✅ Semantic context harvested successfully (${retrievedContext.length} bytes / references populated).`);

    /* ----------------------------------------------------------------------
       💡 REFACTORING TIP: SEAMLESS LLM INTEGRATION / HEYGEN SYNTHESIS CALL
       
       In this area, pass the 'retrievedContext' to your language model client.
       Example implementation using @google/genai SDK:
       
       const aiResponse = await callGeminiDynamic({
         systemInstruction: `You are an expert industrial safety coworker. 
         Use the following GROUNDED CONTEXT to answer the operator's prompt. 
         Do NOT extrapolate or suggest actions that are not present in safety manuals:\\n\\n${retrievedContext}`,
         prompt: prompt
       });
       
       const finalOutputText = aiResponse.text;
       
       // And dispatch to HeyGen Lip Sync streaming WebRTC channel:
       await sendToHeyGenStreamingSession(sessionId, finalOutputText);
       ---------------------------------------------------------------------- */

    // Emulating standard production RAG payload structure for verification
    return res.status(200).json({
      status: "SUCCESS",
      query: prompt,
      retrievedContext: retrievedContext,
      metadata: {
        sourcesMatchedCount: (searchResult.ids && searchResult.ids[0]) ? searchResult.ids[0].length : 0,
        ids: searchResult.ids ? searchResult.ids[0] : [],
        distances: searchResult.distances ? searchResult.distances[0] : []
      },
      message: "Semantic search executed successfully. Grounding context populated inside standard payload envelopes."
    });

  } catch (error) {
    console.error("❌ High-Compliance RAG Route encountered an error:", error);

    // Reliable fallback response preventing system downtime & keeping operator guided securely offline
    return res.status(503).json({
      status: "FALLBACK",
      source: "Offline RAG Fallback System",
      message: "The primary semantic vector server encountered a connection or index lookup error during matching.",
      suggestedAction: "Rely on standard printed operations safety manuals or contact Supervisor Sarah Jenkins immediately."
    });
  }
}

module.exports = {
  askExpert
};
