/* global window */

// Curated content for the Watch & Read library.
// Notes:
// - YouTube items: we fetch title/author/thumbnail at runtime via oEmbed (with offline-safe fallbacks).
// - Dates: YouTube oEmbed does not expose publish dates; leave `date` null unless you want to curate it manually.

window.__HOOKE_CONTENT__ = {
  featured: {
    id: "featured-5vOnRAyNWIw",
    type: "youtube",
    url: "https://www.youtube.com/watch?v=5vOnRAyNWIw&t=8s",
    tags: ["Hooke Wilding", "Featured"],
    date: null,
  },
  items: [
    // Wilding Weekend (videos)
    {
      id: "ww-8_xMAAbjcaw",
      type: "youtube",
      url: "https://www.youtube.com/watch?v=8_xMAAbjcaw",
      tags: ["Wilding Weekend"],
      date: null,
    },
    {
      id: "ww-A7Wg3MJ4b7Y",
      type: "youtube",
      url: "https://www.youtube.com/watch?v=A7Wg3MJ4b7Y",
      tags: ["Wilding Weekend"],
      date: null,
    },
    {
      id: "ww-Izy6GXhwt9s",
      type: "youtube",
      url: "https://www.youtube.com/watch?v=Izy6GXhwt9s",
      tags: ["Wilding Weekend"],
      date: null,
    },
    {
      id: "ww-cYCYuGORszg",
      type: "youtube",
      url: "https://www.youtube.com/watch?v=cYCYuGORszg&pp=0gcJCU0KAYcqIYzv",
      tags: ["Wilding Weekend"],
      date: null,
    },
    {
      id: "ww-hTknDjRNTSA",
      type: "youtube",
      url: "https://www.youtube.com/watch?v=hTknDjRNTSA",
      tags: ["Wilding Weekend"],
      date: null,
    },
    {
      id: "ww-HBiSTHp_RK8",
      type: "youtube",
      url: "https://www.youtube.com/watch?v=HBiSTHp_RK8",
      tags: ["Wilding Weekend"],
      date: null,
    },
    {
      id: "ww-7NclmBEJoOk",
      type: "youtube",
      url: "https://www.youtube.com/watch?v=7NclmBEJoOk",
      tags: ["Wilding Weekend"],
      date: null,
    },

    // Other Hooke wilding content (videos)
    {
      id: "hooke-OeOJNBs5VjI",
      type: "youtube",
      url: "https://www.youtube.com/watch?v=OeOJNBs5VjI",
      tags: ["Hooke Wilding"],
      date: null,
    },
    {
      id: "hooke-X3m18jbvRv0",
      type: "youtube",
      url: "https://www.youtube.com/watch?v=X3m18jbvRv0",
      tags: ["Hooke Wilding"],
      date: null,
    },

    // Other Hooke wilding content (blogs)
    {
      id: "blog-scything-oct23",
      type: "blog",
      url: "https://juliahailes.com/why-do-scything-wilding-go-hand-in-hand-oct23/",
      title: "Why do scything & wilding go hand in hand?",
      publisher: "juliahailes.com",
      tags: ["Blog", "Scything", "Hooke Wilding"],
      date: "2023-10-01",
    },
    {
      id: "blog-no-more-ww-jun25",
      type: "blog",
      url: "https://juliahailes.com/no-more-wilding-weekends-but-wilding-is-on-the-rise-jun25/",
      title: "No more wilding weekends — but wilding is on the rise",
      publisher: "juliahailes.com",
      tags: ["Blog", "Wilding Weekend", "Hooke Wilding"],
      date: "2025-06-01",
    },
    {
      id: "blog-leave-your-leaves-oct25",
      type: "blog",
      url: "https://juliahailes.com/leave-your-leaves-oct25/",
      title: "Leave your leaves",
      publisher: "juliahailes.com",
      tags: ["Blog", "Seasonal", "Hooke Wilding"],
      date: "2025-10-01",
    },
  ],
};


