export type BlogBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "quote"; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; lang: string; text: string };

export type BlogFaq = { question: string; answer: string };

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  category: "Journey" | "Learning" | "Projects" | "AI" | "Marketing";
  date: string; // ISO yyyy-mm-dd
  cover?: string; // cover image URL; posts without one get a themed gradient
  blocks: BlogBlock[];
  // SEO fields (supabase/add-seo.sql). All optional: empty means "fall back to title/excerpt".
  seoTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
  faqs?: BlogFaq[];
  coverAlt?: string;
  updatedAt?: string;
};

const str = (v: unknown) => (typeof v === "string" ? v : "");

export function faqsFromJson(v: unknown): BlogFaq[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((f) => ({
      question: str((f as BlogFaq)?.question).trim(),
      answer: str((f as BlogFaq)?.answer).trim(),
    }))
    .filter((f) => f.question && f.answer);
}

// Maps a Supabase `posts` row (snake_case) to a BlogPost. Any column that doesn't exist yet
// (e.g. before add-seo.sql has been run) is simply undefined here and falls back to ''.
export function postFromRow(row: Record<string, unknown>): BlogPost {
  return {
    slug: str(row.slug),
    title: str(row.title),
    excerpt: str(row.excerpt),
    category: str(row.category) as BlogPost["category"],
    date: str(row.date),
    cover: str(row.cover),
    blocks: Array.isArray(row.blocks) ? (row.blocks as BlogBlock[]) : [],
    seoTitle: str(row.seo_title),
    metaDescription: str(row.meta_description),
    focusKeyword: str(row.focus_keyword),
    faqs: faqsFromJson(row.faqs),
    coverAlt: str(row.cover_alt),
    updatedAt: str(row.updated_at),
  };
}

// Starter posts — edit the text, dates and categories freely. Posts are shown newest first.
export const blogPosts: BlogPost[] = [
  {
    slug: "learning-to-code-with-just-a-laptop",
    title: "Learning to code with just a laptop",
    excerpt:
      "No coding classes, no tech background in Pundri. Just curiosity, a laptop, and a lot of late nights.",
    category: "Journey",
    date: "2026-09-22",
    blocks: [
      {
        type: "p",
        text: 'I\'m a Class 12 student from a small town. There was no coding class to join and nobody around me who worked in tech. What I had was a laptop and a stubborn habit of asking "but how does that actually work?"',
      },
      { type: "h2", text: "Where I started" },
      {
        type: "p",
        text: "I began with Python because it let me see results fast. Print a line, change a number, run it again. That tight loop of trying something and seeing what happens is what made me stay.",
      },
      { type: "h2", text: "What actually helped" },
      {
        type: "list",
        items: [
          "Building small things instead of only watching tutorials.",
          "Reading error messages slowly instead of panicking at them.",
          "Writing down what I learned so I could explain it to myself later.",
        ],
      },
      {
        type: "quote",
        text: "I'm not chasing certificates — I'm chasing the ability to build things that actually work.",
      },
      {
        type: "p",
        text: "I'm still early in this journey. This blog is where I'll keep track of it: what I build, what breaks, and what I figure out along the way.",
      },
    ],
  },
  {
    slug: "python-c-and-cpp-what-each-one-taught-me",
    title: "Python, C and C++: what each one taught me",
    excerpt:
      "Three languages, three different ways of thinking. Here is what I took from each.",
    category: "Learning",
    date: "2026-09-15",
    blocks: [
      {
        type: "p",
        text: "Learning more than one language early on turned out to be less about syntax and more about how each one makes you think.",
      },
      { type: "h2", text: "Python — thinking in ideas" },
      {
        type: "p",
        text: "Python let me focus on the logic. When I had an idea, I could test it in minutes, which made it the best place to learn how loops, functions, and data structures fit together.",
      },
      { type: "h2", text: "C — thinking in memory" },
      {
        type: "p",
        text: "C removed the safety net. Suddenly I had to care about types, memory, and what the machine is really doing. It was frustrating and it was the most useful thing I learned.",
      },
      { type: "h2", text: "C++ — thinking in structure" },
      {
        type: "p",
        text: "C++ added classes and objects on top, which pushed me to organise code into pieces that make sense on their own.",
      },
      {
        type: "code",
        lang: "python",
        text: 'def greet(name):\n    return f"Hello, {name}!"\n\nprint(greet("world"))',
      },
      {
        type: "p",
        text: "Same idea, three languages, three different ways of getting there.",
      },
    ],
  },
  {
    slug: "what-a-memory-match-game-taught-me-about-state",
    title: "What a memory match game taught me about state",
    excerpt:
      "A simple card game is a great way to learn how state changes and events work together.",
    category: "Projects",
    date: "2026-09-08",
    blocks: [
      {
        type: "p",
        text: "My Memory Match game looks simple, but it forced me to think carefully about state: which cards are flipped, which are matched, and what is allowed to happen next.",
      },
      { type: "h2", text: "State first, screen second" },
      {
        type: "p",
        text: "The biggest lesson was to decide what the game needs to remember before drawing anything. Once the state was clear, the screen simply followed it.",
      },
      {
        type: "code",
        lang: "js",
        text: "const state = {\n  flipped: [],\n  matched: [],\n  locked: false,\n};",
      },
      { type: "h2", text: "Events need rules" },
      {
        type: "p",
        text: "Clicking fast, clicking the same card twice, clicking while two cards are being compared — every one of those is a bug waiting to happen. Writing the rules down made them easy to handle.",
      },
      {
        type: "quote",
        text: "Most bugs are just a missing rule about what should happen next.",
      },
    ],
  },
  {
    slug: "how-i-use-ai-tools-without-outsourcing-my-thinking",
    title: "How I use AI tools without outsourcing my thinking",
    excerpt:
      "AI can speed me up, but only if I stay the one who understands the code.",
    category: "AI",
    date: "2026-08-30",
    blocks: [
      {
        type: "p",
        text: "I use AI tools every day for learning and building. The rule I try to follow is simple: I should be able to explain everything I ship.",
      },
      { type: "h2", text: "What I use them for" },
      {
        type: "list",
        items: [
          "Explaining a concept a different way when a tutorial did not click.",
          "Reviewing my code and pointing out things I missed.",
          "Getting unstuck, then going back to write the solution myself.",
        ],
      },
      { type: "h2", text: "What I try not to do" },
      {
        type: "p",
        text: "Paste an answer I do not understand. If I cannot explain a line, I have not learned it yet — I have just borrowed it.",
      },
      {
        type: "quote",
        text: "A tool should make me faster at thinking, not a replacement for it.",
      },
    ],
  },
  {
    slug: "what-digital-marketing-with-ai-taught-me",
    title: "What Digital Marketing with AI taught me about building for people",
    excerpt:
      "Finishing a Digital Marketing with AI certification changed how I think about the things I build.",
    category: "Marketing",
    date: "2026-08-18",
    blocks: [
      {
        type: "p",
        text: "This year I completed a Digital Marketing with AI certification. I expected to learn tools. I also learned to think about who the work is for.",
      },
      { type: "h2", text: "Good software still needs to be found" },
      {
        type: "p",
        text: "SEO, ads, and social media are really about one thing: helping the right person find something useful. A great project nobody can find does not help anyone.",
      },
      { type: "h2", text: "What I am taking with me" },
      {
        type: "list",
        items: [
          "Start with the audience, then decide the message.",
          "Measure what happens instead of guessing.",
          "Clear writing is a skill worth practising just like code.",
        ],
      },
      {
        type: "p",
        text: "Web development and digital marketing feel like two halves of the same idea: build something good, then make sure people can reach it.",
      },
    ],
  },
];

export const blogCategories = [
  "All",
  ...Array.from(new Set(blogPosts.map((p) => p.category))),
];

// Cover photos shipped with the site (public/blog-covers/<slug>.webp, encoded from the .jpg source kept
// alongside for social previews). A cover set in the admin panel takes priority.
const bundledCovers = new Set([
  "learning-to-code-with-just-a-laptop",
  "python-c-and-cpp-what-each-one-taught-me",
  "what-a-memory-match-game-taught-me-about-state",
  "how-i-use-ai-tools-without-outsourcing-my-thinking",
  "what-digital-marketing-with-ai-taught-me",
  "publish-free-android-game",
  "how-to-create-portfolio-website",
  "automate-blog-posts-free-ai",
  "free-government-scheme-finder",
  "build-python-voice-assistant",
]);

export function withCover<T extends BlogPost>(post: T): T {
  if (post.cover || !bundledCovers.has(post.slug)) return post;
  // import.meta.env only exists inside Vite; the build-time prerender script runs outside it.
  const base = import.meta.env?.BASE_URL ?? "/";
  return { ...post, cover: `${base}blog-covers/${post.slug}.webp` };
}

export function getPost(slug: string) {
  return blogPosts.find((p) => p.slug === slug);
}

export function readingMinutes(post: Pick<BlogPost, "blocks">) {
  const words = post.blocks
    .map((b) => (b.type === "list" ? b.items.join(" ") : b.text))
    .join(" ")
    .split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

export function formatPostDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
