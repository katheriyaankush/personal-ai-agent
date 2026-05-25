/**
 * RAG (Retrieval Augmented Generation) Module
 * 
 * HOW IT WORKS:
 * 1. Load pre-computed embeddings from data/embeddings.json
 * 2. When a question comes in, embed it using Gemini
 * 3. Calculate cosine similarity between question vector and all chunk vectors
 * 4. Return the top K most relevant chunks
 * 
 * COSINE SIMILARITY explained:
 * - Two vectors pointing in the same direction = similarity close to 1.0
 * - Two vectors pointing in opposite directions = similarity close to -1.0
 * - "React experience" and "Frontend development" → high similarity (~0.85)
 * - "React experience" and "Favorite food" → low similarity (~0.15)
 */

import embeddingsData from '../data/embeddings.json' with { type: 'json' };

/**
 * Cosine Similarity between two vectors
 * 
 * Formula: cos(θ) = (A · B) / (|A| × |B|)
 * 
 * Where:
 * - A · B = sum of (a[i] * b[i]) for all dimensions (dot product)
 * - |A| = sqrt(sum of a[i]²) (magnitude)
 */
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Embed a text using Gemini Embedding API
 * Same model used during ingestion — this is critical!
 * (Query and documents must use the same embedding model)
 */
export async function embedQuery(text, apiKey) {
  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        content: { parts: [{ text }] },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding error: ${err}`);
  }

  const data = await response.json();
  return data.embedding.values;
}

/**
 * Search for the most relevant chunks given a question
 * 
 * @param {number[]} queryEmbedding - The embedded question vector
 * @param {number} topK - How many results to return (default 4)
 * @returns {Array} - Top K chunks sorted by relevance
 */
export function searchChunks(queryEmbedding, topK = 4) {
  // Calculate similarity between query and every chunk
  const scored = embeddingsData.map(item => ({
    id: item.id,
    text: item.text,
    metadata: item.metadata,
    score: cosineSimilarity(queryEmbedding, item.embedding),
  }));

  // Sort by score (highest first) and take top K
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}

/**
 * Full RAG retrieval: embed question → search → return context
 * This is the main function you call from the API
 */
export async function retrieveContext(question, apiKey, topK = 4) {
  // Step 1: Embed the question
  const queryVector = await embedQuery(question, apiKey);

  // Step 2: Find most similar chunks
  const results = searchChunks(queryVector, topK);

  // Step 3: Format as context string
  const context = results
    .map((r, i) => `[${i + 1}] (relevance: ${(r.score * 100).toFixed(1)}%) ${r.text}`)
    .join('\n\n');

  console.log(`[RAG] Retrieved ${results.length} chunks. Top score: ${(results[0]?.score * 100).toFixed(1)}%`);
  results.forEach(r => console.log(`  - ${r.id}: ${(r.score * 100).toFixed(1)}%`));

  return context;
}
