import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, AudioLines, AudioWaveform, Bot, Code2, Download, Facebook, Figma, Github, HeartPulse, Instagram, Linkedin, Mail, MapPin, MessageSquare, Phone, Search, Sparkles, Video, Youtube } from 'lucide-react';
import { type LucideIcon } from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import BlogPage from '@/pages/blog';
import BlogPostPage from '@/pages/blog-post';
import { SiteNav } from '@/components/site-nav';
import { SiteFooter } from '@/components/site-footer';
import { SiteEffects } from '@/components/site-effects';
import { HeroParticles } from '@/components/hero-particles';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

const projects = [
  {
    number: '01',
    name: 'Fitness Temple',
    description: 'A fitness-themed website built to practice front-end structure, content hierarchy, and styling.',
    url: 'https://github.com/KRRISH972/FITNESS_TEMPLE',
  },
  {
    number: '02',
    name: 'LinguaBridge',
    description: 'A language-learning and translation project exploring the small details that help communication travel.',
    url: 'https://github.com/KRRISH972/LINGUABRIDGE-',
  },
  {
    number: '03',
    name: 'Memory Match Game',
    description: 'An interactive memory game built around logic, state changes, and event-driven programming.',
    url: 'https://github.com/KRRISH972/MEMORY-MATCH',
  },
  {
    number: '04',
    name: 'Calculator',
    description: 'A functional calculator application focused on core programming logic and arithmetic operations.',
    url: '',
  },
  {
    number: '05',
    name: 'M2F Gym Website',
    description: 'A clean gym and fitness business website designed to present services and information clearly.',
    url: '',
  },
];

const tools: { name: string; id: string; icon: LucideIcon }[] = [
  { name: 'Claude', id: 'claude', icon: Sparkles },
  { name: 'GitHub Copilot', id: 'github-copilot', icon: Bot },
  { name: 'ChatGPT', id: 'chatgpt', icon: MessageSquare },
  { name: 'VS Code', id: 'vs-code', icon: Code2 },
  { name: 'GitHub', id: 'github', icon: Github },
  { name: 'Figma', id: 'figma', icon: Figma },
  { name: 'ElevenLabs', id: 'elevenlabs', icon: AudioWaveform },
  { name: 'Deepgram', id: 'deepgram', icon: AudioLines },
  { name: 'Cartesia AI', id: 'cartesia-ai', icon: HeartPulse },
  { name: 'LiveKit', id: 'livekit', icon: Video },
];

function StatCounter({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
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
            setCount(Math.round(value * eased));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div className="stat" ref={ref} data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="stat-number">{count}{suffix}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

const typewriterRoles = ['Web Developer', 'Digital Marketer', 'AI Enthusiast'];

function Typewriter() {
  const [text, setText] = useState('');
  const [roleIndex, setRoleIndex] = useState(0);

  useEffect(() => {
    const current = typewriterRoles[roleIndex];
    let charIndex = 0;
    let timer: ReturnType<typeof setTimeout>;

    const erase = () => {
      if (charIndex === 0) {
        setRoleIndex((i) => (i + 1) % typewriterRoles.length);
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
  }, [roleIndex]);

  return (
    <span className="typewriter-text" data-testid="text-hero-role">
      {text}
      <span className="typewriter-cursor" aria-hidden="true">|</span>
    </span>
  );
}

function CustomCursor() {
  const rootRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return;

    const root = rootRef.current!;
    const dot = dotRef.current!;
    const ring = ringRef.current!;

    const target = { x: -100, y: -100 };
    const ringPos = { x: -100, y: -100 };
    let visible = false;
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      if (!visible) {
        visible = true;
        ringPos.x = target.x;
        ringPos.y = target.y;
        dot.style.transform = `translate3d(${target.x}px, ${target.y}px, 0)`;
        ring.style.transform = `translate3d(${target.x}px, ${target.y}px, 0)`;
        root.classList.add('is-visible');
        return;
      }
      dot.style.transform = `translate3d(${target.x}px, ${target.y}px, 0)`;
    };

    const tick = () => {
      ringPos.x += (target.x - ringPos.x) * 0.15;
      ringPos.y += (target.y - ringPos.y) * 0.15;
      ring.style.transform = `translate3d(${Math.round(ringPos.x * 10) / 10}px, ${Math.round(ringPos.y * 10) / 10}px, 0)`;
      raf = requestAnimationFrame(tick);
    };

    const asHover = (el: Element | null) => el?.closest('a, button, .cursor-hover');

    const asPromoBtn = (el: Element | null) =>
      (el as HTMLElement | null)?.classList.contains('btn-primary') ||
      (el as HTMLElement | null)?.classList.contains('btn-secondary') ||
      !!el?.closest('.btn-primary, .btn-secondary');

    const onOver = (e: MouseEvent) => {
      if (!asHover(e.target as Element | null)) return;
      root.classList.add('cursor-hovered');
      if (asPromoBtn(e.target as Element | null)) root.classList.add('cursor-hovered-btn');
    };

    const onOut = (e: MouseEvent) => {
      if (!asHover(e.target as Element | null)) return;
      root.classList.remove('cursor-hovered');
      root.classList.remove('cursor-hovered-btn');
    };

    window.addEventListener('mousemove', onMove);
    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="cursor" ref={rootRef} aria-hidden="true">
      <div className="cursor-dot" ref={dotRef}>
        <span className="cursor-dot-core" />
      </div>
      <div className="cursor-ring" ref={ringRef}>
        <span className="cursor-ring-core" />
      </div>
    </div>
  );
}

function Home() {
  // Arriving from another page with a #hash (e.g. /#contact from the blog): scroll to it once mounted.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
  }, []);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('.about-in'));
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('is-visible')),
      { threshold: 0.2, rootMargin: '0px 0px -10px' },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('is-visible')),
      { threshold: 0.14, rootMargin: '0px 0px -35px' },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('.tl-in, .mpill-in, .hline-in, .vcta-in, .fline-in, .fbtn-in, .fin-in'));
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('is-in')),
      { threshold: 0.2 },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const visionLines = Array.from(document.querySelectorAll<HTMLElement>('.vision-line'));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const highlight = entry.target.querySelector('.vision-highlight');
            const text = entry.target.querySelector('.vision-text');
            highlight?.classList.add('revealed');
            text?.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 },
    );
    visionLines.forEach((line) => observer.observe(line));
    return () => observer.disconnect();
  }, []);

  const handleContactSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const subject = data.get('name') ? `Portfolio message from ${data.get('name')}` : 'Portfolio message';
    const body = data.get('message') ? String(data.get('message')) : '';
    window.location.href = `mailto:dhimankrish10@gmail.com?subject=${encodeURIComponent(String(subject))}&body=${encodeURIComponent(body)}`;
  };

  return (
    <main className="site-shell">
      <SiteNav />

      <section className="hero" id="top" aria-label="Krish introduction">
        <video
          className="hero-video"
          src="/krish-hero.mp4"
          autoPlay
          loop
          muted
          playsInline
          aria-hidden="true"
        />
        <div className="hero-overlay" aria-hidden="true" />
        <HeroParticles />
        <div className="hero-content">
          <p className="hero-greet hero-anim hero-anim-1">Hi, I'm <span className="line" /></p>
          <h1 className="hero-name" data-testid="text-hero-title">
            <span className="name-letters">
              {'Krish'.split('').map((ch, i) => (
                <span
                  key={i}
                  className="name-letter"
                  style={{ animationDelay: `${0.3 + i * 0.05}s` }}
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
          <h2 className="hero-role hero-anim hero-anim-3"><Typewriter /></h2>
          <p className="hero-desc hero-anim hero-anim-4">
            I'm passionate about creating modern web experiences, exploring the power
            of AI and digital marketing, and building things that make an impact.
          </p>
          <div className="hero-buttons hero-anim hero-anim-5">
            <a href="#work" className="btn-primary">View My Work <ArrowRight size={15} /></a>
            <a href="#resume" className="btn-secondary">Download Resume <Download size={14} /></a>
          </div>
        </div>
      </section>

      <div className="marquee-wrap" aria-label="Krish focus areas">
        <div className="marquee">
          <span>Python</span><span>•</span><span>Web experiments</span><span>•</span><span>Logic first</span><span>•</span>
          <span>Always building</span><span>•</span><span>Python</span><span>•</span><span>Web experiments</span><span>•</span>
          <span>Logic first</span><span>•</span><span>Always building</span><span>•</span>
        </div>
      </div>

      <section className="section intro-section" id="about">
        <div className="section-inner about-layout">
          <div className="about-text">
            <span className="about-ghost" aria-hidden="true">01</span>
            <div className="about-label about-in about-fade-left">01 / The starting point</div>
            <h2 className="about-heading">
              <span className="about-line about-in about-rise" style={{ transitionDelay: '.2s' }}>Small town.</span>
              <span className="about-line about-in about-rise" style={{ transitionDelay: '.35s' }}><em>Big intent.</em></span>
            </h2>
            <p className="about-copy about-in about-rise" style={{ transitionDelay: '.5s' }}>
              Motivated Class 12 student. Strong foundations in Python, C, and C++, with hands-on
              practice building functional web and desktop applications.
            </p>
          </div>
          <div className="about-photo-wrap">
            <div className="about-glow" aria-hidden="true" />
            <div className="about-photo about-in about-fade-right" style={{ transitionDelay: '.3s' }}>
              <span className="about-corner about-corner-tl about-in" style={{ transitionDelay: '0.4s' }} aria-hidden="true" />
              <span className="about-corner about-corner-tr about-in" style={{ transitionDelay: '0.5s' }} aria-hidden="true" />
              <span className="about-corner about-corner-bl about-in" style={{ transitionDelay: '0.6s' }} aria-hidden="true" />
              <span className="about-corner about-corner-br about-in" style={{ transitionDelay: '0.7s' }} aria-hidden="true" />
              <span className="about-dot about-dot-1 about-in" style={{ transitionDelay: '0.45s' }} aria-hidden="true" />
              <span className="about-dot about-dot-2 about-in" style={{ transitionDelay: '0.55s' }} aria-hidden="true" />
              <span className="about-dot about-dot-3 about-in" style={{ transitionDelay: '0.65s' }} aria-hidden="true" />
              <span>Professional photo placeholder</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section story-section">
        <div className="section-inner">
          <div className="story-label reveal">02 / My story</div>
          <div className="story-card reveal reveal-delay-1">
            <h2 className="story-heading">
              <span className="story-bar" aria-hidden="true" />My Story
            </h2>
            <p className="story-paragraph">
              I'm a Class 12 student from Pundri, Kaithal - no formal tech
              background, no coding classes. Just curiosity and a laptop.
            </p>
            <p className="story-paragraph">
              I started teaching myself Python, C, and C++, then moved into
              web development and exploring AI tools. Every project I've built has come
              from figuring things out on my own - late nights, tutorials, and a lot of
              trial and error.
            </p>
            <p className="story-paragraph">
              I'm not chasing certificates - I'm chasing the ability to build
              things that actually work. Right now, I'm looking for an entry-level role or
              internship where I can turn that problem-solving mindset into real software.
            </p>
          </div>
        </div>
      </section>

      <section className="section skills-section" id="skills">
        <div className="section-inner skills-layout">
          <div className="section-label reveal">03 / The toolkit</div>
          <h2 className="skills-heading reveal reveal-delay-1">My Capabilities</h2>
          <div className="tools-grid" data-testid="list-skills">
            {tools.map((tool, i) => (
              <div
                className="tool-item reveal"
                key={tool.name}
                style={{ transitionDelay: `${0.25 + i * 0.05}s` }}
                data-testid={`tool-${tool.id}`}
              >
                <span className="tool-icon"><tool.icon size={40} strokeWidth={1.5} /></span>
                <span className="tool-name">{tool.name}</span>
              </div>
            ))}
          </div>
          <div className="stats-row reveal reveal-delay-3">
            <StatCounter value={500} suffix="+" label="Development Hours" />
            <StatCounter value={5} suffix="+" label="Projects Built" />
            <StatCounter value={3} suffix="+" label="Languages Known" />
          </div>
          <div className="marketing-subsection">
            <h3 className="marketing-heading reveal reveal-delay-1">
              <span className="marketing-accent" aria-hidden="true" />Digital Marketing
            </h3>
            <div className="marketing-pills" data-testid="list-marketing">
              <span className="marketing-pill mpill-in" style={{ transitionDelay: '0s' }}>SEO</span>
              <span className="marketing-pill mpill-in" style={{ transitionDelay: '0.08s' }}><Search size={16} />Google Ads</span>
              <span className="marketing-pill mpill-in" style={{ transitionDelay: '0.16s' }}><Facebook size={16} />Meta Ads</span>
              <span className="marketing-pill mpill-in" style={{ transitionDelay: '0.24s' }}>Social Media Management</span>
              <span className="marketing-pill mpill-in" style={{ transitionDelay: '0.32s' }}>Digital Marketing Strategy</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section projects-section" id="work">
        <div className="section-inner">
          <div className="projects-heading">
            <div>
              <div className="section-label reveal">04 / Selected practice</div>
              <h2 className="section-title reveal reveal-delay-1">Things built<br /><span className="highlight">to learn.</span></h2>
            </div>
            <p className="reveal reveal-delay-2">Five projects. Each one a sharper question, a new constraint, and another reason to keep going.</p>
          </div>
          <div className="project-list" data-testid="list-projects">
            {projects.map((project) => (
              <article className="project-row reveal" data-tilt key={project.number} data-testid={`card-project-${project.number}`}>
                <div className="project-number">{project.number}</div>
                <div className="project-name">{project.name}</div>
                <div className="project-description">{project.description}</div>
                {project.url ? (
                  <a className="project-link" href={project.url} target="_blank" rel="noreferrer" data-testid={`link-project-${project.number}`}>
                    View on GitHub <ArrowUpRight size={14} />
                  </a>
                ) : (
                  <span className="project-link" aria-label="Personal project">Personal project</span>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section timeline-section" id="process">
        <div className="section-inner timeline-layout">
          <div className="timeline-left">
            <span className="timeline-ghost" aria-hidden="true">05</span>
            <div className="section-label reveal">05 / The trajectory</div>
            <h2 className="section-title timeline-title">
              <span className="timeline-heading-line hline-in" style={{ transitionDelay: '0s' }}>Learning fast.</span>
              <span className="timeline-heading-line highlight hline-in" style={{ transitionDelay: '0.15s' }}>Building faster.</span>
            </h2>
            <p className="timeline-intro reveal reveal-delay-2">Every project is a checkpoint. Every bug is a better question waiting to be asked.</p>
            <div className="timeline-lines" aria-hidden="true" />
          </div>
          <div className="timeline reveal reveal-delay-2" data-testid="list-education">
            <div className="timeline-item tl-in" style={{ transitionDelay: '0s' }}>
              <div className="timeline-year">2024</div>
              <div><h3>Class 10 — Saraswati Sr. Sec. School, Dulyani</h3><p>The beginning of a direction that keeps getting clearer.</p></div>
            </div>
            <div className="timeline-item tl-in" style={{ transitionDelay: '0.15s' }}>
              <div className="timeline-year">2026 / NOW</div>
              <div><h3>Class 12 — GMSSS School, Pundri</h3><p>Building a stronger programming foundation while preparing for the next step.</p></div>
            </div>
            <div className="timeline-item tl-in" style={{ transitionDelay: '0.3s' }}>
              <div className="timeline-year">2026</div>
              <div><h3>Digital Marketing with AI — Completed Certification</h3><p>Learned how AI tools can power modern marketing — from content strategy to campaign optimization.</p></div>
            </div>
            <div className="timeline-item tl-in" style={{ transitionDelay: '0.45s' }}>
              <div className="timeline-year">NEXT</div>
              <div><h3>Entry-level opportunity or internship</h3><p>Ready to contribute, learn in a team, and turn practice into production habits.</p></div>
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
              <span className="vision-text">I don't wait for perfect conditions.</span>
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
          <a className="vision-cta vcta-in" style={{ transitionDelay: '1.2s' }} href="#contact" data-testid="link-vision-cta">
            Let's Build Together <ArrowRight size={18} />
          </a>
        </div>
      </section>

      <section className="section contact-section" id="contact">
        <div className="section-inner contact-grid">
          <div>
            <div className="section-label reveal">07 / Say hello</div>
            <h2 className="contact-title reveal reveal-delay-1">Let's build<br /><em>what's next.</em></h2>
          </div>
          <div className="contact-aside reveal reveal-delay-2">
            <p>For an internship, a first opportunity, or a good conversation about software, reach out directly.</p>
            <form className="contact-form-card" onSubmit={handleContactSubmit} data-testid="form-contact">
              <div className="field fline-in" style={{ transitionDelay: '0s' }}>
                <label htmlFor="contact-name" className="visually-hidden">Full Name</label>
                <input id="contact-name" name="name" type="text" placeholder="Full Name" autoComplete="name" required />
              </div>
              <div className="field fline-in" style={{ transitionDelay: '0.1s' }}>
                <label htmlFor="contact-email" className="visually-hidden">Email Address</label>
                <input id="contact-email" name="email" type="email" placeholder="Email Address" autoComplete="email" required />
              </div>
              <div className="field fline-in" style={{ transitionDelay: '0.2s' }}>
                <label htmlFor="contact-message" className="visually-hidden">Message</label>
                <textarea id="contact-message" name="message" placeholder="Message" rows={4} required />
              </div>
              <button type="submit" className="contact-send fbtn-in" style={{ transitionDelay: '0.4s' }}>Send 🚀</button>
              <div className="contact-bottom fin-in" style={{ transitionDelay: '0.5s' }}>
                <div className="contact-location"><MapPin size={16} />Pundri, Kaithal, Haryana, India</div>
                <div className="contact-socials">
                  <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={16} /></a>
                  <a href="https://www.linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn"><Linkedin size={16} /></a>
                  <a href="https://youtube.com" target="_blank" rel="noreferrer" aria-label="YouTube"><Youtube size={16} /></a>
                  <a href="https://github.com/KRRISH972" target="_blank" rel="noreferrer" aria-label="GitHub"><Github size={16} /></a>
                </div>
              </div>
            </form>
            <div className="contact-details">
              <a href="mailto:dhimankrish10@gmail.com" data-testid="link-email"><Mail size={14} /> dhimankrish10@gmail.com</a>
              <a href="tel:+919306091154" data-testid="link-phone"><Phone size={14} /> +91 93060 91154</a>
              <a href="https://github.com/KRRISH972" target="_blank" rel="noreferrer" data-testid="link-github-contact"><Github size={14} /> github.com/KRRISH972</a>
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
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/blog" component={BlogPage} />
        <Route path="/blog/:slug" component={BlogPostPage} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CustomCursor />
      <SiteEffects />
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;