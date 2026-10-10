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