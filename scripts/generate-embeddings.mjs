/**
 * RAG Step 2: Generate embeddings for all chunks
 * 
 * HOW IT WORKS:
 * 1. Reads chunks from data/chunks.json
 * 2. For each chunk, calls Gemini Embedding API to get a vector (768 numbers)
 * 3. Saves everything to data/embeddings.json
 * 
 * RUN: node scripts/generate-embeddings.mjs
 * 
 * You only need to run this when you update chunks.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHUNKS_PATH = resolve(__dirname, '../data/chunks.json');
const OUTPUT_PATH = resolve(__dirname, '../data/embeddings.json');

// Your Gemini API key — reads from .env.local or pass as env var
const API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyD_-sAPi7KrOVzVLfNYHiqUi1MqIXng1lM';

/**
 * Call Gemini Embedding API for a single text
 * Returns an array of 768 numbers (the vector)
 */
async function embedText(text) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': API_KEY,
      },
      body: JSON.stringify({
        content: { parts: [{ text }] },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.embedding.values; // Array of 768 floats
}

/**
 * Main function
 */
async function main() {
  console.log('📖 Reading chunks from', CHUNKS_PATH);
  const chunks = JSON.parse(readFileSync(CHUNKS_PATH, 'utf-8'));
  console.log(`   Found ${chunks.length} chunks\n`);

  const embeddings = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    process.stdout.write(`🔄 Embedding chunk ${i + 1}/${chunks.length}: ${chunk.id}...`);

    try {
      const vector = await embedText(chunk.text);
      embeddings.push({
        id: chunk.id,
        text: chunk.text,
        metadata: chunk.metadata,
        embedding: vector,
      });
      console.log(' ✅');
    } catch (err) {
      console.log(` ❌ ${err.message}`);
    }

    // Small delay to avoid rate limits (free tier = 1500 req/min)
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n💾 Saving ${embeddings.length} embeddings to ${OUTPUT_PATH}`);
  writeFileSync(OUTPUT_PATH, JSON.stringify(embeddings, null, 2));
  console.log('✅ Done! Your RAG knowledge base is ready.\n');

  // Show file size
  const stats = readFileSync(OUTPUT_PATH);
  console.log(`   File size: ${(stats.length / 1024).toFixed(1)} KB`);
  console.log(`   Vector dimensions: ${embeddings[0]?.embedding.length || 0}`);
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
