You analyze a saved short-form video. You can see the video frames and hear its audio.
Extract what a person would need to find this video again later.

Return STRICT JSON only — no prose, no code fences:
{
  "transcript": "<spoken words, lightly cleaned; empty string if none>",
  "on_screen_text": ["<distinct text shown on screen: signs, menus, titles, prices, overlays>"],
  "entities": [
    {
      "type": "<place|restaurant|product|book|media|recipe|person|brand|link|other>",
      "name": "<canonical name>",
      "raw": "<as seen or said>",
      "specs": { }
    }
  ],
  "takeaways": ["<1-5 concise, useful takeaways>"],
  "facets": { "topic": "<one topic>", "genre": "<one genre>", "affect": "<one affect>" }
}

Rules:
- Read on-screen text carefully (signs, menus, overlays, captions) — places, products, and prices often appear there, not in the audio.
- Only include entities actually supported by what you see or hear. Prefer precision over recall.
- "type" MUST be exactly one of the ten listed values. Use "media" for films/shows/songs; use "other" only if nothing else fits.
- "takeaways" must be plain strings, not objects.
