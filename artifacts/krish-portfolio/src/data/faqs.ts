export type FAQ = {
  id: string;
  question: string;
  answer: string;
};

export const faqs: FAQ[] = [
  {
    id: "tech-stack",
    question: "What technologies and tools do you work with?",
    answer:
      "I primarily work with Python, JavaScript/TypeScript, and React for building web applications and AI tools. For AI/ML, I use libraries like TensorFlow, PyTorch, and Hugging Face Transformers, plus APIs from OpenAI, Gemini, and Groq. On the frontend, I'm comfortable with Vite, Tailwind CSS, and modern React patterns. For backend and data, I use Supabase (PostgreSQL), GitHub Actions for CI/CD, and Vercel for deployment. I also work with C/C++ for systems-level understanding.",
  },
  {
    id: "availability",
    question: "Are you available for freelance work, internships, or collaboration?",
    answer:
      "Yes! I'm currently a Class 12 student looking for an entry-level role, internship, or freelance projects where I can contribute and grow. Whether it's building a custom AI tool, automating a workflow, or helping with a digital marketing campaign — I'm open to conversations. Feel free to reach out via the contact form or email me directly.",
  },
  {
    id: "projects-built",
    question: "What kind of projects have you built? Can you give examples?",
    answer:
      "I've built a range of projects from AI assistants to web apps. Highlights include JARVIS — a Python voice assistant that can chat, listen, and search the web; Yojana Saathi, a free government scheme finder for India that matches users with relevant schemes; a Memory Match game that taught me state management; and this portfolio site itself with automated blog publishing via GitHub Actions + Supabase + AI. You can see all of them in the Projects section.",
  },
  {
    id: "contact-hire",
    question: "How can someone contact or hire you?",
    answer:
      "The easiest way is through the contact form at the bottom of this page — it goes straight to my inbox. You can also email me directly at krrishai0916@gmail.com, connect on LinkedIn, or DM me on X/Twitter. I'm responsive and happy to hop on a quick call to discuss your project.",
  },
  {
    id: "digital-marketing",
    question: "Do you take on digital marketing / SEO projects specifically?",
    answer:
      "Absolutely. I completed a Digital Marketing with AI certification and have hands-on experience with SEO, Google Ads, Meta Ads, and social media management. I've applied these skills to grow my own projects (like getting this portfolio indexed and driving traffic to my blog). If you need help with keyword research, content strategy, ad campaigns, or analytics setup — I'm your person.",
  },
  {
    id: "ai-tech-stack",
    question: "What's your tech stack for building AI applications?",
    answer:
      "For AI apps, my go-to stack is: Python (FastAPI or Flask) for the backend, React/Next.js for the frontend, Supabase for auth + database + vector storage, and LLM APIs (OpenAI, Gemini, Groq) for the intelligence layer. I use LangChain or custom prompting for orchestration, and deploy on Vercel or Railway. For local development and privacy-sensitive tasks, I also experiment with Ollama and local models.",
  },
  {
    id: "blog-writing",
    question: "Do you write or blog about what you learn?",
    answer:
      "Yes — I treat writing as part of the learning process. My blog covers what I'm building, what broke, and what I figured out along the way. Recent posts include how I automated my blog with free AI, building a voice assistant in Python, and publishing a game to the Play Store for free. The blog is also fully automated: AI drafts posts, GitHub Actions publishes them, and Vercel rebuilds the site — all on free tiers.",
  },
  {
    id: "see-work",
    question: "Where can people see your work and projects?",
    answer:
      "All my projects are showcased in the Projects section of this site — each one has a live demo, source code link, and a write-up of what I learned. My blog has deeper technical write-ups. You can also check my GitHub (github.com/krish-khati) for the actual code repos. If you want to see the live apps, the Projects page has direct links to each deployed project.",
  },
];