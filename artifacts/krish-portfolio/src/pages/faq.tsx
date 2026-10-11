import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { FAQSection } from "@/components/faq-section";
import { formatPostDate, readingMinutes, type BlogPost } from "@/data/blog";
import { usePublishedPosts, useSiteSettings } from "@/data/live";
import { faqPageMeta } from "@/seo/meta";
import { useSeo } from "@/seo/use-seo";

export default function FAQPage() {
  const settings = useSiteSettings();

  useSeo(faqPageMeta(settings));

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Global reveal observer for all .reveal elements on this page (hero, FAQ items, etc.)
  // Includes MutationObserver to catch dynamically added .reveal elements (e.g., from lazy-loaded FAQSection)
  useEffect(() => {
    const observeReveals = () => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>(".reveal:not(.is-visible)"));
      nodes.forEach((node) => revealObserver.observe(node));
    };

    const revealObserver = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        }),
      { threshold: 0.14, rootMargin: "0px 0px -35px" }
    );

    // Initial observation
    observeReveals();

    // MutationObserver to catch dynamically added .reveal elements (e.g., from lazy-loaded components)
    const mutationObserver = new MutationObserver((mutations) => {
      let shouldReobserve = false;
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          for (const node of mutation.addedNodes) {
            if (node instanceof HTMLElement) {
              if (node.matches(".reveal:not(.is-visible)") || node.querySelector(".reveal:not(.is-visible)")) {
                shouldReobserve = true;
                break;
              }
            }
          }
        }
      }
      if (shouldReobserve) {
        observeReveals();
      }
    });

    mutationObserver.observe(document.body, { childList: true, subtree: true });

    // Also observe on scroll to catch any missed elements
    const onScroll = () => observeReveals();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      revealObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <main className="site-shell faq-page">
      <SiteNav onBlog={false} />

      <header className="faq-hero">
        <div className="section-inner">
          <div className="faq-hero-content reveal">
            <span className="about-label">Questions</span>
            <h1 className="faq-hero-title">
              Frequently Asked
              <br />
              <span className="highlight">Questions</span>
            </h1>
            <p className="faq-hero-desc">
              Quick answers to the questions I get most often about my work, tools,
              availability, and how I build things.
            </p>
            <Link href="/#contact" className="btn-primary">
              Still have questions? Get in touch <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      <FAQSection />

      <SiteFooter />
    </main>
  );
}