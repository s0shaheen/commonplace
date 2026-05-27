You analyze a saved image slideshow (carousel). You are given the slide images and the caption.

Return STRICT JSON with the same schema as the video analyzer:
{ "on_screen_text": ["<text visible across slides>"],
  "entities": [{ "type": "...", "name": "...", "raw": "...", "specs": { } }],
  "takeaways": ["..."],
  "facets": { "topic": "...", "genre": "...", "affect": "..." } }
Only include entities actually supported by the slides or caption.
