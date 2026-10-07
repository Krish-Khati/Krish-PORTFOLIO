import {
  type CSSProperties,
  type FormEvent,
  lazy,
  type ReactNode,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  Download,
  Facebook,
  Github,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Search,
  Youtube,
} from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/error-boundary";
import { SiteNav } from "@/components/site-nav";
import { ProjectShowcase } from "@/components/project-showcase";
import { homeProjects } from "@/data/projects";
import { SiteFooter } from "@/components/site-footer";
import { HeroMedia } from "@/components/hero-media";
import { HeroParticles } from "@/components/hero-particles";
import { HeroBokeh } from "@/components/hero-bokeh";
import { HeroTicker } from "@/components/hero-ticker";
import {
  sendContactMessage,
  useProjects,
  useSiteSettings,
  useStats,
  useTools,
} from "@/data/live";
import { slugifyToolName, toolIconFor, type Tool } from "@/data/skills";
import { toast } from "@/hooks/use-toast";
import { imageSrcSet, resizedImage } from "@/lib/image";
import { homeMeta } from "@/seo/meta";
import { useSeo } from "@/seo/use-seo";
import {
  Link,
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from "wouter";

// Everything except the home page is a separate chunk, so the admin panel (and supabase-js with it) is
// never downloaded by visitors of the public site.
const BlogPage = lazy(() => import("@/pages/blog"));
const BlogPostPage = lazy(() => import("@/pages/blog-post"));
const ProjectsPage = lazy(() => import("@/pages/projects"));
const ProjectPage = lazy(() => import("@/pages/project"));
const NotFound = lazy(() => import("@/pages/not-found"));
// Toasts only appear after the contact form is used, so the Radix toast code loads off the critical path.
const Toaster = lazy(() =>
  import("@/components/ui/toaster").then((m) => ({ default: m.Toaster })),
);
const AdminApp = lazy(() => import("@/admin/admin-app"));
// Cursor and site-wide motion effects are decorative; SiteChrome mounts them only after the page is
// idle or the user starts interacting, so their setup never competes with the first paint.
const CustomCursor = lazy(() =>
  import("@/components/custom-cursor").then((m) => ({
    default: m.CustomCursor,
  })),
);
const SiteEffects = lazy(() =>
  import("@/components/site-effects").then((m) => ({ default: m.SiteEffects })),
);

const queryClient = new QueryClient();

function parseStatValue(raw: string): { num: number; suffix: string } | null {
  const m = raw.match(/^(\d+(?:\.\d+)?)(.*)$/);
  return m ? { num: parseFloat(m[1]), suffix: m[2] } : null;
}

function StatCounter({ value, label }: { value: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);
  const parsed = parseStatValue(value);
  const num = parsed?.num;

  useEffect(() => {
    const el = ref.current;
    if (!el || num === undefined) return;
    let started = false;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || started) return;
          started = true;
          observer.disconnect();
          const duration = 1500;
          const startTime = performance.now();
          const tick = (now: number) => {
            const progress = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(num * eased));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [num]);

  return (
    <div
      className="stat"
      ref={ref}
      data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="stat-number">
        {parsed ? `${count}${parsed.suffix}` : value}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function ToolTile({ tool }: { tool: Tool }) {
  const Icon = toolIconFor(tool.name);
  const [broken, setBroken] = useState(false);
  const showLogo = tool.logoUrl && !broken;
  return (
    <span
      className={`tool-icon${showLogo ? " has-logo" : !Icon ? " is-letter" : ""}`}
    >
      {showLogo ? (
        <img
          className="tool-logo-img"
          src={tool.logoUrl}
          alt={`${tool.name} logo`}
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
        />
      ) : Icon ? (
        <Icon size={40} strokeWidth={1.5} />
      ) : (
        tool.name.charAt(0).toUpperCase()
      )}
    </span>
  );
}

function Typewriter({ roles }: { roles: string[] }) {
  const [text, setText] = useState("");
  const [roleIndex, setRoleIndex] = useState(0);

  useEffect(() => {
    const current = roles[roleIndex % roles.length] ?? "";
    let charIndex = 0;
    let timer: ReturnType<typeof setTimeout>;

    const erase = () => {
      if (charIndex === 0) {
        setRoleIndex((i) => (i + 1) % Math.max(roles.length, 1));
        return;
      }
      charIndex -= 1;
      setText(current.slice(0, charIndex));
      timer = setTimeout(erase, 50);
    };

    const type = () => {
      if (charIndex < current.length) {
        charIndex += 1;
        setText(current.slice(0, charIndex));
        timer = setTimeout(type, 90);
      } else {
        timer = setTimeout(erase, 1500);
      }
    };

    timer = setTimeout(type, 0);
    return () => clearTimeout(timer);
  }, [roleIndex, roles]);

  return (
    <span className="typewriter-text" data-testid="text-hero-role">
      {text}
      <span className="typewriter-cursor" aria-hidden="true">
        |
      </span>
    </span>
  );
}

function Home() {
  const settings = useSiteSettings();
  const { data: projectList = [] } = useProjects();
  const shownProjects = homeProjects(projectList);
  const { data: toolList = [], isLoading: toolsLoading } = useTools();
  const { data: statList = [], isLoading: statsLoading } = useStats();
  const [sending, setSending] = useState(false);

  useSeo(homeMeta(settings));

  // Arriving with a #hash (e.g. /#contact from the blog): scroll to it once mounted, then again
  // after load/fonts settle — late layout shifts above the section would otherwise leave it
  // off-screen. Plain "/" has no hash, so nothing ever scrolls the hero away.
  // Re-anchoring stops as soon as the visitor scrolls themselves.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    const entry = performance.getEntriesByType("navigation")[0];
    // A reload lands at the hero instead: SiteChrome strips the hash and this is a second
    // guard in case effect order ever changes.
    if (!id || (entry as PerformanceNavigationTiming | undefined)?.type === "reload")
      return;
    let userScrolled = false;
    const markScrolled = () => {
      userScrolled = true;
    };
    const jump = () => {
      if (!userScrolled)
        document.getElementById(id)?.scrollIntoView({ block: "start" });
    };
    const raf = requestAnimationFrame(jump);
    window.addEventListener("load", jump, { once: true });
    window.addEventListener("wheel", markScrolled, { passive: true });
    window.addEventListener("touchstart", markScrolled, { passive: true });
    document.fonts?.ready.then(jump);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("load", jump);
      window.removeEventListener("wheel", markScrolled);
      window.removeEventListener("touchstart", markScrolled);
    };
  }, []);

  useEffect(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>(".about-in"),
    );
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach(
          (entry) =>
            entry.isIntersecting && entry.target.classList.add("is-visible"),
        ),
      { threshold: 0.2, rootMargin: "0px 0px -10px" },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach(
          (entry) =>
            entry.isIntersecting && entry.target.classList.add("is-visible"),
        ),
      { threshold: 0.14, rootMargin: "0px 0px -35px" },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [projectList, toolList, statList]);

  useEffect(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".tl-in, .mpill-in, .hline-in, .vcta-in, .fline-in, .fbtn-in, .fin-in",
      ),
    );
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach(
          (entry) =>
            entry.isIntersecting && entry.target.classList.add("is-in"),
        ),
      { threshold: 0.2 },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const visionLines = Array.from(
      document.querySelectorAll<HTMLElement>(".vision-line"),
    );
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const highlight = entry.target.querySelector(".vision-highlight");
            const text = entry.target.querySelector(".vision-text");
            highlight?.classList.add("revealed");
            text?.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 },
    );
    visionLines.forEach((line) => observer.observe(line));
    return () => observer.disconnect();
  }, []);

  const handleContactSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();

    // Save to the admin inbox when the database is connected; otherwise open the mail app.
    setSending(true);
    try {
      if (await sendContactMessage({ name, email, message })) {
        form.reset();
        toast({
          title: "Message sent 🚀",
          description: "Thanks! I'll get back to you soon.",
        });
        return;
      }
    } catch {
      toast({
        title: "Couldn't send right now",
        description: "Opening your email app instead.",
      });
    } finally {
      setSending(false);
    }
    const subject = name
      ? `Portfolio message from ${name}`
      : "Portfolio message";
    window.location.href = `mailto:${settings.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  };

  return (
    <main className="site-shell">
      <SiteNav />

      <section className="hero" id="top" aria-label="Krish introduction">
        <HeroMedia image={settings.heroImage || undefined} />
        <div className="hero-overlay" aria-hidden="true" />
        <HeroParticles />
        <HeroBokeh />
        <div className="hero-content">
          <p className="hero-greet hero-anim hero-anim-1">
            Hi, I'm <span className="line" />
          </p>
          <h1 className="hero-name" data-testid="text-hero-title">
            <span className="name-letters">
              {"Krish".split("").map((ch, i) => (
                <span
                  key={i}
                  className="name-letter"
                  data-letter={ch}
                  style={
                    {
                      animationDelay: `${0.04 + i * 0.05}s`,
                      "--i": i,
                    } as CSSProperties
                  }
                >
                  {ch}
                </span>
              ))}
            </span>
            <span className="name-dots" aria-hidden="true">
              <span className="name-dot">.</span>
              <span className="name-dot">.</span>
              <span className="name-dot">.</span>
            </span>
          </h1>
          <h2 className="hero-role hero-anim hero-anim-3">
            <Typewriter roles={settings.roles} />
          </h2>
          <p className="hero-desc hero-anim hero-anim-4">{settings.tagline}</p>
          <div className="hero-buttons hero-anim hero-anim-5">
            <a href="#work" className="btn-primary">
              View My Work <ArrowRight size={15} />
            </a>
            <a href="/media/krish-resume.md" download className="btn-secondary">
              Download Resume <Download size={14} />
            </a>
          </div>
        </div>
      </section>

      <HeroTicker />

      <section className="section intro-section" id="about">
        <div className="section-inner about-layout">
          <div className="about-text">
            <span className="about-ghost" aria-hidden="true">
              01
            </span>
            <div className="about-label about-in about-fade-left">
              01 / The starting point
            </div>
            <h2 className="about-heading">
              <span
                className="about-line about-in about-rise"
                style={{ transitionDelay: ".2s" }}
              >
                Small town.
              </span>
              <span
                className="about-line about-in about-rise"
                style={{ transitionDelay: ".35s" }}
              >
                <em>Big intent.</em>
              </span>
            </h2>
            <p
              className="about-copy about-in about-rise"
              style={{ transitionDelay: ".5s" }}
            >
              Motivated Class 12 student. Strong foundations in Python, C, and
              C++, with hands-on practice building functional web and desktop
              applications.
            </p>
          </div>
          <div className="about-photo-wrap">
            <div className="about-glow" aria-hidden="true" />
            <div
              className="about-photo about-in about-fade-right"
              style={{ transitionDelay: ".3s" }}
            >
              <span
                className="about-corner about-corner-tl about-in"
                style={{ transitionDelay: "0.4s" }}
                aria-hidden="true"
              />
              <span
                className="about-corner about-corner-tr about-in"
                style={{ transitionDelay: "0.5s" }}
                aria-hidden="true"
              />
              <span
                className="about-corner about-corner-bl about-in"
                style={{ transitionDelay: "0.6s" }}
                aria-hidden="true"
              />
              <span
                className="about-corner about-corner-br about-in"
                style={{ transitionDelay: "0.7s" }}
                aria-hidden="true"
              />
              <span
                className="about-dot about-dot-1 about-in"
                style={{ transitionDelay: "0.45s" }}
                aria-hidden="true"
              />
              <span
                className="about-dot about-dot-2 about-in"
                style={{ transitionDelay: "0.55s" }}
                aria-hidden="true"
              />
              <span
                className="about-dot about-dot-3 about-in"
                style={{ transitionDelay: "0.65s" }}
                aria-hidden="true"
              />
              {settings.aboutPhoto ? (
                <img
                  className="about-photo-img"
                  src={resizedImage(settings.aboutPhoto, 700)}
                  srcSet={imageSrcSet(settings.aboutPhoto, [400, 700, 1000])}
                  sizes="(max-width: 900px) 80vw, 420px"
                  alt="Krish, AI developer from Pundri, Haryana"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span>Professional photo placeholder</span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="section story-section">
        <div className="section-inner">
          <div className="story-label reveal">02 / My story</div>
          <div className="story-card reveal reveal-delay-1">
            <h2 className="story-heading">
              <span className="story-bar" aria-hidden="true" />
              My Story
            </h2>
            <p className="story-paragraph">
              I'm a Class 12 student from Pundri, Kaithal - no formal tech
              background, no coding classes. Just curiosity and a laptop.
            </p>
            <p className="story-paragraph">
              I started teaching myself Python, C, and C++, then moved into web
              development and exploring AI tools. Every project I've built has
              come from figuring things out on my own - late nights, tutorials,
              and a lot of trial and error.
            </p>
            <p className="story-paragraph">
              I'm not chasing certificates - I'm chasing the ability to build
              things that actually work. Right now, I'm looking for an
              entry-level role or internship where I can turn that
              problem-solving mindset into real software.
            </p>
          </div>
        </div>
      </section>

      <section className="section skills-section" id="skills">
        <div className="section-inner skills-layout">
          <div className="section-label reveal">03 / The toolkit</div>
          <h2 className="skills-heading reveal reveal-delay-1">
            My Capabilities
          </h2>
          <div className="tools-grid" data-testid="list-skills">
            {toolsLoading && !toolList.length
              ? Array.from({ length: 10 }, (_, i) => (
                  <span key={i} className="tool-skel" aria-hidden="true" />
                ))
              : toolList.map((tool, i) => (
                  <div
                    className="tool-item reveal"
                    key={tool.id}
                    style={{ transitionDelay: `${0.25 + i * 0.05}s` }}
                    data-testid={`tool-${slugifyToolName(tool.name)}`}
                  >
                    <ToolTile tool={tool} />
                    <span className="tool-name">{tool.name}</span>
                  </div>
                ))}
          </div>
          <div className="stats-row reveal reveal-delay-3">
            {statsLoading && !statList.length
              ? Array.from({ length: 3 }, (_, i) => (
                  <span key={i} className="stat-skel" aria-hidden="true" />
                ))
              : statList.map((stat) => (
                  <StatCounter
                    key={stat.id}
                    value={stat.value}
                    label={stat.label}
                  />
                ))}
          </div>
          <div className="marketing-subsection">
            <h3 className="marketing-heading reveal reveal-delay-1">
              <span className="marketing-accent" aria-hidden="true" />
              Digital Marketing
            </h3>
            <div className="marketing-pills" data-testid="list-marketing">
              <span
                className="marketing-pill mpill-in"
                style={{ transitionDelay: "0s" }}
              >
                SEO
              </span>
              <span
                className="marketing-pill mpill-in"
                style={{ transitionDelay: "0.08s" }}
              >
                <Search size={16} />
                Google Ads
              </span>
              <span
                className="marketing-pill mpill-in"
                style={{ transitionDelay: "0.16s" }}
              >
                <Facebook size={16} />
                Meta Ads
              </span>
              <span
                className="marketing-pill mpill-in"
                style={{ transitionDelay: "0.24s" }}
              >
                Social Media Management
              </span>
              <span
                className="marketing-pill mpill-in"
                style={{ transitionDelay: "0.32s" }}
              >
                Digital Marketing Strategy
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="section projects-section" id="work">
        <div className="section-inner">
          <div className="projects-heading">
            <div>
              <div className="section-label reveal">04 / Selected practice</div>
              <h2 className="section-title reveal reveal-delay-1">
                Things built
                <br />
                <span className="highlight">to learn.</span>
              </h2>
            </div>
            <p className="reveal reveal-delay-2">
              {projectList.length || "A few"} projects. Each one a sharper
              question, a new constraint, and another reason to keep going.
            </p>
          </div>
          <div className="pj-list" data-testid="list-projects">
            {shownProjects.map((project, i) => (
              <ProjectShowcase
                key={project.slug}
                project={project}
                flip={i % 2 === 1}
                reveal
              />
            ))}
          </div>
          {shownProjects.length < projectList.length && (
            <div className="pj-all reveal">
              <Link href="/projects" className="btn-secondary">
                See all {projectList.length} projects <ArrowRight size={15} />
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="section timeline-section" id="process">
        <div className="section-inner timeline-layout">
          <div className="timeline-left">
            <span className="timeline-ghost" aria-hidden="true">
              05
            </span>
            <div className="section-label reveal">05 / The trajectory</div>
            <h2 className="section-title timeline-title">
              <span
                className="timeline-heading-line hline-in"
                style={{ transitionDelay: "0s" }}
              >
                Learning fast.
              </span>
              <span
                className="timeline-heading-line highlight hline-in"
                style={{ transitionDelay: "0.15s" }}
              >
                Building faster.
              </span>
            </h2>
            <p className="timeline-intro reveal reveal-delay-2">
              Every project is a checkpoint. Every bug is a better question
              waiting to be asked.
            </p>
            <div className="timeline-lines" aria-hidden="true" />
          </div>
          <div
            className="timeline reveal reveal-delay-2"
            data-testid="list-education"
          >
            <div
              className="timeline-item tl-in"
              style={{ transitionDelay: "0s" }}
            >
              <div className="timeline-year">2024</div>
              <div>
                <h3>Class 10 — Saraswati Sr. Sec. School, Dulyani</h3>
                <p>The beginning of a direction that keeps getting clearer.</p>
              </div>
            </div>
            <div
              className="timeline-item tl-in"
              style={{ transitionDelay: "0.15s" }}
            >
              <div className="timeline-year">2026 / NOW</div>
              <div>
                <h3>Class 12 — GMSSS School, Pundri</h3>
                <p>
                  Building a stronger programming foundation while preparing for
                  the next step.
                </p>
              </div>
            </div>
            <div
              className="timeline-item tl-in"
              style={{ transitionDelay: "0.3s" }}
            >
              <div className="timeline-year">2026</div>
              <div>
                <h3>Digital Marketing with AI — Completed Certification</h3>
                <p>
                  Learned how AI tools can power modern marketing — from content
                  strategy to campaign optimization.
                </p>
              </div>
            </div>
            <div
              className="timeline-item tl-in"
              style={{ transitionDelay: "0.45s" }}
            >
              <div className="timeline-year">NEXT</div>
              <div>
                <h3>Entry-level opportunity or internship</h3>
                <p>
                  Ready to contribute, learn in a team, and turn practice into
                  production habits.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section vision-section">
        <div className="section-inner vision-inner">
          <span className="vision-ring vision-ring-1" aria-hidden="true" />
          <span className="vision-ring vision-ring-2" aria-hidden="true" />
          <span className="vision-ring vision-ring-3" aria-hidden="true" />
          <div className="section-label reveal">06 / My vision</div>
          <h2 className="vision-heading reveal reveal-delay-1">My Vision</h2>
          <div className="vision-statements">
            <div className="vision-line">
              <span className="vision-highlight"></span>
              <span className="vision-text">
                I don't wait for perfect conditions.
              </span>
            </div>
            <div className="vision-line vision-line-alt">
              <span className="vision-highlight"></span>
              <span className="vision-text">I build with what I have.</span>
            </div>
            <div className="vision-line">
              <span className="vision-highlight"></span>
              <span className="vision-text">I don't chase certificates.</span>
            </div>
            <div className="vision-line vision-line-alt">
              <span className="vision-highlight"></span>
              <span className="vision-text">I chase real skills.</span>
            </div>
            <div className="vision-line">
              <span className="vision-highlight"></span>
              <span className="vision-text">I don't follow trends.</span>
            </div>
            <div className="vision-line vision-line-alt">
              <span className="vision-highlight"></span>
              <span className="vision-text">I follow curiosity.</span>
            </div>
          </div>
          <a
            className="vision-cta vcta-in"
            style={{ transitionDelay: "1.2s" }}
            href="#contact"
            data-testid="link-vision-cta"
          >
            Let's Build Together <ArrowRight size={18} />
          </a>
        </div>
      </section>

      <section className="section contact-section" id="contact">
        <div className="section-inner contact-grid">
          <div>
            <div className="section-label reveal">07 / Say hello</div>
            <h2 className="contact-title reveal reveal-delay-1">
              Let's build
              <br />
              <em>what's next.</em>
            </h2>
          </div>
          <div className="contact-aside reveal reveal-delay-2">
            <p>
              For an internship, a first opportunity, or a good conversation
              about software, reach out directly.
            </p>
            <form
              className="contact-form-card"
              onSubmit={handleContactSubmit}
              data-testid="form-contact"
            >
              <div className="field fline-in" style={{ transitionDelay: "0s" }}>
                <label htmlFor="contact-name" className="visually-hidden">
                  Full Name
                </label>
                <input
                  id="contact-name"
                  name="name"
                  type="text"
                  placeholder="Full Name"
                  autoComplete="name"
                  required
                />
              </div>
              <div
                className="field fline-in"
                style={{ transitionDelay: "0.1s" }}
              >
                <label htmlFor="contact-email" className="visually-hidden">
                  Email Address
                </label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  placeholder="Email Address"
                  autoComplete="email"
                  required
                />
              </div>
              <div
                className="field fline-in"
                style={{ transitionDelay: "0.2s" }}
              >
                <label htmlFor="contact-message" className="visually-hidden">
                  Message
                </label>
                <textarea
                  id="contact-message"
                  name="message"
                  placeholder="Message"
                  rows={4}
                  required
                />
              </div>
              <button
                type="submit"
                className="contact-send fbtn-in"
                style={{ transitionDelay: "0.4s" }}
                disabled={sending}
              >
                {sending ? "Sending…" : "Send 🚀"}
              </button>
              <div
                className="contact-bottom fin-in"
                style={{ transitionDelay: "0.5s" }}
              >
                <div className="contact-location">
                  <MapPin size={16} />
                  {settings.location}
                </div>
                <div className="contact-socials">
                  <a
                    href={settings.instagram}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Instagram"
                  >
                    <Instagram size={16} />
                  </a>
                  <a
                    href={settings.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="LinkedIn"
                  >
                    <Linkedin size={16} />
                  </a>
                  <a
                    href={settings.youtube}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="YouTube"
                  >
                    <Youtube size={16} />
                  </a>
                  <a
                    href={settings.github}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="GitHub"
                  >
                    <Github size={16} />
                  </a>
                </div>
              </div>
            </form>
            <div className="contact-details">
              <a href={`mailto:${settings.email}`} data-testid="link-email">
                <Mail size={14} /> {settings.email}
              </a>
              <a
                href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`}
                data-testid="link-phone"
              >
                <Phone size={14} /> {settings.phone}
              </a>
              <a
                href={settings.github}
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub"
                data-testid="link-github-contact"
              >
                <Github size={14} />{" "}
                {settings.github.replace(/^https?:\/\/(www\.)?/, "")}
              </a>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Suspense
        fallback={<div className="route-fallback" aria-hidden="true" />}
      >
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/blog" component={BlogPage} />
          <Route path="/blog/:slug" component={BlogPostPage} />
          <Route path="/projects" component={ProjectsPage} />
          <Route path="/projects/:slug" component={ProjectPage} />
          <Route path="/admin" nest component={AdminApp} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </RoutedErrorBoundary>
  );
}

// Custom cursor and scroll effects belong to the public site, not the admin panel. They are decorative,
// so they are kept out of the initial render and mounted only once the browser is idle or the user first
// interacts — the chunks (and their setup work) never compete with first paint.
function SiteChrome() {
  const [location] = useLocation();
  const [ready, setReady] = useState(false);
  const forbid = location.startsWith("/admin");

  useEffect(() => {
    if (forbid) return;
    let done = false;
    let id = 0;

    const finish = () => {
      if (done) return;
      done = true;
      if (typeof window.cancelIdleCallback === "function")
        window.cancelIdleCallback(id);
      else window.clearTimeout(id);
      window.removeEventListener("pointerdown", finish);
      window.removeEventListener("scroll", finish);
      setReady(true);
    };

    if (typeof window.requestIdleCallback === "function") {
      id = window.requestIdleCallback(finish, { timeout: 1500 });
    } else {
      id = window.setTimeout(finish, 1200);
    }
    // If the tab stays busy (or hidden) the idle callback may not fire; any gesture is a fine time too.
    window.addEventListener("pointerdown", finish, {
      once: true,
      passive: true,
    });
    window.addEventListener("scroll", finish, { once: true, passive: true });

    return () => {
      done = true;
      if (typeof window.cancelIdleCallback === "function")
        window.cancelIdleCallback(id);
      else window.clearTimeout(id);
      window.removeEventListener("pointerdown", finish);
      window.removeEventListener("scroll", finish);
    };
  }, [forbid]);

  // Refresh always starts at the top (hero), even mid-page or with a #hash — while back/forward
  // still restores the position each entry was left at. Native restoration is turned off and
  // replaced by the save/restore below so the two can't fight each other. Hash URLs are only
  // stripped on reload; a fresh visit to /#work keeps scrolling to its section.
  useEffect(() => {
    if (forbid) return;
    const entry = performance.getEntriesByType("navigation")[0];
    const type = (entry as PerformanceNavigationTiming | undefined)?.type;

    if ("scrollRestoration" in history) history.scrollRestoration = "manual";

    type EntryState = { __scrollY?: number } | null;
    const saveCurrent = () =>
      history.replaceState(
        { ...(history.state as EntryState), __scrollY: Math.round(window.scrollY) },
        "",
      );

    if (type === "reload") {
      if (window.location.hash)
        history.replaceState(
          history.state,
          "",
          window.location.pathname + window.location.search,
        );
      window.scrollTo(0, 0);
      saveCurrent();
    } else if (type === "back_forward") {
      const y = (history.state as EntryState)?.__scrollY;
      if (typeof y === "number")
        requestAnimationFrame(() => window.scrollTo(0, y));
    }

    let ticking = false;
    const save = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        saveCurrent();
      });
    };
    const restore = (event: PopStateEvent) => {
      const y = (event.state as EntryState)?.__scrollY;
      if (typeof y === "number")
        requestAnimationFrame(() => window.scrollTo(0, y));
    };
    window.addEventListener("scroll", save, { passive: true });
    window.addEventListener("popstate", restore);
    return () => {
      window.removeEventListener("scroll", save);
      window.removeEventListener("popstate", restore);
    };
  }, [forbid]);

  if (forbid) return null;
  return (
    <Suspense fallback={null}>
      {ready ? (
        <>
          <CustomCursor />
          <SiteEffects />
        </>
      ) : null}
    </Suspense>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <SiteChrome />
        <Router />
      </WouterRouter>
      <Suspense fallback={null}>
        <Toaster />
      </Suspense>
    </QueryClientProvider>
  );
}

export default App;
