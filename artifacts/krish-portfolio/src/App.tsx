import { type ReactNode, useEffect } from 'react';
import { ArrowDownRight, ArrowUpRight, Github, Mail, Phone } from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
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

const skills = ['Python', 'C', 'C++', 'CSS', 'Git', 'GitHub', 'Problem-solving', 'Logical thinking'];

function ScrollLink({ href, children, testId }: { href: string; children: string; testId: string }) {
  return (
    <a data-testid={testId} href={href}>
      {children}
    </a>
  );
}

function Home() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('is-visible')),
      { threshold: 0.14, rootMargin: '0px 0px -35px' },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <main className="site-shell">
      <nav className="site-nav" aria-label="Main navigation">
        <a className="brand-lockup" href="#top" data-testid="link-home">
          <span className="brand-mark">K</span>
          <span>Krish / 2026</span>
        </a>
        <div className="nav-links">
          <ScrollLink href="#work" testId="link-work">Work</ScrollLink>
          <ScrollLink href="#process" testId="link-process">Process</ScrollLink>
          <ScrollLink href="#contact" testId="link-contact-nav">Contact</ScrollLink>
        </div>
        <div className="nav-status" data-testid="status-available">
          <span className="status-dot" />
          Open to learn
        </div>
      </nav>

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
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-orbit" aria-hidden="true" />
        <div className="hero-inner">
          <div className="hero-kicker">Pundri, Haryana / builder in progress</div>
          <h1 data-testid="text-hero-title">
            Code with<br />
            <em>momentum.</em>
          </h1>
          <p className="hero-subtitle" data-testid="text-hero-subtitle">
            Krish is an aspiring software developer turning early practice into useful, playable, and real things.
          </p>
          <div className="hero-actions">
            <a className="button-primary magnetic" href="#work" data-testid="button-explore-work">
              Explore the work <ArrowDownRight size={15} />
            </a>
            <a className="button-ghost magnetic" href="https://github.com/KRRISH972" target="_blank" rel="noreferrer" data-testid="link-github-hero">
              <Github size={15} /> GitHub / KRRISH972
            </a>
          </div>
          <div className="hero-foot">
            <div className="hero-scroll"><span className="scroll-line" /> Scroll to meet the work</div>
            <div className="hero-coordinates">29.68° N / 76.99° E</div>
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
        <div className="section-inner intro-layout">
          <div>
            <div className="section-label reveal">01 / The starting point</div>
            <h2 className="section-title reveal reveal-delay-1">Small town.<br /><span className="highlight">Big intent.</span></h2>
            <p className="intro-copy reveal reveal-delay-2">
              <strong>Motivated Class 12 student.</strong> Strong foundations in Python, C, and C++, with hands-on practice building functional web and desktop applications.
            </p>
          </div>
          <aside className="intro-aside reveal reveal-delay-3" data-testid="text-location">
            <span>Currently in motion</span>
            From GMSSS School, Pundri (Kaithal), Krish is looking for an entry-level opportunity or internship where problem-solving can grow into software that matters.
          </aside>
        </div>
      </section>

      <section className="section projects-section" id="work">
        <div className="section-inner">
          <div className="projects-heading">
            <div>
              <div className="section-label reveal">02 / Selected practice</div>
              <h2 className="section-title reveal reveal-delay-1">Things built<br /><span className="highlight">to learn.</span></h2>
            </div>
            <p className="reveal reveal-delay-2">Five projects. Each one a sharper question, a new constraint, and another reason to keep going.</p>
          </div>
          <div className="project-list" data-testid="list-projects">
            {projects.map((project) => (
              <article className="project-row depth-object reveal" key={project.number} data-testid={`card-project-${project.number}`}>
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

      <section className="section skills-section" id="skills">
        <div className="section-inner skills-layout">
          <div>
            <div className="section-label reveal">03 / The toolkit</div>
            <h2 className="section-title reveal reveal-delay-1">Learn the<br /><span className="highlight">language.</span></h2>
            <p className="skills-note reveal reveal-delay-2">A practical toolkit, built from the ground up. The goal is not to collect technologies — it is to understand what they can make possible.</p>
          </div>
          <div className="skill-cloud reveal reveal-delay-2" data-testid="list-skills">
            {skills.map((skill) => <span className="skill-pill" key={skill} data-testid={`tag-skill-${skill}`}>{skill}</span>)}
          </div>
        </div>
      </section>

      <section className="section timeline-section" id="process">
        <div className="section-inner timeline-layout">
          <div>
            <div className="section-label reveal">04 / The trajectory</div>
            <h2 className="section-title reveal reveal-delay-1">A foundation<br /><span className="highlight">underway.</span></h2>
            <p className="timeline-intro reveal reveal-delay-2">Every project is a checkpoint. Every bug is a better question waiting to be asked.</p>
          </div>
          <div className="timeline reveal reveal-delay-2" data-testid="list-education">
            <div className="timeline-item">
              <div className="timeline-year">2026 / NOW</div>
              <div><h3>Class 12 — GMSSS School, Pundri</h3><p>Building a stronger programming foundation while preparing for the next step.</p></div>
            </div>
            <div className="timeline-item">
              <div className="timeline-year">2024</div>
              <div><h3>Class 10 — Saraswati Sr. Sec. School, Dulyani</h3><p>The beginning of a direction that keeps getting clearer.</p></div>
            </div>
            <div className="timeline-item">
              <div className="timeline-year">NEXT</div>
              <div><h3>Entry-level opportunity or internship</h3><p>Ready to contribute, learn in a team, and turn practice into production habits.</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section principles-section">
        <div className="section-inner">
          <div className="section-label reveal">05 / Working principles</div>
          <h2 className="section-title reveal reveal-delay-1">Stay curious.<br />Make it <span className="highlight">work.</span></h2>
          <div className="principles-list">
            <article className="principle reveal reveal-delay-1">
              <span className="principle-index">01</span><h3>Think in systems</h3><p>Break a problem down until the next useful step is obvious.</p>
            </article>
            <article className="principle reveal reveal-delay-2">
              <span className="principle-index">02</span><h3>Learn by shipping</h3><p>A working experiment teaches more than a perfect plan.</p>
            </article>
            <article className="principle reveal reveal-delay-3">
              <span className="principle-index">03</span><h3>Keep adapting</h3><p>New tools, new teammates, new constraints — stay ready for all three.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="section contact-section" id="contact">
        <div className="section-inner contact-grid">
          <div>
            <div className="section-label reveal">06 / Say hello</div>
            <h2 className="contact-title reveal reveal-delay-1">Let's build<br /><em>what's next.</em></h2>
          </div>
          <div className="contact-aside reveal reveal-delay-2">
            <p>For an internship, a first opportunity, or a good conversation about software, reach out directly.</p>
            <div className="contact-details">
              <a href="mailto:dhimankrish10@gmail.com" data-testid="link-email"><Mail size={14} /> dhimankrish10@gmail.com</a>
              <a href="tel:+919306091154" data-testid="link-phone"><Phone size={14} /> +91 93060 91154</a>
              <a href="https://github.com/KRRISH972" target="_blank" rel="noreferrer" data-testid="link-github-contact"><Github size={14} /> github.com/KRRISH972</a>
            </div>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <span>Krish / aspiring software developer</span>
        <span>Pundri, Haryana / made with momentum</span>
      </footer>
    </main>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
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