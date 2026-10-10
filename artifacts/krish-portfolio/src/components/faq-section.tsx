import { ChevronDown, HelpCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { faqs, type FAQ } from "@/data/faqs";

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleFAQ(index);
    }
  };

  return (
    <section className="section faq-section" id="faq" aria-labelledby="faq-heading">
      <div className="section-inner">
        <div className="section-label reveal">07 / Questions</div>
        <h2 id="faq-heading" className="section-title reveal reveal-delay-1">
          Frequently Asked
          <br />
          <span className="highlight">Questions</span>
        </h2>

        <div className="faq-grid" data-testid="list-faqs">
          {faqs.map((faq, index) => (
            <FAQItem
              key={faq.id}
              faq={faq}
              index={index}
              isOpen={openIndex === index}
              onToggle={() => toggleFAQ(index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQItem({
  faq,
  index,
  isOpen,
  onToggle,
  onKeyDown,
}: {
  faq: FAQ;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  return (
    <article
      className={`faq-item reveal${isOpen ? " is-open" : ""}`}
      style={{ transitionDelay: `${0.1 + index * 0.08}s` }}
    >
      <button
        type="button"
        className="faq-question"
        aria-expanded={isOpen}
        aria-controls={`faq-answer-${faq.id}`}
        id={`faq-question-${faq.id}`}
        onClick={onToggle}
        onKeyDown={onKeyDown}
      >
        <span className="faq-icon-wrapper">
          <HelpCircle size={20} className="faq-icon" aria-hidden="true" />
          <ChevronDown
            size={20}
            className={`faq-chevron ${isOpen ? "rotated" : ""}`}
            aria-hidden="true"
          />
        </span>
        <span className="faq-question-text">{faq.question}</span>
      </button>
      <div
        id={`faq-answer-${faq.id}`}
        role="region"
        aria-labelledby={`faq-question-${faq.id}`}
        className="faq-answer"
        hidden={!isOpen}
      >
        <div className="faq-answer-inner">
          <p className="faq-answer-text">{faq.answer}</p>
        </div>
      </div>
    </article>
  );
}